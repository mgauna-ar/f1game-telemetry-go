package analytics

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// StintsResponse contains complete stint partitions, degradation models, and strategy metrics for a session.
type StintsResponse struct {
	Drivers          []DriverStintData   `json:"drivers"`
	KPIs             StintKPIs           `json:"kpis"`
	DegradationData  []map[string]any    `json:"degradation_data"`
	MaxTyreAge       int                 `json:"max_tyre_age"`
	DegradationRates map[string]*float64 `json:"degradation_rates"`
	SessionCompounds []string            `json:"session_compounds"`
	EffectiveMaxLaps int                 `json:"effective_max_laps"`
}

// DriverStintData encapsulates all stints and strategy summary for a single driver.
type DriverStintData struct {
	CarIndex       int           `json:"car_index"`
	DriverName     string        `json:"driver_name"`
	RaceNumber     int           `json:"race_number"`
	TeamID         int           `json:"team_id"`
	Position       int           `json:"position"`
	StrategyString string        `json:"strategy_string"`
	TotalStints    int           `json:"total_stints"`
	TotalPits      int           `json:"total_pits"`
	Stints         []DriverStint `json:"stints"`
}

// DriverStint represents a single contiguous tyre stint for a driver.
type DriverStint struct {
	StintIndex        int           `json:"stint_index"`
	StintID           int           `json:"stint_id"`
	Compound          string        `json:"compound"`
	ActualCompound    string        `json:"actual_compound,omitempty"`
	StartLap          int           `json:"start_lap"`
	EndLap            int           `json:"end_lap"`
	TotalLaps         int           `json:"total_laps"`
	AvgLapTimeMS      int           `json:"avg_lap_time_ms"`
	BestLapTimeMS     int           `json:"best_lap_time_ms"`
	HasPitStopAfter   bool          `json:"has_pit_stop_after"`
	DegSlopeSecPerLap *float64      `json:"deg_slope_sec_per_lap"`
	Laps              []storage.Lap `json:"laps"`
}

// StintLongestSummary stores information about the longest stint recorded in the session.
type StintLongestSummary struct {
	DriverName string `json:"driver_name"`
	CarIndex   int    `json:"car_index"`
	RaceNumber int    `json:"race_number"`
	Compound   string `json:"compound"`
	TotalLaps  int    `json:"total_laps"`
}

// CompoundBestLap stores the best valid lap time recorded on a specific tyre compound.
type CompoundBestLap struct {
	TimeMS     int    `json:"time_ms"`
	DriverName string `json:"driver_name"`
	CarIndex   int    `json:"car_index"`
}

// StintKPIs summarizes high-level strategy key performance indicators across the grid.
type StintKPIs struct {
	MostPopularStrategy string                     `json:"most_popular_strategy"`
	MostPopularCount    int                        `json:"most_popular_count"`
	LongestStint        *StintLongestSummary       `json:"longest_stint,omitempty"`
	BestLapsByCompound  map[string]CompoundBestLap `json:"best_laps_by_compound"`
	TotalFieldPitStops  int                        `json:"total_field_pit_stops"`
}

// partitionDriverStints partitions contiguous laps of a single driver into distinct tyre stints.
func partitionDriverStints(driverLaps []storage.Lap, usedCompoundsSet map[string]bool) (stints []DriverStint, maxDriverLap int) {
	var rawStints []*DriverStint
	var currentStint *DriverStint
	maxDriverLap = 0

	for _, l := range driverLaps {
		rawComp := strings.TrimSpace(l.TyreCompound)
		if rawComp == "" {
			rawComp = packets.CompoundNameUnknown
		}
		normComp := packets.NormalizeCompoundName(rawComp)
		if normComp != packets.CompoundNameUnknown {
			usedCompoundsSet[normComp] = true
		}
		lapStintID := l.Stint

		isNewStint := currentStint == nil ||
			(lapStintID > 0 && currentStint.StintID > 0 && lapStintID != currentStint.StintID) ||
			currentStint.Compound != normComp

		if isNewStint {
			if currentStint != nil {
				currentStint.HasPitStopAfter = true
			}
			currentStint = &DriverStint{
				StintIndex:      len(rawStints) + 1,
				StintID:         lapStintID,
				Compound:        normComp,
				ActualCompound:  l.ActualCompound,
				StartLap:        l.LapNumber,
				EndLap:          l.LapNumber,
				TotalLaps:       1,
				HasPitStopAfter: false,
				Laps:            []storage.Lap{l},
			}
			rawStints = append(rawStints, currentStint)
		} else {
			currentStint.EndLap = l.LapNumber
			currentStint.TotalLaps++
			currentStint.Laps = append(currentStint.Laps, l)
			if currentStint.ActualCompound == "" && l.ActualCompound != "" {
				currentStint.ActualCompound = l.ActualCompound
			}
		}

		if l.LapNumber > maxDriverLap {
			maxDriverLap = l.LapNumber
		}
	}

	finalStints := make([]DriverStint, len(rawStints))
	for sIdx, s := range rawStints {
		var validLaps []storage.Lap
		var degPoints []DegRegressionPoint

		for lapIndexInStint, l := range s.Laps {
			if l.LapTimeMS > 0 {
				validLaps = append(validLaps, l)
				sec := float64(l.LapTimeMS) / 1000.0
				degPoints = append(degPoints, DegRegressionPoint{
					Age:     float64(lapIndexInStint + 1),
					TimeSec: sec,
				})
			}
		}

		if len(validLaps) > 0 {
			sum := int64(0)
			best := validLaps[0].LapTimeMS
			for _, l := range validLaps {
				sum += int64(l.LapTimeMS)
				if l.LapTimeMS < best {
					best = l.LapTimeMS
				}
			}
			s.AvgLapTimeMS = int(sum / int64(len(validLaps)))
			s.BestLapTimeMS = best
		}
		s.DegSlopeSecPerLap = CalculateDegradationSlope(degPoints)
		finalStints[sIdx] = *s
	}

	return finalStints, maxDriverLap
}

