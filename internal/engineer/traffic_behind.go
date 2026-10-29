package engineer

import (
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// carsBehind is where a rule stands with the cars closing on a player who isn't at pace (on a
// qualifying out-lap or in-lap, slow in a race) and with its pit exit call. The rule embeds it,
// runs its steps with what counts for it, and writes its own directives from what they decide.
type carsBehind struct {
	behind [packets.MaxCars]trafficApproach
	// The pit exit call: made at pitExitAt for car pitExitCar and waiting for the radio (0: none),
	// or done for this pit exit.
	pitExitAt   int64
	pitExitCar  int
	pitExitDone bool
	// The player's pit status on the last lap data, and when they last came out of the pit lane
	// (unix ms, 0: not this session): for a while after, their pace still has the pit lane in it.
	playerPit uint8
	joinedAt  int64
}

// behindKeys are a rule's alert keys for its cars-behind calls: the warning, "on you now",
// "clear" and the pit exit call.
type behindKeys struct {
	warn, close, clear, pitExit string
}

// followBehindLocked checks the calls made on the last packet got on the radio: a warning the
// radio didn't say is made again (logged as log.said once said), and so are the follow-ups; a car
// said clear is done with. A pit exit call said makes its car warned of, for its follow-ups.
func (c *carsBehind) followBehindLocked(ctx *EvaluationContext, keys behindKeys, log trafficLog) {
	confirmTraffic(ctx, &c.behind, keys.warn, trafficProfile(ctx), log)
	for i := range c.behind {
		a := &c.behind[i]
		if a.closeAt > 0 && !a.closeSaid {
			a.closeSaid = ctx.LastSaid[keys.close] >= a.closeAt
			if !a.closeSaid {
				a.closeAt = 0
			}
		}
		if a.clearAt > 0 {
			if ctx.LastSaid[keys.clear] >= a.clearAt {
				*a = trafficApproach{}
			} else {
				a.clearAt = 0
			}
		}
	}
	if c.pitExitAt > 0 {
		if ctx.LastSaid[keys.pitExit] >= c.pitExitAt {
			c.pitExitDone = true
			c.behind[c.pitExitCar] = trafficApproach{
				warned: true, confirmed: true, fromPitExit: true, madeAt: c.pitExitAt,
				subAlert: keys.pitExit, leadMs: ctx.DeliveryLeadMs, source: trafficProfile(ctx).source(),
			}
		}
		c.pitExitAt = 0
	}
}

// joinLocked notes the player coming out of the pit lane, and gives their pace share: slow, or
// for PaceWindowLongMs after they joined the track the last PaceWindowShortMs of it, since the
// longer window still has the pit limiter's pace in it. ready reports whether their pace is known.
func (c *carsBehind) joinLocked(ctx *EvaluationContext, playerLap *packets.LapData, prof paceProfile, slow float64) (share float64, ready bool) {
	if playerLap.PitStatus == packets.PitStatusNone && c.playerPit != packets.PitStatusNone {
		c.joinedAt = ctx.Now
	}
	c.playerPit = playerLap.PitStatus
	joined := ctx.Now - c.joinedAt
	if c.joinedAt > 0 && joined < PaceWindowLongMs {
		if s, ok := ctx.Motion.paceShare(ctx.PlayerCarIndex, PaceWindowShortMs, prof); ok {
			slow = s
		}
	}
	return slow, ctx.Motion.ready(ctx.PlayerCarIndex) && (c.joinedAt == 0 || joined >= PaceWindowShortMs)
}

// justJoined reports whether the player came out of the pit lane less than PaceWindowLongMs ago.
func (c *carsBehind) justJoined(ctx *EvaluationContext) bool {
	return c.joinedAt > 0 && ctx.Now-c.joinedAt < PaceWindowLongMs
}

// behindStep is how a rule runs its cars-behind step: the player's pace share, which cars count
// and at what share, how much faster than the player a car must run to be warned of, what may be
// said, and what the calls are logged as.
type behindStep struct {
	slow       float64
	counts     func(i int, rival *packets.LapData) bool
	share      func(i int) float64
	minClosing float64
	calling    bool // a warning may be made
	closing    bool // "on you now" may be made
	following  bool // "clear" may be made
	log        trafficLog
	// key, nowKey and twoKey are what a warning, one for a car right there and one for two cars
	// are logged as.
	key, nowKey, twoKey string
}

// behindCalls is what the cars-behind step decided: the car to warn of (-1: none) met at meet,
// with the second of two (-1: none), whether it is right there (now) or the number (reach); the
// car to call on the player now (-1: none) met at closeMeet; and whether to say clear.
type behindCalls struct {
	warn, second int
	meet         trafficMeeting
	now          bool
	reach        int
	close        int
	closeMeet    trafficMeeting
	clear        bool
}

// stepBehindLocked warns the player of a car closing from behind, so they hear QualyTrafficWarnSec
// before it reaches them: from both cars' pace on the track's pace profile and how long the call
// takes to be heard. The car that gets there first, each car once per approach, with a second one
// QualyTrainSec behind it in the same call. Then, a warned car is called "on you now"
// QualyTrafficCloseSec before it arrives (after a warning that left room for it), and "clear" once
// it went by, unless another one is coming: that one's warning is next.
func (c *carsBehind) stepBehindLocked(ctx *EvaluationContext, playerLap *packets.LapData, prof paceProfile, s behindStep) behindCalls {
	lapM := ctx.TrackLengthM()
	warnSec := trafficWarnSec(ctx)
	var meets [packets.MaxCars]trafficMeeting
	var counted [packets.MaxCars]bool
	calls := behindCalls{warn: -1, second: -1, close: -1}
	coming := false // a car will reach the player within the warning time
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex {
			continue
		}
		a := &c.behind[i]
		if !onTrack(rival) || !s.counts(i, rival) {
			*a = trafficApproach{}
			continue
		}
		gapM := trackGapM(rival.LapDistance, playerLap.LapDistance, lapM)
		share := s.share(i)
		m := meeting(prof, rival.LapDistance, gapM, share, s.slow)
		meets[i], counted[i] = m, true
		heard := heardSec(ctx, m)
		if trackApproach(ctx, a, i, gapM, lapM, heard, true, s.log) {
			coming = coming || heard <= warnSec
			closeHeard := m.reachSec - float64(ctx.DeliveryLeadMs+TrafficKeyHeardMs)/1000
			if a.confirmed && !a.train && a.closeAt == 0 && (a.reachSec >= TrafficCloseMinSaidSec || a.fromPitExit) &&
				closeHeard <= QualyTrafficCloseSec && (calls.close < 0 || m.reachSec < meets[calls.close].reachSec) {
				calls.close = i
			}
			continue
		}
		if a.warned || heard > warnSec || share-s.slow < s.minClosing {
			continue
		}
		coming = true
		if s.calling && (calls.warn < 0 || m.reachSec < meets[calls.warn].reachSec) {
			calls.warn = i
		}
	}

	if calls.warn >= 0 {
		c.warnLocked(ctx, &calls, meets, counted, prof.source(), s)
	}
	if calls.close >= 0 && s.closing {
		c.behind[calls.close].closeAt = ctx.Now
		calls.closeMeet = meets[calls.close]
	} else {
		calls.close = -1
	}
	calls.clear = c.clearLocked(ctx, playerLap, coming, s.following)
	return calls
}

