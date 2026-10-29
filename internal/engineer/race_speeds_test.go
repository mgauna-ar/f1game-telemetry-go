package engineer

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceSpeedsAt is speed m/s in every bin of a qualyTrackLen lap.
func raceSpeedsAt(speed float32) []float32 {
	speeds := make([]float32, quietBins(qualyTrackLen))
	for b := range speeds {
		speeds[b] = speed
	}
	return speeds
}

// fieldAt is the field's speeds of a qualyTrackLen lap, known everywhere: speeds[b] in bin b.
func fieldAt(speeds []float32) *raceSpeeds {
	r := &raceSpeeds{}
	r.reset(qualyTrackLen)
	for b, v := range speeds {
		for range RaceSpeedPasses {
			r.addPass(b, v)
		}
	}
	return r
}

// drive moves car idx from fromM to toM at mps in steps of 50 ms, every step counting or not.
func drive(r *raceSpeeds, idx int, fromM, toM float32, mps float64, counts bool) {
	step := mps * 0.05
	for x := float64(fromM); x < float64(toM); x += step {
		r.learn(idx, qualyTrackLen, float32(x), step, 50, counts)
	}
}

// Each car going through a bin adds one pass at its speed through it, however long it takes;
// a bin it drove only part of adds none.
func TestRaceSpeeds_OnePassPerCar(t *testing.T) {
	var r raceSpeeds
	drive(&r, 1, 0, 160, 40, true)
	for b := range 3 {
		if r.n[b] != 1 || math.Abs(float64(r.speeds[b])-40) > 0.5 {
			t.Errorf("bin %d: %d passes at %.1f m/s, want one at 40", b, r.n[b], r.speeds[b])
		}
	}
	if r.n[3] != 0 {
		t.Errorf("bin 3, still being driven, has %d passes", r.n[3])
	}

	// A car crawling through bin 5 at 1 m/s: one pass, not a thousand.
	drive(&r, 2, 250, 310, 1, true)
	if r.n[5] != 1 || math.Abs(float64(r.speeds[5])-1) > 0.05 {
		t.Errorf("bin 5: %d passes at %.2f m/s, want one at 1", r.n[5], r.speeds[5])
	}

	// Joining half way through bin 10: no pass there.
	drive(&r, 3, 530, 610, 40, true)
	if r.n[10] != 0 || r.n[11] != 1 {
		t.Errorf("bins 10 and 11: %d and %d passes, want 0 and 1", r.n[10], r.n[11])
	}

	// A step that doesn't count (the pit lane, a yellow) drops the pass it was on.
	drive(&r, 4, 1000, 1020, 40, true)
	drive(&r, 4, 1020, 1022, 40, false)
	drive(&r, 4, 1022, 1110, 40, true)
	if r.n[20] != 0 || r.n[21] != 1 {
		t.Errorf("bins 20 and 21: %d and %d passes, want 0 and 1", r.n[20], r.n[21])
	}
}

// A bin's speed is the median of its last passes: one slow car doesn't move it, the field slowing
// down does.
func TestRaceSpeeds_Median(t *testing.T) {
	var r raceSpeeds
	r.reset(qualyTrackLen)
	for range RaceSpeedPasses - 1 {
		r.addPass(0, 80)
	}
	r.addPass(0, 10)
	if r.speeds[0] != 80 {
		t.Errorf("one slow pass moved the bin to %.1f m/s", r.speeds[0])
	}
	for range RaceSpeedPasses/2 + 1 {
		r.addPass(0, 60)
	}
	if r.speeds[0] != 60 {
		t.Errorf("the field at 60 m/s left the bin at %.1f m/s", r.speeds[0])
	}
}

// The field's speeds are used once PushMinCoverage of the bins have RaceSpeedMinPasses passes; a
// bin without any takes the next known one's.
func TestRaceSpeeds_Ready(t *testing.T) {
	var r raceSpeeds
	r.reset(qualyTrackLen)
	bins := quietBins(qualyTrackLen)
	need := int(math.Ceil(PushMinCoverage * float64(bins)))
	for b := range need - 1 {
		for range RaceSpeedMinPasses {
			r.addPass(b, 70)
		}
	}
	r.addPass(need-1, 50)
	if r.speedsFor(qualyTrackLen) != nil {
		t.Fatalf("used with %d bins known of the %d needed", need-1, need)
	}
	for range RaceSpeedMinPasses - 1 {
		r.addPass(need-1, 50)
	}
	speeds := r.speedsFor(qualyTrackLen)
	if speeds == nil {
		t.Fatal("not used with enough bins known")
	}
	if speeds[need-1] != 50 || speeds[need] != 70 {
		t.Errorf("bins %d and %d at %.0f and %.0f m/s, want 50 and 70 (the next known, round the line)",
			need-1, need, speeds[need-1], speeds[need])
	}
	if r.speedsFor(qualyTrackLen+100) != nil {
		t.Error("used on another track length")
	}
}

