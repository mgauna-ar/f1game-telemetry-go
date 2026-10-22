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
	mu                       sync.Mutex
	lastDrsWarningIndex      int
	lastCarAheadWarningIndex int
	// The defend and attack calls last made, and when: one that never got on the radio before it
	// went stale (a long call before it) is made again while the car is still close.
	defendKey, attackKey        string
	defendAt, attackAt          int64
	activeAeroAnticipationFired bool
	overtakeAnticipationFired   bool
	// The car ahead the player is catching and the car behind catching the player, once called on
	// their way into battle range (-1: none), and when.
	closingAheadIdx, closingBehindIdx int
	closingAheadAt, closingBehindAt   int64
	// penalties are each car's time penalties at the last lap data; the first lap data only
	// records them (penaltiesSeen), so joining a race doesn't announce old penalties.
	penalties     [packets.MaxCars]uint8
	penaltiesSeen bool
}

// NewRivalsRule creates a new RivalsRule.
func NewRivalsRule() *RivalsRule {
	return &RivalsRule{
		lastDrsWarningIndex:      -1,
		lastCarAheadWarningIndex: -1,
		closingAheadIdx:          -1,
		closingBehindIdx:         -1,
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
		// The defend calls are urgent: a new car right behind is called a few seconds after the last.
		"rival_defend": {
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
			MinRepeatMs:             BattleMinRepeatMs,
			SpeechMs:                TrafficSpeechMs,
		},
		"rival_defend_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
			MinRepeatMs:             BattleMinRepeatMs,
			SpeechMs:                TrafficSpeechMs,
		},
		"rival_attack": {
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
			CooldownGroup:           cooldownBattleAhead,
		},
		"rival_attack_override": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			MaxDelayMs:              MomentMaxDelayMs,
			CooldownGroup:           cooldownBattleAhead,
		},
		"aero_straight_anticipation": {
			Category:      DirectiveCategoryRivals,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseFlyingLap},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    MomentMaxDelayMs,
			CooldownGroup: cooldownAeroZones,
		},
		"overtake_boost_anticipation": {
			Category:      DirectiveCategoryRivals,
			ValidPhases:   []DrivingPhase{PhaseRacing},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    MomentMaxDelayMs,
			CooldownGroup: cooldownAeroZones,
		},
		"rival_closing": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			CooldownGroup:           cooldownRivalNews,
		},
		"rival_catching_you": {
			Category:                DirectiveCategoryRivals,
			ValidPhases:             []DrivingPhase{PhaseRacing},
			SuppressAfterPitForLaps: PostPitSuppressionLaps,
			DedupScope:              DedupScopeNone,
			CooldownGroup:           cooldownRivalNews,
		},
		"rival_penalty": {
			Category:      DirectiveCategoryRivals,
			ValidPhases:   []DrivingPhase{PhaseRacing},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    ConditionMaxDelayMs,
			CooldownGroup: cooldownRivalNews,
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
		r.closingAheadIdx, r.closingBehindIdx = -1, -1
		r.penalties, r.penaltiesSeen = [packets.MaxCars]uint8{}, false
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
	penalised := r.newPenaltiesLocked(ctx)

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
	teammateCalled := aheadIdx == ctx.TeammateCarIndex && ctx.Config.IsAlertEnabled(string(DirectiveCategoryTeammate), "teammate_ahead")
	if aheadIdx >= 0 && !teammateCalled {
		if d, ok := r.attackCall(ctx, aheadIdx, playerPos, is2026); ok {
			directives = append(directives, d)
		}
	}
	if r.lastCarAheadWarningIndex != aheadIdx {
		r.lastCarAheadWarningIndex = -1
	}

	// 3. Closing in: the car ahead the player is catching, the car behind catching the player.
	if r.closingAheadIdx != aheadIdx {
		r.closingAheadIdx = -1
	}
	if r.closingBehindIdx != behindIdx {
		r.closingBehindIdx = -1
	}
	if aheadIdx >= 0 && !teammateCalled {
		if d, ok := r.closingCall(ctx, aheadIdx, playerLap, true); ok {
			directives = append(directives, d)
		}
	}
	if behindIdx >= 0 {
		if d, ok := r.closingCall(ctx, behindIdx, playerLap, false); ok {
			directives = append(directives, d)
		}
	}

	// 4. A time penalty for the car right ahead or behind.
	for _, i := range []int{aheadIdx, behindIdx} {
		if i >= 0 && penalised[i] {
			if d, ok := rivalPenaltyCall(ctx, i, i == aheadIdx); ok {
				directives = append(directives, d)
				break
			}
		}
	}

	return directives
}

