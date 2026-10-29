package engineer

import (
	"log/slog"
	"math"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// trafficApproach is where the qualifying rule stands with one car the player is about to meet.
type trafficApproach struct {
	warned    bool
	madeAt    int64 // unix ms the call was made
	confirmed bool  // the call got on the radio
	subAlert  string
	reachSec  int   // the number it said (0: none)
	leadMs    int64 // the delivery lead it was timed with
	meet      trafficMeeting
	source    string // the pace profile it was worked out on
	overSince int64  // unix ms since the car runs TrafficRearmSec past the warning time; 0 when not
	// train is whether it was warned of as the second of two push-lap cars (the first one's close
	// call covers it); fromPitExit whether the pit exit call warned of it.
	train       bool
	fromPitExit bool
	// The follow-ups: when "on you now" was made (0: not) and whether the radio said it; when the
	// car went by (0: not yet) and when "clear" was made after it.
	closeAt   int64
	closeSaid bool
	passedAt  int64
	clearAt   int64
}

// trafficWarnSec is how long before the two cars meet the driver hears the number.
func trafficWarnSec(ctx *EvaluationContext) float64 {
	if w := float64(ctx.Config.QualyTrafficWarnSec); w > 0 {
		return w
	}
	return QualyTrafficWarnDefaultSec
}

// heardSec is when the two cars meet, counted from when the driver hears the call's number.
func heardSec(ctx *EvaluationContext, m trafficMeeting) float64 {
	return m.reachSec - float64(ctx.DeliveryLeadMs+TrafficNumberHeardMs)/1000
}

// trafficLog is what a rule's traffic calls are logged as: once the radio said one, and once the
// car went by.
type trafficLog struct {
	said, passed string
}

var (
	pushLapTrafficLog = trafficLog{said: "Push-lap traffic", passed: "Push-lap car passed"}
	raceTrafficLog    = trafficLog{said: "Race traffic", passed: "Race traffic passed"}
)

// followTrafficLocked forgets what was worked out from motion samples since dropped (a
// flashback), and checks the calls made on the last packet got on the radio: one that didn't (the
// repeat limit took it) is made again, so a second car is still called.
func (r *QualifyingRule) followTrafficLocked(ctx *EvaluationContext) {
	if ctx.Motion != nil && ctx.Motion.epoch != r.motionEpoch {
		r.motionEpoch = ctx.Motion.epoch
		r.behind = [packets.MaxCars]trafficApproach{}
		r.ahead = [packets.MaxCars]trafficApproach{}
	}
	r.followBehindLocked(ctx, qualyBehindKeys, pushLapTrafficLog)
	confirmTraffic(ctx, &r.ahead, "qualy_traffic_ahead", trafficProfile(ctx), pushLapTrafficLog)
}

// qualyBehindKeys are the qualifying rule's cars-behind alert keys.
var qualyBehindKeys = behindKeys{
	warn: "inlap_traffic_behind", close: "inlap_traffic_close", clear: "inlap_traffic_clear", pitExit: "qualy_pit_exit_traffic",
}

// confirmTraffic checks the calls made under alert key for states got on the radio: one the
// radio didn't say is forgotten, so it is made again; one it said is logged as log.said, with
// the pace windows on prof, the profile the calls run on.
func confirmTraffic(ctx *EvaluationContext, states *[packets.MaxCars]trafficApproach, key string, prof paceProfile, log trafficLog) {
	for i := range states {
		a := &states[i]
		if !a.warned || a.confirmed {
			continue
		}
		if ctx.LastSaid[key] < a.madeAt {
			*a = trafficApproach{}
			continue
		}
		a.confirmed = true
		// What the player and the car ran over each window, to see where the shares came from.
		window := func(idx int, ms int64) float64 {
			share, _ := ctx.Motion.paceShare(idx, ms, prof)
			return roundTo(share, 3)
		}
		car := &ctx.LapData.LapData[i]
		slog.Info(log.said,
			"key", a.subAlert, "car", i, "road_sec", roundTo(a.meet.roadSec, 1),
			"reach_sec", roundTo(a.meet.reachSec, 1), "said_sec", a.reachSec,
			"fast_share", roundTo(a.meet.fast, 3), "slow_share", roundTo(a.meet.slow, 3),
			"player_short", window(ctx.PlayerCarIndex, PaceWindowShortMs), "player_long", window(ctx.PlayerCarIndex, PaceWindowLongMs),
			"car_short", window(i, PaceWindowShortMs), "car_long", window(i, PaceWindowLongMs),
			"driver_status", car.DriverStatus, "result_status", car.ResultStatus,
			"profile", a.source, "lead_ms", a.leadMs)
	}
}

// trackApproach moves a warned car's state on: it passed (gap wrapped past half a lap: logged as
// log.passed, and kept, with when, for "clear" when clearAfter), or fell back far enough for long
// enough to be warned again.
// It reports whether the car is still on its way to the player.
func trackApproach(ctx *EvaluationContext, a *trafficApproach, idx int, gapM, lapM float32, heard float64, clearAfter bool, log trafficLog) bool {
	if !a.warned || a.passedAt > 0 {
		return false
	}
	if a.confirmed && gapM > lapM/2 {
		// A call with a number says when the car should get there; one without says nothing to check.
		expected := 0.0
		if a.reachSec > 0 {
			expected = roundTo(float64(a.reachSec)+float64(a.leadMs+TrafficNumberHeardMs)/1000, 1)
		}
		slog.Info(log.passed,
			"key", a.subAlert, "car", idx, "said_sec", a.reachSec,
			"after_call_sec", roundTo(float64(ctx.Now-a.madeAt)/1000, 1), "expected_sec", expected)
		if !clearAfter {
			*a = trafficApproach{}
			return false
		}
		a.passedAt = ctx.Now
		return false
	}
	if heard > trafficWarnSec(ctx)+TrafficRearmSec {
		if a.overSince == 0 {
			a.overSince = ctx.Now
		} else if ctx.Now-a.overSince >= TrafficRearmMs {
			*a = trafficApproach{}
			return false
		}
	} else {
		a.overSince = 0
	}
	return true
}

// prePush reports whether car idx, on its out-lap, is about to start a push lap before it reaches
// the player: within PrePushToLineM of the line, at PrePushShare of its push pace, with the line
// between it and the player.
func prePush(ctx *EvaluationContext, idx int, rival, player *packets.LapData, lapM float32, prof paceProfile) bool {
	if rival.DriverStatus != packets.DriverStatusOutLap {
		return false
	}
	toLine := trackGapM(rival.LapDistance, 0, lapM)
	if toLine > PrePushToLineM || trackGapM(rival.LapDistance, player.LapDistance, lapM) <= toLine {
		return false
	}
	share, ok := ctx.Motion.paceShare(idx, PaceWindowLongMs, prof)
	return ok && share >= PrePushShare*pushShare(ctx, idx, prof)
}

// trafficCall records the call made for a car met at m, under alert key (nowKey when the car is
// right there): the number of seconds the driver has once they hear it, or that it is right there
// (now, no number).
func trafficCall(ctx *EvaluationContext, a *trafficApproach, m trafficMeeting, source, key, nowKey string) (now bool, reach int) {
	heard := heardSec(ctx, m)
	now = m.roadSec < TrafficNowRoadSec || heard < TrafficNowMinSec
	subAlert := key
	if now {
		subAlert = nowKey
	} else {
		reach = int(math.Round(heard))
	}
	*a = trafficApproach{
		warned: true, madeAt: ctx.Now, subAlert: subAlert, reachSec: reach,
		leadMs: ctx.DeliveryLeadMs, meet: m, source: source,
	}
	return now, reach
}

// evaluateCarBehind warns a player who isn't pushing (out-lap or in-lap of a timed session) of a
// car on a push lap closing from behind (stepBehindLocked). On an in-lap the player is taken at
// their in-lap pace at most. "Clear" is made in the pit lane too, after the pit exit call; "on you
// now" waits for the track, since the player speeds up as they join it.
func (r *QualifyingRule) evaluateCarBehind(ctx *EvaluationContext, playerLap *packets.LapData) []Directive {
	lapM := ctx.TrackLengthM()
	prof := trafficProfile(ctx)
	slow := slowShare(ctx, ctx.PlayerCarIndex, prof)
	if ctx.Phase == PhaseInLap {
		slow = min(slow, r.inLapPaceLocked(ctx, playerLap, prof))
	}
	slow, ready := r.joinLocked(ctx, playerLap, prof, slow)
	calling := ready && (ctx.Phase == PhaseOutLap || ctx.Phase == PhaseInLap)
	calls := r.stepBehindLocked(ctx, playerLap, prof, behindStep{
		slow: slow,
		counts: func(i int, rival *packets.LapData) bool {
			return rival.DriverStatus == packets.DriverStatusFlyingLap || prePush(ctx, i, rival, playerLap, lapM, prof)
		},
		share:     func(i int) float64 { return pushingShare(ctx, i, prof) },
		calling:   calling,
		closing:   calling,
		following: calling || (ready && ctx.Phase == PhasePitLane),
		log:       pushLapTrafficLog,
		key:       "inlap_traffic_behind", nowKey: "inlap_traffic_behind_now", twoKey: "inlap_traffic_behind_two",
	})

	var dirs []Directive
	if calls.warn >= 0 {
		dirs = append(dirs, carBehindCall(calls))
	}
	if calls.close >= 0 {
		dirs = append(dirs, Directive{
			ID:       "inlap_traffic_close",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_close",
			Title:    "Push-Lap Car on You",
			Message:  "Push-lap car right behind you now, stay off the line.",
			Urgency:  UrgencyHigh,
			Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(calls.closeMeet.roadSec, 1)}},
		})
	}
	if calls.clear {
		dirs = append(dirs, Directive{
			ID:       "inlap_traffic_clear",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_clear",
			Title:    "Clear Behind",
			Message:  "Clear, it's through.",
			Urgency:  UrgencyHigh,
		})
	}
	return dirs
}

