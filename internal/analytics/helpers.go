package analytics

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// GroupLapsByCar organizes laps by car index, derives Sector 3, sorts each car's laps chronologically,
// and computes the maximum recorded completed lap number.
func GroupLapsByCar(laps []storage.Lap) (lapsByCar map[int][]storage.Lap, maxRecordedLap int) {
	lapsByCar = make(map[int][]storage.Lap)
	maxRecordedLap = 0

	for _, l := range laps {
		storage.DeriveSector3(&l)
		lapsByCar[l.CarIndex] = append(lapsByCar[l.CarIndex], l)
		if l.LapTimeMS > 0 && l.LapNumber > maxRecordedLap {
			maxRecordedLap = l.LapNumber
		}
	}

	for carIdx := range lapsByCar {
		sort.SliceStable(lapsByCar[carIdx], func(i, j int) bool {
			return lapsByCar[carIdx][i].LapNumber < lapsByCar[carIdx][j].LapNumber
		})
	}

	return lapsByCar, maxRecordedLap
}

// BuildEffectiveParticipants returns the active participants for analytics, creating synthetic
// placeholder participants if none were persisted for the session.
func BuildEffectiveParticipants(
	session *storage.Session,
	participants []storage.Participant,
	lapsByCar map[int][]storage.Lap,
	isRaceSession bool,
) []storage.Participant {
	effectiveParticipants := participants
	if len(effectiveParticipants) == 0 {
		var sessionID int64
		if session != nil {
			sessionID = session.ID
		}
		for carIdx := range lapsByCar {
			effectiveParticipants = append(effectiveParticipants, storage.Participant{
				SessionID:    sessionID,
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
		if IsHistoricalParticipantActive(&p, lapsByCar[p.CarIndex], isRaceSession) {
			activeParticipants = append(activeParticipants, p)
		}
	}

	return activeParticipants
}

// IsHistoricalParticipantActive determines whether a participant should be included in session analytics.
func IsHistoricalParticipantActive(p *storage.Participant, driverLaps []storage.Lap, isRace bool) bool {
	isAI := p.AIControlled || (p.DriverID > 0 && p.DriverID != int(packets.InvalidDriverID))
	isHuman := !isAI && strings.TrimSpace(p.Name) != ""
	if isHuman {
		return true
	}

	hasCompletedLaps := false
	hasSectors := false
	hasTelemetry := false
	for _, l := range driverLaps {
		if l.LapTimeMS > 0 {
			hasCompletedLaps = true
		}
		if l.Sector1MS > 0 || l.Sector2MS > 0 || l.Sector3MS > 0 {
			hasSectors = true
		}
		if l.HasTelemetry && l.SampleCount > 10 {
			hasTelemetry = true
		}
	}

	hasOfficialResult := p.TotalRaceTime > 0 || p.Points > 0 || (isRace && p.Position > 0)
	if isRace {
		return hasCompletedLaps || hasSectors || hasTelemetry || hasOfficialResult
	}
	return hasCompletedLaps || hasSectors || hasTelemetry
}

// ComputeStintsSummary formats tyre stint transitions (e.g. "SOFT (14) → MEDIUM (22)").
func ComputeStintsSummary(laps []storage.Lap) string {
	if len(laps) == 0 {
		return ""
	}
	type stintEntry struct {
		compound string
		count    int
		stintID  int
	}
	var stints []*stintEntry
	for _, l := range laps {
		raw := strings.TrimSpace(l.TyreCompound)
		if raw == "" {
			continue
		}
		stintID := l.Stint
		normComp := packets.NormalizeCompoundName(raw)
		if len(stints) == 0 || (stintID > 0 && stints[len(stints)-1].stintID > 0 && stintID != stints[len(stints)-1].stintID) || stints[len(stints)-1].compound != normComp {
			stints = append(stints, &stintEntry{compound: normComp, count: 1, stintID: stintID})
		} else {
			stints[len(stints)-1].count++
		}
	}
	if len(stints) == 0 {
		return ""
	}
	parts := make([]string, len(stints))
	for i, s := range stints {
		parts[i] = fmt.Sprintf("%s (%d)", s.compound, s.count)
	}
	return strings.Join(parts, " → ")
}

// DegRegressionPoint represents a single data point for linear regression of tyre degradation.
type DegRegressionPoint struct {
	Age     float64
	TimeSec float64
}

// CalculateDegradationSlope computes the Ordinary Least Squares (OLS) linear regression slope.
// slope = (N * sum(XY) - sum(X) * sum(Y)) / (N * sum(X^2) - (sum(X))^2)
func CalculateDegradationSlope(points []DegRegressionPoint) *float64 {
	n := float64(len(points))
	if n < 3 {
		return nil
	}
	var sumX, sumY, sumXY, sumXX float64
	for _, pt := range points {
		sumX += pt.Age
		sumY += pt.TimeSec
		sumXY += pt.Age * pt.TimeSec
		sumXX += pt.Age * pt.Age
	}
	denom := n*sumXX - sumX*sumX
	if denom == 0 {
		return nil
	}
	slope := (n*sumXY - sumX*sumY) / denom
	rounded := math.Round(slope*1000.0) / 1000.0
	return &rounded
}
