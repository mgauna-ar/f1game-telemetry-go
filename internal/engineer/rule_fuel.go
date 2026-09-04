package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FuelRule manages fuel deficit, pit stop window opening, undercut threat alerts, and fuel mix management.
type FuelRule struct {
	mu                          sync.Mutex
	lastFuelDeltaAlertLap       int
	lastPitWindowWarnedLap      int
	lastPitWindowCloseWarnedLap int
	lastUndercutRivalIndex      int
	fuelMixNeutralizedWarned    bool
	fuelMixRestartWarned        bool
}

// NewFuelRule creates a new FuelRule.
func NewFuelRule() *FuelRule {
	return &FuelRule{
		lastFuelDeltaAlertLap:       -1,
		lastPitWindowWarnedLap:      -1,
		lastPitWindowCloseWarnedLap: -1,
		lastUndercutRivalIndex:      -1,
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
		},
		"undercut": {
			Category:    DirectiveCategoryPitStrategy,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeStint,
		},
		"pit_window": {
			Category:    DirectiveCategoryPitStrategy,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"pit_window_close": {
			Category:    DirectiveCategoryPitStrategy,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
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
		r.lastPitWindowWarnedLap = -1
		r.lastPitWindowCloseWarnedLap = -1
	}
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastUndercutRivalIndex = -1
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

	// 3. Pit Stop Window Opening (from SessionData & LapData, race only on LapData)
	if ctx.IsRaceSession() && ctx.Phase != PhaseSafetyCar && !isNeutralized && ctx.Session != nil && ctx.Session.SafetyCarStatus == packets.SafetyCarNone && ctx.Session.PitStopWindowIdealLap > 0 &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "pit_window") {
		idealLap := int(ctx.Session.PitStopWindowIdealLap)
		if idealLap == currentLapNum && r.lastPitWindowWarnedLap != currentLapNum {
			r.lastPitWindowWarnedLap = currentLapNum
			playerPos := 1
			if playerLap != nil && playerLap.CarPosition > 0 {
				playerPos = int(playerLap.CarPosition)
			}
			rejoinPos := int(ctx.Session.PitStopRejoinPosition)
			if rejoinPos == 0 {
				rejoinPos = playerPos
			}
			if rejoinPos == 0 {
				rejoinPos = 1
			}
			directives = append(directives, Directive{
				ID:       "pit_window",
				Category: DirectiveCategoryPitStrategy,
				SubAlert: "pit_window_open",
				Title:    "Pit Stop Window",
				Message:  fmt.Sprintf("Pit stop window is now open (Lap %d). Target rejoin position P%d.", currentLapNum, rejoinPos),
				Urgency:  UrgencyLow,
			})
		}
	}

	// 3. Pit Stop Window Closing (from SessionData & LapData, race only on LapData)
	if ctx.IsRaceSession() && ctx.Phase != PhaseSafetyCar && !isNeutralized && ctx.Session != nil &&
		ctx.Session.SafetyCarStatus == packets.SafetyCarNone && ctx.Session.PitStopWindowLatestLap > 0 &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "pit_window_close") {
		latestLap := int(ctx.Session.PitStopWindowLatestLap)
		if latestLap == currentLapNum && r.lastPitWindowCloseWarnedLap != currentLapNum {
			r.lastPitWindowCloseWarnedLap = currentLapNum
			directives = append(directives, Directive{
				ID:       "pit_window_close",
				Category: DirectiveCategoryPitStrategy,
				SubAlert: "pit_window_close",
				Title:    "Pit Window Closing",
				Message:  fmt.Sprintf("Box this lap, box box! Pit stop window is closing (Lap %d), take the stop now to preserve tyre life.", currentLapNum),
				Urgency:  UrgencyHigh,
			})
		}
	}

	// 4. Undercut Threat Detection (from LapData, race only on LapData)
	if ctx.IsRaceSession() && playerLap != nil && playerLap.CarPosition > 0 && ctx.Phase != PhaseSafetyCar && !isNeutralized &&
		(ctx.Session == nil || ctx.Session.SafetyCarStatus == packets.SafetyCarNone) && ctx.LapData != nil &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "undercut") {
		playerPos := int(playerLap.CarPosition)
		for i, rival := range ctx.LapData.LapData {
			if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos+1 {
				continue
			}
			if rival.PitStatus == packets.PitStatusPitting && r.lastUndercutRivalIndex != i {
				distDelta := playerLap.TotalDistance - rival.TotalDistance
				maxUndercutDist := ctx.Config.UndercutGapSec * AverageRaceSpeedMetersPerSec
				if distDelta > 0 && distDelta < maxUndercutDist {
					r.lastUndercutRivalIndex = i
					directives = append(directives, Directive{
						ID:       "undercut",
						Category: DirectiveCategoryPitStrategy,
						SubAlert: "undercut_window",
						Title:    "Undercut Threat",
						Message:  fmt.Sprintf("Car behind (P%d) has just pitted for an undercut attempt! Push hard now on the in-lap to defend track position.", playerPos+1),
						Urgency:  UrgencyCritical,
					})
				}
			}
		}
	}

	return directives
}
