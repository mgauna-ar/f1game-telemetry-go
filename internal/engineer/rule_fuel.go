package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FuelRule manages fuel deficit, the undercut and overcut calls, and fuel mix management. The
// game's pit window is PitPlanRule's.
type FuelRule struct {
	mu                       sync.Mutex
	lastFuelDeltaAlertLap    int
	fuelMixNeutralizedWarned bool
	fuelMixRestartWarned     bool
}

// NewFuelRule creates a new FuelRule.
func NewFuelRule() *FuelRule {
	return &FuelRule{
		lastFuelDeltaAlertLap: -1,
	}
}

func (r *FuelRule) Name() string {
	return "fuel"
}

func (r *FuelRule) Category() string {
	return string(DirectiveCategoryFuel)
}

func (r *FuelRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhaseSafetyCar}
}

func (r *FuelRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"fuel_delta": {
			Category:    DirectiveCategoryFuel,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
			MaxDelayMs:  ConditionMaxDelayMs,
		},
		"undercut": {
			Category:    DirectiveCategoryPitStrategy,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeStint,
		},
		"overcut": {
			Category:       DirectiveCategoryPitStrategy,
			ValidPhases:    []DrivingPhase{PhaseRacing},
			DedupScope:     DedupScopeLap,
			NotWhileBoxDue: true,
		},
		"fuel_mix_neutralized": {
			Category:    DirectiveCategoryFuel,
			ValidPhases: []DrivingPhase{PhaseSafetyCar, PhaseRacing},
			DedupScope:  DedupScopePhase,
		},
		"fuel_mix_restart": {
			Category:    DirectiveCategoryFuel,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopePhase,
		},
	}
}

func (r *FuelRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeLap || scope == DedupScopeNone {
		r.lastFuelDeltaAlertLap = -1
	}
	if scope == DedupScopePhase || scope == DedupScopeNone {
		r.fuelMixNeutralizedWarned = false
		r.fuelMixRestartWarned = false
	}
}

func (r *FuelRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	currentLapNum := 1
	playerLap := ctx.PlayerLap()
	if playerLap != nil && playerLap.CurrentLapNum > 0 {
		currentLapNum = int(playerLap.CurrentLapNum)
	}

	// 1. Fuel Target Deficit & Lift & Coast (from CarStatusData, race only at racing speed)
	status := ctx.PlayerStatus()
	isNeutralized := ctx.Phase == PhaseSafetyCar ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		(playerLap != nil && playerLap.SafetyCarDelta != 0)

	if status != nil && ctx.IsRaceSession() && ctx.Phase == PhaseRacing && !isNeutralized &&
		(ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryFuel), "fuel_delta") {
		if status.FuelRemainingLaps <= ctx.Config.FuelDeltaLaps && currentLapNum > MinFuelAlertLapNum && currentLapNum != r.lastFuelDeltaAlertLap {
			r.lastFuelDeltaAlertLap = currentLapNum
			directives = append(directives, Directive{
				ID:       "fuel_delta",
				Category: DirectiveCategoryFuel,
				SubAlert: "fuel_deficit",
				Title:    "Fuel Target Deficit",
				Message:  fmt.Sprintf("Fuel target delta is negative (%.1f laps). Introduce Lift & Coast into Turn 1 and heavy braking zones.", status.FuelRemainingLaps),
				Urgency:  UrgencyMedium,
			})
		}
	}

	// 2. Neutralization Fuel Mix Audit (Switch to Lean under SC, restore to Race on restart)
	if status != nil && ctx.IsRaceSession() {
		if isNeutralized {
			if status.FuelMix >= packets.FuelMixStandard && !r.fuelMixNeutralizedWarned {
				r.fuelMixNeutralizedWarned = true
				r.fuelMixRestartWarned = false
				directives = append(directives, Directive{
					ID:       "fuel_mix_neutralized",
					Category: DirectiveCategoryFuel,
					SubAlert: "fuel_mix_neutralized",
					Title:    "Neutralization Fuel Mix",
					Message:  "Safety car conditions. Switch fuel mix to Lean / Mix 1 to conserve fuel and protect engine temperatures.",
					Urgency:  UrgencyMedium,
				})
			}
		} else if ctx.Phase == PhaseRacing && currentLapNum > 1 {
			if status.FuelMix == packets.FuelMixLean && !r.fuelMixRestartWarned && r.fuelMixNeutralizedWarned {
				r.fuelMixRestartWarned = true
				r.fuelMixNeutralizedWarned = false
				directives = append(directives, Directive{
					ID:       "fuel_mix_restart",
					Category: DirectiveCategoryFuel,
					SubAlert: "fuel_mix_restart",
					Title:    "Race Restart Fuel Mix",
					Message:  "Green flag racing! Restore fuel mix to Race Mix 2.",
					Urgency:  UrgencyMedium,
				})
			}
		}
	}

	// 3-4. The car behind or ahead pits (from LapData, race only on LapData): once per stop, as it
	// enters the pit lane.
	if ctx.IsRaceSession() && playerLap != nil && playerLap.CarPosition > 0 && ctx.Phase != PhaseSafetyCar && !isNeutralized &&
		(ctx.Session == nil || ctx.Session.SafetyCarStatus == packets.SafetyCarNone) && ctx.LapData != nil &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
		if d, ok := undercutCall(ctx, playerLap); ok {
			directives = append(directives, d)
		}
		if d, ok := overcutCall(ctx, playerLap); ok {
			directives = append(directives, d)
		}
	}

	return directives
}

