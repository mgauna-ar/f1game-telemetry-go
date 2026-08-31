package engineer

import (
	"fmt"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BrakesRule manages brake disc fade overheating and cold brake drag alerts.
type BrakesRule struct {
	mu                     sync.Mutex
	lastBrakeOverheatAlert int64
	lastBrakeColdAlert     int64
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

func (r *BrakesRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopePhase || scope == DedupScopeNone {
		r.lastBrakeColdAlert = 0
	}
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastBrakeOverheatAlert = 0
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

	now := ctx.Now
	if now == 0 {
		now = time.Now().UnixMilli()
	}

	if maxBrakeTemp >= ctx.Config.BrakeOverheatC && (now-r.lastBrakeOverheatAlert > BrakeOverheatCooldownMs) {
		r.lastBrakeOverheatAlert = now
		directives = append(directives, Directive{
			ID:       "brake_hot",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_overheat",
			Title:    "Brake Disc Overheating",
			Message:  fmt.Sprintf("Brake disc temperatures are critically high at %d°C (fade threshold: %d°C)!", int(maxBrakeTemp), int(ctx.Config.BrakeOverheatC)),
			Urgency:  UrgencyMedium,
		})
	} else if maxBrakeTemp > 0 && maxBrakeTemp <= ctx.Config.BrakeColdC && (now-r.lastBrakeColdAlert > BrakeColdCooldownMs) {
		if ctx.Phase == PhaseFormationLap || ctx.Phase == PhaseSafetyCar || ctx.Phase == PhaseOutLap {
			r.lastBrakeColdAlert = now
			directives = append(directives, Directive{
				ID:       "brake_cold",
				Category: DirectiveCategoryBrakes,
				SubAlert: "brake_cold",
				Title:    "Cold Brakes",
				Message:  fmt.Sprintf("Brake temperatures are cold (%d°C, optimal: >%d°C).", int(maxBrakeTemp), int(ctx.Config.BrakeColdC)),
				Urgency:  UrgencyLow,
			})
		}
	}

	return directives
}
