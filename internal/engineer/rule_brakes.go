package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BrakesRule manages brake disc fade overheating, cold brake drag, and front/rear brake bias imbalance alerts.
type BrakesRule struct {
	mu                 sync.Mutex
	lastBrakeBiasAlert string
	// hot is how long each brake has been over the overheating limit.
	hot [4]conditionSpell
	// The braking zone under way (its peak front and rear temperatures), and the peaks of the last
	// BrakeBiasZones zones, oldest first: the bias check compares those, not one instant.
	inZone    bool
	zonePeak  [2]float32
	zonePeaks [][2]float32
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
			ValidPhases:     []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
		"brake_cold": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"brake_bias": {
			ValidPhases:     []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
		"brake_bias_ok": {
			ValidPhases:     []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:      DedupScopeStint,
			MaxDelayMs:      ConditionMaxDelayMs,
			OutlastsSilence: true,
		},
	}
}

func (r *BrakesRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastBrakeBiasAlert = ""
		r.hot = [4]conditionSpell{}
		r.inZone = false
		r.zonePeak = [2]float32{}
		r.zonePeaks = nil
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
	now := ctx.Now

	// A brake that stays over the limit for BrakeHotSustainMs is overheating; one big stop isn't.
	hotWheel := -1
	var maxBrakeTemp float32
	for w, bt := range tele.BrakesTemperature {
		val := float32(bt)
		maxBrakeTemp = max(maxBrakeTemp, val)
		r.hot[w].update(val >= ctx.Config.BrakeOverheatC, now)
		if hotWheel < 0 && r.hot[w].heldFor(now, BrakeHotSustainMs) {
			hotWheel = w
		}
	}

	switch {
	case hotWheel >= 0:
		front := hotWheel == packets.WheelFrontLeft || hotWheel == packets.WheelFrontRight
		subAlert, advice := "brake_overheat_rear", "Move the brake bias forward a click."
		if front {
			subAlert, advice = "brake_overheat", "Move the brake bias rearward a click."
		}
		directives = append(directives, Directive{
			ID:       "brake_hot",
			Category: DirectiveCategoryBrakes,
			SubAlert: subAlert,
			Title:    "Brake Disc Overheating",
			Message:  fmt.Sprintf("The %s brake has been over %d°C for a while (%d°C now). %s", wheelLongNames[hotWheel], int(ctx.Config.BrakeOverheatC), tele.BrakesTemperature[hotWheel], advice),
			Urgency:  UrgencyMedium,
		})
	case maxBrakeTemp > 0 && maxBrakeTemp <= ctx.Config.BrakeColdC:
		directives = append(directives, Directive{
			ID:       "brake_cold",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_cold",
			Title:    "Cold Brakes",
			Message:  fmt.Sprintf("Brake temperatures are cold (%d°C, optimal: >%d°C).", int(maxBrakeTemp), int(ctx.Config.BrakeColdC)),
			Urgency:  UrgencyLow,
		})
	}

	if bias, ok := r.biasCall(tele); ok {
		directives = append(directives, bias)
	}
	return directives
}

// biasCall compares the front and rear brakes' peak temperatures over the last BrakeBiasZones
// braking zones: a front/rear imbalance asks to move the bias, and once a called imbalance evens
// out, that is said too.
func (r *BrakesRule) biasCall(tele *packets.CarTelemetryData) (Directive, bool) {
	frontAvg := (float32(tele.BrakesTemperature[packets.WheelFrontLeft]) + float32(tele.BrakesTemperature[packets.WheelFrontRight])) / 2
	rearAvg := (float32(tele.BrakesTemperature[packets.WheelRearLeft]) + float32(tele.BrakesTemperature[packets.WheelRearRight])) / 2

	if tele.Brake >= BrakeZoneMinPedal {
		if !r.inZone {
			r.inZone, r.zonePeak = true, [2]float32{}
		}
		r.zonePeak = [2]float32{max(r.zonePeak[0], frontAvg), max(r.zonePeak[1], rearAvg)}
		return Directive{}, false
	}
	if !r.inZone {
		return Directive{}, false
	}
	// A braking zone just ended: its peaks join the last zones'.
	r.inZone = false
	r.zonePeaks = append(r.zonePeaks, r.zonePeak)
	if len(r.zonePeaks) > BrakeBiasZones {
		r.zonePeaks = r.zonePeaks[len(r.zonePeaks)-BrakeBiasZones:]
	}
	if len(r.zonePeaks) < BrakeBiasZones {
		return Directive{}, false
	}
	var front, rear float32
	for _, p := range r.zonePeaks {
		front += p[0]
		rear += p[1]
	}
	front /= float32(len(r.zonePeaks))
	rear /= float32(len(r.zonePeaks))

	switch {
	case r.lastBrakeBiasAlert != "" && math.Abs(float64(front-rear)) < BrakeBiasEqualizedDeltaThresholdC:
		r.lastBrakeBiasAlert = ""
		return Directive{
			ID:       "brake_bias_ok",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_bias_ok",
			Title:    "Brake Balance Restored",
			Message:  "Brake temperatures are even again front to rear over the last braking zones.",
			Urgency:  UrgencyLow,
		}, true
	case front >= BrakeBiasOverheatThresholdC && front-rear >= BrakeBiasImbalanceDeltaThresholdC && r.lastBrakeBiasAlert != "front":
		r.lastBrakeBiasAlert = "front"
		return Directive{
			ID:       "brake_bias",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_bias",
			Title:    "Brake Bias Imbalance",
			Message:  fmt.Sprintf("Front brakes peak much hotter than the rears over the last braking zones (%d°C vs %d°C). Move the brake bias rearward.", int(front), int(rear)),
			Urgency:  UrgencyMedium,
		}, true
	case rear >= BrakeBiasOverheatThresholdC && rear-front >= BrakeBiasImbalanceDeltaThresholdC && r.lastBrakeBiasAlert != "rear":
		r.lastBrakeBiasAlert = "rear"
		return Directive{
			ID:       "brake_bias",
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_bias_forward",
			Title:    "Brake Bias Imbalance",
			Message:  fmt.Sprintf("Rear brakes peak much hotter than the fronts over the last braking zones (%d°C vs %d°C). Move the brake bias forward.", int(rear), int(front)),
			Urgency:  UrgencyMedium,
		}, true
	}
	return Directive{}, false
}
