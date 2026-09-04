package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// RivalsRule manages defending against cars behind, attacking cars ahead,
// and 2026 active aero / override boost zone anticipation.
type RivalsRule struct {
	mu                          sync.Mutex
	lastDrsWarningIndex         int
	lastCarAheadWarningIndex    int
	activeAeroAnticipationFired bool
	overtakeAnticipationFired   bool
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
	return []DrivingPhase{PhaseRacing, PhaseFlyingLap}
}

func (r *RivalsRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"rival_defend": {
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
		},
		"rival_defend_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
		},
		"rival_attack": {
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
		},
		"rival_attack_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
		},
		"aero_straight_anticipation": {
			Category:    DirectiveCategoryRivals,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:  DedupScopeNone,
		},
		"overtake_boost_anticipation": {
			Category:    DirectiveCategoryRivals,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
	}
}

func (r *RivalsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone || scope == DedupScopeLap {
		r.activeAeroAnticipationFired = false
		r.overtakeAnticipationFired = false
	}
	if scope == DedupScopeNone {
		r.lastDrsWarningIndex = -1
		r.lastCarAheadWarningIndex = -1
	}
}

func (r *RivalsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive
	is2026 := ctx.Is2026()

	// 1. 2026 Active Aero & Overtake Boost Anticipation
	if is2026 && (ctx.Phase == PhaseRacing || ctx.Phase == PhaseFlyingLap) {
		tele2 := ctx.PlayerTelemetry2()
		if tele2 != nil {
			// Straight Mode Anticipation
			if tele2.ActiveAeroAvailable == 1 && tele2.ActiveAeroMode == 0 &&
				tele2.ActiveAeroActivationDistance > 0 && tele2.ActiveAeroActivationDistance <= ActiveAeroAnticipationDistanceM {
				if !r.activeAeroAnticipationFired {
					r.activeAeroAnticipationFired = true
					directives = append(directives, Directive{
						ID:       "aero_straight_anticipation",
						Category: DirectiveCategoryRivals,
						SubAlert: "aero_straight_anticipation",
						Title:    "Straight Mode Approaching",
						Message:  "Straight Mode zone in 100 metres! Prepare to activate low-drag aero on corner exit.",
						Urgency:  UrgencyMedium,
						Metadata: map[string]any{
							"activation_distance_m": tele2.ActiveAeroActivationDistance,
							"is_2026":               true,
						},
					})
				}
			} else if tele2.ActiveAeroActivationDistance == 0 || tele2.ActiveAeroMode == 1 {
				r.activeAeroAnticipationFired = false
			}

			// Override Boost Anticipation (Racing phase only)
			if ctx.Phase == PhaseRacing {
				if tele2.OvertakeAvailable == 1 && tele2.OvertakeActive == 0 &&
					tele2.OvertakeActivationDistance > 0 && tele2.OvertakeActivationDistance <= OvertakeBoostAnticipationDistanceM {
					if !r.overtakeAnticipationFired {
						r.overtakeAnticipationFired = true
						directives = append(directives, Directive{
							ID:       "overtake_boost_anticipation",
							Category: DirectiveCategoryRivals,
							SubAlert: "overtake_boost_anticipation",
							Title:    "Override Zone Approaching",
							Message:  "Override zone ahead in 100 metres! Ready on the boost button.",
							Urgency:  UrgencyMedium,
							Metadata: map[string]any{
								"activation_distance_m": tele2.OvertakeActivationDistance,
								"is_2026":               true,
							},
						})
					}
				} else if tele2.OvertakeActivationDistance == 0 || tele2.OvertakeActive == 1 {
					r.overtakeAnticipationFired = false
				}
			}
		}
	}

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return directives
	}

	playerLap := ctx.PlayerLap()
	if !ctx.IsRaceSession() || playerLap == nil || playerLap.CarPosition <= 0 || ctx.Phase != PhaseRacing ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) || playerLap.SafetyCarDelta != 0 ||
		ctx.LapData == nil || playerLap.CurrentLapNum == 1 {
		return directives
	}

	playerPos := int(playerLap.CarPosition)

	// 1. Defend: Car Behind (playerPos + 1)
	maxDefendDist := ctx.Config.RivalGapSec * AverageRaceSpeedMetersPerSec
	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos+1 {
			continue
		}
		distDelta := playerLap.TotalDistance - rival.TotalDistance
		var gapSec float32
		var hasExactGap bool
		if rival.DeltaToCarInFrontMSPart > 0 || rival.DeltaToCarInFrontMinutesPart > 0 {
			exactSec := float32(uint32(rival.DeltaToCarInFrontMinutesPart)*packets.MillisPerMinute+uint32(rival.DeltaToCarInFrontMSPart)) / float32(packets.MillisPerSecond)
			if exactSec > 0 {
				gapSec = exactSec
				hasExactGap = true
			}
		}
		if !hasExactGap && distDelta > 0 {
			gapSec = distDelta / AverageRaceSpeedMetersPerSec
		}

		inDefendRange := (hasExactGap && gapSec <= ctx.Config.RivalGapSec) || (!hasExactGap && distDelta > 0 && distDelta < maxDefendDist)
		if inDefendRange && r.lastDrsWarningIndex != i {
			r.lastDrsWarningIndex = i

			var extraContext string
			if ctx.Status != nil && i < len(ctx.Status.CarStatusData) {
				rivalStatus := ctx.Status.CarStatusData[i]
				playerStatus := ctx.PlayerStatus()
				if playerStatus != nil && rivalStatus.ActualTyreCompound > 0 && playerStatus.ActualTyreCompound > 0 && rivalStatus.ActualTyreCompound != playerStatus.ActualTyreCompound {
					rivalCompound := packets.VisualTyreCompoundName(rivalStatus.VisualTyreCompound)
					extraContext += fmt.Sprintf(" Rival is on %s tyres (tyre age: %d laps).", rivalCompound, rivalStatus.TyresAgeLaps)
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
			subAlert := "rival_defend"
			title := "Defend Position"
			if is2026 {
				subAlert = "rival_defend_override"
				title = "Defend Position (Boost Threat)"
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within Override/Boost attack threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			} else {
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within DRS threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			}

			directives = append(directives, Directive{
				ID:       subAlert,
				Category: DirectiveCategoryRivals,
				SubAlert: subAlert,
				Title:    title,
				Message:  defendMsg,
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"rival_pos": playerPos + 1,
					"gap_sec":   gapSec,
					"is_2026":   is2026,
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
			var gapSec float32
			var hasExactGap bool
			if playerLap.DeltaToCarInFrontMSPart > 0 || playerLap.DeltaToCarInFrontMinutesPart > 0 {
				exactSec := float32(uint32(playerLap.DeltaToCarInFrontMinutesPart)*packets.MillisPerMinute+uint32(playerLap.DeltaToCarInFrontMSPart)) / float32(packets.MillisPerSecond)
				if exactSec > 0 {
					gapSec = exactSec
					hasExactGap = true
				}
			}
			if !hasExactGap && distDelta > 0 {
				gapSec = distDelta / AverageRaceSpeedMetersPerSec
			}

			inAttackRange := (hasExactGap && gapSec <= ctx.Config.RivalAheadGapSec) || (!hasExactGap && distDelta > 0 && distDelta < maxAttackDist)
			if inAttackRange && r.lastCarAheadWarningIndex != i {
				r.lastCarAheadWarningIndex = i

				var tyreContext string
				if ctx.Status != nil && i < len(ctx.Status.CarStatusData) {
					rivalStatus := ctx.Status.CarStatusData[i]
					rivalCompound := packets.VisualTyreCompoundName(rivalStatus.VisualTyreCompound)
					tyreContext = fmt.Sprintf(" Car ahead is on %s tyres (age: %d laps).", rivalCompound, rivalStatus.TyresAgeLaps)
				}

				var attackMsg string
				subAlert := "rival_attack"
				title := "Attack Opportunity"
				if is2026 {
					subAlert = "rival_attack_override"
					title = "Attack Opportunity (Override Available)"
					telemetry2 := ctx.PlayerTelemetry2()
					var boostContext string
					if telemetry2 != nil && telemetry2.OvertakeAvailable == 1 {
						boostContext = " Override Boost is available!"
					}
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s%s Prepare overtake using Straight Mode and Boost deployment.", playerPos-1, gapSec, tyreContext, boostContext)
				} else {
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s Mode overtake available.", playerPos-1, gapSec, tyreContext)
				}

				directives = append(directives, Directive{
					ID:       subAlert,
					Category: DirectiveCategoryRivals,
					SubAlert: subAlert,
					Title:    title,
					Message:  attackMsg,
					Urgency:  UrgencyMedium,
					Metadata: map[string]any{
						"rival_pos": playerPos - 1,
						"gap_sec":   gapSec,
						"is_2026":   is2026,
					},
				})
			}
		}
	}

	return directives
}