// The steps of a car count while it races on track: not behind the Safety Car, in the pit lane,
// nor where a yellow flag is out.
func TestRaceSpeeds_Steps(t *testing.T) {
	racing := raceCar(0, 0)
	pitting := racing
	pitting.PitStatus = packets.PitStatusPitting
	feed := func(s *packets.PacketSessionData, l packets.LapData) *raceSpeeds {
		r := &raceSpeeds{}
		learn := r.steps(s, qualyTrackLen)
		for x := float32(0); x < qualyTrackLen; x += 2 {
			learn(1, &l, x, 2, 50)
		}
		return r
	}
	passes := func(r *raceSpeeds, from, to int) int {
		n := 0
		for b := from; b < to; b++ {
			n += int(r.n[b])
		}
		return n
	}
	bins := quietBins(qualyTrackLen)
	green := &packets.PacketSessionData{TrackLength: qualyTrackLen}
	if n := passes(feed(green, racing), 0, bins); n < bins-1 {
		t.Errorf("%d passes round a green lap, want %d", n, bins-1)
	}
	sc := &packets.PacketSessionData{TrackLength: qualyTrackLen, SafetyCarStatus: packets.SafetyCarFull}
	if n := passes(feed(sc, racing), 0, bins); n != 0 {
		t.Errorf("%d passes behind the Safety Car", n)
	}
	if n := passes(feed(green, pitting), 0, bins); n != 0 {
		t.Errorf("%d passes in the pit lane", n)
	}
	yellow := &packets.PacketSessionData{TrackLength: qualyTrackLen, NumMarshalZones: 2}
	yellow.MarshalZones[0] = packets.MarshalZone{ZoneStart: 0, ZoneFlag: packets.VehicleFIAFlagGreen}
	yellow.MarshalZones[1] = packets.MarshalZone{ZoneStart: 0.5, ZoneFlag: packets.VehicleFIAFlagYellow}
	r := feed(yellow, racing)
	if n := passes(r, bins/2, bins); n != 0 {
		t.Errorf("%d passes in the yellow zone", n)
	}
	if n := passes(r, 0, bins/2); n < bins/2-1 {
		t.Errorf("%d passes before the yellow zone, want %d", n, bins/2-1)
	}
}

// The marshal zone at a lap distance is the one starting last before it; before the first one's
// start, the last zone, which runs over the line.
func TestYellowAt(t *testing.T) {
	s := &packets.PacketSessionData{NumMarshalZones: 3}
	s.MarshalZones[0] = packets.MarshalZone{ZoneStart: 0.05, ZoneFlag: packets.VehicleFIAFlagGreen}
	s.MarshalZones[1] = packets.MarshalZone{ZoneStart: 0.3, ZoneFlag: packets.VehicleFIAFlagYellow}
	s.MarshalZones[2] = packets.MarshalZone{ZoneStart: 0.8, ZoneFlag: packets.VehicleFIAFlagYellow}
	// A zone past the count isn't one.
	s.MarshalZones[3] = packets.MarshalZone{ZoneStart: 0.9, ZoneFlag: packets.VehicleFIAFlagGreen}
	for _, tt := range []struct {
		at   float32
		want bool
	}{{0.02, true}, {0.1, false}, {0.4, true}, {0.79, true}, {0.95, true}} {
		if got := yellowAt(s, tt.at*qualyTrackLen, qualyTrackLen); got != tt.want {
			t.Errorf("at %.2f of the lap: yellow %v, want %v", tt.at, got, tt.want)
		}
	}
	if yellowAt(nil, 100, qualyTrackLen) {
		t.Error("yellow with no session data")
	}
}