// buildDriverStintData constructs DriverStintData for a driver including strategy string.
func buildDriverStintData(p storage.Participant, pIdx int, driverLaps []storage.Lap, usedCompoundsSet map[string]bool) (data DriverStintData, maxLap int) {
	finalStints, maxLap := partitionDriverStints(driverLaps, usedCompoundsSet)

	strategyString := "N/A"
	if len(finalStints) > 0 {
		parts := make([]string, len(finalStints))
		for i, s := range finalStints {
			compInitial := "?"
			if s.Compound != "" {
				compInitial = string(s.Compound[0])
			}
			parts[i] = fmt.Sprintf("%s (%dL)", compInitial, s.TotalLaps)
		}
		strategyString = strings.Join(parts, " ➔ ")
	}

	totalPits := len(finalStints) - 1
	if totalPits < 0 {
		totalPits = 0
	}

	driverName := p.Name
	if strings.TrimSpace(driverName) == "" {
		driverName = packets.DriverName(uint16(p.DriverID))
	}

	pos := p.Position
	if pos == 0 {
		pos = pIdx + 1
	}

	return DriverStintData{
		CarIndex:       p.CarIndex,
		DriverName:     driverName,
		RaceNumber:     p.RaceNumber,
		TeamID:         p.TeamID,
		Position:       pos,
		StrategyString: strategyString,
		TotalStints:    len(finalStints),
		TotalPits:      totalPits,
		Stints:         finalStints,
	}, maxLap
}

// buildStrategyKPIs calculates session-wide strategy KPIs including most popular strategy and compound records.
func buildStrategyKPIs(driverStintsData []DriverStintData) StintKPIs {
	strategyCounts := make(map[string]int)
	totalFieldPitStops := 0
	bestLapsByCompound := make(map[string]CompoundBestLap)
	var longestStint *StintLongestSummary

	for _, d := range driverStintsData {
		totalFieldPitStops += d.TotalPits
		if len(d.Stints) > 0 {
			patternParts := make([]string, len(d.Stints))
			for i, s := range d.Stints {
				compInitial := "?"
				if s.Compound != "" {
					compInitial = string(s.Compound[0])
				}
				patternParts[i] = compInitial
			}
			pattern := strings.Join(patternParts, " ➔ ")
			strategyCounts[pattern]++

			for _, s := range d.Stints {
				if longestStint == nil || s.TotalLaps > longestStint.TotalLaps {
					longestStint = &StintLongestSummary{
						DriverName: d.DriverName,
						CarIndex:   d.CarIndex,
						RaceNumber: d.RaceNumber,
						Compound:   s.Compound,
						TotalLaps:  s.TotalLaps,
					}
				}

				for _, l := range s.Laps {
					if l.LapTimeMS > 0 && l.IsValid {
						existing, exists := bestLapsByCompound[s.Compound]
						if !exists || l.LapTimeMS < existing.TimeMS {
							bestLapsByCompound[s.Compound] = CompoundBestLap{
								TimeMS:     l.LapTimeMS,
								DriverName: d.DriverName,
								CarIndex:   d.CarIndex,
							}
						}
					}
				}
			}
		}
	}

	mostPopularStrategy := "N/A"
	mostPopularCount := 0
	for strategyKey, count := range strategyCounts {
		if count > mostPopularCount {
			mostPopularStrategy = strategyKey
			mostPopularCount = count
		}
	}

	return StintKPIs{
		MostPopularStrategy: mostPopularStrategy,
		MostPopularCount:    mostPopularCount,
		LongestStint:        longestStint,
		BestLapsByCompound:  bestLapsByCompound,
		TotalFieldPitStops:  totalFieldPitStops,
	}
}

