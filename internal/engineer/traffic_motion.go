package engineer

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// How fast each car runs now, for the qualifying traffic calls. A car's pace share is how fast it
// covers the lap against the track's pace profile: 1 runs the profile's pace, 0.8 takes a quarter
// longer over every stretch. Two cars' shares say when one reaches the other wherever they are on
// the lap, since both run the same track.

// motionSamples is how many samples each car keeps: PaceWindowLongMs and a margin at one sample
// every motionSampleMs.
const (
	motionSampleMs = 50
	motionSamples  = PaceWindowLongMs/motionSampleMs + 12
)

// motionSample is where a car was at a moment of the session.
type motionSample struct {
	sessionMs int64   // the session time, ms
	lapM      float32 // its lap distance
	drivenM   float64 // how far it drove since its samples started
}

// carTrack is one car's latest samples, oldest first, in a ring.
type carTrack struct {
	ring  [motionSamples]motionSample
	start int // index of the oldest
	n     int
	// skipped is whether the last sample was out of order and skipped: a second in a row starts
	// the samples again.
	skipped bool
}

// carMotion follows how every car moved over the last seconds of lap data.
type carMotion struct {
	cars [packets.MaxCars]carTrack
	// epoch goes up each time every car's samples are dropped (a flashback), so a rule knows what
	// it worked out from them no longer holds.
	epoch int
}

// reset drops every car's samples.
func (m *carMotion) reset() {
	m.cars = [packets.MaxCars]carTrack{}
	m.epoch++
}

// ready reports whether the player's pace is known: their samples span PaceWindowShortMs. Until
// then (a new session, a flashback) a car behind would seem to reach a standing player.
func (m *carMotion) ready(player int) bool {
	return m == nil || (player >= 0 && player < packets.MaxCars && m.cars[player].spanMs() >= PaceWindowShortMs)
}

// motionStep is told each step car idx drove (its lap data l): step metres from lap distance
// fromM in ms.
type motionStep func(idx int, l *packets.LapData, fromM float32, step float64, ms int64)

// sample adds where each car is on lap data p at session time sessionTime (s), on a lap of
// trackLen metres. Each step a car drives goes to learn (nil: none).
func (m *carMotion) sample(p *packets.PacketLapData, sessionTime, trackLen float32, learn motionStep) {
	if p == nil || trackLen <= 0 {
		return
	}
	now := int64(math.Round(float64(sessionTime) * 1000))
	for i := range p.LapData {
		l := &p.LapData[i]
		from, step, ok := m.cars[i].add(now, l.LapDistance, trackLen)
		if ok && learn != nil {
			learn(i, l, from.lapM, step, now-from.sessionMs)
		}
	}
}

// add records a car at lap distance lapM at session time nowMs, and reports the step it drove
// from the last sample (ok false when none). A sample closer than motionSampleMs to the last is
// left out. A step back of up to MaxStepBackM is standing still. A step no car could drive
// (faster than MaxCarSpeedMps, nearly a lap) starts the samples again.
func (t *carTrack) add(nowMs int64, lapM, trackLen float32) (from motionSample, step float64, ok bool) {
	if t.n == 0 {
		t.ring[t.start], t.n = motionSample{sessionMs: nowMs, lapM: lapM}, 1
		return motionSample{}, 0, false
	}
	last := t.latest()
	if nowMs <= last.sessionMs {
		if t.skipped {
			*t = carTrack{}
			return t.add(nowMs, lapM, trackLen)
		}
		t.skipped = true
		return motionSample{}, 0, false
	}
	t.skipped = false
	if nowMs-last.sessionMs < motionSampleMs {
		return motionSample{}, 0, false
	}
	step = float64(trackGapM(last.lapM, lapM, trackLen))
	if trackGapM(lapM, last.lapM, trackLen) <= MaxStepBackM {
		step = 0 // a step back: standing still
	}
	if step > MaxCarSpeedMps*float64(nowMs-last.sessionMs)/1000 || step > 0.9*float64(trackLen) {
		*t = carTrack{}
		return t.add(nowMs, lapM, trackLen)
	}
	next := motionSample{sessionMs: nowMs, lapM: lapM, drivenM: last.drivenM + step}
	if t.n < motionSamples {
		t.ring[(t.start+t.n)%motionSamples] = next
		t.n++
	} else {
		t.ring[t.start] = next
		t.start = (t.start + 1) % motionSamples
	}
	return last, step, true
}