// Until the field's speeds are known (lap 1), only a stopped car is called, on the track's pace
// profile.
func TestRaceTrafficRule_SlowCarAheadBeforeFieldSpeeds(t *testing.T) {
	v := float64(raceSpeed)
	for _, tt := range []struct {
		name      string
		car       packets.LapData
		speed     float64
		wantAlert string
	}{
		{name: "a stopped car", car: aheadBy(700), wantAlert: "race_stopped_car_ahead"},
		{name: "a car at half pace", car: aheadBy(350), speed: 0.5 * v},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), tt.car), map[int]float64{0: v, 1: tt.speed})
			ctx.TrackProfile = learnedTrackAt(raceSpeed)
			ctx.RaceSpeeds = &raceSpeeds{}
			dirs := NewRaceTrafficRule().Evaluate(ctx)
			if tt.wantAlert == "" {
				if len(dirs) != 0 {
					t.Fatalf("expected no call, got %v", subAlerts(dirs))
				}
				return
			}
			if directiveFor(dirs, tt.wantAlert) == nil {
				t.Fatalf("expected %s, got %v", tt.wantAlert, subAlerts(dirs))
			}
		})
	}
}

// The reported case: the cars ahead brake earlier than the player and take a slow corner at 65 %
// of the player's speed, for 5 s. On the player's speeds they look slow; on the field's, learned
// from them over the first lap, they aren't, so no slow car call while the player closes on one
// through the corner.
func TestEngineerEngine_NoSlowCarForTheFieldBraking(t *testing.T) {
	player := raceSpeedsAt(80)
	field := raceSpeedsAt(78)
	player[39] = 55
	field[38], field[39] = 35, 35
	for b := 40; b <= 41; b++ {
		player[b] = 30
		field[b] = 0.65 * 30
	}
	speedAt := func(speeds []float32, x float64) float64 {
		return float64(speeds[min(int(math.Mod(x, qualyTrackLen)/QuietBinM), len(speeds)-1)])
	}

	e, b, clock, h := raceEngine(t)
	tp := e.profiles.learning(0)
	tp.speed, tp.quiet, tp.quietLaps = player, make([]float32, len(player)), 1
	// The player at the line, car 1 700 m up the road and six more round the lap: the player
	// catches car 1 through the corner on the second lap.
	at := make([]float64, 8)
	for i := 1; i < len(at); i++ {
		at[i] = float64(i) * 700
	}
	closedIn := false
	for k := 0; k < 3000; k++ {
		h.SessionTime = float32(100 + float64(k)*0.05)
		p := &packets.PacketLapData{Header: h}
		for i, x := range at {
			p.LapData[i] = raceCar(float32(math.Mod(x, qualyTrackLen)), float32(46_000+x))
		}
		e.ProcessPacket(context.Background(), p)
		// Car 1 braking or in the corner within 150 m ahead, with the field's speeds known.
		inCorner := math.Mod(at[1], qualyTrackLen) >= 38*QuietBinM && math.Mod(at[1], qualyTrackLen) < 42*QuietBinM
		if gap := at[1] - at[0]; inCorner && gap > 0 && gap < 150 && e.raceSpeeds.speedsFor(qualyTrackLen) != nil {
			closedIn = true
		}
		for i := range at {
			speeds := field
			if i == 0 {
				speeds = player
			}
			at[i] += speedAt(speeds, at[i]) * 0.05
		}
		clock.advance(50 * time.Millisecond)
	}
	if !closedIn {
		t.Fatal("the player never closed on car 1 through the corner with the field's speeds known")
	}
	for _, key := range []string{"race_slow_car_ahead", "race_stopped_car_ahead", "race_slow_car_ahead_now"} {
		if n := len(spokenCalls(t, b, key)); n > 0 {
			t.Errorf("%s said %d times for cars braking as the field does", key, n)
		}
	}
}

// The field's speeds are forgotten with the session.
func TestEngineerEngine_RaceSpeedsResetWithTheSession(t *testing.T) {
	e, _, _, h := raceEngine(t)
	for k := 0; k < 40; k++ {
		h.SessionTime = float32(100 + float64(k)*0.05)
		p := &packets.PacketLapData{Header: h}
		p.LapData[0] = raceCar(float32(1000+k*4), 46_000)
		e.ProcessPacket(context.Background(), p)
	}
	if e.raceSpeeds.n[20] == 0 {
		t.Fatal("no pass learned in the race")
	}
	next := createTestHeader(packets.PacketFormat2025, h.SessionUID+1, 0)
	e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: next, SessionType: packets.SessionRace, TrackLength: qualyTrackLen})
	if len(e.raceSpeeds.n) != 0 {
		t.Error("the race speeds outlived the session")
	}
}
