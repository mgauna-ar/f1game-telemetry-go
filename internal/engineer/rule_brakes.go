package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BrakesRule manages brake disc fade overheating and cold brake drag alerts.
type BrakesRule struct {
	mu sync.Mutex
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

func (r *BrakesRule) DedupScope() DedupScope {
	return DedupScopeStint
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
	}
}

func (r *BrakesRule) Reset(scope DedupScope) {
	// State is managed by engine deduplication & cooldowns
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

	return directives
}
