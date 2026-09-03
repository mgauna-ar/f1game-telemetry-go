package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FuelRule manages fuel deficit, pit stop window opening, and undercut threat alerts.
type FuelRule struct {
	mu                     sync.Mutex
	lastFuelDeltaAlertLap  int
	lastPitWindowWarnedLap int
	lastUndercutRivalIndex int
}

// NewFuelRule creates a new FuelRule.
func NewFuelRule() *FuelRule {
	return &FuelRule{
		lastFuelDeltaAlertLap:  -1,
		lastPitWindowWarnedLap: -1,
		lastUndercutRivalIndex: -1,
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
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
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
	}
}

func (r *FuelRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeLap || scope == DedupScopeNone {
		r.lastFuelDeltaAlertLap = -1
		r.lastPitWindowWarnedLap = -1
	}
	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.lastUndercutRivalIndex = -1
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

	// 1. Fuel Target Deficit & Lift & Coast (from CarStatusData, race only)
	status := ctx.PlayerStatus()
	if status != nil && ctx.IsRaceSession() && (ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryFuel), "fuel_delta") {
		if status.FuelRemainingLaps <= ctx.Config.FuelDeltaLaps && currentLapNum > MinFuelAlertLapNum && currentLapNum != r.lastFuelDeltaAlertLap {
			r.lastFuelDeltaAlertLap = currentLapNum
			directives = append(directives, Directive{
				ID:       "fuel_delta",
				Category: DirectiveCategoryFuel,
				SubAlert: "fuel_deficit",
				Title:    "Fuel Target Deficit",
				Message:  fmt.Sprintf("Fuel target delta is negative (%.1f laps). Direct driver to introduce Lift & Coast into Turn 1 and heavy braking zones.", status.FuelRemainingLaps),
				Urgency:  UrgencyMedium,
			})
		}
	}

	// 2. Pit Stop Window Opening (from SessionData & LapData, race only on LapData)
	if ctx.IsRaceSession() && ctx.Phase != PhaseSafetyCar && ctx.Session != nil && ctx.Session.SafetyCarStatus == packets.SafetyCarNone && ctx.Session.PitStopWindowIdealLap > 0 &&
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

	// 3. Undercut Threat Detection (from LapData, race only on LapData)
	if ctx.IsRaceSession() && playerLap != nil && playerLap.CarPosition > 0 && ctx.Phase != PhaseSafetyCar &&
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
