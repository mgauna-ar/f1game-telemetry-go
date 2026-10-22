package engineer

import (
	"context"
	"math"
	"slices"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceSpeed is the speed of every bin of the learned track in the slow car tests.
const raceSpeed = AverageRaceSpeedMetersPerSec

// learnedTrackAt is a track profile of qualyTrackLen metres whose player speeds were learned:
// speed m/s in every bin.
func learnedTrackAt(speed float32) *trackProfile {
	bins := quietBins(qualyTrackLen)
	tp := &trackProfile{speed: make([]float32, bins), quiet: make([]float32, bins), quietLaps: 1}
	for b := range tp.speed {
		tp.speed[b] = speed
	}
	return tp
}

// slowEval evaluates rule on lap data of a race on a learned track, with the player (car 0) at
// 2000 m and car i driving at speeds[i] m/s over the last seconds, at now, with the calls the
// radio said in lastSaid.
func slowEval(rule *RaceTrafficRule, lastSaid map[string]int64, now int64, speeds map[int]float64, cars ...packets.LapData) []Directive {
	ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, append([]packets.LapData{raceCar(2000, 46_000)}, cars...)...), speeds)
	ctx.TrackProfile = learnedTrackAt(raceSpeed)
	ctx.Now, ctx.LastSaid = now, lastSaid
	return rule.Evaluate(ctx)
}

// aheadBy is a car aheadM metres up the road from the player at 2000 m (negative: behind).
func aheadBy(aheadM float32) packets.LapData {
	return raceCar(2000+aheadM, 46_000+aheadM)
}

// A slow or stopped car ahead is called once the driver would hear the number QualyTrafficWarnSec
// before they reach it.
func TestRaceTrafficRule_SlowCarAhead(t *testing.T) {
	v := float64(raceSpeed)
	tests := []struct {
		name      string
		car       packets.LapData
		speed     float64
		entryM    float32 // the learned pit entry (0: none)
		wantAlert string  // "" for no call
		wantReach int
	}{
		// 700 m at the player's 65 m/s: reached in 10.8 s, 8 s once the number is heard.
		{name: "a stopped car", car: aheadBy(700), wantAlert: "race_stopped_car_ahead", wantReach: 8},
		{name: "a stopped car a bit further", car: aheadBy(750)},
		// 350 m closing at half the player's pace: the same 10.8 s.
		{name: "a car at half pace", car: aheadBy(350), speed: 0.5 * v, wantAlert: "race_slow_car_ahead", wantReach: 8},
		{name: "right there", car: aheadBy(40), wantAlert: "race_slow_car_ahead_now"},
		{name: "racing 3% slower", car: aheadBy(100), speed: 0.97 * v},
		{name: "a car at three quarters pace", car: aheadBy(150), speed: 0.75 * v},
		{name: "slowing for the pit entry", car: aheadBy(350), speed: 0.5 * v, entryM: 2600},
		{name: "stopped before the pit entry", car: aheadBy(350), entryM: 2600, wantAlert: "race_stopped_car_ahead", wantReach: 2},
		{name: "behind the player", car: aheadBy(-200)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), tt.car), map[int]float64{0: v, 1: tt.speed})
			ctx.TrackProfile = learnedTrackAt(raceSpeed)
			if tt.entryM > 0 {
				ctx.TrackProfile.entryM = []float32{tt.entryM}
			}
			dirs := NewRaceTrafficRule().Evaluate(ctx)
			if tt.wantAlert == "" {
				if len(dirs) != 0 {
					t.Fatalf("expected no call, got %v", subAlerts(dirs))
				}
				return
			}
			d := directiveFor(dirs, tt.wantAlert)
			if d == nil || d.ID != "race_slow_car_ahead" || d.Urgency != UrgencyHigh || d.Values.Ahead.ReachSec != tt.wantReach {
				t.Fatalf("expected %s in %d s, got %v %+v", tt.wantAlert, tt.wantReach, subAlerts(dirs), d)
			}
		})
	}
}

// No slow car call without a pace profile (a car in a slow corner would seem stopped), nor for a
// car whose samples just started again (a flashback, a jump).
func TestRaceTrafficRule_SlowCarAheadNeedsPaces(t *testing.T) {
	speeds := map[int]float64{0: float64(raceSpeed), 1: 0}
	ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), aheadBy(700)), speeds)
	if dirs := NewRaceTrafficRule().Evaluate(ctx); len(dirs) != 0 {
		t.Errorf("called %v on a flat profile", subAlerts(dirs))
	}
	ctx.TrackProfile = learnedTrackAt(raceSpeed)
	ctx.Motion.cars[1] = carTrack{}
	ctx.Motion.cars[1].add(100_000, 2700, qualyTrackLen)
	if dirs := NewRaceTrafficRule().Evaluate(ctx); len(dirs) != 0 {
		t.Errorf("called %v for a car with one sample", subAlerts(dirs))
	}
}