func (t *carTrack) at(k int) motionSample {
	return t.ring[(t.start+k)%motionSamples]
}

func (t *carTrack) latest() motionSample {
	return t.at(t.n - 1)
}

// spanMs is how much session time the samples cover.
func (t *carTrack) spanMs() int64 {
	if t.n < 2 {
		return 0
	}
	return t.latest().sessionMs - t.at(0).sessionMs
}

// window is the car's latest sample and the newest one at least windowMs before it; ok is false
// while the samples don't go back that far.
func (t *carTrack) window(windowMs int64) (from, to motionSample, ok bool) {
	if t.n < 2 {
		return motionSample{}, motionSample{}, false
	}
	to = t.latest()
	for k := t.n - 2; k >= 0; k-- {
		if s := t.at(k); to.sessionMs-s.sessionMs >= windowMs {
			return s, to, true
		}
	}
	return motionSample{}, motionSample{}, false
}

// paceShare is car idx's pace share over the last windowMs against profile prof; ok is false
// while its samples don't go back that far.
func (m *carMotion) paceShare(idx int, windowMs int64, prof paceProfile) (float64, bool) {
	if m == nil || idx < 0 || idx >= packets.MaxCars {
		return 0, false
	}
	from, to, ok := m.cars[idx].window(windowMs)
	if !ok {
		return 0, false
	}
	return prof.sec(from.lapM, float32(to.drivenM-from.drivenM)) / (float64(to.sessionMs-from.sessionMs) / 1000), true
}

// paceProfile is how long each stretch of the lap takes at the track's reference pace. Only its
// shape matters to when two cars meet; its overall pace cancels out.
type paceProfile struct {
	lapM    float32
	speeds  []float32 // one per QuietBinM bin; nil: flat at flatMps
	from    string    // where the speeds come from, for the log
	flatMps float64
}

// trafficProfile is the pace profile of the track ctx runs on: the push-lap speeds learned from
// every car on one, else the player's own speeds once a whole lap of theirs was sampled, else the
// track length over the session's best lap all the way round. Against a flat profile, a car in a
// slow corner seems to crawl and one on a straight to fly, so the calls are least sure then.
func trafficProfile(ctx *EvaluationContext) paceProfile {
	lapM := ctx.TrackLengthM()
	p := paceProfile{lapM: lapM, from: "flat", flatMps: AverageRaceSpeedMetersPerSec}
	if best := sessionBestLapMS(ctx); best > 0 {
		p.flatMps = float64(lapM) / msToSec(best)
	}
	switch push := ctx.TrackProfile.pushSpeeds(lapM); {
	case push != nil:
		p.speeds, p.from = push, "push"
	case ctx.TrackProfile.speedLearned(lapM):
		p.speeds, p.from = ctx.TrackProfile.speed, "player"
	}
	return p
}

// raceProfile is the pace profile of the field's speeds in this race (raceSpeeds); ok is false
// until they are known round the lap.
func raceProfile(ctx *EvaluationContext) (paceProfile, bool) {
	lapM := ctx.TrackLengthM()
	speeds := ctx.RaceSpeeds.speedsFor(lapM)
	if speeds == nil {
		return paceProfile{}, false
	}
	return paceProfile{lapM: lapM, speeds: speeds, from: "race", flatMps: AverageRaceSpeedMetersPerSec}, true
}

