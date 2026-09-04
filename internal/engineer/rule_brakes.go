package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BrakesRule manages brake disc fade overheating, cold brake drag, and front/rear brake bias imbalance alerts.
type BrakesRule struct {
	mu                 sync.Mutex
	lastBrakeBiasAlert string
}

// NewBrakesRule creates a new BrakesRule.
func NewBrakesRule() *BrakesRule {
	return &BrakesRule{}
}

func (r *BrakesRule) Name() string {
	return "brakes"
}

func (r *BrakesRule) Category() string {
	return string(DirectiveCategoryBrakes)
}

func (r *BrakesRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseSafetyCar}
}

func (r *BrakesRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"brake_hot": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeStint,
		},
		"brake_cold": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
		},
		"brake_bias": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:  DedupScopeStint,
		},
	}
}

func (r *BrakesRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastBrakeBiasAlert = ""
	}
}

func (r *BrakesRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketCarTelemetryData](ctx.Packet) {
		return nil
	}

	tele := ctx.PlayerTelemetry()
	if tele == nil {
		return nil
	}

	var directives []Directive

	var maxBrakeTemp float32
	for _, bt := range tele.BrakesTemperature {
		val := float32(bt)
		if val > maxBrakeTemp {
			maxBrakeTemp = val
		}
	}

	if maxBrakeTemp >= ctx.Config.BrakeOverheatC {
		directives = append(directives, Directive{
			ID:       "brake_hot",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_overheat",
			Title:    "Brake Disc Overheating",
			Message:  fmt.Sprintf("Brake disc temperatures are critically high at %d°C (fade threshold: %d°C)!", int(maxBrakeTemp), int(ctx.Config.BrakeOverheatC)),
			Urgency:  UrgencyMedium,
		})
	} else if maxBrakeTemp > 0 && maxBrakeTemp <= ctx.Config.BrakeColdC {
		directives = append(directives, Directive{
			ID:       "brake_cold",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_cold",
			Title:    "Cold Brakes",
			Message:  fmt.Sprintf("Brake temperatures are cold (%d°C, optimal: >%d°C).", int(maxBrakeTemp), int(ctx.Config.BrakeColdC)),
			Urgency:  UrgencyLow,
		})
	}

	// Front vs Rear Axle Thermal Imbalance / Brake Bias Coaching
	frontAvg := (float32(tele.BrakesTemperature[packets.WheelFrontLeft]) + float32(tele.BrakesTemperature[packets.WheelFrontRight])) / 2
	rearAvg := (float32(tele.BrakesTemperature[packets.WheelRearLeft]) + float32(tele.BrakesTemperature[packets.WheelRearRight])) / 2

	if frontAvg >= BrakeBiasOverheatThresholdC && (frontAvg-rearAvg) >= BrakeBiasImbalanceDeltaThresholdC && r.lastBrakeBiasAlert != "front" {
		r.lastBrakeBiasAlert = "front"
		directives = append(directives, Directive{
			ID:       "brake_bias",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_bias",
			Title:    "Brake Bias Imbalance",
			Message:  fmt.Sprintf("Front brakes are running excessively hot relative to the rears (%d°C vs %d°C). Move brake bias rearward by 1-2%%.", int(frontAvg), int(rearAvg)),
			Urgency:  UrgencyMedium,
		})
	} else if rearAvg >= BrakeBiasOverheatThresholdC && (rearAvg-frontAvg) >= BrakeBiasImbalanceDeltaThresholdC && r.lastBrakeBiasAlert != "rear" {
		r.lastBrakeBiasAlert = "rear"
		directives = append(directives, Directive{
			ID:       "brake_bias",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_bias",
			Title:    "Brake Bias Imbalance",
			Message:  fmt.Sprintf("Rear brakes are running excessively hot relative to the fronts (%d°C vs %d°C). Move brake bias forward by 1-2%%.", int(rearAvg), int(frontAvg)),
			Urgency:  UrgencyMedium,
		})
	}

	return directives
}
