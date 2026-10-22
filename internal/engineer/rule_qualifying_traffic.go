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

// followTrafficLocked forgets what was worked out from motion samples since dropped (a
// flashback), and checks the calls made on the last packet got on the radio: one that didn't (the
// repeat limit took it) is made again, so a second car is still called.
func (r *QualifyingRule) followTrafficLocked(ctx *EvaluationContext) {
	if ctx.Motion != nil && ctx.Motion.epoch != r.motionEpoch {
		r.motionEpoch = ctx.Motion.epoch
		r.behind = [packets.MaxCars]trafficApproach{}
		r.ahead = [packets.MaxCars]trafficApproach{}
	}
	confirm := func(states *[packets.MaxCars]trafficApproach, key string) {
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
			prof := trafficProfile(ctx)
			window := func(idx int, ms int64) float64 {
				share, _ := ctx.Motion.paceShare(idx, ms, prof)
				return roundTo(share, 3)
			}
			slog.Info("Push-lap traffic",
				"key", a.subAlert, "car", i, "road_sec", roundTo(a.meet.roadSec, 1),
				"reach_sec", roundTo(a.meet.reachSec, 1), "said_sec", a.reachSec,
				"fast_share", roundTo(a.meet.fast, 3), "slow_share", roundTo(a.meet.slow, 3),
				"player_short", window(ctx.PlayerCarIndex, PaceWindowShortMs), "player_long", window(ctx.PlayerCarIndex, PaceWindowLongMs),
				"car_short", window(i, PaceWindowShortMs), "car_long", window(i, PaceWindowLongMs),
				"profile", a.source, "lead_ms", a.leadMs)
		}
	}
	confirm(&r.behind, "inlap_traffic_behind")
	confirm(&r.ahead, "qualy_traffic_ahead")

	// The follow-ups the radio didn't say are made again; a car said clear is done with.
	for i := range r.behind {
		a := &r.behind[i]
		if a.closeAt > 0 && !a.closeSaid {
			a.closeSaid = ctx.LastSaid["inlap_traffic_close"] >= a.closeAt
			if !a.closeSaid {
				a.closeAt = 0
			}
		}
		if a.clearAt > 0 {
			if ctx.LastSaid["inlap_traffic_clear"] >= a.clearAt {
				*a = trafficApproach{}
			} else {
				a.clearAt = 0
			}
		}
	}
	if r.pitExitAt > 0 {
		if ctx.LastSaid["qualy_pit_exit_traffic"] >= r.pitExitAt {
			r.pitExitDone = true
			r.behind[r.pitExitCar] = trafficApproach{
				warned: true, confirmed: true, fromPitExit: true, madeAt: r.pitExitAt,
				subAlert: "qualy_pit_exit_traffic", leadMs: ctx.DeliveryLeadMs, source: trafficProfile(ctx).source(),
			}
		}
		r.pitExitAt = 0
	}
}

