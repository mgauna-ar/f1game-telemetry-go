package main

import (
	"cmp"
	"log/slog"
	"math"
	"slices"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// The race traffic scenario (a Grand Prix) drives a small field in real time on the traffic
// scenario's lap, so the engineer's race calls can be checked against when the cars really meet:
//   - lap 1: everyone at race pace, so the engineer learns the player's speeds;
//   - lap 2: car 1, raceBattleSec behind the player from the start, stays there for the first half
//     of the lap (a defend call), then drops back;
//   - lap 3: the player is slower, and cars 2 and 3, a lap up, close on them from
//     raceLapperBehindSec behind, raceLapperTrainSec apart. The player's flag turns blue once car 2
//     is raceBlueFlagSec behind, and stays blue until both went by;
//   - lap 4: car 4 stands stopped on a straight at raceStoppedAtM (a stopped car call), and goes
//     out of the race raceSlowGoneSec after the player went by it. Then car 5 runs
//     raceSlowAheadM ahead of the player at raceSlowShare (a slow car call), and speeds up to
//     race pace once the player went by it;
//   - lap 5: the player spins at raceSpinAtM (a step back, then standing) with cars 6 and 7
//     raceSpinBehindSec and raceSpinBehindSec+1 behind at race pace (cars coming on a slow player),
//     and gets going raceSpinRestartSec after both went by;
//   - lap 6: car 8 makes a stop, so the engineer learns where the pit exit is; then the player
//     stops at the end of the lap, and car 9 comes past the pit exit racePitExitAfterSec after the
//     player gets there (the pit exit call). The player runs raceOutLapShare until it is
//     raceOutLapClearM ahead.
//
// The other cars take no part. The scenario logs "Race scenario pass" as a car goes by the player,
// or the player by a car.
const (
	raceCars             = 10
	raceShare            = 0.97 // race pace, as a share of the push pace
	raceBattleSec        = 0.8
	raceBattleUntilM     = simTrackLengthM / 2
	raceDropBackShare    = 0.9
	raceLappedShare      = 0.9 // the player's pace on the lap they are lapped
	raceLapperShare      = 1.0
	raceLapperBehindSec  = 3.0
	raceLapperTrainSec   = 0.8
	raceBlueFlagSec      = 1.0
	raceBlueFlagAfterSec = 1.0 // the flag stays blue this long after the last lapping car went by
	raceLappedLap        = 3
	raceStartM           = 200.0 // where the player is on lap 1 as the scenario starts
	raceSlowLap          = raceLappedLap + 1
	raceStoppedAtM       = 2100.0 // on the lap's longest straight
	raceSlowGoneSec      = 5.0
	raceSlowAheadM       = 800.0
	raceSlowShare        = 0.5
	raceSpinLap          = raceSlowLap + 1
	raceSpinAtM          = 2550.0 // in the slow corner after the longest straight
	raceSpinStepBackM    = 3.0
	raceSpinBehindSec    = 16.0
	raceSpinRestartSec   = 2.0
	racePitLap           = raceSpinLap + 1
	raceAIPitFromM       = 1000.0 // car 8 starts its stop as the player gets here on racePitLap
	raceLaneEntryM       = 4900.0
	raceBoxM             = 100.0 // on the next lap, before the exit at simPitExitM
	raceBoxSec           = 3.0
	racePitExitAfterSec  = 1.5
	raceOutLapShare      = 0.7
	raceOutLapClearM     = 100.0 // the player gets up to race pace once car 9 is this far ahead
)

// raceTrafficSim is the race traffic scenario's state.
type raceTrafficSim struct {
	simProfile
	cars   [raceCars]trafficCar // the player and the cars with a part (see above)
	active [raceCars]bool       // the car is in the race; the lapping cars join on raceLappedLap
	passed [raceCars]bool       // the car went by the player this approach, or the player by it
	// goneAt is the clock seconds car 4 goes out of the race (0: not set).
	goneAt float64
	// The pit stops: how long each car is in the pit lane, how long it has left in its box, and
	// whether it stopped there yet.
	laneSec [raceCars]float64
	boxLeft [raceCars]float64
	stopped [raceCars]bool
	// The spin: whether it happened, whether the player stands, and the clock seconds they get
	// going (0: not set); whether car 8 made its stop.
	spun, spinning bool
	restartAt      float64
	aiPitted       bool
	// blue is whether the player's flag is blue, and blueUntil the clock seconds it stays blue
	// until once the lapping cars went by (0: until then).
	blue      bool
	blueUntil float64
	clock     float64 // session seconds since the scenario started
}

func newRaceTrafficSim() *raceTrafficSim {
	t := &raceTrafficSim{simProfile: newSimProfile()}
	t.placeAt(0, raceStartM)
	t.cars[0].share = raceShare
	t.active[0] = true
	t.placeAt(1, raceStartM-t.secOverBehind(raceStartM, raceBattleSec, raceShare))
	t.cars[1].share = raceShare
	t.active[1] = true
	return t
}

// total is how far car i has driven in the race, in metres.
func (t *raceTrafficSim) total(i int) float64 {
	c := t.cars[i]
	return float64(c.lapNum-1)*simTrackLengthM + c.lapM
}

// placeAt puts car i at total metres into the race, on track.
func (t *raceTrafficSim) placeAt(i int, total float64) {
	c := &t.cars[i]
	lap := math.Floor(total / simTrackLengthM)
	c.lapNum, c.lapM = uint8(lap+1), total-lap*simTrackLengthM
	c.status, c.pit = packets.DriverStatusOnTrack, packets.PitStatusNone
}

// secOverBehind is how many metres behind lap distance m a car at share of the push pace runs sec
// seconds back.
func (t *raceTrafficSim) secOverBehind(m, sec, share float64) float64 {
	back := t.behindBy(m, sec*share)
	return math.Mod(m-back+2*simTrackLengthM, simTrackLengthM)
}

// step runs the scenario on by dt seconds.
func (t *raceTrafficSim) step(dt float64) {
	var gaps [raceCars]float64
	for i := 1; i < raceCars; i++ {
		gaps[i] = t.gapBehind(i)
	}
	t.clock += dt
	p := &t.cars[0]
	prevLap := p.lapNum
	t.movePlayer(dt)
	if p.lapNum != prevLap {
		t.startLap()
	}
	for i := 1; i < raceCars; i++ {
		if !t.active[i] {
			continue
		}
		c := &t.cars[i]
		if i == 1 && c.share == raceShare && p.lapNum == 2 && p.lapM >= raceBattleUntilM {
			c.share = raceDropBackShare
			slog.Info("Race scenario battle over", "car", 1)
		}
		if c.pit != packets.PitStatusNone {
			if t.pitStep(i, dt) == pitJoined {
				c.share = raceShare
			}
			continue
		}
		t.drive(c, dt)
		if i == 4 || i == 5 {
			t.notePlayerPass(i, gaps[i])
		} else {
			t.notePass(i, gaps[i])
		}
	}
	t.updateSlowCars()
	t.updateSpin()
	t.updatePitStops()
	t.updateFlag()
}

// startLap sets up the player's new lap.
func (t *raceTrafficSim) startLap() {
	p := &t.cars[0]
	slog.Info("Race scenario lap", "lap", p.lapNum)
	switch p.lapNum {
	case raceLappedLap:
		// Two cars a lap up close from behind on a slower player.
		p.share = raceLappedShare
		lapper := t.total(0) + simTrackLengthM - t.secOverBehind(p.lapM, raceLapperBehindSec, raceLapperShare)
		t.placeAt(2, lapper)
		t.placeAt(3, lapper-t.secOverBehind(t.cars[2].lapM, raceLapperTrainSec, raceLapperShare))
		for _, i := range []int{2, 3} {
			c := &t.cars[i]
			c.share, t.active[i], t.passed[i] = raceLapperShare, true, false
			// Its lap times are as if it had raced here: from the line, and a whole lap before.
			c.lapTimeMs = uint32(math.Round(t.secOver(0, c.lapM, c.share) * 1000))
			c.lastLapMs = uint32(math.Round(t.secOver(0, simTrackLengthM, c.share) * 1000))
		}
	case raceSlowLap:
		p.share = raceShare
		// A car stopped on the straight ahead, as if it had raced to there.
		t.placeAt(4, t.total(0)-p.lapM+raceStoppedAtM)
		t.cars[4].share, t.active[4], t.passed[4] = 0, true, false
		t.cars[4].lastLapMs = uint32(math.Round(t.secOver(0, simTrackLengthM, raceShare) * 1000))
	}
}

// movePlayer moves the player on by dt seconds: standing after the spin, down the pit lane, or
// driving.
func (t *raceTrafficSim) movePlayer(dt float64) {
	p := &t.cars[0]
	switch {
	case t.spinning:
		p.speedMps = 0
		p.lapTimeMs += uint32(math.Round(dt * 1000))
	case p.pit != packets.PitStatusNone:
		switch t.pitStep(0, dt) {
		case pitLeftBox:
			t.comePastPitExit()
		case pitJoined:
			p.status, p.share = packets.DriverStatusOutLap, raceOutLapShare
			slog.Info("Race scenario pit exit", "car", 0, "lap_m", int(p.lapM))
		}
	default:
		t.drive(p, dt)
	}
}

// updateSpin spins the player on raceSpinLap at raceSpinAtM, with cars 6 and 7 coming at race
// pace, and gets them going raceSpinRestartSec after both went by.
func (t *raceTrafficSim) updateSpin() {
	p := &t.cars[0]
	switch {
	case !t.spun && p.lapNum == raceSpinLap && p.lapM >= raceSpinAtM:
		t.spun, t.spinning = true, true
		p.lapM, p.speedMps = p.lapM-raceSpinStepBackM, 0
		for k, i := range []int{6, 7} {
			back := t.secOverBehind(p.lapM, raceSpinBehindSec+float64(k), raceShare)
			t.placeAt(i, t.total(0)-back)
			t.raced(i, raceShare)
		}
		slog.Info("Race scenario spin", "lap_m", int(p.lapM), "cars", 2, "behind_sec", raceSpinBehindSec)
	case t.spinning && t.restartAt == 0 && t.passed[6] && t.passed[7]:
		t.restartAt = t.clock + raceSpinRestartSec
	case t.spinning && t.restartAt > 0 && t.clock >= t.restartAt:
		t.spinning = false
		slog.Info("Race scenario spin over", "lap_m", int(p.lapM))
	}
}

// updatePitStops sends car 8 down the pit lane on racePitLap, then the player at the lane entry
// at the end of that lap; once car 9 went by the player on their out-lap and is raceOutLapClearM
// ahead, they run at race pace.
func (t *raceTrafficSim) updatePitStops() {
	p := &t.cars[0]
	switch {
	case !t.aiPitted && p.lapNum == racePitLap && p.lapM >= raceAIPitFromM:
		t.aiPitted = true
		t.placeAt(8, t.total(0)-p.lapM+raceLaneEntryM)
		t.raced(8, raceShare)
		t.enterPitLane(8)
	case p.lapNum == racePitLap && p.pit == packets.PitStatusNone && !t.stopped[0] && p.lapM >= raceLaneEntryM:
		t.enterPitLane(0)
	case p.status == packets.DriverStatusOutLap && t.active[9] && t.passed[9] && p.share == raceOutLapShare &&
		simTrackLengthM-t.gapBehind(9) >= raceOutLapClearM:
		p.status, p.share = packets.DriverStatusOnTrack, raceShare
	}
}

// enterPitLane sends car i into the pit lane, for a stop in its box.
func (t *raceTrafficSim) enterPitLane(i int) {
	t.cars[i].pit = packets.PitStatusPitting
	t.laneSec[i], t.boxLeft[i], t.stopped[i] = 0, 0, false
	slog.Info("Race scenario pit entry", "car", i, "lap_m", int(t.cars[i].lapM))
}

// comePastPitExit puts car 9 on track where, at race pace, it passes the pit exit
// racePitExitAfterSec after the player leaving their box gets there at the pit limit.
func (t *raceTrafficSim) comePastPitExit() {
	p := &t.cars[0]
	playerSec := (simPitExitM - p.lapM) / (trafficPitLimitKmh / 3.6)
	back := t.secOverBehind(simPitExitM, playerSec+racePitExitAfterSec, raceShare)
	t.placeAt(9, t.total(0)-p.lapM+simPitExitM-back)
	t.raced(9, raceShare)
	t.passed[9] = false
	slog.Info("Race scenario pit exit car", "car", 9, "after_sec", racePitExitAfterSec)
}

// raced makes car i, just placed, take part at share, with lap times as if it had raced there.
func (t *raceTrafficSim) raced(i int, share float64) {
	c := &t.cars[i]
	c.share, t.active[i], t.passed[i] = share, true, false
	c.lapTimeMs = uint32(math.Round(t.secOver(0, c.lapM, share) * 1000))
	c.lastLapMs = uint32(math.Round(t.secOver(0, simTrackLengthM, share) * 1000))
}

// What a step down the pit lane did.
const (
	pitMoved = iota
	pitLeftBox
	pitJoined
)

// pitStep drives car i down the pit lane by dt seconds: at the pit limit from the entry to its
// box at raceBoxM, standing there raceBoxSec, then on to the exit at simPitExitM, where it joins
// the track.
func (t *raceTrafficSim) pitStep(i int, dt float64) int {
	c := &t.cars[i]
	t.laneSec[i] += dt
	c.lapTimeMs += uint32(math.Round(dt * 1000))
	if c.pit == packets.PitStatusInPitArea {
		c.speedMps = 0
		if t.boxLeft[i] -= dt; t.boxLeft[i] <= 0 {
			c.pit = packets.PitStatusPitting
			return pitLeftBox
		}
		return pitMoved
	}
	c.speedMps = trafficPitLimitKmh / 3.6
	c.lapM += c.speedMps * dt
	if c.lapM >= simTrackLengthM {
		c.lapM -= simTrackLengthM
		c.lapNum++
		c.lastLapMs, c.lapTimeMs = c.lapTimeMs, 0
	}
	switch {
	case !t.stopped[i] && c.lapM >= raceBoxM && c.lapM < simPitExitM:
		c.lapM, c.pit, c.speedMps = raceBoxM, packets.PitStatusInPitArea, 0
		t.boxLeft[i], t.stopped[i] = raceBoxSec, true
	case t.stopped[i] && c.lapM >= simPitExitM && c.lapM < simTrackLengthM/2:
		c.pit = packets.PitStatusNone
		return pitJoined
	}
	return pitMoved
}

// updateSlowCars moves the lap's slow cars on once the player went by them: car 4 goes out of
// the race raceSlowGoneSec later, and car 5 comes out raceSlowAheadM ahead at raceSlowShare;
// car 5 speeds up to race pace once the player went by it.
func (t *raceTrafficSim) updateSlowCars() {
	switch {
	case t.active[4] && t.passed[4] && t.goneAt == 0:
		t.goneAt = t.clock + raceSlowGoneSec
		t.placeAt(5, t.total(0)+raceSlowAheadM)
		t.raced(5, raceShare)
		t.cars[5].share = raceSlowShare
		slog.Info("Race scenario slow car", "car", 5, "ahead_m", raceSlowAheadM, "share", raceSlowShare)
	case t.active[4] && t.goneAt > 0 && t.clock >= t.goneAt:
		t.active[4] = false
	case t.active[5] && t.passed[5] && t.cars[5].share == raceSlowShare:
		t.cars[5].share = raceShare
	}
}

// gapBehind is how far car i runs behind the player on the road, in metres, in [0, lap).
func (t *raceTrafficSim) gapBehind(i int) float64 {
	return math.Mod(t.cars[0].lapM-t.cars[i].lapM+2*simTrackLengthM, simTrackLengthM)
}

// notePass logs the moment car i went by the player: its gap behind wrapped past half a lap.
func (t *raceTrafficSim) notePass(i int, gapBefore float64) {
	if t.passed[i] || gapBefore > simTrackLengthM/2 || t.gapBehind(i) < simTrackLengthM/2 {
		return
	}
	t.passed[i] = true
	slog.Info("Race scenario pass", "car", i, "player_lap_m", int(t.cars[0].lapM))
}

// notePlayerPass logs the moment the player went by car i: its gap behind them wrapped back under
// half a lap.
func (t *raceTrafficSim) notePlayerPass(i int, gapBefore float64) {
	if t.passed[i] || gapBefore < simTrackLengthM/2 || t.gapBehind(i) > simTrackLengthM/2 {
		return
	}
	t.passed[i] = true
	slog.Info("Race scenario pass", "car", i, "by", "player", "player_lap_m", int(t.cars[0].lapM))
}

// updateFlag shows the player the blue flag once car 2, a lap up, is raceBlueFlagSec behind, until
// raceBlueFlagAfterSec after both lapping cars went by.
func (t *raceTrafficSim) updateFlag() {
	if !t.active[2] {
		return
	}
	switch {
	case !t.blue && !t.passed[2] && t.secBehind(2) <= raceBlueFlagSec:
		t.blue = true
		slog.Info("Race scenario blue flag", "car", 2, "road_sec", math.Round(t.secBehind(2)*10)/10)
	case t.blue && t.blueUntil == 0 && t.passed[2] && t.passed[3]:
		t.blueUntil = t.clock + raceBlueFlagAfterSec
	case t.blue && t.blueUntil > 0 && t.clock >= t.blueUntil:
		t.blue = false
	}
}

// secBehind is how many seconds car i runs behind the player on the road, at its pace.
func (t *raceTrafficSim) secBehind(i int) float64 {
	return t.secOver(t.cars[i].lapM, t.gapBehind(i), t.cars[i].share)
}

// playerLimiter is whether the player's pit limiter is on: all the way down the pit lane.
func (t *raceTrafficSim) playerLimiter() uint8 {
	if t.cars[0].pit != packets.PitStatusNone {
		return 1
	}
	return 0
}

// playerFlag is the flag shown to the player.
func (t *raceTrafficSim) playerFlag() int8 {
	if t.blue {
		return packets.VehicleFIAFlagBlue
	}
	return packets.VehicleFIAFlagGreen
}

// applyLap writes car i's part of the scenario into its lap data: the cars in the race by race
// distance, the gaps between them at their pace; the cars without a part sit out the race.
func (t *raceTrafficSim) applyLap(i int, l *packets.LapData) {
	if i >= raceCars || !t.active[i] {
		*l = packets.LapData{DriverStatus: packets.DriverStatusInGarage, ResultStatus: packets.ResultStatusInactive}
		return
	}
	order := t.order()
	pos := slices.Index(order, i)
	c := t.cars[i]
	*l = packets.LapData{
		DriverStatus:       c.status,
		PitStatus:          c.pit,
		ResultStatus:       packets.ResultStatusActive,
		CurrentLapNum:      c.lapNum,
		LapDistance:        float32(c.lapM),
		TotalDistance:      float32(t.total(i)),
		CarPosition:        uint8(pos + 1),
		GridPosition:       uint8(i + 1),
		CurrentLapTimeInMS: c.lapTimeMs,
		LastLapTimeInMS:    c.lastLapMs,
		Sector:             uint8(min(int(c.lapM/(simTrackLengthM/3)), 2)),
	}
	if c.pit != packets.PitStatusNone {
		l.PitLaneTimerActive, l.PitLaneTimeInLaneInMS = 1, uint16(min(t.laneSec[i]*1000, math.MaxUint16))
		if c.pit == packets.PitStatusInPitArea {
			l.PitStopTimerInMS = uint16((raceBoxSec - t.boxLeft[i]) * 1000)
		}
	}
	if pos > 0 {
		l.DeltaToCarInFrontMinutesPart, l.DeltaToCarInFrontMSPart = splitMS(t.secOver(c.lapM, t.total(order[pos-1])-t.total(i), c.share))
		l.DeltaToRaceLeaderMinutesPart, l.DeltaToRaceLeaderMSPart = splitMS(t.secOver(c.lapM, t.total(order[0])-t.total(i), c.share))
	}
}

// order is the cars in the race, first to last by race distance.
func (t *raceTrafficSim) order() []int {
	var order []int
	for i := range t.cars {
		if t.active[i] {
			order = append(order, i)
		}
	}
	slices.SortFunc(order, func(a, b int) int { return cmp.Compare(t.total(b), t.total(a)) })
	return order
}

// splitMS splits sec into the lap data's minutes and milliseconds parts.
func splitMS(sec float64) (minutes uint8, ms uint16) {
	total := int(math.Round(sec * 1000))
	return uint8(total / 60_000), uint16(total % 60_000)
}

// speedKmh is car i's speed for its telemetry.
func (t *raceTrafficSim) speedKmh(i int) uint16 {
	if i >= raceCars || !t.active[i] {
		return 0
	}
	return uint16(t.cars[i].speedMps * 3.6)
}
