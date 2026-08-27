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

type degRegressionPoint struct {
	age     float64
	timeSec float64
}

// calculateDegradationSlope computes the Ordinary Least Squares (OLS) linear regression slope.
// slope = (N * sum(XY) - sum(X) * sum(Y)) / (N * sum(X^2) - (sum(X))^2)
func calculateDegradationSlope(points []degRegressionPoint) *float64 {
	n := float64(len(points))
	if n < 3 {
		return nil
	}
	var sumX, sumY, sumXY, sumXX float64
	for _, pt := range points {
		sumX += pt.age
		sumY += pt.timeSec
		sumXY += pt.age * pt.timeSec
		sumXX += pt.age * pt.age
	}
	denom := n*sumXX - sumX*sumX
	if denom == 0 {
		return nil
	}
	slope := (n*sumXY - sumX*sumY) / denom
	rounded := math.Round(slope*1000.0) / 1000.0
	return &rounded
}

// computeSessionStints executes server-side stint strategy analysis, partitioning, OLS regression, and KPIs.
func computeSessionStints(session *storage.Session, participants []storage.Participant, laps []storage.Lap) *StintsResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by CarIndex
	lapsByCar := make(map[int][]storage.Lap)
	for _, l := range laps {
		storage.DeriveSector3(&l)
		lapsByCar[l.CarIndex] = append(lapsByCar[l.CarIndex], l)
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
		var rawStints []*DriverStint
		var currentStint *DriverStint

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

			if l.LapNumber > effectiveMaxLaps {
				effectiveMaxLaps = l.LapNumber
			}
		}

		// Calculate timing stats and regression for each stint
		finalStints := make([]DriverStint, len(rawStints))
		for sIdx, s := range rawStints {
			var validLaps []storage.Lap
			var degPoints []degRegressionPoint

			for lapIndexInStint, l := range s.Laps {
				if l.LapTimeMS > 0 {
					validLaps = append(validLaps, l)
					sec := float64(l.LapTimeMS) / 1000.0
					degPoints = append(degPoints, degRegressionPoint{
						age:     float64(lapIndexInStint + 1),
						timeSec: sec,
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
			s.DegSlopeSecPerLap = calculateDegradationSlope(degPoints)
			finalStints[sIdx] = *s
		}

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

		driverStintsData = append(driverStintsData, DriverStintData{
			CarIndex:       p.CarIndex,
			DriverName:     driverName,
			RaceNumber:     p.RaceNumber,
			TeamID:         p.TeamID,
			Position:       pos,
			StrategyString: strategyString,
			TotalStints:    len(finalStints),
			TotalPits:      totalPits,
			Stints:         finalStints,
		})
	}

	// 4. Compute Strategy KPIs
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

	kpis := StintKPIs{
		MostPopularStrategy: mostPopularStrategy,
		MostPopularCount:    mostPopularCount,
		LongestStint:        longestStint,
		BestLapsByCompound:  bestLapsByCompound,
		TotalFieldPitStops:  totalFieldPitStops,
	}

	// 5. Build Degradation Data Matrix by Tyre Age
	globalMaxAge := 0
	ageDataMap := make(map[int]map[string]any)
	rates := make(map[string]*float64)

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

	degradationData := make([]map[string]any, 0, globalMaxAge)
	for age := 1; age <= globalMaxAge; age++ {
		if pt, ok := ageDataMap[age]; ok {
			degradationData = append(degradationData, pt)
		} else {
			degradationData = append(degradationData, map[string]any{"tyreAge": age})
		}
	}

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

// handleGetSessionStints serves GET /api/sessions/{id}/stints
func (s *Server) handleGetSessionStints(w http.ResponseWriter, r *http.Request) {
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

	resp := computeSessionStints(session, participants, laps)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
