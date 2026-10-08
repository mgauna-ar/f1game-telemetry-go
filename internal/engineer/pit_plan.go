package engineer

import "github.com/mgauna/f1game-telemetry-go/internal/packets"

// PitPlanState is the game's plan for the player's next pit stop in a race: the ideal and latest
// lap to pit on and the position they would rejoin in (Session packet), and whether they have
// made that stop. Pitting on a lap means entering the pit lane at its end.
type PitPlanState struct {
	IdealLap       int // 0: no plan
	LatestLap      int
	RejoinPosition int // 0 while unknown
	Done           bool
}

// pitPlanTracker follows the game's pit plan and the player's stops. A stop made for the plan
// marks it done until the game moves the ideal lap (the next stop of a two-stop race). The plan
// isn't moved while the player is in the pit lane, so whether the game updates the stop or the
// plan first, the stop counts for the plan it was made for. A flashback to before the stop undoes
// it.
type pitPlanTracker struct {
	plan        PitPlanState
	inPitLane   bool
	stoppedHere bool // the player stopped in the box on this visit to the pit lane
	visitLap    int  // the lap the player entered the pit lane on
	doneLap     int  // the lap of the stop that made the plan done
}

// update follows the plan from the latest session packet and the player's lap.
func (t *pitPlanTracker) update(session *packets.PacketSessionData, lap *packets.LapData) {
	if session == nil || lap == nil || !packets.IsRaceSession(session.SessionType) {
		*t = pitPlanTracker{}
		return
	}
	if lap.PitStatus != packets.PitStatusNone {
		if !t.inPitLane {
			t.inPitLane, t.visitLap = true, int(lap.CurrentLapNum)
		}
		if lap.PitStatus == packets.PitStatusInPitArea {
			t.stoppedHere = true
		}
		return
	}
	// A stop made well before the plan's lap (damage, a puncture) leaves the plan to the game.
	if t.inPitLane && t.stoppedHere && t.plan.IdealLap > 0 && t.visitLap >= t.plan.IdealLap-PitPlanEarlyLaps {
		t.plan.Done, t.doneLap = true, t.visitLap
	}
	t.inPitLane, t.stoppedHere = false, false
	if t.plan.Done && int(lap.CurrentLapNum) < t.doneLap {
		t.plan.Done = false
	}

	if ideal := int(session.PitStopWindowIdealLap); ideal != t.plan.IdealLap {
		t.plan, t.doneLap = PitPlanState{IdealLap: ideal}, 0
	}
	t.plan.LatestLap = int(session.PitStopWindowLatestLap)
	t.plan.RejoinPosition = int(session.PitStopRejoinPosition)
}

// pitPlanOpen reports whether the game's pit plan may still call the player in: a race, a plan
// not yet done, enough laps left for a stop, tyres not just fitted, out of the pit lane and no
// other call to box open. It returns the player's lap.
func pitPlanOpen(ctx *EvaluationContext) (int, bool) {
	plan := ctx.PitPlan
	lap, status := ctx.PlayerLap(), ctx.PlayerStatus()
	if !ctx.IsRaceSession() || ctx.Session == nil || plan.IdealLap == 0 || plan.Done || lap == nil || status == nil ||
		lap.PitStatus != packets.PitStatusNone || int(status.TyresAgeLaps) < PitPlanMinTyreAgeLaps {
		return 0, false
	}
	n := int(lap.CurrentLapNum)
	if total := int(ctx.Session.TotalLaps); total > 0 && max(n, plan.IdealLap) > total-PitPlanMinLapsToGo {
		return 0, false
	}
	if ctx.BoxDueLap != 0 && ctx.BoxDueLap >= n {
		return 0, false
	}
	return n, true
}

// planStopAhead reports whether the game's plan still has a stop for the player to make.
func planStopAhead(ctx *EvaluationContext) bool {
	return ctx.PitPlan.IdealLap > 0 && !ctx.PitPlan.Done
}

// planLatestLap is the last lap of the plan's window: the latest lap, or the ideal lap when the
// game sends no later one.
func planLatestLap(plan PitPlanState) int {
	return max(plan.LatestLap, plan.IdealLap)
}

// isPlanHeadsUpLap reports whether lap n is the one the plan's "box next lap" heads-up is said on,
// or was.
func isPlanHeadsUpLap(ctx *EvaluationContext, n int) bool {
	if ctx.CallLaps["pit_window"] == n {
		return true
	}
	plan := ctx.PitPlan
	return plan.IdealLap > 0 && !plan.Done && n == plan.IdealLap-1 &&
		ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "pit_window")
}

// safetyCarStopNear reports whether a Safety Car or VSC (scStatus) coming out now is the time to
// take the plan's stop: the plan is open, its calls are on, and its lap is near.
func safetyCarStopNear(ctx *EvaluationContext, scStatus uint8) bool {
	n, ok := pitPlanOpen(ctx)
	if !ok || !ctx.Config.IsAlertEnabled(string(DirectiveCategoryPitStrategy), "pit_plan_box") {
		return false
	}
	early := PitPlanEarlyLaps
	if scStatus == packets.SafetyCarVirtual {
		early = VSCStopEarlyLaps
	}
	return n >= ctx.PitPlan.IdealLap-early && n <= planLatestLap(ctx.PitPlan)
}
