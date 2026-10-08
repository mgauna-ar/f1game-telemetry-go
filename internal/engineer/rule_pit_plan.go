package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// PitPlanRule calls the player in on the game's own pit plan, the way the game's engineer does:
// "box next lap" early in the lap before the plan's ideal lap, "box this lap" on it, and a last
// call on the plan's latest lap when the stop still hasn't been made.
type PitPlanRule struct {
	mu             sync.Mutex
	headsUpFor     int // the ideal lap the "box next lap" heads-up was said for (0: none)
	boxCalledFor   int // the ideal lap the call to box was made for
	closeCalledFor int // the latest lap the last call was made for
	lastLap        int // the player's lap at the last evaluation
}

// NewPitPlanRule creates a new PitPlanRule.
func NewPitPlanRule() *PitPlanRule {
	return &PitPlanRule{}
}

func (r *PitPlanRule) Name() string {
	return "pit_plan"
}

func (r *PitPlanRule) Category() string {
	return string(DirectiveCategoryPitStrategy)
}

// ValidPhases includes the Safety Car: a stop on the plan's lap is cheapest under it.
func (r *PitPlanRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhaseSafetyCar}
}

func (r *PitPlanRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"pit_window": {
			Category:             DirectiveCategoryPitStrategy,
			ValidPhases:          []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:           DedupScopeLap,
			SkipCategoryCooldown: true,
			NotWhileBoxDue:       true,
			LapBound:             true,
		},
		"pit_plan_box": {
			Category:             DirectiveCategoryPitStrategy,
			ValidPhases:          []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:           DedupScopeLap,
			SkipCategoryCooldown: true,
		},
		"pit_window_close": {
			Category:             DirectiveCategoryPitStrategy,
			ValidPhases:          []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:           DedupScopeLap,
			SkipCategoryCooldown: true,
		},
	}
}

// Reset clears the calls made only for a new session: a plan's calls are made once per plan.
func (r *PitPlanRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if scope == DedupScopeNone {
		r.headsUpFor, r.boxCalledFor, r.closeCalledFor, r.lastLap = 0, 0, 0, 0
	}
}

func (r *PitPlanRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}
	// A flashback re-drives the laps the calls were made on.
	if lap := ctx.PlayerLap(); lap != nil {
		if int(lap.CurrentLapNum) < r.lastLap {
			r.headsUpFor, r.boxCalledFor, r.closeCalledFor = 0, 0, 0
		}
		r.lastLap = int(lap.CurrentLapNum)
	}
	n, ok := pitPlanOpen(ctx)
	if !ok {
		return nil
	}
	plan := ctx.PitPlan
	var values *DirectiveValues
	if plan.RejoinPosition > 0 {
		values = &DirectiveValues{Position: plan.RejoinPosition}
	}
	// This lap's pit entry can still be called: a plan the game moves to this lap after that
	// waits for the next lap, rather than saying "box next lap" for a lap off the plan.
	inTime := ctx.BoxTiming() == BoxThisLap

	switch {
	case n == plan.IdealLap-1 && r.headsUpFor != plan.IdealLap:
		pct := ctx.CalculateLapDistancePct()
		if pct < PitPlanHeadsUpFromPct || pct > PitPlanHeadsUpToPct {
			return nil
		}
		r.headsUpFor = plan.IdealLap
		return []Directive{{
			ID:       "pit_window",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_plan_next_lap",
			Title:    "Box Next Lap",
			Message:  fmt.Sprintf("Box next lap: lap %d is the plan's stop.%s", plan.IdealLap, rejoinText(plan)),
			Urgency:  UrgencyMedium,
			Values:   values,
		}}
	case n >= plan.IdealLap && n <= planLatestLap(plan) && r.boxCalledFor != plan.IdealLap && inTime:
		r.boxCalledFor = plan.IdealLap
		return []Directive{{
			ID:       "pit_plan_box",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_plan_box",
			Title:    "Box This Lap",
			Message:  fmt.Sprintf("Box this lap for the planned stop (ideal lap %d).%s", plan.IdealLap, rejoinText(plan)),
			Urgency:  UrgencyHigh,
			BoxCall:  BoxCallInstruction,
			Values:   values,
		}}
	case n == plan.LatestLap && plan.LatestLap > plan.IdealLap && r.closeCalledFor != plan.LatestLap && inTime:
		r.closeCalledFor = plan.LatestLap
		return []Directive{{
			ID:       "pit_window_close",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_window_close",
			Title:    "Pit Window Closing",
			Message:  fmt.Sprintf("Box this lap, box box! Lap %d is the last lap of the plan's pit window.", n),
			Urgency:  UrgencyHigh,
			BoxCall:  BoxCallInstruction,
		}}
	}
	return nil
}

// rejoinText is the plan's rejoin position for the log, or nothing while unknown.
func rejoinText(plan PitPlanState) string {
	if plan.RejoinPosition == 0 {
		return ""
	}
	return fmt.Sprintf(" We'd rejoin P%d.", plan.RejoinPosition)
}
