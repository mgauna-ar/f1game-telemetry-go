package main

import (
	"log/slog"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// The traffic scenario (Q1) drives its cars in real time on a lap of slow corners and fast
// straights, so the engineer's push-lap traffic calls can be checked against when the cars really
// meet. The player runs garage, pit lane, out-lap, push lap and in-lap, then back to the garage.
// Car 1 does a push lap while the player first waits in the garage (so the engineer learns the
// track's push-lap speeds), then is on one trafficBehindStartSec behind the player on every
// out-lap and passes them;
// car 2 is on a slow in-lap ahead on every push lap. The other cars stay in their garages. The
// engine's "Push-lap traffic" and "Push-lap car passed" lines say when it called each car and when
// it went by; this scenario logs "Traffic scenario pass" at the moment it did.
const (
	trafficGarageSec      = 6.0
	trafficFirstGarageSec = 95.0  // the first wait in the garage: car 1 does a whole push lap meanwhile
	trafficPitLaneM       = 250.0 // the pit lane's length to the exit at simPitExitM
	trafficPitLimitKmh    = 80
	trafficOutLapShare    = 0.8
	trafficInLapShare     = 0.6
	trafficSlowShare      = 0.55
	trafficBehindStartSec = 12.0   // car 1's gap behind the player as the out-lap starts, at its pace
	trafficSlowAheadM     = 1500.0 // car 2's gap ahead as the push lap starts
	trafficStartSec       = 1080
	trafficPlayerPosition = 12
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

// trafficSim is the scenario's state.
type trafficSim struct {
	scale    float64 // push-pace speed over the profile's
	stage    int
	stageSec float64
	runs     int           // the runs the player started
	cars     [3]trafficCar // the player, the push-lap car, the slow car
	passed   [3]bool       // the car went by the player this approach
}

func newTrafficSim() *trafficSim {
	t := &trafficSim{}
	var profileSec float64
	from := 0.0
	for _, seg := range trafficProfileSegments {
		profileSec += (seg.toM - from) / seg.mps
		from = seg.toM
	}
	s := simSectorsMS(0, 1)
	t.scale = profileSec / (float64(s[0]+s[1]+s[2]) / 1000)
	t.cars[0] = trafficCar{lapNum: 1, status: packets.DriverStatusInGarage, pit: packets.PitStatusInPitArea}
	t.cars[1] = trafficCar{lapNum: 1, status: packets.DriverStatusFlyingLap, pit: packets.PitStatusNone, share: 1}
	t.cars[2] = trafficCar{lapNum: 1, status: packets.DriverStatusInGarage, pit: packets.PitStatusInPitArea}
	return t
}

// speedAt is the push-pace speed at lap distance m, in m/s.
func (t *trafficSim) speedAt(m float64) float64 {
	m = math.Mod(m, simTrackLengthM)
	for _, seg := range trafficProfileSegments {
		if m < seg.toM {
			return seg.mps * t.scale
		}
	}
	return trafficProfileSegments[len(trafficProfileSegments)-1].mps * t.scale
}

// behindBy is the lap distance dt seconds of car 1's push pace behind lap distance m.
func (t *trafficSim) behindBy(m, dt float64) float64 {
	for left := dt; left > 0; left -= 0.05 {
		m -= t.speedAt(math.Mod(m+simTrackLengthM, simTrackLengthM)) * min(0.05, left)
	}
	return math.Mod(m+2*simTrackLengthM, simTrackLengthM)
}

// drive moves car c on by dt seconds at its share of the profile, counting its laps. A step
// that reaches the end of a stretch goes on at the next stretch's speed from there.
func (t *trafficSim) drive(c *trafficCar, dt float64) {
	c.lapTimeMs += uint32(math.Round(dt * 1000))
	for left := dt; left > 1e-9; {
		c.speedMps = c.share * t.speedAt(c.lapM)
		end := t.stretchEnd(c.lapM)
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
func (t *trafficSim) stretchEnd(m float64) float64 {
	for _, seg := range trafficProfileSegments {
		if m < seg.toM {
			return seg.toM
		}
	}
	return simTrackLengthM
}

// step runs the scenario on by dt seconds.
func (t *trafficSim) step(dt float64) {
	var gaps [3]float64
	for i := 1; i < len(t.cars); i++ {
		gaps[i] = t.approachGap(i)
	}
	p := &t.cars[0]
	t.stageSec += dt
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
		}
	case trafficPitLane:
		p.speedMps = trafficPitLimitKmh / 3.6
		p.lapM += p.speedMps * dt
		if p.lapM >= simPitExitM {
			t.setStage(trafficOutLap)
			p.pit, p.share = packets.PitStatusNone, trafficOutLapShare
			// Car 1 starts its push lap behind the player.
			c := &t.cars[1]
			c.status, c.pit, c.share, c.lapNum = packets.DriverStatusFlyingLap, packets.PitStatusNone, 1, p.lapNum
			c.lapM = t.behindBy(p.lapM, trafficBehindStartSec)
			t.passed[1] = false
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
		t.notePass(i, gaps[i])
	}
}

// notePass logs the moment car 1 went by the player, or the player went by car 2: the gap from the
// one behind to the one ahead (gapBefore last frame) wrapped past half a lap.
func (t *trafficSim) notePass(i int, gapBefore float64) {
	if t.passed[i] || t.cars[0].pit != packets.PitStatusNone || gapBefore > simTrackLengthM/2 ||
		t.approachGap(i) < simTrackLengthM/2 {
		return
	}
	t.passed[i] = true
	slog.Info("Traffic scenario pass", "car", i, "player_lap_m", int(t.cars[0].lapM))
}

// approachGap is how far the car behind (car 1, or the player behind car 2) is from the one ahead.
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