// sec is how long length metres of lap from lap distance from take at the profile's pace.
func (p paceProfile) sec(from, length float32) float64 {
	if length <= 0 {
		return 0
	}
	if p.speeds == nil {
		return float64(length) / p.flatMps
	}
	return float64(stretchMsAt(p.speeds, p.lapM, from, length)) / 1000
}

// lapSec is how long a whole lap takes at the profile's pace.
func (p paceProfile) lapSec() float64 {
	return p.sec(0, p.lapM)
}

// source says where the profile comes from, for the log.
func (p paceProfile) source() string {
	return p.from
}

// pushShare is car idx's pace share on a push lap: the profile's lap over its best lap (or the
// session's best, as pushPaceMps takes it). Before anyone has set a lap, what it runs now, else
// the profile's pace.
func pushShare(ctx *EvaluationContext, idx int, prof paceProfile) float64 {
	if sessionBestLapMS(ctx) > 0 {
		return prof.lapSec() / (float64(prof.lapM) / pushPaceMps(ctx, idx))
	}
	if share, ok := ctx.Motion.paceShare(idx, PaceWindowLongMs, prof); ok && share > 0 {
		return share
	}
	return 1
}

// pushingShare is the pace share of car idx on a push lap: its push pace, unless it runs
// AbortMarginShare slower now (it backed off).
func pushingShare(ctx *EvaluationContext, idx int, prof paceProfile) float64 {
	share := pushShare(ctx, idx, prof)
	if now, ok := ctx.Motion.paceShare(idx, PaceWindowLongMs, prof); ok && now < share-AbortMarginShare {
		return now
	}
	return share
}

// racingShare is car idx's pace share at race pace: the larger of what it ran over the long
// window and its last lap (the profile's lap over its last lap time), so a car held up a moment
// still counts at its pace; 0 while neither is known. A last lap quicker than LastLapMaxShare
// wasn't a whole one.
func racingShare(ctx *EvaluationContext, idx int, prof paceProfile) float64 {
	share, _ := ctx.Motion.paceShare(idx, PaceWindowLongMs, prof)
	if ctx.LapData != nil && idx >= 0 && idx < len(ctx.LapData.LapData) {
		if last := ctx.LapData.LapData[idx].LastLapTimeInMS; last > 0 {
			if lap := prof.lapSec() / msToSec(last); lap <= LastLapMaxShare {
				share = max(share, lap)
			}
		}
	}
	return max(share, 0)
}

// slowShare is the pace share of car idx that isn't pushing: the slower of what it ran over the
// short and the long window, so a car slowing down is met early rather than late; 0 before
// either is known.
func slowShare(ctx *EvaluationContext, idx int, prof paceProfile) float64 {
	short, okShort := ctx.Motion.paceShare(idx, PaceWindowShortMs, prof)
	long, okLong := ctx.Motion.paceShare(idx, PaceWindowLongMs, prof)
	switch {
	case okShort && okLong:
		return max(min(short, long), 0)
	case okShort:
		return max(short, 0)
	case okLong:
		return max(long, 0)
	}
	return 0
}

// trafficMeeting is when a faster car reaches a slower one ahead of it on the road.
type trafficMeeting struct {
	roadSec  float64 // the gap on the road at the faster car's pace
	reachSec float64 // when it reaches the slower car; +Inf when it doesn't close
	fast     float64 // the faster car's pace share
	slow     float64 // the slower car's
}

// meeting is when a car at pace share fast, gapM metres behind a car at pace share slow from lap
// distance fromM, reaches it on profile prof.
func meeting(prof paceProfile, fromM, gapM float32, fast, slow float64) trafficMeeting {
	s := prof.sec(fromM, gapM)
	m := trafficMeeting{roadSec: s / fast, reachSec: math.Inf(1), fast: fast, slow: slow}
	if fast-slow >= MinClosingShare*fast {
		m.reachSec = s / (fast - slow)
	}
	return m
}