// trackApproach moves a warned car's state on: it passed (gap wrapped past half a lap: kept, with
// when, for "clear" when clearAfter), or fell back far enough for long enough to be warned again.
// It reports whether the car is still on its way to the player.
func trackApproach(ctx *EvaluationContext, a *trafficApproach, idx int, gapM, lapM float32, heard float64, clearAfter bool) bool {
	if !a.warned || a.passedAt > 0 {
		return false
	}
	if a.confirmed && gapM > lapM/2 {
		// A call with a number says when the car should get there; one without says nothing to check.
		expected := 0.0
		if a.reachSec > 0 {
			expected = roundTo(float64(a.reachSec)+float64(a.leadMs+TrafficNumberHeardMs)/1000, 1)
		}
		slog.Info("Push-lap car passed",
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
// car on a push lap closing from behind, so they hear QualyTrafficWarnSec before it reaches them:
// from both cars' pace on the track's pace profile and how long the call takes to be heard. The
// car that gets there first, each car once per approach, with a second one QualyTrainSec behind
// it in the same call. Then, a warned car is called "on you now" QualyTrafficCloseSec before it
// arrives, and "clear" once it went by, unless another one is coming: that one's warning is next.
// "Clear" is made in the pit lane too, after the pit exit call; "on you now" waits for the track,
// since the player speeds up as they join it.
func (r *QualifyingRule) evaluateCarBehind(ctx *EvaluationContext, playerLap *packets.LapData) []Directive {
	lapM := ctx.TrackLengthM()
	prof := trafficProfile(ctx)
	slow := slowShare(ctx, ctx.PlayerCarIndex, prof)
	if ctx.Phase == PhaseInLap {
		slow = min(slow, r.inLapPaceLocked(ctx, playerLap, prof))
	}
	// Just out of the pit lane, the longer window still has the pit limiter's pace in it: the last
	// PaceWindowShortMs is the player's pace, once there is that much of it on track.
	if playerLap.PitStatus == packets.PitStatusNone && r.playerPit != packets.PitStatusNone {
		r.joinedAt = ctx.Now
	}
	r.playerPit = playerLap.PitStatus
	joined := ctx.Now - r.joinedAt
	if r.joinedAt > 0 && joined < PaceWindowLongMs {
		if share, ok := ctx.Motion.paceShare(ctx.PlayerCarIndex, PaceWindowShortMs, prof); ok {
			slow = share
		}
	}
	ready := ctx.Motion.ready(ctx.PlayerCarIndex) && (r.joinedAt == 0 || joined >= PaceWindowShortMs)
	calling := ready && (ctx.Phase == PhaseOutLap || ctx.Phase == PhaseInLap)
	following := calling || (ready && ctx.Phase == PhasePitLane)
	warnSec := trafficWarnSec(ctx)

	var meets [packets.MaxCars]trafficMeeting
	var pushing [packets.MaxCars]bool
	best, closeCar := -1, -1
	coming := false // a push-lap car will reach the player within the warning time
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex {
			continue
		}
		a := &r.behind[i]
		if !onTrack(rival) || (rival.DriverStatus != packets.DriverStatusFlyingLap && !prePush(ctx, i, rival, playerLap, lapM, prof)) {
			*a = trafficApproach{}
			continue
		}
		gapM := trackGapM(rival.LapDistance, playerLap.LapDistance, lapM)
		m := meeting(prof, rival.LapDistance, gapM, pushingShare(ctx, i, prof), slow)
		meets[i], pushing[i] = m, true
		heard := heardSec(ctx, m)
		if trackApproach(ctx, a, i, gapM, lapM, heard, true) {
			coming = coming || heard <= warnSec
			closeHeard := m.reachSec - float64(ctx.DeliveryLeadMs+TrafficKeyHeardMs)/1000
			if a.confirmed && !a.train && a.closeAt == 0 && (a.reachSec >= TrafficCloseMinSaidSec || a.fromPitExit) &&
				closeHeard <= QualyTrafficCloseSec && (closeCar < 0 || m.reachSec < meets[closeCar].reachSec) {
				closeCar = i
			}
			continue
		}
		if a.warned || heard > warnSec {
			continue
		}
		coming = true
		if calling && (best < 0 || m.reachSec < meets[best].reachSec) {
			best = i
		}
	}

	var dirs []Directive
	if best >= 0 {
		dirs = append(dirs, r.carBehindCall(ctx, best, meets, pushing, prof.source()))
	}
	if calling && closeCar >= 0 {
		r.behind[closeCar].closeAt = ctx.Now
		dirs = append(dirs, Directive{
			ID:       "inlap_traffic_close",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_close",
			Title:    "Push-Lap Car on You",
			Message:  "Push-lap car right behind you now, stay off the line.",
			Urgency:  UrgencyHigh,
			Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(meets[closeCar].roadSec, 1)}},
		})
	}
	if d := r.clearCall(ctx, playerLap, coming, following); d != nil {
		dirs = append(dirs, *d)
	}
	return dirs
}

// carBehindCall is the warning for car best, met at meets[best]: with the second of two push-lap
// cars when another not yet warned gets there within QualyTrainSec after it.
func (r *QualifyingRule) carBehindCall(ctx *EvaluationContext, best int, meets [packets.MaxCars]trafficMeeting, pushing [packets.MaxCars]bool, source string) Directive {
	m := meets[best]
	second := -1
	for j := range pushing {
		if j == best || !pushing[j] || r.behind[j].warned {
			continue
		}
		if after := meets[j].reachSec - m.reachSec; after >= 0 && after <= QualyTrainSec && (second < 0 || meets[j].reachSec < meets[second].reachSec) {
			second = j
		}
	}
	now, reach := trafficCall(ctx, &r.behind[best], m, source, "inlap_traffic_behind", "inlap_traffic_behind_now")
	subAlert := "inlap_traffic_behind"
	what := "Push-lap car behind"
	switch {
	case now:
		subAlert = "inlap_traffic_behind_now"
	case second >= 0:
		subAlert = "inlap_traffic_behind_two"
		what = "Two push-lap cars behind"
		r.behind[second] = r.behind[best]
		r.behind[second].train, r.behind[second].meet = true, meets[second]
		r.behind[best].subAlert, r.behind[second].subAlert = subAlert, subAlert
	}
	return Directive{
		ID:       "inlap_traffic_behind",
		Category: DirectiveCategoryQualifying,
		SubAlert: subAlert,
		Title:    "Car Behind on a Push Lap",
		Message:  trafficMessage(what, reach),
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(m.roadSec, 1), ReachSec: reach}},
	}
}

