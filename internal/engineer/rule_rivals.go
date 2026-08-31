package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// RivalsRule manages defending against cars behind and attacking cars ahead.
type RivalsRule struct {
	mu                       sync.Mutex
	lastDrsWarningIndex      int
	lastCarAheadWarningIndex int
}

// NewRivalsRule creates a new RivalsRule.
func NewRivalsRule() *RivalsRule {
	return &RivalsRule{
		lastDrsWarningIndex:      -1,
		lastCarAheadWarningIndex: -1,
	}
}

func (r *RivalsRule) Name() string {
	return "rivals"
}

func (r *RivalsRule) Category() string {
	return string(DirectiveCategoryRivals)
}

func (r *RivalsRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing}
}

func (r *RivalsRule) DedupScope() DedupScope {
	return DedupScopeNone
}

func (r *RivalsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lastDrsWarningIndex = -1
		r.lastCarAheadWarningIndex = -1
	}
}

func (r *RivalsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}

	playerLap := ctx.PlayerLap()
	if !ctx.IsRaceSession() || playerLap == nil || playerLap.CarPosition <= 0 || ctx.Phase != PhaseRacing ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) || ctx.LapData == nil {
		return nil
	}

	var directives []Directive
	playerPos := int(playerLap.CarPosition)
	is2026 := ctx.Is2026()

	// 1. Defend: Car Behind (playerPos + 1)
	maxDefendDist := ctx.Config.RivalGapSec * AverageRaceSpeedMetersPerSec
	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos+1 {
			continue
		}
		distDelta := playerLap.TotalDistance - rival.TotalDistance
		if distDelta > 0 && distDelta < maxDefendDist && r.lastDrsWarningIndex != i {
			r.lastDrsWarningIndex = i
			gapSec := distDelta / AverageRaceSpeedMetersPerSec

			var extraContext string
			if ctx.Status != nil && i < len(ctx.Status.CarStatusData) {
				rivalStatus := ctx.Status.CarStatusData[i]
				playerStatus := ctx.PlayerStatus()
				if playerStatus != nil && rivalStatus.ActualTyreCompound > 0 && playerStatus.ActualTyreCompound > 0 && rivalStatus.ActualTyreCompound != playerStatus.ActualTyreCompound {
					extraContext += fmt.Sprintf(" Rival is on different compound (Compound ID: %d, tyre age: %d laps).", rivalStatus.ActualTyreCompound, rivalStatus.TyresAgeLaps)
				}
			}
			if ctx.Damage != nil && i < len(ctx.Damage.CarDamageData) {
				rivalDamage := ctx.Damage.CarDamageData[i]
				rivalWing := float32(rivalDamage.FrontLeftWingDamage + rivalDamage.FrontRightWingDamage)
				if rivalWing > RivalDamageWingThresholdPct {
					extraContext += " Note: Car behind has front wing damage."
				}
			}

			var defendMsg string
			if is2026 {
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within Override/Boost attack threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			} else {
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within DRS threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			}

			directives = append(directives, Directive{
				ID:       "rival_defend",
				Category: DirectiveCategoryRivals,
				SubAlert: "rival_defend",
				Title:    "Defend Position",
				Message:  defendMsg,
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"rival_pos": playerPos + 1,
					"gap_sec":   gapSec,
				},
			})
		}
	}

	// 2. Attack: Car Ahead (playerPos - 1)
	if playerPos > 1 {
		maxAttackDist := ctx.Config.RivalAheadGapSec * AverageRaceSpeedMetersPerSec
		for i, rival := range ctx.LapData.LapData {
			if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos-1 {
				continue
			}
			distDelta := rival.TotalDistance - playerLap.TotalDistance
			if distDelta > 0 && distDelta < maxAttackDist && r.lastCarAheadWarningIndex != i {
				r.lastCarAheadWarningIndex = i
				gapSec := distDelta / AverageRaceSpeedMetersPerSec

				var tyreContext string
				if ctx.Status != nil && i < len(ctx.Status.CarStatusData) {
					rivalStatus := ctx.Status.CarStatusData[i]
					tyreContext = fmt.Sprintf(" Car ahead tyre age: %d laps (Compound: %d).", rivalStatus.TyresAgeLaps, rivalStatus.ActualTyreCompound)
				}

				var attackMsg string
				if is2026 {
					telemetry2 := ctx.PlayerTelemetry2()
					var boostContext string
					if telemetry2 != nil && telemetry2.OvertakeAvailable == 1 {
						boostContext = " Override Boost is available!"
					}
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s%s Direct driver to prepare overtake using Straight Mode and Boost deployment.", playerPos-1, gapSec, tyreContext, boostContext)
				} else {
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s", playerPos-1, gapSec, tyreContext)
				}

				directives = append(directives, Directive{
					ID:       "rival_attack",
					Category: DirectiveCategoryRivals,
					SubAlert: "rival_attack",
					Title:    "Attack Opportunity",
					Message:  attackMsg,
					Urgency:  UrgencyMedium,
					Metadata: map[string]any{
						"rival_pos": playerPos - 1,
						"gap_sec":   gapSec,
					},
				})
			}
		}
	}

	return directives
}