// undercutCall warns that the car behind has just pitted within UndercutGapSec: push now to cover
// the undercut.
func undercutCall(ctx *EvaluationContext, playerLap *packets.LapData) (Directive, bool) {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "undercut") {
		return Directive{}, false
	}
	playerPos := int(playerLap.CarPosition)
	i := carAtPosition(ctx.LapData, playerPos+1)
	if i < 0 || i == ctx.PlayerCarIndex || !ctx.PitEntries[i] {
		return Directive{}, false
	}
	distDelta := playerLap.TotalDistance - ctx.LapData.LapData[i].TotalDistance
	if distDelta <= 0 || distDelta >= ctx.Config.UndercutGapSec*AverageRaceSpeedMetersPerSec {
		return Directive{}, false
	}
	return Directive{
		ID:       "undercut",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: "undercut_window",
		Title:    "Undercut Threat",
		Message:  fmt.Sprintf("Car behind (P%d) has just pitted for the undercut! Push now to cover it.", playerPos+1),
		Urgency:  UrgencyCritical,
	}, true
}

// overcutCall says that the car ahead has just pitted within UndercutGapSec: push in the clear air
// to come out ahead after our own stop. Not for the teammate: their stop has its own call.
func overcutCall(ctx *EvaluationContext, playerLap *packets.LapData) (Directive, bool) {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "overcut") {
		return Directive{}, false
	}
	playerPos := int(playerLap.CarPosition)
	i := carAtPosition(ctx.LapData, playerPos-1)
	if i < 0 || i == ctx.PlayerCarIndex || i == ctx.TeammateCarIndex || !ctx.PitEntries[i] {
		return Directive{}, false
	}
	gapMS := deltaToCarInFrontMS(*playerLap)
	gapSec := msToSec(gapMS)
	if gapMS == 0 || gapSec > float64(ctx.Config.UndercutGapSec) {
		return Directive{}, false
	}
	gapSec = roundTo(gapSec, 1)
	return Directive{
		ID:       "overcut",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: "overcut_window",
		Title:    "Car Ahead Pitted",
		Message:  fmt.Sprintf("Car ahead (P%d) has pitted, %.1fs up the road. Push now in clear air for the overcut.", playerPos-1, gapSec),
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: gapSec}},
	}, true
}