// buildDegradationData produces a tyre degradation matrix indexed by tyre age and stint regression slopes.
func buildDegradationData(driverStintsData []DriverStintData) (degradationData []map[string]any, rates map[string]*float64, globalMaxAge int) {
	globalMaxAge = 0
	ageDataMap := make(map[int]map[string]any)
	rates = make(map[string]*float64)

	for _, d := range driverStintsData {
		carIdx := d.CarIndex
		for _, stint := range d.Stints {
			key := fmt.Sprintf("driver_%d_stint_%d", carIdx, stint.StintIndex)
			rates[key] = stint.DegSlopeSecPerLap

			for lapIndexInStint, lap := range stint.Laps {
				tyreAge := lapIndexInStint + 1
				if tyreAge > globalMaxAge {
					globalMaxAge = tyreAge
				}

				if lap.LapTimeMS > 0 {
					sec := math.Round(float64(lap.LapTimeMS)/10.0) / 100.0
					if ageDataMap[tyreAge] == nil {
						ageDataMap[tyreAge] = map[string]any{"tyreAge": tyreAge}
					}
					ageDataMap[tyreAge][key] = sec
					ageDataMap[tyreAge][key+"_compound"] = stint.Compound
					ageDataMap[tyreAge][key+"_rawMS"] = lap.LapTimeMS
					ageDataMap[tyreAge][key+"_lapNum"] = lap.LapNumber
				}
			}
		}
	}

	degradationData = make([]map[string]any, 0, globalMaxAge)
	for age := 1; age <= globalMaxAge; age++ {
		if pt, ok := ageDataMap[age]; ok {
			degradationData = append(degradationData, pt)
		} else {
			degradationData = append(degradationData, map[string]any{"tyreAge": age})
		}
	}

	return degradationData, rates, globalMaxAge
}

// ComputeSessionStints executes server-side stint strategy analysis, partitioning, OLS regression, and KPIs.
func ComputeSessionStints(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *StintsResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by car
	lapsByCar, _ := GroupLapsByCar(laps)

	// 2. Prepare active participants
	activeParticipants := BuildEffectiveParticipants(session, participants, lapsByCar, isRaceSession)

	// Sort active participants by standing / position
	sort.SliceStable(activeParticipants, func(i, j int) bool {
		posA := activeParticipants[i].Position
		posB := activeParticipants[j].Position
		if posA > 0 && posB > 0 && posA != posB {
			return posA < posB
		}
		if posA > 0 && posB == 0 {
			return true
		}
		if posA == 0 && posB > 0 {
			return false
		}
		return activeParticipants[i].CarIndex < activeParticipants[j].CarIndex
	})

	// 3. Partition Stints per Driver
	driverStintsData := make([]DriverStintData, 0, len(activeParticipants))
	effectiveMaxLaps := 1
	if session != nil && session.TotalLaps > 0 {
		effectiveMaxLaps = session.TotalLaps
	}
	usedCompoundsSet := make(map[string]bool)

	for pIdx, p := range activeParticipants {
		driverLaps := lapsByCar[p.CarIndex]
		driverStint, maxLap := buildDriverStintData(p, pIdx, driverLaps, usedCompoundsSet)
		driverStintsData = append(driverStintsData, driverStint)
		if maxLap > effectiveMaxLaps {
			effectiveMaxLaps = maxLap
		}
	}

	// 4. Compute Strategy KPIs
	kpis := buildStrategyKPIs(driverStintsData)

	// 5. Build Degradation Data Matrix by Tyre Age
	degradationData, rates, globalMaxAge := buildDegradationData(driverStintsData)

	sessionCompounds := make([]string, 0, len(usedCompoundsSet))
	for comp := range usedCompoundsSet {
		sessionCompounds = append(sessionCompounds, comp)
	}
	sort.Strings(sessionCompounds)

	return &StintsResponse{
		Drivers:          driverStintsData,
		KPIs:             kpis,
		DegradationData:  degradationData,
		MaxTyreAge:       globalMaxAge,
		DegradationRates: rates,
		SessionCompounds: sessionCompounds,
		EffectiveMaxLaps: effectiveMaxLaps,
	}
}