// The slow car call is made in the race only, on its laps: not behind the Safety Car, on the
// formation lap or under a red flag, nor in qualifying.
func TestRaceTrafficRule_SlowCarAheadPhases(t *testing.T) {
	keys := NewRaceTrafficRule().AlertKeys()
	phases := keys["race_slow_car_ahead"].ValidPhases
	for _, p := range []DrivingPhase{PhaseSafetyCar, PhaseFormationLap, PhaseRedFlag, PhaseRaceStart, PhasePitLane} {
		if slices.Contains(phases, p) {
			t.Errorf("race_slow_car_ahead is valid in %s", p)
		}
	}
	ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseRacing, raceCar(2000, 46_000), aheadBy(700)), map[int]float64{0: float64(raceSpeed)})
	ctx.TrackProfile = learnedTrackAt(raceSpeed)
	if dirs := NewRaceTrafficRule().Evaluate(ctx); len(dirs) != 0 {
		t.Errorf("called %v in qualifying", subAlerts(dirs))
	}
}

// Each slow car is called once on the player's way to it, with a second one just past it counted
// in the same call; one the radio didn't say is called again, and one that speeds up and slows
// again is a new call.
func TestRaceTrafficRule_SlowCarAheadOncePerCar(t *testing.T) {
	rule := NewRaceTrafficRule()
	said := map[string]int64{}
	stopped := map[int]float64{0: float64(raceSpeed), 1: 0, 2: 0}

	// Not said: made again.
	if d := directiveFor(slowEval(rule, said, 1000, stopped, aheadBy(700), aheadBy(760)), "race_stopped_car_ahead"); d == nil {
		t.Fatal("expected the stopped car to be called")
	}
	if d := directiveFor(slowEval(rule, said, 1050, stopped, aheadBy(700), aheadBy(760)), "race_stopped_car_ahead"); d == nil {
		t.Fatal("expected the call the radio didn't say to be made again")
	}
	sayAll(said, []Directive{{ID: "race_slow_car_ahead"}}, 1050)
	for now := int64(1100); now < 2000; now += 50 {
		if dirs := slowEval(rule, said, now, stopped, aheadBy(650), aheadBy(710)); len(dirs) != 0 {
			t.Fatalf("called %v again for the two cars already called", subAlerts(dirs))
		}
	}
	// Car 1 gets going and stops again: a new call.
	going := map[int]float64{0: float64(raceSpeed), 1: float64(raceSpeed), 2: 0}
	if dirs := slowEval(rule, said, 2000, going, aheadBy(600), aheadBy(1000)); len(dirs) != 0 {
		t.Fatalf("called %v with car 1 at race pace", subAlerts(dirs))
	}
	if d := directiveFor(slowEval(rule, said, 2050, stopped, aheadBy(650), aheadBy(1000)), "race_stopped_car_ahead"); d == nil {
		t.Fatal("expected car 1 to be called again once it stopped again")
	}
}

// A stopped car whose lap distance jitters back and forth has a pace (none), not samples that
// keep starting again.
func TestCarMotion_JitteringStoppedCar(t *testing.T) {
	var track carTrack
	jitter := []float32{3000, 2999.97, 3000.02, 2999.99}
	for k := 0; k < 80; k++ {
		track.add(int64(100_000+k*50), jitter[k%len(jitter)], qualyTrackLen)
	}
	if track.n < 60 {
		t.Fatalf("%d samples kept of 80: they started again", track.n)
	}
	m := &carMotion{}
	m.cars[1] = track
	share, ok := m.paceShare(1, PaceWindowLongMs, learnedProfile())
	if !ok || share > 0.01 {
		t.Errorf("share %.3f (known %v), want standing still", share, ok)
	}
}

// learnedProfile is the pace profile of a learned track at raceSpeed.
func learnedProfile() paceProfile {
	ctx := qualyCtx(packets.SessionRace, PhaseRacing)
	ctx.TrackProfile = learnedTrackAt(raceSpeed)
	return trafficProfile(ctx)
}