// closingCall says, once on its way, that a car is closing into battle range: the car ahead (i,
// ahead) the player is catching, or the car behind catching the player. It must be within
// RivalClosingWindowSec but not yet in range, the gap coming down by RivalClosingMinSecPerLap a
// lap or more (at race pace: not a stop in the laps measured), and in range within
// RivalClosingMaxLaps and before the flag. The same car is
// called again once it drops back RivalClosingRearmSec past the window, or when the call went
// stale unsaid.
func (r *RivalsRule) closingCall(ctx *EvaluationContext, i int, playerLap *packets.LapData, ahead bool) (Directive, bool) {
	key, latched, at := "rival_catching_you", &r.closingBehindIdx, &r.closingBehindAt
	gapSec, rangeSec := raceGapSec(ctx, ctx.PlayerCarIndex, i), float64(ctx.Config.RivalGapSec)
	if ahead {
		key, latched, at = "rival_closing", &r.closingAheadIdx, &r.closingAheadAt
		gapSec, rangeSec = raceGapSec(ctx, i, ctx.PlayerCarIndex), float64(ctx.Config.RivalAheadGapSec)
	}
	if *latched == i && (gapSec > RivalClosingWindowSec+RivalClosingRearmSec || ctx.CallLost(key, *at, DefaultMaxDelayMs)) {
		*latched = -1
	}
	if *latched == i || gapSec <= rangeSec+RivalRearmHysteresisSec || gapSec > RivalClosingWindowSec {
		return Directive{}, false
	}
	g := gapToCar(ctx.PlayerLaps, i, uint32(math.Round(gapSec*packets.MillisPerSecond)), ahead)
	if g == nil || g.Trend != GapClosing || g.PerLapSec < RivalClosingMinSecPerLap || g.PerLapSec > RivalClosingMaxSecPerLap {
		return Directive{}, false
	}
	// Rounded first: 1.2 s at 0.3 s a lap is 4 laps, not 4.0000001.
	laps := int(math.Ceil(roundTo((gapSec-rangeSec)/g.PerLapSec, 3)))
	if laps > RivalClosingMaxLaps || (ctx.Session != nil && ctx.Session.TotalLaps > 0 && int(playerLap.CurrentLapNum)+laps > int(ctx.Session.TotalLaps)) {
		return Directive{}, false
	}
	*latched, *at = i, ctx.Now
	withRival(ctx, i, g)

	d := Directive{
		ID:       key,
		Category: DirectiveCategoryRivals,
		SubAlert: key,
		Urgency:  UrgencyLow,
		Values:   &DirectiveValues{LapsToRange: laps},
	}
	if ahead {
		d.Title = "Closing On The Car Ahead"
		d.Message = fmt.Sprintf("Closing on the car ahead (P%d): %.1fs, %.1fs a lap, in range in about %d laps.", playerLap.CarPosition-1, g.GapSec, g.PerLapSec, laps)
		d.Values.Ahead = g
	} else {
		d.Title = "Car Behind Closing"
		d.Message = fmt.Sprintf("The car behind (P%d) is closing: %.1fs, %.1fs a lap, in range in about %d laps.", playerLap.CarPosition+1, g.GapSec, g.PerLapSec, laps)
		d.Values.Behind = g
	}
	return d, true
}

// newPenaltiesLocked follows each car's time penalties and returns the cars whose went up since
// the last lap data. The first lap data only records them.
func (r *RivalsRule) newPenaltiesLocked(ctx *EvaluationContext) [packets.MaxCars]bool {
	var up [packets.MaxCars]bool
	if ctx.LapData == nil {
		return up
	}
	for i := range ctx.LapData.LapData {
		p := ctx.LapData.LapData[i].Penalties
		up[i] = r.penaltiesSeen && p > r.penalties[i]
		r.penalties[i] = p
	}
	r.penaltiesSeen = true
	return up
}

