package main

import (
	"log/slog"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// The traffic scenario (Q1) drives its cars in real time on a lap of slow corners and fast
// straights, so the engineer's push-lap traffic calls can be checked against when the cars really
// meet. The player runs garage, pit lane, out-lap, push lap and in-lap, then back to the garage.
//   - car 1 does a push lap while the player first waits in the garage (so the engineer learns the
//     track's push-lap speeds), then is on one trafficBehindStartSec behind the player on every
//     out-lap, with car 3 trafficTrainSec behind it: two cars in one warning;
//   - car 2 is on a slow in-lap ahead on every push lap;
//   - car 4 is on a push lap that reaches the pit exit trafficPitExitAfterSec after the player
//     leaves the pit lane;
//   - car 5 leaves its garage early in the first wait, so the engineer learns where the pit exit is.
//
// The other cars stay in their garages. The engine's "Push-lap traffic" and "Push-lap car passed"
// lines say when it called each car and when it went by; this scenario logs "Traffic scenario
// pass" at the moment it did.
const (
	trafficGarageSec       = 6.0
	trafficFirstGarageSec  = 95.0  // the first wait in the garage: car 1 does a whole push lap meanwhile
	trafficPitLaneM        = 250.0 // the pit lane's length to the exit at simPitExitM
	trafficPitLimitKmh     = 80
	trafficOutLapShare     = 0.8
	trafficInLapShare      = 0.6
	trafficSlowShare       = 0.55
	trafficBehindStartSec  = 12.0   // car 1's gap behind the player as the out-lap starts, at its pace
	trafficSlowAheadM      = 1500.0 // car 2's gap ahead as the push lap starts
	trafficTrainSec        = 0.5    // car 3's gap behind car 1: they reach an 80% out-lap 2.5 s apart
	trafficPitExitAfterSec = 1.5    // car 4 passes the pit exit this long after the player leaves the pit lane
	trafficLeaverOutSec    = 20.0   // car 5 leaves its garage this far into the first wait...
	trafficLeaverTrackSec  = 15.0   // ...and goes back after this long on track
	trafficCars            = 6
	trafficStartSec        = 1080
	trafficPlayerPosition  = 12
)

// The stages of the player's run.
const (
	trafficGarage = iota
	trafficPitLane
	trafficOutLap
	trafficPushLap
	trafficInLap
)

// trafficProfileSegments is the lap's shape: where each stretch ends and its speed at push pace,
// before trafficProfile scales it to the player's push lap.
var trafficProfileSegments = []struct{ toM, mps float64 }{
	{400, 80}, {650, 30}, {1300, 75}, {1500, 28}, {2400, 88}, {2650, 35}, {3300, 70},
	{3500, 25}, {4300, 85}, {4600, 40}, {simTrackLengthM, 78},
}

// trafficCar is one car of the scenario.
type trafficCar struct {
	lapNum    uint8
	lapM      float64 // lap distance
	lapTimeMs uint32
	lastLapMs uint32
	share     float64 // its pace share of the profile
	status    uint8
	pit       uint8
	speedMps  float64
}

// simProfile is the lap's shape in time (trafficProfileSegments), scaled so a push lap takes the
// player's simulated lap time: the traffic scenarios drive their cars on it.
type simProfile struct {
	scale float64 // push-pace speed over the profile's
}

func newSimProfile() simProfile {
	var profileSec float64
	from := 0.0
	for _, seg := range trafficProfileSegments {
		profileSec += (seg.toM - from) / seg.mps
		from = seg.toM
	}
	s := simSectorsMS(0, 1)
	return simProfile{scale: profileSec / (float64(s[0]+s[1]+s[2]) / 1000)}
}

// trafficSim is the scenario's state.
type trafficSim struct {
	simProfile
	stage    int
	stageSec float64
	runs     int                     // the runs the player started
	cars     [trafficCars]trafficCar // the player and the cars with a part (see above)
	passed   [trafficCars]bool       // the car went by the player this approach
	leaverAt float64                 // the session seconds car 5 came out of the pit lane (0: not yet)
	clock    float64                 // session seconds since the scenario started
}

func newTrafficSim() *trafficSim {
	t := &trafficSim{simProfile: newSimProfile()}
	t.cars[0] = trafficCar{lapNum: 1, status: packets.DriverStatusInGarage, pit: packets.PitStatusInPitArea}
	t.cars[1] = trafficCar{lapNum: 1, status: packets.DriverStatusFlyingLap, pit: packets.PitStatusNone, share: 1}
	for i := 2; i < trafficCars; i++ {
		t.cars[i] = trafficCar{lapNum: 1, status: packets.DriverStatusInGarage, pit: packets.PitStatusInPitArea}
	}
	return t
}

// speedAt is the push-pace speed at lap distance m, in m/s.
func (p simProfile) speedAt(m float64) float64 {
	m = math.Mod(m, simTrackLengthM)
	for _, seg := range trafficProfileSegments {
		if m < seg.toM {
			return seg.mps * p.scale
		}
	}
	return trafficProfileSegments[len(trafficProfileSegments)-1].mps * p.scale
}

// behindBy is the lap distance dt seconds of push pace behind lap distance m.
func (p simProfile) behindBy(m, dt float64) float64 {
	for left := dt; left > 0; left -= 0.05 {
		m -= p.speedAt(math.Mod(m+simTrackLengthM, simTrackLengthM)) * min(0.05, left)
	}
	return math.Mod(m+2*simTrackLengthM, simTrackLengthM)
}

// secOver is how long length metres of the lap from lap distance m take at share of the push pace.
func (p simProfile) secOver(m, length, share float64) float64 {
	var sec float64
	m = math.Mod(m+simTrackLengthM, simTrackLengthM)
	for left := length; left > 1e-9; {
		step := min(p.stretchEnd(m)-m, left)
		sec += step / (share * p.speedAt(m))
		left -= step
		if m += step; m >= simTrackLengthM-1e-9 {
			m = 0
		}
	}
	return sec
}

// drive moves car c on by dt seconds at its share of the profile, counting its laps. A step
// that reaches the end of a stretch goes on at the next stretch's speed from there. A car with
// no share stands still.
func (p simProfile) drive(c *trafficCar, dt float64) {
	c.lapTimeMs += uint32(math.Round(dt * 1000))
	if c.share <= 0 {
		c.speedMps = 0
		return
	}
	for left := dt; left > 1e-9; {
		c.speedMps = c.share * p.speedAt(c.lapM)
		end := p.stretchEnd(c.lapM)
		step := min(c.speedMps*left, end-c.lapM)
		left -= step / c.speedMps
		c.lapM += step
		if c.lapM >= simTrackLengthM-1e-9 {
			c.lapM = 0
			c.lapNum++
			c.lastLapMs, c.lapTimeMs = c.lapTimeMs, 0
		}
	}
}

// stretchEnd is where the profile's stretch at lap distance m ends.
func (p simProfile) stretchEnd(m float64) float64 {
	for _, seg := range trafficProfileSegments {
		if m < seg.toM {
			return seg.toM
		}
	}
	return simTrackLengthM
}

// step runs the scenario on by dt seconds.
func (t *trafficSim) step(dt float64) {
	var gaps [trafficCars]float64
	for i := 1; i < len(t.cars); i++ {
		gaps[i] = t.approachGap(i)
	}
	p := &t.cars[0]
	t.stageSec += dt
	t.clock += dt
	t.moveLeaver(dt)
	prevLap := p.lapNum
	switch t.stage {
	case trafficGarage:
		p.speedMps = 0
		wait := trafficGarageSec
		if t.runs == 0 {
			wait = trafficFirstGarageSec
		}
		if t.stageSec >= wait {
			t.runs++
			t.setStage(trafficPitLane)
			p.status, p.pit, p.lapM = packets.DriverStatusOutLap, packets.PitStatusPitting, simPitExitM-trafficPitLaneM
			// Car 1 waits for the out-lap; car 4 comes past the pit exit as the player joins.
			t.garage(1)
			t.push(4, t.behindBy(simPitExitM, trafficPitLaneM/(trafficPitLimitKmh/3.6)+trafficPitExitAfterSec))
		}
	case trafficPitLane:
		p.speedMps = trafficPitLimitKmh / 3.6
		p.lapM += p.speedMps * dt
		if p.lapM >= simPitExitM {
			t.setStage(trafficOutLap)
			p.pit, p.share = packets.PitStatusNone, trafficOutLapShare
			// Car 1 starts its push lap behind the player, car 3 right behind it.
			t.push(1, t.behindBy(p.lapM, trafficBehindStartSec))
			t.push(3, t.behindBy(t.cars[1].lapM, trafficTrainSec))
		}
	case trafficOutLap, trafficPushLap, trafficInLap:
		t.drive(p, dt)
	}
	if p.lapNum != prevLap {
		switch t.stage {
		case trafficOutLap:
			t.setStage(trafficPushLap)
			p.status, p.share = packets.DriverStatusFlyingLap, 1
			c := &t.cars[2]
			c.status, c.pit, c.share, c.lapNum = packets.DriverStatusInLap, packets.PitStatusNone, trafficSlowShare, p.lapNum
			c.lapM, c.lapTimeMs = trafficSlowAheadM, 0
			t.passed[2] = false
			t.garage(3)
			t.garage(4)
		case trafficPushLap:
			t.setStage(trafficInLap)
			p.status, p.share = packets.DriverStatusInLap, trafficInLapShare
			t.garage(2)
		case trafficInLap:
			t.setStage(trafficGarage)
			p.status, p.pit, p.lapM = packets.DriverStatusInGarage, packets.PitStatusInPitArea, 0
			t.garage(1)
		}
	}
	for i := 1; i < len(t.cars); i++ {
		c := &t.cars[i]
		if c.pit != packets.PitStatusNone {
			continue
		}
		t.drive(c, dt)
		if i != 5 {
			t.notePass(i, gaps[i])
		}
	}
}

// push puts car i on a push lap at lap distance lapM, on the player's lap.
func (t *trafficSim) push(i int, lapM float64) {
	c := &t.cars[i]
	c.status, c.pit, c.share, c.lapNum, c.lapM = packets.DriverStatusFlyingLap, packets.PitStatusNone, 1, t.cars[0].lapNum, lapM
	t.passed[i] = false
}

// moveLeaver drives car 5 out of its garage down the pit lane early in the first wait, onto the
// track at the pit exit, and back to its garage a while later.
func (t *trafficSim) moveLeaver(dt float64) {
	c := &t.cars[5]
	switch {
	case t.runs == 0 && t.stage == trafficGarage && c.status == packets.DriverStatusInGarage && t.leaverAt == 0 &&
		t.stageSec >= trafficLeaverOutSec:
		c.status, c.pit, c.lapM = packets.DriverStatusOutLap, packets.PitStatusPitting, simPitExitM-trafficPitLaneM
	case c.pit == packets.PitStatusPitting:
		c.speedMps = trafficPitLimitKmh / 3.6
		c.lapM += c.speedMps * dt
		if c.lapM >= simPitExitM {
			c.pit, c.share, t.leaverAt = packets.PitStatusNone, trafficOutLapShare, t.clock
			slog.Info("Traffic scenario pit exit", "car", 5, "lap_m", int(c.lapM))
		}
	case c.pit == packets.PitStatusNone && t.leaverAt > 0 && t.clock-t.leaverAt >= trafficLeaverTrackSec:
		t.garage(5)
	}
}

// notePass logs the moment a push-lap car went by the player, or the player went by car 2: the gap
// from the one behind to the one ahead (gapBefore last frame) wrapped past half a lap.
func (t *trafficSim) notePass(i int, gapBefore float64) {
	if t.passed[i] || t.cars[0].pit != packets.PitStatusNone || gapBefore > simTrackLengthM/2 ||
		t.approachGap(i) < simTrackLengthM/2 {
		return
	}
	t.passed[i] = true
	slog.Info("Traffic scenario pass", "car", i, "player_lap_m", int(t.cars[0].lapM))
}

// approachGap is how far the car behind (a push-lap car, or the player behind car 2) is from the one
// ahead.
func (t *trafficSim) approachGap(i int) float64 {
	from, to := t.cars[i].lapM, t.cars[0].lapM
	if i == 2 {
		from, to = to, from
	}
	return math.Mod(to-from+2*simTrackLengthM, simTrackLengthM)
}

func (t *trafficSim) setStage(stage int) {
	t.stage, t.stageSec = stage, 0
	slog.Info("Traffic scenario stage", "stage", []string{"garage", "pit lane", "out-lap", "push lap", "in-lap"}[stage], "lap", t.cars[0].lapNum)
}

func (t *trafficSim) garage(i int) {
	c := &t.cars[i]
	c.status, c.pit, c.speedMps = packets.DriverStatusInGarage, packets.PitStatusInPitArea, 0
}

// applyLap writes car i's part of the scenario into its lap data; the cars without one wait in
// their garages.
func (t *trafficSim) applyLap(i int, l *packets.LapData) {
	l.CarPosition = simQualyPosition(i)
	if i >= len(t.cars) {
		l.DriverStatus, l.PitStatus = packets.DriverStatusInGarage, packets.PitStatusInPitArea
		l.CurrentLapNum = t.cars[0].lapNum
		return
	}
	c := t.cars[i]
	l.DriverStatus, l.PitStatus = c.status, c.pit
	l.CurrentLapNum = c.lapNum
	l.LapDistance = float32(c.lapM)
	l.CurrentLapTimeInMS = c.lapTimeMs
	l.LastLapTimeInMS = c.lastLapMs
	l.Sector = uint8(min(int(c.lapM/(simTrackLengthM/3)), 2))
	l.CurrentLapInvalid = 0
	l.PitLaneTimerActive = 0
}

// speedKmh is car i's speed for its telemetry.
func (t *trafficSim) speedKmh(i int) uint16 {
	if i >= len(t.cars) {
		return 0
	}
	return uint16(t.cars[i].speedMps * 3.6)
}
