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
//
// Each degradation_data row has tyreAge plus keys built at runtime: driver_{carIndex}_stint_{index}
// holds the lap time in seconds of a lap the degradation fit uses; a lap it leaves out has its
// time under the same key with _excluded and the reason (a StintLapExclusion) with _reason. Both
// kinds carry _compound, _rawMS and _lapNum. The tstype tag describes that shape for the generated
// frontend types.
type StintsResponse struct {
	Drivers          []DriverStintData   `json:"drivers"`
	KPIs             StintKPIs           `json:"kpis"`
	DegradationData  []map[string]any    `json:"degradation_data" tstype:"DegradationRow[]"`
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
	StintIndex        int      `json:"stint_index"`
	StintID           int      `json:"stint_id"`
	Compound          string   `json:"compound"`
	ActualCompound    string   `json:"actual_compound,omitempty"`
	StartLap          int      `json:"start_lap"`
	EndLap            int      `json:"end_lap"`
	TotalLaps         int      `json:"total_laps"`
	AvgLapTimeMS      int      `json:"avg_lap_time_ms"`
	BestLapTimeMS     int      `json:"best_lap_time_ms"`
	HasPitStopAfter   bool     `json:"has_pit_stop_after"`
	DegSlopeSecPerLap *float64 `json:"deg_slope_sec_per_lap"`
	// FitLaps is how many laps the degradation slope and the average are taken from.
	FitLaps int `json:"fit_laps"`
	// ExcludedLaps are the timed laps left out of the fit, in lap order.
	ExcludedLaps []StintExcludedLap `json:"excluded_laps"`
	// Laps feed the KPIs and the degradation matrix; the client has them from the session detail.
	Laps []storage.Lap `json:"-"`
}

// StintLapExclusion says why a lap is left out of a stint's degradation fit.
type StintLapExclusion string

// The reasons a lap is left out of the degradation fit: the laps into and out of the pits, laps
// under the safety car or the virtual safety car, and laps slower than 107% of the stint's median
// (analyzeDriverLapOutliers applied to the stint's racing laps).
const (
	ExcludedPitIn  StintLapExclusion = "pit_in"
	ExcludedPitOut StintLapExclusion = "pit_out"
	ExcludedSC     StintLapExclusion = "sc"
	ExcludedVSC    StintLapExclusion = "vsc"
	ExcludedSlow   StintLapExclusion = "slow"
)