// rivalPenaltyCall says the time penalties the car right ahead (or behind) now has to serve,
// while it is within RivalPenaltyMaxGapSec: the player beats a car ahead that finishes less than
// its penalty in front, and keeps a car behind that finishes less than its penalty back.
func rivalPenaltyCall(ctx *EvaluationContext, i int, ahead bool) (Directive, bool) {
	gapSec := raceGapSec(ctx, ctx.PlayerCarIndex, i)
	if ahead {
		gapSec = raceGapSec(ctx, i, ctx.PlayerCarIndex)
	}
	if gapSec <= 0 || gapSec > RivalPenaltyMaxGapSec {
		return Directive{}, false
	}
	pen := int(ctx.LapData.LapData[i].Penalties)
	g := withRival(ctx, i, &GapToCar{GapSec: roundTo(gapSec, 1)})
	subAlert := "rival_penalty_behind"
	msg := fmt.Sprintf("The car behind, %.1fs back, has %ds of time penalties: keep it within that and we stay ahead.", g.GapSec, pen)
	values := &DirectiveValues{Behind: g, PenaltySec: pen}
	if ahead {
		subAlert = "rival_penalty_ahead"
		msg = fmt.Sprintf("The car ahead, %.1fs up the road, has %ds of time penalties: finish within that and we're ahead.", g.GapSec, pen)
		values = &DirectiveValues{Ahead: g, PenaltySec: pen}
	}
	return Directive{
		ID:       "rival_penalty",
		Category: DirectiveCategoryRivals,
		SubAlert: subAlert,
		Title:    "Rival Penalty",
		Message:  msg,
		Urgency:  UrgencyMedium,
		Values:   values,
	}, true
}

// defendCall warns of car i, right behind, once it comes within RivalGapSec; the same car is
// called again only after dropping back past the threshold. It is urgent: said at once, even under
// braking, since the driver must know before the next straight. DRS is only said when the car
// behind can use it (not on the first laps, in the wet or when race control has it off).
func (r *RivalsRule) defendCall(ctx *EvaluationContext, i, playerPos int, is2026 bool) (Directive, bool) {
	gapSec := raceGapSec(ctx, ctx.PlayerCarIndex, i)
	if r.lastDrsWarningIndex == i && (gapSec > float64(ctx.Config.RivalGapSec+RivalRearmHysteresisSec) || ctx.CallLost(r.defendKey, r.defendAt, MomentMaxDelayMs)) {
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
	r.defendKey, r.defendAt = id, ctx.Now
	return Directive{
		ID:       id,
		Category: DirectiveCategoryRivals,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: gap},
	}, true
}

// attackCall says car i, right ahead, is within RivalAheadGapSec; the same car is called again
// only after pulling away past the threshold. "Catching" is only said when the gap is closing.
func (r *RivalsRule) attackCall(ctx *EvaluationContext, i, playerPos int, is2026 bool) (Directive, bool) {
	gapSec := raceGapSec(ctx, i, ctx.PlayerCarIndex)
	if r.lastCarAheadWarningIndex == i && (gapSec > float64(ctx.Config.RivalAheadGapSec+RivalRearmHysteresisSec) || ctx.CallLost(r.attackKey, r.attackAt, MomentMaxDelayMs)) {
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
	r.attackKey, r.attackAt = id, ctx.Now
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

// rivalGap is the gap to rival i for a battle call, with how it moved over the last laps and
// what is known of the rival.
func rivalGap(ctx *EvaluationContext, i int, gapSec float64, ahead bool) *GapToCar {
	g := gapToCar(ctx.PlayerLaps, i, uint32(math.Round(gapSec*packets.MillisPerSecond)), ahead)
	if g == nil {
		g = &GapToCar{GapSec: roundTo(gapSec, 1)}
	}
	return withRival(ctx, i, g)
}

// withRival adds what is known of rival i to the gap to it on a race call: who drives it, its tyre,
// and how much older that is than the player's.
func withRival(ctx *EvaluationContext, i int, g *GapToCar) *GapToCar {
	g.Name = spokenName(ctx.Participants, i)
	if ctx.Status == nil || i < 0 || i >= len(ctx.Status.CarStatusData) {
		return g
	}
	rival := ctx.Status.CarStatusData[i]
	if g.Compound = tyreCompoundOf(rival.VisualTyreCompound); g.Compound == "" {
		return g
	}
	if player := ctx.PlayerStatus(); player != nil && player.VisualTyreCompound != 0 {
		g.TyreAgeDiffLaps = int(rival.TyresAgeLaps) - int(player.TyresAgeLaps)
	}
	return g
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
