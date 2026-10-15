package engineer

import (
	"fmt"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// StrategyNewsRule says the stops that shape the player's race beyond the cars right ahead and
// behind, whose stops the undercut and overcut calls cover: the leader's, and a car's close by.
type StrategyNewsRule struct{}

// NewStrategyNewsRule creates a new StrategyNewsRule.
func NewStrategyNewsRule() *StrategyNewsRule {
	return &StrategyNewsRule{}
}

func (r *StrategyNewsRule) Name() string {
	return "strategy_news"
}

func (r *StrategyNewsRule) Category() string {
	return string(DirectiveCategoryPitStrategy)
}

func (r *StrategyNewsRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing}
}

func (r *StrategyNewsRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"leader_pitted": {
			Category:      DirectiveCategoryPitStrategy,
			ValidPhases:   []DrivingPhase{PhaseRacing},
			DedupScope:    DedupScopeNone,
			CooldownGroup: cooldownPitNews,
		},
		"nearby_pitted": {
			Category:      DirectiveCategoryPitStrategy,
			ValidPhases:   []DrivingPhase{PhaseRacing},
			DedupScope:    DedupScopeNone,
			CooldownGroup: cooldownPitNews,
		},
	}
}

// Reset has nothing to clear: each stop shows once (EvaluationContext.PitEntries).
func (r *StrategyNewsRule) Reset(DedupScope) {}

// Evaluate says, as a car enters the pit lane, the leader's stop or else the nearest stop within
// NearbyPitGapSec of the player. Only racing: not under a Safety Car or VSC, when everyone stops.
func (r *StrategyNewsRule) Evaluate(ctx *EvaluationContext) []Directive {
	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}
	playerLap := ctx.PlayerLap()
	if !ctx.IsRaceSession() || playerLap == nil || playerLap.CarPosition <= 0 || ctx.Phase != PhaseRacing {
		return nil
	}
	playerPos := int(playerLap.CarPosition)

	leader := carAtPosition(ctx.LapData, 1)
	if leader >= 0 && pitStopFor(ctx, leader) && !cutCovers(ctx, leader, playerPos) {
		gap := withRival(ctx, leader, &GapToCar{GapSec: roundTo(raceGapSec(ctx, leader, ctx.PlayerCarIndex), 1)})
		return []Directive{{
			ID:       "leader_pitted",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "leader_pitted",
			Title:    "Leader Pitted",
			Message:  fmt.Sprintf("The leader has pitted, %.1fs up the road.", gap.GapSec),
			Urgency:  UrgencyLow,
			Values:   &DirectiveValues{Ahead: gap},
		}}
	}

	nearest, nearestGap := -1, 0.0
	for i := range ctx.LapData.LapData {
		if i == leader || !pitStopFor(ctx, i) || cutCovers(ctx, i, playerPos) {
			continue
		}
		gap := carGapSec(ctx, i, playerPos)
		if gap > 0 && gap <= NearbyPitGapSec && (nearest < 0 || gap < nearestGap) {
			nearest, nearestGap = i, gap
		}
	}
	if nearest < 0 {
		return nil
	}
	pos := int(ctx.LapData.LapData[nearest].CarPosition)
	g := withRival(ctx, nearest, &GapToCar{GapSec: roundTo(nearestGap, 1)})
	subAlert, title := "nearby_pitted_behind", "Car Behind Pitted"
	msg := fmt.Sprintf("The car in P%d, %.1fs behind, has pitted.", pos, g.GapSec)
	values := &DirectiveValues{Behind: g}
	if pos < playerPos {
		subAlert, title = "nearby_pitted_ahead", "Car Ahead Pitted"
		msg = fmt.Sprintf("The car in P%d, %.1fs up the road, has pitted.", pos, g.GapSec)
		values = &DirectiveValues{Ahead: g}
	}
	return []Directive{{
		ID:       "nearby_pitted",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyLow,
		Values:   values,
	}}
}

// carGapSec is how far car i runs from the player, in seconds, ahead or behind by position.
func carGapSec(ctx *EvaluationContext, i, playerPos int) float64 {
	if int(ctx.LapData.LapData[i].CarPosition) < playerPos {
		return raceGapSec(ctx, i, ctx.PlayerCarIndex)
	}
	return raceGapSec(ctx, ctx.PlayerCarIndex, i)
}

// cutCovers reports whether the undercut or overcut call is about car i's stop: it runs right
// behind or right ahead of the player, within UndercutGapSec, with that call on.
func cutCovers(ctx *EvaluationContext, i, playerPos int) bool {
	switch int(ctx.LapData.LapData[i].CarPosition) {
	case playerPos + 1:
		gap := raceGapSec(ctx, ctx.PlayerCarIndex, i)
		return gap > 0 && gap < float64(ctx.Config.UndercutGapSec) &&
			ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "undercut")
	case playerPos - 1:
		gap := raceGapSec(ctx, i, ctx.PlayerCarIndex)
		return gap > 0 && gap <= float64(ctx.Config.UndercutGapSec) &&
			ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "overcut")
	}
	return false
}
