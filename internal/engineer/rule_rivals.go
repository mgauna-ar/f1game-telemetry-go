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
			MaxDelayMs:              MomentMaxDelayMs,
		},
		"rival_defend_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
		},
		"rival_attack": {
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
		},
		"rival_attack_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
		},
		"aero_straight_anticipation": {
			Category:    DirectiveCategoryRivals,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  MomentMaxDelayMs,
		},
		"overtake_boost_anticipation": {
			Category:    DirectiveCategoryRivals,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  MomentMaxDelayMs,
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
	behindIdx := -1
	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos+1 {
			continue
		}
		behindIdx = i
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
		// The car can be called again once it has dropped back past the threshold.
		if r.lastDrsWarningIndex == i && gapSec > ctx.Config.RivalGapSec+RivalRearmHysteresisSec {
			r.lastDrsWarningIndex = -1
		}
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

			// DRS is only said when the car behind can use it (2025): not on the first laps, in the
			// wet or when race control has it off.
			id := "rival_defend"
			subAlert := "rival_defend"
			title := "Defend Position"
			defendMsg := fmt.Sprintf("Defend! Car behind (P%d) is within a second (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			switch {
			case is2026:
				id = "rival_defend_override"
				subAlert = "rival_defend_override"
				title = "Defend Position (Boost Threat)"
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within Override/Boost attack threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			case ctx.Status != nil && i < len(ctx.Status.CarStatusData) && ctx.Status.CarStatusData[i].DRSAllowed == 1:
				subAlert = "rival_defend_drs"
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) has DRS (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			}

			directives = append(directives, Directive{
				ID:       id,
				Category: DirectiveCategoryRivals,
				SubAlert: subAlert,
				Title:    title,
				Message:  defendMsg,
				Urgency:  UrgencyMedium,
				Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(float64(gapSec), 1)}},
			})
		}
	}

	// A car that is no longer right behind can be called again when it is back there.
	if r.lastDrsWarningIndex != behindIdx {
		r.lastDrsWarningIndex = -1
	}

	// 2. Attack: Car Ahead (playerPos - 1)
	aheadIdx := -1
	if playerPos > 1 {
		maxAttackDist := ctx.Config.RivalAheadGapSec * AverageRaceSpeedMetersPerSec
		for i, rival := range ctx.LapData.LapData {
			if i == ctx.PlayerCarIndex || int(rival.CarPosition) != playerPos-1 {
				continue
			}
			aheadIdx = i
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
			if r.lastCarAheadWarningIndex == i && gapSec > ctx.Config.RivalAheadGapSec+RivalRearmHysteresisSec {
				r.lastCarAheadWarningIndex = -1
			}
			if inAttackRange && r.lastCarAheadWarningIndex != i {
				r.lastCarAheadWarningIndex = i

				var tyreContext string
				if ctx.Status != nil && i < len(ctx.Status.CarStatusData) {
					rivalStatus := ctx.Status.CarStatusData[i]
					rivalCompound := packets.VisualTyreCompoundName(rivalStatus.VisualTyreCompound)
					tyreContext = fmt.Sprintf(" Car ahead is on %s tyres (age: %d laps).", rivalCompound, rivalStatus.TyresAgeLaps)
				}

				id := "rival_attack"
				subAlert := "rival_attack"
				title := "Attack Opportunity"
				attackMsg := fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s", playerPos-1, gapSec, tyreContext)
				playerStatus := ctx.PlayerStatus()
				switch {
				case is2026:
					id = "rival_attack_override"
					subAlert = "rival_attack_override"
					title = "Attack Opportunity (Override Available)"
					telemetry2 := ctx.PlayerTelemetry2()
					var boostContext string
					if telemetry2 != nil && telemetry2.OvertakeAvailable == 1 {
						boostContext = " Override Boost is available!"
					}
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s%s Prepare overtake using Straight Mode and Boost deployment.", playerPos-1, gapSec, tyreContext, boostContext)
				case playerStatus != nil && playerStatus.DRSAllowed == 1:
					subAlert = "rival_attack_drs"
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d) with DRS, gap is %.1fs.%s", playerPos-1, gapSec, tyreContext)
				}

				directives = append(directives, Directive{
					ID:       id,
					Category: DirectiveCategoryRivals,
					SubAlert: subAlert,
					Title:    title,
					Message:  attackMsg,
					Urgency:  UrgencyMedium,
					Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: roundTo(float64(gapSec), 1)}},
				})
			}
		}
	}
	if r.lastCarAheadWarningIndex != aheadIdx {
		r.lastCarAheadWarningIndex = -1
	}

	return directives
}