// warnLocked records the warning for car calls.warn: with the second of two cars when another
// not yet warned gets there within QualyTrainSec after it.
func (c *carsBehind) warnLocked(ctx *EvaluationContext, calls *behindCalls, meets [packets.MaxCars]trafficMeeting, counted [packets.MaxCars]bool, source string, s behindStep) {
	best := calls.warn
	m := meets[best]
	for j := range counted {
		if j == best || !counted[j] || c.behind[j].warned {
			continue
		}
		if after := meets[j].reachSec - m.reachSec; after >= 0 && after <= QualyTrainSec && (calls.second < 0 || meets[j].reachSec < meets[calls.second].reachSec) {
			calls.second = j
		}
	}
	calls.meet = m
	calls.now, calls.reach = trafficCall(ctx, &c.behind[best], m, source, s.key, s.nowKey)
	if calls.now {
		calls.second = -1
		return
	}
	if calls.second >= 0 {
		c.behind[calls.second] = c.behind[best]
		c.behind[calls.second].train, c.behind[calls.second].meet = true, meets[calls.second]
		c.behind[best].subAlert, c.behind[calls.second].subAlert = s.twoKey, s.twoKey
	}
}

// clearLocked reports whether to say the road behind is clear: a warned car that went by is
// QualyClearAheadM ahead, while following, unless another car is coming (its own warning is the
// call then) or it took longer than TrafficClearWithinMs.
func (c *carsBehind) clearLocked(ctx *EvaluationContext, playerLap *packets.LapData, coming, following bool) bool {
	lapM := ctx.TrackLengthM()
	for i := range c.behind {
		a := &c.behind[i]
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
		return true
	}
	return false
}

// pitExitLocked finds the car to warn a player leaving their box down the pit lane of: one that
// will pass the pit exit as they get there (from PitExitWindowBeforeSec before to PitExitWindowSec
// after), once per pit exit, about QualyTrafficWarnSec before they reach it. The player is taken
// at the pit speed limit; the exit is where cars came out of the pit lane at this track, so there
// is no call before one did. It reports the car (-1: none), recorded as the pit exit call, and
// how long after the player it gets there.
func (c *carsBehind) pitExitLocked(ctx *EvaluationContext, playerLap *packets.LapData, leaving bool, prof paceProfile,
	counts func(i int, rival *packets.LapData) bool, share func(i int) float64) (car int, afterSec float64) {
	if playerLap.PitStatus != packets.PitStatusPitting {
		c.pitExitDone = false
		return -1, 0
	}
	exitM := ctx.TrackProfile.exit()
	tele := ctx.PlayerTelemetry()
	if c.pitExitDone || exitM <= 0 || !leaving || tele == nil || float64(tele.Speed) <= SpeedGarageMaxKmh ||
		!ctx.Motion.ready(ctx.PlayerCarIndex) {
		return -1, 0
	}
	lapM := ctx.TrackLengthM()
	dist := trackGapM(playerLap.LapDistance, exitM, lapM)
	limitKmh := float64(DefaultPitSpeedLimitKmh)
	if ctx.Session != nil && ctx.Session.PitSpeedLimit > 0 {
		limitKmh = float64(ctx.Session.PitSpeedLimit)
	}
	playerSec := float64(dist) / (limitKmh / 3.6)
	if dist > PitExitMaxDistM || playerSec-float64(ctx.DeliveryLeadMs+TrafficKeyHeardMs)/1000 > trafficWarnSec(ctx) {
		return -1, 0
	}
	car, carSec := -1, 0.0
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || !onTrack(rival) || !counts(i, rival) {
			continue
		}
		toExit := trackGapM(rival.LapDistance, exitM, lapM)
		if toExit > lapM/2 {
			continue
		}
		sec := prof.sec(rival.LapDistance, toExit) / share(i)
		if sec >= playerSec-PitExitWindowBeforeSec && sec <= playerSec+PitExitWindowSec && (car < 0 || sec < carSec) {
			car, carSec = i, sec
		}
	}
	if car >= 0 {
		c.pitExitAt, c.pitExitCar = ctx.Now, car
	}
	return car, carSec - playerSec
}