// StintExcludedLap is a timed lap left out of a stint's degradation fit.
type StintExcludedLap struct {
	LapNumber int               `json:"lap_number"`
	Reason    StintLapExclusion `json:"reason" tstype:"'pit_in' | 'pit_out' | 'sc' | 'vsc' | 'slow'"`
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

// partitionDriverStints partitions contiguous laps of a single driver into distinct tyre stints and
// fits each stint's degradation on its clean laps (see stintExclusions). neutralised maps the laps
// run under the safety car or the VSC to ExcludedSC or ExcludedVSC.
func partitionDriverStints(driverLaps []storage.Lap, usedCompoundsSet map[string]bool, neutralised map[int]StintLapExclusion) (stints []DriverStint, maxDriverLap int) {
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

	pitLaps := analyzeDriverLapOutliers(driverLaps)
	finalStints := make([]DriverStint, len(rawStints))
	for sIdx, s := range rawStints {
		excluded := stintExclusions(s.Laps, pitLaps, neutralised)
		var fitLaps []storage.Lap
		var degPoints []DegRegressionPoint
		best := 0
		s.ExcludedLaps = []StintExcludedLap{}
		for lapIndexInStint, l := range s.Laps {
			if l.LapTimeMS <= 0 {
				continue
			}
			if best == 0 || l.LapTimeMS < best {
				best = l.LapTimeMS
			}
			if reason, ok := excluded[l.LapNumber]; ok {
				s.ExcludedLaps = append(s.ExcludedLaps, StintExcludedLap{LapNumber: l.LapNumber, Reason: reason})
				continue
			}
			fitLaps = append(fitLaps, l)
			degPoints = append(degPoints, DegRegressionPoint{
				Age:     float64(lapIndexInStint + 1),
				TimeSec: float64(l.LapTimeMS) / 1000.0,
			})
		}

		s.BestLapTimeMS = best
		s.FitLaps = len(fitLaps)
		if len(fitLaps) > 0 {
			sum := int64(0)
			for _, l := range fitLaps {
				sum += int64(l.LapTimeMS)
			}
			s.AvgLapTimeMS = int(sum / int64(len(fitLaps)))
		}
		s.DegSlopeSecPerLap = CalculateDegradationSlope(degPoints)
		finalStints[sIdx] = *s
	}

	return finalStints, maxDriverLap
}

// stintExclusions picks the laps of a stint the degradation fit leaves out: the in and out laps
// (from analyzeDriverLapOutliers on the driver's whole race, in pitLaps), the laps under the
// safety car or the VSC, and then, from the laps left, those analyzeDriverLapOutliers finds slower
// than 107% of their median. Taking that median from the stint's own racing laps keeps a slower
// compound or a safety car period from moving it.
func stintExclusions(laps []storage.Lap, pitLaps map[int]driverLapOutlierInfo, neutralised map[int]StintLapExclusion) map[int]StintLapExclusion {
	excluded := make(map[int]StintLapExclusion)
	racing := make([]storage.Lap, 0, len(laps))
	for _, l := range laps {
		switch {
		case pitLaps[l.LapNumber].outlierReason == "pit_in":
			excluded[l.LapNumber] = ExcludedPitIn
		case pitLaps[l.LapNumber].outlierReason == "pit_out":
			excluded[l.LapNumber] = ExcludedPitOut
		case neutralised[l.LapNumber] != "":
			excluded[l.LapNumber] = neutralised[l.LapNumber]
		default:
			racing = append(racing, l)
		}
	}
	for lapNum, info := range analyzeDriverLapOutliers(racing) {
		if info.isOutlier {
			excluded[lapNum] = ExcludedSlow
		}
	}
	return excluded
}

// neutralisedLaps maps every lap inside a safety car or VSC period to its reason; a period still
// open at the end runs to lastLap. The periods are in the leader's laps, so for a lapped car they
// can be a lap early; the 107% rule catches its slow laps either way.
func neutralisedLaps(periods []RaceControlPeriod, lastLap int) map[int]StintLapExclusion {
	laps := make(map[int]StintLapExclusion)
	for _, p := range periods {
		reason := ExcludedSC
		if p.Kind == PeriodVirtualSafetyCar {
			reason = ExcludedVSC
		}
		end := p.EndLap
		if end == 0 {
			end = lastLap
		}
		for lap := p.StartLap; lap <= end; lap++ {
			// A full safety car wins over the VSC it followed on the lap they share
			if laps[lap] != ExcludedSC {
				laps[lap] = reason
			}
		}
	}
	return laps
}

// buildDriverStintData constructs DriverStintData for a driver including strategy string.
func buildDriverStintData(p storage.Participant, pIdx int, driverLaps []storage.Lap, usedCompoundsSet map[string]bool, neutralised map[int]StintLapExclusion) (data DriverStintData, maxLap int) {
	finalStints, maxLap := partitionDriverStints(driverLaps, usedCompoundsSet, neutralised)

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
	if pos == 0 && len(driverLaps) > 0 {
		for i := len(driverLaps) - 1; i >= 0; i-- {
			if driverLaps[i].CarPosition > 0 {
				pos = driverLaps[i].CarPosition
				break
			}
		}
	}
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
			reasons := make(map[int]StintLapExclusion, len(stint.ExcludedLaps))
			for _, e := range stint.ExcludedLaps {
				reasons[e.LapNumber] = e.Reason
			}

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
					if reason, ok := reasons[lap.LapNumber]; ok {
						ageDataMap[tyreAge][key+"_excluded"] = sec
						ageDataMap[tyreAge][key+"_reason"] = string(reason)
					} else {
						ageDataMap[tyreAge][key] = sec
					}
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
// The safety car and VSC periods (from the session's stored race-control events; none for older
// sessions) are left out of the degradation fits.
func ComputeSessionStints(session *storage.Session, participants []storage.Participant, laps []storage.Lap, periods []RaceControlPeriod) *StintsResponse {
	isRaceSession := session != nil && strings.Contains(strings.ToLower(session.SessionType), "race")

	// 1. Group laps by car
	lapsByCar, _ := GroupLapsByCar(laps)

	// 2. Prepare active participants
	activeParticipants := BuildEffectiveParticipants(session, participants, lapsByCar, isRaceSession)

	getEffectivePos := func(p storage.Participant) int {
		if p.Position > 0 {
			return p.Position
		}
		carLaps := lapsByCar[p.CarIndex]
		for i := len(carLaps) - 1; i >= 0; i-- {
			if carLaps[i].CarPosition > 0 {
				return carLaps[i].CarPosition
			}
		}
		return 0
	}

	// Sort active participants by standing / position
	sort.SliceStable(activeParticipants, func(i, j int) bool {
		posA := getEffectivePos(activeParticipants[i])
		posB := getEffectivePos(activeParticipants[j])
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
	lastLap := 0
	for _, l := range laps {
		lastLap = max(lastLap, l.LapNumber)
	}
	neutralised := neutralisedLaps(periods, lastLap)

	for pIdx, p := range activeParticipants {
		driverLaps := lapsByCar[p.CarIndex]
		driverStint, maxLap := buildDriverStintData(p, pIdx, driverLaps, usedCompoundsSet, neutralised)
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
