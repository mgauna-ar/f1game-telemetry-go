package api

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// ProgressionResponse contains lap-by-lap pace evolution, position changes, and gaps to the leader.
type ProgressionResponse struct {
	LapPace          []map[string]any        `json:"lap_pace"`
	Positions        []map[string]any        `json:"positions"`
	GapToLeader      []map[string]any        `json:"gap_to_leader"`
	Drivers          []ProgressionDriverMeta `json:"drivers"`
	TotalSessionLaps int                     `json:"total_session_laps"`
}

// ProgressionDriverMeta contains identity and styling metadata for driver series on charts.
type ProgressionDriverMeta struct {
	CarIndex   int    `json:"car_index"`
	DriverName string `json:"driver_name"`
	RaceNumber int    `json:"race_number"`
	TeamID     int    `json:"team_id"`
	TeamColor  string `json:"team_color"`
}

// computeSessionProgression executes server-side progression matrix calculation for a session.
func computeSessionProgression(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *ProgressionResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by CarIndex
	lapsByCar := make(map[int][]storage.Lap)
	totalSessionLaps := 0
	for _, l := range laps {
		storage.DeriveSector3(&l)
		lapsByCar[l.CarIndex] = append(lapsByCar[l.CarIndex], l)
		if l.LapTimeMS > 0 && l.LapNumber > totalSessionLaps {
			totalSessionLaps = l.LapNumber
		}
	}
	if totalSessionLaps == 0 && session != nil && session.TotalLaps > 0 {
		totalSessionLaps = session.TotalLaps
	}

	for carIdx := range lapsByCar {
		sort.SliceStable(lapsByCar[carIdx], func(i, j int) bool {
			return lapsByCar[carIdx][i].LapNumber < lapsByCar[carIdx][j].LapNumber
		})
	}

	// 2. Prepare participants list
	effectiveParticipants := participants
	if len(effectiveParticipants) == 0 {
		for carIdx := range lapsByCar {
			effectiveParticipants = append(effectiveParticipants, storage.Participant{
				SessionID:    session.ID,
				CarIndex:     carIdx,
				Name:         fmt.Sprintf("Driver %d", carIdx+1),
				RaceNumber:   carIdx + 1,
				DriverID:     carIdx + 1,
				TeamID:       0,
				AIControlled: false,
			})
		}
		sort.Slice(effectiveParticipants, func(i, j int) bool {
			return effectiveParticipants[i].CarIndex < effectiveParticipants[j].CarIndex
		})
	}

	var activeParticipants []storage.Participant
	for _, p := range effectiveParticipants {
		if isHistoricalParticipantActive(&p, lapsByCar[p.CarIndex], isRaceSession) {
			activeParticipants = append(activeParticipants, p)
		}
	}

	// 3. Check for dynamic position changes in recorded data
	hasDynamicCarPositions := false
	for _, p := range activeParticipants {
		var positions []int
		for _, l := range lapsByCar[p.CarIndex] {
			if l.CarPosition > 0 {
				positions = append(positions, l.CarPosition)
			}
		}
		if len(positions) > 1 {
			first := positions[0]
			for _, pos := range positions[1:] {
				if pos != first {
					hasDynamicCarPositions = true
					break
				}
			}
		}
		if hasDynamicCarPositions {
			break
		}
	}

	// 4. Build Lap Pace Matrix
	lapPace := make([]map[string]any, 0, totalSessionLaps)
	for lapNum := 1; lapNum <= totalSessionLaps; lapNum++ {
		point := map[string]any{"lapNumber": lapNum}
		for _, p := range activeParticipants {
			carIdx := p.CarIndex
			for _, l := range lapsByCar[carIdx] {
				if l.LapNumber != lapNum || l.LapTimeMS <= 0 {
					continue
				}
				sec := math.Round(float64(l.LapTimeMS)/10.0) / 100.0
				point[fmt.Sprintf("driver_%d", carIdx)] = sec
				point[fmt.Sprintf("driver_%d_tyre", carIdx)] = l.TyreCompound
				point[fmt.Sprintf("driver_%d_rawMS", carIdx)] = l.LapTimeMS
				break
			}
		}
		lapPace = append(lapPace, point)
	}

	// 5. Build Position Progression Matrix
	positions := make([]map[string]any, 0, totalSessionLaps)
	for lapNum := 1; lapNum <= totalSessionLaps; lapNum++ {
		point := map[string]any{"lapNumber": lapNum}

		if isRaceSession {
			type driverAtLap struct {
				carIdx       int
				cumulativeMS int64
				directPos    int
				gridPos      int
			}
			var activeDriversAtLap []driverAtLap

			for _, p := range activeParticipants {
				carIdx := p.CarIndex
				var cumulative int64
				hasCurrentLap := false
				directPos := 0

				for _, l := range lapsByCar[carIdx] {
					if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
						cumulative += int64(l.LapTimeMS)
					}
					if l.LapNumber == lapNum && l.LapTimeMS > 0 {
						hasCurrentLap = true
						directPos = l.CarPosition
					}
				}

				if hasCurrentLap {
					gridPos := p.GridPosition
					if gridPos == 0 {
						gridPos = p.Position
					}
					if gridPos == 0 {
						gridPos = carIdx + 1
					}
					activeDriversAtLap = append(activeDriversAtLap, driverAtLap{
						carIdx:       carIdx,
						cumulativeMS: cumulative,
						directPos:    directPos,
						gridPos:      gridPos,
					})
				}
			}

			sort.SliceStable(activeDriversAtLap, func(i, j int) bool {
				a := activeDriversAtLap[i]
				b := activeDriversAtLap[j]
				if hasDynamicCarPositions && a.directPos > 0 && b.directPos > 0 && a.directPos != b.directPos {
					return a.directPos < b.directPos
				}
				if a.cumulativeMS != b.cumulativeMS {
					return a.cumulativeMS < b.cumulativeMS
				}
				return a.gridPos < b.gridPos
			})

			for idx, item := range activeDriversAtLap {
				posVal := idx + 1
				if hasDynamicCarPositions && item.directPos > 0 {
					posVal = item.directPos
				}
				point[fmt.Sprintf("driver_%d", item.carIdx)] = posVal
			}
		} else {
			// Qualifying / Practice: order by best valid lap time set up to lapNum
			type qualyDriverAtLap struct {
				carIdx     int
				bestTimeMS int
				gridPos    int
			}
			var qualyDrivers []qualyDriverAtLap

			for _, p := range activeParticipants {
				carIdx := p.CarIndex
				bestTimeMS := 0
				hasLapsUpTo := false

				for _, l := range lapsByCar[carIdx] {
					if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
						hasLapsUpTo = true
						if l.IsValid && (bestTimeMS == 0 || l.LapTimeMS < bestTimeMS) {
							bestTimeMS = l.LapTimeMS
						}
					}
				}
				if bestTimeMS == 0 && hasLapsUpTo {
					// Fallback to non-valid completed lap
					for _, l := range lapsByCar[carIdx] {
						if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
							if bestTimeMS == 0 || l.LapTimeMS < bestTimeMS {
								bestTimeMS = l.LapTimeMS
							}
						}
					}
				}

				if hasLapsUpTo && bestTimeMS > 0 {
					gridPos := p.GridPosition
					if gridPos == 0 {
						gridPos = carIdx + 1
					}
					qualyDrivers = append(qualyDrivers, qualyDriverAtLap{
						carIdx:     carIdx,
						bestTimeMS: bestTimeMS,
						gridPos:    gridPos,
					})
				}
			}

			sort.SliceStable(qualyDrivers, func(i, j int) bool {
				if qualyDrivers[i].bestTimeMS != qualyDrivers[j].bestTimeMS {
					return qualyDrivers[i].bestTimeMS < qualyDrivers[j].bestTimeMS
				}
				return qualyDrivers[i].gridPos < qualyDrivers[j].gridPos
			})

			for idx, item := range qualyDrivers {
				point[fmt.Sprintf("driver_%d", item.carIdx)] = idx + 1
			}
		}

		positions = append(positions, point)
	}

	// 6. Build Gap to Leader Matrix
	gapToLeader := make([]map[string]any, 0, totalSessionLaps)
	for lapNum := 1; lapNum <= totalSessionLaps; lapNum++ {
		point := map[string]any{"lapNumber": lapNum}

		if isRaceSession {
			type raceCumEntry struct {
				carIdx       int
				cumulativeMS int64
			}
			var completedDrivers []raceCumEntry

			for _, p := range activeParticipants {
				carIdx := p.CarIndex
				var cumulative int64
				completedCount := 0
				hasCurrentLap := false

				for _, l := range lapsByCar[carIdx] {
					if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
						cumulative += int64(l.LapTimeMS)
						completedCount++
					}
					if l.LapNumber == lapNum && l.LapTimeMS > 0 {
						hasCurrentLap = true
					}
				}

				if hasCurrentLap && completedCount == lapNum {
					completedDrivers = append(completedDrivers, raceCumEntry{
						carIdx:       carIdx,
						cumulativeMS: cumulative,
					})
				}
			}

			if len(completedDrivers) > 0 {
				leaderCumMS := completedDrivers[0].cumulativeMS
				for _, d := range completedDrivers[1:] {
					if d.cumulativeMS < leaderCumMS {
						leaderCumMS = d.cumulativeMS
					}
				}
				for _, d := range completedDrivers {
					gapSec := math.Max(0, float64(d.cumulativeMS-leaderCumMS)/1000.0)
					point[fmt.Sprintf("driver_%d", d.carIdx)] = math.Round(gapSec*1000.0) / 1000.0
				}
			}
		} else {
			type qualyGapEntry struct {
				carIdx     int
				bestTimeMS int
			}
			var qualyDrivers []qualyGapEntry

			for _, p := range activeParticipants {
				carIdx := p.CarIndex
				bestTimeMS := 0

				for _, l := range lapsByCar[carIdx] {
					if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
						if l.IsValid && (bestTimeMS == 0 || l.LapTimeMS < bestTimeMS) {
							bestTimeMS = l.LapTimeMS
						}
					}
				}
				if bestTimeMS == 0 {
					for _, l := range lapsByCar[carIdx] {
						if l.LapNumber <= lapNum && l.LapTimeMS > 0 {
							if bestTimeMS == 0 || l.LapTimeMS < bestTimeMS {
								bestTimeMS = l.LapTimeMS
							}
						}
					}
				}

				if bestTimeMS > 0 {
					qualyDrivers = append(qualyDrivers, qualyGapEntry{
						carIdx:     carIdx,
						bestTimeMS: bestTimeMS,
					})
				}
			}

			if len(qualyDrivers) > 0 {
				leaderBestMS := qualyDrivers[0].bestTimeMS
				for _, d := range qualyDrivers[1:] {
					if d.bestTimeMS < leaderBestMS {
						leaderBestMS = d.bestTimeMS
					}
				}
				for _, d := range qualyDrivers {
					gapSec := math.Max(0, float64(d.bestTimeMS-leaderBestMS)/1000.0)
					point[fmt.Sprintf("driver_%d", d.carIdx)] = math.Round(gapSec*1000.0) / 1000.0
				}
			}
		}

		gapToLeader = append(gapToLeader, point)
	}

	// 7. Drivers Metadata
	drivers := make([]ProgressionDriverMeta, 0, len(activeParticipants))
	for _, p := range activeParticipants {
		name := p.Name
		if strings.TrimSpace(name) == "" {
			name = packets.DriverName(uint16(p.DriverID))
		}
		color := packets.TeamColor(uint16(p.TeamID))
		drivers = append(drivers, ProgressionDriverMeta{
			CarIndex:   p.CarIndex,
			DriverName: name,
			RaceNumber: p.RaceNumber,
			TeamID:     p.TeamID,
			TeamColor:  color,
		})
	}

	return &ProgressionResponse{
		LapPace:          lapPace,
		Positions:        positions,
		GapToLeader:      gapToLeader,
		Drivers:          drivers,
		TotalSessionLaps: totalSessionLaps,
	}
}

// handleGetSessionProgression serves GET /api/sessions/{id}/progression
func (s *Server) handleGetSessionProgression(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		participants = []storage.Participant{}
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		laps = []storage.Lap{}
	}

	resp := computeSessionProgression(session, participants, laps)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