// Push speeds are learned from the cars in timed sessions, not in a race.
func TestEngineerEngine_PushSpeedsNotLearnedInARace(t *testing.T) {
	for _, tt := range []struct {
		session uint8
		learn   bool
	}{{packets.SessionRace, false}, {packets.SessionQ1, true}} {
		e := newTestEngineerEngine(&mockBroadcaster{})
		h := createTestHeader(packets.PacketFormat2025, 77, 0)
		e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: h, SessionType: tt.session, TrackLength: qualyTrackLen})
		for k := 0; k < 20; k++ {
			h.SessionTime = float32(100 + float64(k)*0.05)
			p := &packets.PacketLapData{Header: h}
			p.LapData[0] = qualyCar(packets.DriverStatusOutLap, 100, 100)
			p.LapData[1] = qualyCar(packets.DriverStatusFlyingLap, float32(1000+k*4), 0)
			e.ProcessPacket(context.Background(), p)
		}
		learned := slices.ContainsFunc(e.profiles.learning(0).push, func(v float32) bool { return v > 0 })
		if learned != tt.learn {
			t.Errorf("session %d: push speeds learned %v, want %v", tt.session, learned, tt.learn)
		}
	}
}

// slowCarRun is one approach to a slow car through the engine at 20 Hz: where the player and the
// car are at session second t (unwrapped lap distances), on learned speeds.
type slowCarRun struct {
	speeds   []float32
	playerAt func(t float64) float64
	carAt    func(t float64) float64
	alert    string
}

// The player reaches a stopped or slow car QualyTrafficWarnSec (±1 s) after hearing the number.
func TestEngineerEngine_SlowCarReachedWhenSaid(t *testing.T) {
	// A fast first four kilometres and a slow last one, as in the push-lap traffic test.
	speeds := make([]float32, quietBins(qualyTrackLen))
	for b := range speeds {
		speeds[b] = 80
		if b < 20 {
			speeds[b] = 20
		}
	}
	tests := []struct {
		name string
		run  slowCarRun
	}{
		{"a car stopped round the slow corner", slowCarRun{
			speeds:   speeds,
			playerAt: onProfile(speeds, 3000, 1),
			carAt:    func(float64) float64 { return 5300 },
			alert:    "race_stopped_car_ahead",
		}},
		{"a car at half pace", slowCarRun{
			speeds:   speeds,
			playerAt: onProfile(speeds, 3000, 1),
			carAt:    onProfile(speeds, 4100, 0.5),
			alert:    "race_slow_car_ahead",
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := tt.run
			e, b, clock, h := raceEngine(t)
			tp := e.profiles.learning(0)
			tp.speed, tp.quiet, tp.quietLaps = r.speeds, make([]float32, len(r.speeds)), 1
			calledAt, reach, passedAt := -1.0, 0, 0.0
			for k := 0; k < 1200; k++ {
				now := float64(k) * 0.05
				h.SessionTime = float32(100 + now)
				p := &packets.PacketLapData{Header: h}
				p.LapData[0] = raceCar(float32(math.Mod(r.playerAt(now), qualyTrackLen)), 46_000)
				p.LapData[1] = raceCar(float32(math.Mod(r.carAt(now), qualyTrackLen)), 47_000)
				e.ProcessPacket(context.Background(), p)
				if calledAt < 0 {
					if calls := spokenCalls(t, b, r.alert); len(calls) > 0 {
						calledAt, reach = now, calls[0].Values.Ahead.ReachSec
					}
				}
				if passedAt == 0 && r.playerAt(now) >= r.carAt(now) {
					passedAt = now
				}
				clock.advance(50 * time.Millisecond)
			}
			if calledAt < 0 || passedAt == 0 {
				t.Fatalf("called at %v s, reached at %v s: want both", calledAt, passedAt)
			}
			if reach != int(QualyTrafficWarnDefaultSec) {
				t.Errorf("said %d s, want %v", reach, QualyTrafficWarnDefaultSec)
			}
			heardAt := calledAt + float64(RadioDeliveryLatencyMs+TrafficNumberHeardMs)/1000
			if d := passedAt - heardAt; math.Abs(d-QualyTrafficWarnDefaultSec) > 1 {
				t.Errorf("the player got there %.1f s after the number was heard, want %v ± 1", d, QualyTrafficWarnDefaultSec)
			}
			for _, other := range []string{"race_slow_car_ahead", "race_stopped_car_ahead", "race_slow_car_ahead_now"} {
				if n := len(spokenCalls(t, b, other)); other != r.alert && n > 0 {
					t.Errorf("%s said %d times as well", other, n)
				}
			}
		})
	}
}
