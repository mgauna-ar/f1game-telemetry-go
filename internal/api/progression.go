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

// detectDynamicCarPositions checks if recorded laps contain real-time positions that changed during the session.
func detectDynamicCarPositions(activeParticipants []storage.Participant, lapsByCar map[int][]storage.Lap) bool {
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
					return true
				}
			}
		}
	}
	return false
}

// buildLapPaceMatrix generates the lap pace data point for every session lap across active drivers.
func buildLapPaceMatrix(totalSessionLaps int, activeParticipants []storage.Participant, lapsByCar map[int][]storage.Lap) []map[string]any {
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
	return lapPace
}

// buildPositionProgression calculates standing positions at each lap for race or qualifying sessions.
func buildPositionProgression(
	totalSessionLaps int,
	activeParticipants []storage.Participant,
	lapsByCar map[int][]storage.Lap,
	isRaceSession bool,
	hasDynamicCarPositions bool,
) []map[string]any {
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

	return positions
}

// buildGapToLeaderMatrix calculates the time delta (seconds) to the leader at each lap.
func buildGapToLeaderMatrix(
	totalSessionLaps int,
	activeParticipants []storage.Participant,
	lapsByCar map[int][]storage.Lap,
	isRaceSession bool,
) []map[string]any {
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

	return gapToLeader
}

// buildProgressionDriverMeta creates the driver identity and team color styling metadata array.
func buildProgressionDriverMeta(activeParticipants []storage.Participant) []ProgressionDriverMeta {
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
	return drivers
}

// computeSessionProgression executes server-side progression matrix calculation for a session.
func computeSessionProgression(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *ProgressionResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by car & determine total session laps
	lapsByCar, maxRecordedLap := groupLapsByCar(laps)
	totalSessionLaps := maxRecordedLap
	if totalSessionLaps == 0 && session != nil && session.TotalLaps > 0 {
		totalSessionLaps = session.TotalLaps
	}

	// 2. Prepare active participants
	activeParticipants := buildEffectiveParticipants(session, participants, lapsByCar, isRaceSession)

	// 3. Dynamic position detection
	hasDynamicCarPositions := detectDynamicCarPositions(activeParticipants, lapsByCar)

	// 4. Lap Pace Matrix
	lapPace := buildLapPaceMatrix(totalSessionLaps, activeParticipants, lapsByCar)

	// 5. Position Progression Matrix
	positions := buildPositionProgression(totalSessionLaps, activeParticipants, lapsByCar, isRaceSession, hasDynamicCarPositions)

	// 6. Gap to Leader Matrix
	gapToLeader := buildGapToLeaderMatrix(totalSessionLaps, activeParticipants, lapsByCar, isRaceSession)

	// 7. Drivers Metadata
	drivers := buildProgressionDriverMeta(activeParticipants)

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
