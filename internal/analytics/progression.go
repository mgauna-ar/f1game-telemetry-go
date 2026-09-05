package analytics

import (
	"fmt"
	"math"
	"sort"
	"strings"

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

type driverLapOutlierInfo struct {
	isOutlier     bool
	outlierReason string // "pit_in", "pit_out", "slow"
}

// analyzeDriverLapOutliers identifies in-laps, out-laps (stint boundaries), and slow laps (>107% pace).
func analyzeDriverLapOutliers(laps []storage.Lap) map[int]driverLapOutlierInfo {
	outliers := make(map[int]driverLapOutlierInfo)
	if len(laps) == 0 {
		return outliers
	}

	sortedLaps := make([]storage.Lap, len(laps))
	copy(sortedLaps, laps)
	sort.Slice(sortedLaps, func(i, j int) bool {
		return sortedLaps[i].LapNumber < sortedLaps[j].LapNumber
	})

	// 1. Identify stint boundaries (in-lap and out-lap)
	for i := 0; i < len(sortedLaps)-1; i++ {
		curr := sortedLaps[i]
		next := sortedLaps[i+1]

		currStint := curr.Stint
		nextStint := next.Stint
		currComp := packets.NormalizeCompoundName(curr.TyreCompound)
		nextComp := packets.NormalizeCompoundName(next.TyreCompound)

		stintChanged := (currStint > 0 && nextStint > 0 && currStint != nextStint) ||
			(currComp != packets.CompoundNameUnknown && nextComp != packets.CompoundNameUnknown && currComp != nextComp)

		if stintChanged {
			outliers[curr.LapNumber] = driverLapOutlierInfo{isOutlier: true, outlierReason: "pit_in"}
			if _, exists := outliers[next.LapNumber]; !exists {
				outliers[next.LapNumber] = driverLapOutlierInfo{isOutlier: true, outlierReason: "pit_out"}
			}
		}
	}

	// 2. Calculate competitive pace baseline (median of valid non-pit laps)
	var candidateTimes []int
	for _, l := range sortedLaps {
		if l.LapTimeMS <= 0 {
			continue
		}
		if _, isOutlier := outliers[l.LapNumber]; !isOutlier {
			if l.IsValid {
				candidateTimes = append(candidateTimes, l.LapTimeMS)
			}
		}
	}
	if len(candidateTimes) == 0 {
		for _, l := range sortedLaps {
			if l.LapTimeMS > 0 {
				if _, isOutlier := outliers[l.LapNumber]; !isOutlier {
					candidateTimes = append(candidateTimes, l.LapTimeMS)
				}
			}
		}
	}
	if len(candidateTimes) == 0 {
		for _, l := range sortedLaps {
			if l.LapTimeMS > 0 {
				candidateTimes = append(candidateTimes, l.LapTimeMS)
			}
		}
	}

	if len(candidateTimes) > 0 {
		sort.Ints(candidateTimes)
		medianTime := candidateTimes[len(candidateTimes)/2]
		maxCompetitiveTime := int(float64(medianTime) * 1.07) // F1 107% standard cutoff

		for _, l := range sortedLaps {
			if l.LapTimeMS > maxCompetitiveTime {
				if existing, found := outliers[l.LapNumber]; found {
					outliers[l.LapNumber] = existing
				} else {
					outliers[l.LapNumber] = driverLapOutlierInfo{
						isOutlier:     true,
						outlierReason: "slow",
					}
				}
			}
		}
	}

	return outliers
}

// buildLapPaceMatrix generates the lap pace data point for every session lap across active drivers.
func buildLapPaceMatrix(totalSessionLaps int, activeParticipants []storage.Participant, lapsByCar map[int][]storage.Lap) []map[string]any {
	driverOutliers := make(map[int]map[int]driverLapOutlierInfo, len(activeParticipants))
	for _, p := range activeParticipants {
		driverOutliers[p.CarIndex] = analyzeDriverLapOutliers(lapsByCar[p.CarIndex])
	}

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

				outlierInfo := driverOutliers[carIdx][lapNum]
				point[fmt.Sprintf("driver_%d_is_outlier", carIdx)] = outlierInfo.isOutlier
				point[fmt.Sprintf("driver_%d_outlier_reason", carIdx)] = outlierInfo.outlierReason
				if !outlierInfo.isOutlier {
					point[fmt.Sprintf("driver_%d_pace_filtered", carIdx)] = sec
				}
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

// ComputeSessionProgression executes server-side progression matrix calculation for a session.
func ComputeSessionProgression(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *ProgressionResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by car & determine total session laps
	lapsByCar, maxRecordedLap := GroupLapsByCar(laps)
	totalSessionLaps := maxRecordedLap
	if totalSessionLaps == 0 && session != nil && session.TotalLaps > 0 {
		totalSessionLaps = session.TotalLaps
	}

	// 2. Prepare active participants
	activeParticipants := BuildEffectiveParticipants(session, participants, lapsByCar, isRaceSession)

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