// carBehindCall is the warning of a push-lap car behind the step decided on: of one car, two, or
// one right there.
func carBehindCall(calls behindCalls) Directive {
	values := &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(calls.meet.roadSec, 1), ReachSec: calls.reach}}
	switch {
	case calls.now:
		return Directive{
			ID:       "inlap_traffic_behind",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_behind_now",
			Title:    "Car Behind on a Push Lap",
			Message:  trafficMessage("Push-lap car behind", 0),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	case calls.second >= 0:
		return Directive{
			ID:       "inlap_traffic_behind",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_behind_two",
			Title:    "Car Behind on a Push Lap",
			Message:  trafficMessage("Two push-lap cars behind", calls.reach),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	}
	return Directive{
		ID:       "inlap_traffic_behind",
		Category: DirectiveCategoryQualifying,
		SubAlert: "inlap_traffic_behind",
		Title:    "Car Behind on a Push Lap",
		Message:  trafficMessage("Push-lap car behind", calls.reach),
		Urgency:  UrgencyHigh,
		Values:   values,
	}
}

// evaluatePitExit warns a player leaving the garage down the pit lane of a push-lap car that will
// pass the pit exit as they get there (pitExitLocked). The exit is where cars leaving their
// garages came out at this track. The car it names is warned of: its follow-ups come after.
func (r *QualifyingRule) evaluatePitExit(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	lapM := ctx.TrackLengthM()
	prof := trafficProfile(ctx)
	leaving := playerLap.DriverStatus == packets.DriverStatusOutLap || ctx.PreviousPhase == PhaseInGarage
	car, afterSec := r.pitExitLocked(ctx, playerLap, leaving, prof,
		func(i int, rival *packets.LapData) bool {
			return rival.DriverStatus == packets.DriverStatusFlyingLap || prePush(ctx, i, rival, playerLap, lapM, prof)
		},
		func(i int) float64 { return pushingShare(ctx, i, prof) })
	if car < 0 {
		return nil
	}
	return &Directive{
		ID:       "qualy_pit_exit_traffic",
		Category: DirectiveCategoryQualifying,
		SubAlert: "qualy_pit_exit_traffic",
		Title:    "Push-Lap Car at the Pit Exit",
		Message:  "Push-lap car coming past the pit exit, careful as you join.",
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(afterSec, 1)}},
	}
}