// clearCall says the road behind is clear once a warned car that went by is QualyClearAheadM
// ahead, unless another push-lap car is coming (its own warning is the call then) or it took
// longer than TrafficClearWithinMs.
func (r *QualifyingRule) clearCall(ctx *EvaluationContext, playerLap *packets.LapData, coming, following bool) *Directive {
	lapM := ctx.TrackLengthM()
	for i := range r.behind {
		a := &r.behind[i]
		if a.passedAt == 0 || a.clearAt > 0 {
			continue
		}
		ahead := trackGapM(playerLap.LapDistance, ctx.LapData.LapData[i].LapDistance, lapM)
		if coming || ctx.Now-a.passedAt > TrafficClearWithinMs {
			*a = trafficApproach{}
			continue
		}
		if !following || ahead < QualyClearAheadM || ahead > lapM/2 {
			continue
		}
		a.clearAt = ctx.Now
		return &Directive{
			ID:       "inlap_traffic_clear",
			Category: DirectiveCategoryQualifying,
			SubAlert: "inlap_traffic_clear",
			Title:    "Clear Behind",
			Message:  "Clear, it's through.",
			Urgency:  UrgencyHigh,
		}
	}
	return nil
}

// evaluatePitExit warns a player leaving the garage down the pit lane of a push-lap car that will
// pass the pit exit as they get there (from PitExitWindowBeforeSec before to PitExitWindowSec
// after), once per pit exit, about QualyTrafficWarnSec before they reach it. The player is taken at
// the pit speed limit; the exit is where cars leaving their garages came out at this track, so
// there is no call before one did. The car it names is warned of: its follow-ups come after.
func (r *QualifyingRule) evaluatePitExit(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if playerLap.PitStatus != packets.PitStatusPitting {
		r.pitExitDone = false
		return nil
	}
	exitM := ctx.TrackProfile.exit()
	tele := ctx.PlayerTelemetry()
	leaving := playerLap.DriverStatus == packets.DriverStatusOutLap || ctx.PreviousPhase == PhaseInGarage
	if r.pitExitDone || exitM <= 0 || !leaving || tele == nil || float64(tele.Speed) <= SpeedGarageMaxKmh ||
		!ctx.Motion.ready(ctx.PlayerCarIndex) {
		return nil
	}
	lapM := ctx.TrackLengthM()
	dist := trackGapM(playerLap.LapDistance, exitM, lapM)
	limitKmh := float64(DefaultPitSpeedLimitKmh)
	if ctx.Session != nil && ctx.Session.PitSpeedLimit > 0 {
		limitKmh = float64(ctx.Session.PitSpeedLimit)
	}
	playerSec := float64(dist) / (limitKmh / 3.6)
	if dist > PitExitMaxDistM || playerSec-float64(ctx.DeliveryLeadMs+TrafficKeyHeardMs)/1000 > trafficWarnSec(ctx) {
		return nil
	}
	prof := trafficProfile(ctx)
	car, carSec := -1, 0.0
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || !onTrack(rival) ||
			(rival.DriverStatus != packets.DriverStatusFlyingLap && !prePush(ctx, i, rival, playerLap, lapM, prof)) {
			continue
		}
		toExit := trackGapM(rival.LapDistance, exitM, lapM)
		if toExit > lapM/2 {
			continue
		}
		sec := prof.sec(rival.LapDistance, toExit) / pushingShare(ctx, i, prof)
		if sec >= playerSec-PitExitWindowBeforeSec && sec <= playerSec+PitExitWindowSec && (car < 0 || sec < carSec) {
			car, carSec = i, sec
		}
	}
	if car < 0 {
		return nil
	}
	r.pitExitAt, r.pitExitCar = ctx.Now, car
	return &Directive{
		ID:       "qualy_pit_exit_traffic",
		Category: DirectiveCategoryQualifying,
		SubAlert: "qualy_pit_exit_traffic",
		Title:    "Push-Lap Car at the Pit Exit",
		Message:  "Push-lap car coming past the pit exit, careful as you join.",
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(carSec-playerSec, 1)}},
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
		if trackApproach(ctx, a, i, gapM, lapM, heard, false) || !calling || heard > trafficWarnSec(ctx) ||
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
