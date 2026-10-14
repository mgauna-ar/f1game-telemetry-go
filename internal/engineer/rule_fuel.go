package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FuelRule manages fuel deficit, the undercut and overcut calls, and fuel mix management. The
// game's pit window is PitPlanRule's.
type FuelRule struct {
	mu sync.Mutex
	// The fuel deficit call is made once a stint, at fuelDeltaCalledLaps, and again only when the
	// deficit grows by FuelDeltaRecallStepLaps.
	fuelDeltaCalled          bool
	fuelDeltaCalledLaps      float32
	fuelMixNeutralizedWarned bool
	// wasNeutralized is whether the last packet was under a Safety Car or VSC; restartDue is set
	// by each one, until the restart checks the fuel mix.
	wasNeutralized bool
	restartDue     bool
}

// NewFuelRule creates a new FuelRule.
func NewFuelRule() *FuelRule {
	return &FuelRule{}
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
			DedupScope:  DedupScopeNone, // once a stint, again when worse (Evaluate)
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

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.fuelDeltaCalled = false
	}
	// The fuel mix calls span the Safety Car and the restart, two phases, so only a new session
	// clears them; each Safety Car re-arms them (Evaluate).
	if scope == DedupScopeNone {
		r.fuelMixNeutralizedWarned = false
		r.wasNeutralized = false
		r.restartDue = false
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
		worse := !r.fuelDeltaCalled || status.FuelRemainingLaps <= r.fuelDeltaCalledLaps-FuelDeltaRecallStepLaps
		if status.FuelRemainingLaps <= ctx.Config.FuelDeltaLaps && currentLapNum > MinFuelAlertLapNum && worse {
			r.fuelDeltaCalled, r.fuelDeltaCalledLaps = true, status.FuelRemainingLaps
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

	// 2. Fuel mix under a Safety Car or VSC: lean while neutralised, back to the race mix at the
	// restart.
	if status != nil && ctx.IsRaceSession() {
		if isNeutralized && !r.wasNeutralized {
			r.fuelMixNeutralizedWarned = false
			r.restartDue = true
		}
		r.wasNeutralized = isNeutralized

		switch {
		case isNeutralized:
			if status.FuelMix >= packets.FuelMixStandard && !r.fuelMixNeutralizedWarned {
				r.fuelMixNeutralizedWarned = true
				directives = append(directives, Directive{
					ID:       "fuel_mix_neutralized",
					Category: DirectiveCategoryFuel,
					SubAlert: "fuel_mix_neutralized",
					Title:    "Neutralization Fuel Mix",
					Message:  "Safety car conditions. Switch the fuel mix to lean to save fuel and keep the engine cool.",
					Urgency:  UrgencyMedium,
				})
			}
		case ctx.Phase == PhaseRacing && currentLapNum > 1 && r.restartDue:
			r.restartDue = false
			if status.FuelMix == packets.FuelMixLean {
				directives = append(directives, Directive{
					ID:       "fuel_mix_restart",
					Category: DirectiveCategoryFuel,
					SubAlert: "fuel_mix_restart",
					Title:    "Race Restart Fuel Mix",
					Message:  "Green flag racing! Fuel mix is still lean: back to the standard race mix.",
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
	if !pitStopFor(ctx, i) {
		return Directive{}, false
	}
	gapSec := raceGapSec(ctx, ctx.PlayerCarIndex, i)
	if gapSec <= 0 || gapSec >= float64(ctx.Config.UndercutGapSec) {
		return Directive{}, false
	}
	gapSec = roundTo(gapSec, 1)
	return Directive{
		ID:       "undercut",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: "undercut_window",
		Title:    "Undercut Threat",
		Message:  fmt.Sprintf("Car behind (P%d), %.1fs back, has just pitted for the undercut! Push now to cover it.", playerPos+1, gapSec),
		Urgency:  UrgencyCritical,
		Values:   &DirectiveValues{Behind: &GapToCar{GapSec: gapSec}},
	}, true
}

// overcutCall says that the car ahead has just pitted within UndercutGapSec: push in the clear air
// to come out ahead after our own stop.
func overcutCall(ctx *EvaluationContext, playerLap *packets.LapData) (Directive, bool) {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "overcut") {
		return Directive{}, false
	}
	playerPos := int(playerLap.CarPosition)
	i := carAtPosition(ctx.LapData, playerPos-1)
	if !pitStopFor(ctx, i) {
		return Directive{}, false
	}
	gapSec := raceGapSec(ctx, i, ctx.PlayerCarIndex)
	if gapSec <= 0 || gapSec > float64(ctx.Config.UndercutGapSec) {
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

// pitStopFor reports whether car i has just entered the pit lane for a tyre stop that changes the
// battle: not the player, not the teammate (their stop has its own call), and not a car going in
// only to serve a drive-through or stop-go penalty.
func pitStopFor(ctx *EvaluationContext, i int) bool {
	if i < 0 || i == ctx.PlayerCarIndex || i == ctx.TeammateCarIndex || !ctx.PitEntries[i] {
		return false
	}
	l := ctx.LapData.LapData[i]
	return l.NumUnservedDriveThroughPens == 0 && l.NumUnservedStopGoPens == 0
}