// inLapPaceLocked is the pace share the player drives their in-laps at: learned once they are
// InLapLearnFromLapPct into one (past the slowing down after the line), else InLapPaceShare.
func (r *QualifyingRule) inLapPaceLocked(ctx *EvaluationContext, playerLap *packets.LapData, prof paceProfile) float64 {
	if playerLap.LapDistance > ctx.TrackLengthM()*InLapLearnFromLapPct {
		if share, ok := ctx.Motion.paceShare(ctx.PlayerCarIndex, PaceWindowLongMs, prof); ok && share > 0 {
			r.inLapSamples = min(r.inLapSamples+1, InLapLearnSamples)
			r.inLapShare += (share - r.inLapShare) / float64(r.inLapSamples)
		}
	}
	if r.inLapSamples == 0 {
		return InLapPaceShare
	}
	return r.inLapShare
}

// evaluateTrafficAhead warns a player on a push lap of a car ahead that isn't pushing, so they
// hear QualyTrafficWarnSec before they reach it, when that is before the line; each car once per
// approach.
func (r *QualifyingRule) evaluateTrafficAhead(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	lapM := ctx.TrackLengthM()
	prof := trafficProfile(ctx)
	fast := pushingShare(ctx, ctx.PlayerCarIndex, prof)
	toLineSec := prof.sec(playerLap.LapDistance, trackGapM(playerLap.LapDistance, 0, lapM))
	calling := ctx.Phase == PhaseFlyingLap && ctx.Motion.ready(ctx.PlayerCarIndex)
	best, bestHeard := -1, 0.0
	var bestMeet trafficMeeting
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex {
			continue
		}
		a := &r.ahead[i]
		if !onTrack(rival) || rival.DriverStatus == packets.DriverStatusFlyingLap {
			*a = trafficApproach{}
			continue
		}
		gapM := trackGapM(playerLap.LapDistance, rival.LapDistance, lapM)
		m := meeting(prof, playerLap.LapDistance, gapM, fast, slowShare(ctx, i, prof))
		heard := heardSec(ctx, m)
		if trackApproach(ctx, a, i, gapM, lapM, heard, false, pushLapTrafficLog) || !calling || heard > trafficWarnSec(ctx) ||
			m.reachSec*fast > toLineSec {
			continue
		}
		if best < 0 || heard < bestHeard {
			best, bestHeard, bestMeet = i, heard, m
		}
	}
	if best < 0 {
		return nil
	}
	now, reach := trafficCall(ctx, &r.ahead[best], bestMeet, prof.source(), "qualy_traffic_ahead", "qualy_traffic_ahead_now")
	subAlert := "qualy_traffic_ahead"
	if now {
		subAlert = "qualy_traffic_ahead_now"
	}
	return &Directive{
		ID:       "qualy_traffic_ahead",
		Category: DirectiveCategoryQualifying,
		SubAlert: subAlert,
		Title:    "Slow Car Ahead",
		Message:  trafficMessage("Slow car ahead", reach),
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: roundTo(bestMeet.roadSec, 1), ReachSec: reach}},
	}
}

// trafficMessage is a traffic call's text for the log and the AI: when the cars meet, or that the
// car is right there.
func trafficMessage(what string, reach int) string {
	if reach == 0 {
		return what + ", right there. Off the line."
	}
	return what + ", you meet in " + strconv.Itoa(reach) + " seconds."
}
