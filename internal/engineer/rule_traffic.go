package engineer

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TrafficRule manages clean air pit rejoin window calculation alerts.
type TrafficRule struct{}

// NewTrafficRule creates a new TrafficRule.
func NewTrafficRule() *TrafficRule {
	return &TrafficRule{}
}

func (r *TrafficRule) Name() string {
	return "traffic"
}

func (r *TrafficRule) Category() string {
	return string(DirectiveCategoryPitStrategy)
}

func (r *TrafficRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing}
}

func (r *TrafficRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"pit_clean_air": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
	}
}

func (r *TrafficRule) Reset(scope DedupScope) {
	// TrafficRule has no persistent dedup state beyond phase/lap
}

func (r *TrafficRule) Evaluate(ctx *EvaluationContext) []Directive {
	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}

	playerLap := ctx.PlayerLap()
	if !ctx.IsRaceSession() || ctx.Phase != PhaseRacing ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap == nil || ctx.LapData == nil {
		return nil
	}

	// Strategy integrity: suppress clean air pit calls if player already pitted or race is near conclusion
	if playerLap.NumPitStops >= 1 {
		return nil
	}
	currentLap := int(playerLap.CurrentLapNum)
	if ctx.Session != nil && ctx.Session.TotalLaps > 0 {
		lapsRemaining := int(ctx.Session.TotalLaps) - currentLap
		if lapsRemaining <= CleanAirMinRemainingLaps {
			return nil
		}
	}
	trackLen := float32(DefaultTrackLengthMeters)
	if ctx.Session != nil && ctx.Session.TrackLength > 0 {
		trackLen = float32(ctx.Session.TrackLength)
	}

	pitLossDistance := float32(DefaultPitLaneLossSeconds * AverageRaceSpeedMetersPerSec)
	targetRejoinTotalDist := playerLap.TotalDistance - pitLossDistance
	trafficCount := 0

	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || rival.TotalDistance == 0 {
			continue
		}
		distDelta := math.Abs(float64(rival.TotalDistance - targetRejoinTotalDist))
		distDeltaOnTrack := math.Mod(distDelta, float64(trackLen))
		windowDistance := CleanAirTrafficWindowSeconds * AverageRaceSpeedMetersPerSec
		if distDeltaOnTrack < windowDistance {
			trafficCount++
		}
	}

	var directives []Directive
	if trafficCount == 0 && currentLap%CleanAirPeriodicLapModulo == 0 {
		directives = append(directives, Directive{
			ID:       "pit_clean_air",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_clean_air",
			Title:    "Clean Air Pit Window",
			Message:  "Pit window offers clean air on rejoin. Ideal opportunity for undercut/overcut strategy.",
			Urgency:  UrgencyLow,
		})
	}

	return directives
}
