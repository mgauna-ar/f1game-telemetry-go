package engineer

import (
	"fmt"
	"math"
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

	// 1. Defend: the car right behind, out on track (not one pitting or out of the race).
	behindIdx := racingCarAt(ctx, playerPos+1)
	if behindIdx >= 0 {
		if d, ok := r.defendCall(ctx, behindIdx, playerPos, is2026); ok {
			directives = append(directives, d)
		}
	}
	// A car that is no longer right behind can be called again when it is back there.
	if r.lastDrsWarningIndex != behindIdx {
		r.lastDrsWarningIndex = -1
	}

	// 2. Attack: the car right ahead. Not the teammate while its own call covers it.
	aheadIdx := racingCarAt(ctx, playerPos-1)
	if aheadIdx >= 0 && (aheadIdx != ctx.TeammateCarIndex || !ctx.Config.IsAlertEnabled(string(DirectiveCategoryTeammate), "teammate_ahead")) {
		if d, ok := r.attackCall(ctx, aheadIdx, playerPos, is2026); ok {
			directives = append(directives, d)
		}
	}
	if r.lastCarAheadWarningIndex != aheadIdx {
		r.lastCarAheadWarningIndex = -1
	}

	return directives
}

// defendCall warns of car i, right behind, once it comes within RivalGapSec; the same car is
// called again only after dropping back past the threshold. DRS is only said when the car behind
// can use it (not on the first laps, in the wet or when race control has it off).
func (r *RivalsRule) defendCall(ctx *EvaluationContext, i, playerPos int, is2026 bool) (Directive, bool) {
	gapSec := raceGapSec(ctx, ctx.PlayerCarIndex, i)
	if r.lastDrsWarningIndex == i && gapSec > float64(ctx.Config.RivalGapSec+RivalRearmHysteresisSec) {
		r.lastDrsWarningIndex = -1
	}
	if gapSec <= 0 || gapSec > float64(ctx.Config.RivalGapSec) || r.lastDrsWarningIndex == i {
		return Directive{}, false
	}
	r.lastDrsWarningIndex = i

	extra := rivalTyreContext(ctx, i, true)
	if ctx.Damage != nil && i < len(ctx.Damage.CarDamageData) {
		rivalDamage := ctx.Damage.CarDamageData[i]
		if float32(rivalDamage.FrontLeftWingDamage+rivalDamage.FrontRightWingDamage) > RivalDamageWingThresholdPct {
			extra += " Note: Car behind has front wing damage."
		}
	}
	gap := rivalGap(ctx, i, gapSec, false)
	id, subAlert, title := "rival_defend", "rival_defend", "Defend Position"
	msg := fmt.Sprintf("Defend! Car behind (P%d) is within a second (%.1fs gap%s).%s", playerPos+1, gap.GapSec, trendNote(gap), extra)
	switch {
	case is2026:
		id, subAlert, title = "rival_defend_override", "rival_defend_override", "Defend Position (Boost Threat)"
		msg = fmt.Sprintf("Defend! Car behind (P%d) is within Override range (%.1fs gap%s).%s", playerPos+1, gap.GapSec, trendNote(gap), extra)
	case ctx.Status != nil && i < len(ctx.Status.CarStatusData) && ctx.Status.CarStatusData[i].DRSAllowed == 1:
		subAlert = "rival_defend_drs"
		msg = fmt.Sprintf("Defend! Car behind (P%d) has DRS (%.1fs gap%s).%s", playerPos+1, gap.GapSec, trendNote(gap), extra)
	}
	return Directive{
		ID:       id,
		Category: DirectiveCategoryRivals,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyMedium,
		Values:   &DirectiveValues{Behind: gap},
	}, true
}

// attackCall says car i, right ahead, is within RivalAheadGapSec; the same car is called again
// only after pulling away past the threshold. "Catching" is only said when the gap is closing.
func (r *RivalsRule) attackCall(ctx *EvaluationContext, i, playerPos int, is2026 bool) (Directive, bool) {
	gapSec := raceGapSec(ctx, i, ctx.PlayerCarIndex)
	if r.lastCarAheadWarningIndex == i && gapSec > float64(ctx.Config.RivalAheadGapSec+RivalRearmHysteresisSec) {
		r.lastCarAheadWarningIndex = -1
	}
	if gapSec <= 0 || gapSec > float64(ctx.Config.RivalAheadGapSec) || r.lastCarAheadWarningIndex == i {
		return Directive{}, false
	}
	r.lastCarAheadWarningIndex = i

	tyres := rivalTyreContext(ctx, i, false)
	gap := rivalGap(ctx, i, gapSec, true)
	lead := fmt.Sprintf("Car ahead (P%d) is within reach, gap %.1fs%s.", playerPos-1, gap.GapSec, trendNote(gap))
	id, subAlert, title := "rival_attack", "rival_attack", "Attack Opportunity"
	msg := lead + tyres
	playerStatus := ctx.PlayerStatus()
	switch {
	case is2026:
		id, subAlert, title = "rival_attack_override", "rival_attack_override", "Attack Opportunity (Override Available)"
		var boost string
		if tele2 := ctx.PlayerTelemetry2(); tele2 != nil && tele2.OvertakeAvailable == 1 {
			boost = " Override is available!"
		}
		msg = lead + tyres + boost + " Use Straight Mode and Override to pass."
	case playerStatus != nil && playerStatus.DRSAllowed == 1:
		subAlert = "rival_attack_drs"
		msg = fmt.Sprintf("DRS on the car ahead (P%d), gap %.1fs%s.%s", playerPos-1, gap.GapSec, trendNote(gap), tyres)
	}
	return Directive{
		ID:       id,
		Category: DirectiveCategoryRivals,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyMedium,
		Values:   &DirectiveValues{Ahead: gap},
	}, true
}

// rivalGap is the gap to rival i for a battle call, with how it moved over the last laps.
func rivalGap(ctx *EvaluationContext, i int, gapSec float64, ahead bool) *GapToCar {
	if g := gapToCar(ctx.PlayerLaps, i, uint32(math.Round(gapSec*packets.MillisPerSecond)), ahead); g != nil {
		return g
	}
	return &GapToCar{GapSec: roundTo(gapSec, 1)}
}

// trendNote describes a battle gap's trend for the server log: ", closing 0.3s a lap".
func trendNote(g *GapToCar) string {
	if g.Trend == GapClosing || g.Trend == GapOpening {
		return fmt.Sprintf(", %s %.1fs a lap", g.Trend, g.PerLapSec)
	}
	return ""
}

// rivalTyreContext describes rival i's tyres for the server log: always for the car ahead, and
// for the car behind only when they differ from the player's.
func rivalTyreContext(ctx *EvaluationContext, i int, onlyIfDifferent bool) string {
	if ctx.Status == nil || i >= len(ctx.Status.CarStatusData) {
		return ""
	}
	rival := ctx.Status.CarStatusData[i]
	if onlyIfDifferent {
		player := ctx.PlayerStatus()
		if player == nil || rival.ActualTyreCompound == 0 || player.ActualTyreCompound == 0 || rival.ActualTyreCompound == player.ActualTyreCompound {
			return ""
		}
	}
	return fmt.Sprintf(" Rival is on %s tyres (age: %d laps).", packets.VisualTyreCompoundName(rival.VisualTyreCompound), rival.TyresAgeLaps)
}
