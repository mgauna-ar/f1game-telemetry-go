package engineer

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// behindBy is a car on the same lap backM metres down the road from the player at 2000 m
// (negative: ahead).
func behindBy(backM float32) packets.LapData {
	return raceCar(2000-backM, 46_000-backM)
}

// comingEval evaluates rule on lap data of a race on a learned track, in phase, with the player
// (car 0) and car i driving at speeds[i] m/s over the last seconds, at now, with the calls the
// radio said in lastSaid.
func comingEval(rule *RaceTrafficRule, lastSaid map[string]int64, now int64, phase DrivingPhase, speeds map[int]float64, player packets.LapData, cars ...packets.LapData) []Directive {
	ctx := withMotion(qualyCtx(packets.SessionRace, phase, append([]packets.LapData{player}, cars...)...), speeds)
	ctx.TrackProfile = learnedTrackAt(raceSpeed)
	ctx.Now, ctx.LastSaid = now, lastSaid
	return rule.Evaluate(ctx)
}

// A car closing on a slow player is called once the driver would hear the number
// QualyTrafficWarnSec before it gets there.
func TestRaceTrafficRule_CarsComingWhenSlow(t *testing.T) {
	v := float64(raceSpeed)
	inLap := raceCar(2000, 46_000)
	inLap.DriverStatus = packets.DriverStatusInLap
	pitting := behindBy(100)
	pitting.PitStatus = packets.PitStatusPitting
	tests := []struct {
		name      string
		phase     DrivingPhase
		player    packets.LapData
		speed     float64 // the player's
		cars      []packets.LapData
		carSpeed  float64 // the cars' (default: v)
		entryM    float32
		wantAlert string
		wantReach int
	}{
		// 700 m back at 65 m/s on a stopped player: there in 10.8 s, 8 s once the number is heard.
		{name: "stopped", cars: []packets.LapData{behindBy(700)}, wantAlert: "race_car_behind", wantReach: 8},
		{name: "stopped, the car a bit further", cars: []packets.LapData{behindBy(750)}},
		{name: "two cars", cars: []packets.LapData{behindBy(700), behindBy(760)}, wantAlert: "race_car_behind_two", wantReach: 8},
		{name: "right behind", cars: []packets.LapData{behindBy(40)}, wantAlert: "race_car_behind_now"},
		// 350 m closing at half the car's pace: the same 10.8 s.
		{name: "limping at half pace", speed: 0.5 * v, cars: []packets.LapData{behindBy(350)}, wantAlert: "race_car_behind", wantReach: 8},
		// 28% slower than the car, but not slow: braking early, a slow corner.
		{name: "just above the slow pace", speed: 0.72 * v, cars: []packets.LapData{behindBy(100)}},
		{name: "racing, a car right behind", speed: 0.97 * v, cars: []packets.LapData{behindBy(30)}},
		{name: "a car only a bit faster", speed: 0.5 * v, cars: []packets.LapData{behindBy(100)}, carSpeed: 0.65 * v},
		{name: "a car in the pit lane", cars: []packets.LapData{pitting}},
		{name: "slowing for the pit entry on an in-lap", phase: PhaseInLap, player: inLap, entryM: 2200, cars: []packets.LapData{behindBy(700)}},
		{name: "stopped before the pit entry, not pitting", entryM: 2200, cars: []packets.LapData{behindBy(700)}, wantAlert: "race_car_behind", wantReach: 8},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			phase, player, carSpeed := tt.phase, tt.player, tt.carSpeed
			if phase == "" {
				phase, player = PhaseRacing, raceCar(2000, 46_000)
			}
			if carSpeed == 0 {
				carSpeed = v
			}
			speeds := map[int]float64{0: tt.speed}
			for i := range tt.cars {
				speeds[i+1] = carSpeed
			}
			ctx := withMotion(qualyCtx(packets.SessionRace, phase, append([]packets.LapData{player}, tt.cars...)...), speeds)
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
			if d == nil || d.ID != "race_car_behind" || d.Urgency != UrgencyHigh || d.Values.Behind.ReachSec != tt.wantReach {
				t.Fatalf("expected %s in %d s, got %v %+v", tt.wantAlert, tt.wantReach, subAlerts(dirs), d)
			}
		})
	}
	ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), behindBy(700)), map[int]float64{1: v})
	if dirs := NewRaceTrafficRule().Evaluate(ctx); len(dirs) != 0 {
		t.Errorf("called %v on a flat profile", subAlerts(dirs))
	}
}

// After the warning, "on you now" as the car gets close, and "clear" once it went by; "clear"
// waits for the second of two cars.
func TestRaceTrafficRule_CarsComingFollowUps(t *testing.T) {
	stopped := map[int]float64{0: 0, 1: float64(raceSpeed), 2: float64(raceSpeed)}
	player := raceCar(2000, 46_000)
	rule, said := NewRaceTrafficRule(), map[string]int64{}
	step := func(now int64, cars ...packets.LapData) []Directive {
		dirs := comingEval(rule, said, now, PhaseRacing, stopped, player, cars...)
		sayAll(said, dirs, now)
		return dirs
	}
	if d := directiveFor(step(1000, behindBy(700)), "race_car_behind"); d == nil {
		t.Fatal("expected the warning")
	}
	if dirs := step(1100, behindBy(650)); len(dirs) != 0 {
		t.Fatalf("called %v again", subAlerts(dirs))
	}
	// 300 m back: there in 4.6 s, "on you now" heard in under QualyTrafficCloseSec.
	if d := directiveFor(step(2000, behindBy(300)), "race_car_behind_close"); d == nil {
		t.Fatal("expected on you now")
	}
	if dirs := step(3000, behindBy(-10)); len(dirs) != 0 {
		t.Fatalf("called %v with the car 10 m ahead", subAlerts(dirs))
	}
	if d := directiveFor(step(3500, behindBy(-40)), "race_car_behind_clear"); d == nil {
		t.Fatal("expected clear once the car is 40 m ahead")
	}
	if dirs := step(3600, behindBy(-60)); len(dirs) != 0 {
		t.Fatalf("called %v after clear", subAlerts(dirs))
	}

	rule, said = NewRaceTrafficRule(), map[string]int64{}
	if d := directiveFor(step(1000, behindBy(700), behindBy(760)), "race_car_behind_two"); d == nil {
		t.Fatal("expected two cars")
	}
	step(3000, behindBy(-10), behindBy(50))
	if dirs := step(3500, behindBy(-40), behindBy(20)); directiveFor(dirs, "race_car_behind_clear") != nil {
		t.Fatal("clear with the second car still coming")
	}
	step(4000, behindBy(-70), behindBy(-10))
	if d := directiveFor(step(4500, behindBy(-100), behindBy(-40)), "race_car_behind_clear"); d == nil {
		t.Fatal("expected clear once both went by")
	}
}

// A lapping car already warned of as coming behind a slow player isn't called again by the blue
// flag, nor is the flag said without a car.
func TestRaceTrafficRule_BlueFlagAfterCarComing(t *testing.T) {
	rule, said := NewRaceTrafficRule(), map[string]int64{}
	speeds := map[int]float64{0: 0, 1: float64(raceSpeed)}
	eval := func(now int64, flag int8, car packets.LapData) []Directive {
		ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), car), speeds)
		ctx.TrackProfile = learnedTrackAt(raceSpeed)
		ctx.Status = &packets.PacketCarStatusData{}
		ctx.Status.CarStatusData[0].VehicleFIAFlags = flag
		ctx.Now, ctx.LastSaid = now, said
		dirs := rule.Evaluate(ctx)
		sayAll(said, dirs, now)
		return dirs
	}
	if d := directiveFor(eval(1000, packets.VehicleFIAFlagGreen, lapperAt(700)), "race_car_behind"); d == nil {
		t.Fatal("expected the car coming to be called")
	}
	for now := int64(2000); now < 3000; now += 100 {
		dirs := eval(now, packets.VehicleFIAFlagBlue, lapperAt(150))
		if directiveFor(dirs, "flags_blue") != nil || directiveFor(dirs, "flags_blue_two") != nil {
			t.Fatalf("blue flag called for the car already warned of: %v", subAlerts(dirs))
		}
	}
}

// Leaving the box after a stop, a car reaching the pit exit as the player gets there is warned
// of, once; a drive-through has no call, nor a stop under a Safety Car or VSC.
func TestRaceTrafficRule_PitExit(t *testing.T) {
	leaving := raceCar(2100, 46_100)
	leaving.PitStatus = packets.PitStatusPitting
	eval := func(rule *RaceTrafficRule, said map[string]int64, now int64, previous DrivingPhase, sc uint8, car packets.LapData) []Directive {
		ctx := withMotion(qualyCtx(packets.SessionRace, PhasePitLane, leaving, car), map[int]float64{0: 22.2, 1: float64(raceSpeed)})
		ctx.Session.SafetyCarStatus = sc
		ctx.PreviousPhase = previous
		ctx.Telemetry = &packets.PacketCarTelemetryData{}
		ctx.Telemetry.CarTelemetryData[0].Speed = 80
		ctx.TrackProfile = learnedTrackAt(raceSpeed)
		ctx.TrackProfile.exitM = []float32{2300}
		ctx.Now, ctx.LastSaid = now, said
		return rule.Evaluate(ctx)
	}
	// 200 m to the exit at 80 km/h: 9 s. A car 682 m before it gets there in 10.5 s, inside the
	// window; one 910 m before, in 14 s, after it.
	tests := []struct {
		name     string
		car      packets.LapData
		previous DrivingPhase
		sc       uint8
		want     bool
	}{
		{"a car there 1.5 s after the player", raceCar(1618, 45_618), PhaseInGarage, packets.SafetyCarNone, true},
		{"a car well after", raceCar(1390, 45_390), PhaseInGarage, packets.SafetyCarNone, false},
		{"a drive-through", raceCar(1618, 45_618), PhaseRacing, packets.SafetyCarNone, false},
		{"under the Safety Car", raceCar(1618, 45_618), PhaseInGarage, packets.SafetyCarFull, false},
		{"under the VSC", raceCar(1618, 45_618), PhaseInGarage, packets.SafetyCarVirtual, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, said := NewRaceTrafficRule(), map[string]int64{}
			dirs := eval(rule, said, 1000, tt.previous, tt.sc, tt.car)
			d := directiveFor(dirs, "race_pit_exit_traffic")
			if got := d != nil; got != tt.want {
				t.Fatalf("pit exit call %v, want %v (%v)", got, tt.want, subAlerts(dirs))
			}
			if !tt.want {
				return
			}
			if d.Values.Behind.GapSec != 1.5 {
				t.Errorf("the car gets there %v s after the player, want 1.5", d.Values.Behind.GapSec)
			}
			sayAll(said, dirs, 1000)
			if dirs := eval(rule, said, 1100, tt.previous, tt.sc, tt.car); len(dirs) != 0 {
				t.Fatalf("said again: %v", subAlerts(dirs))
			}
			if a := rule.behind[1]; !a.warned || !a.fromPitExit {
				t.Fatalf("the car isn't warned of: %+v", a)
			}
		})
	}
}

// A slow player (a spin) hears the cars coming, not the battle calls.
func TestRivalsRule_NoBattleCallsWhenSlow(t *testing.T) {
	for _, tt := range []struct {
		name  string
		speed float64
		want  bool
	}{{"at race pace", float64(raceSpeed), true}, {"stopped", 0, false}} {
		t.Run(tt.name, func(t *testing.T) {
			player := raceCar(2000, 46_000)
			player.CarPosition = 5
			behind := behindBy(40)
			behind.CarPosition, behind.DeltaToCarInFrontMSPart = 6, 600
			ctx := withMotion(qualyCtx(packets.SessionRace, PhaseRacing, player, behind), map[int]float64{0: tt.speed, 1: float64(raceSpeed)})
			ctx.TrackProfile = learnedTrackAt(raceSpeed)
			ctx.Now = 100_000
			if got := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_defend") != nil; got != tt.want {
				t.Fatalf("defend call %v, want %v", got, tt.want)
			}
		})
	}
}

// The player hears the number QualyTrafficWarnSec (±1 s) before the car coming gets to them, "on
// you now" QualyTrafficCloseSec before, and "clear" after.
func TestEngineerEngine_CarComingReachesYouWhenSaid(t *testing.T) {
	// A fast first four kilometres and a slow last one, as in the push-lap traffic test.
	speeds := make([]float32, quietBins(qualyTrackLen))
	for b := range speeds {
		speeds[b] = 80
		if b < 20 {
			speeds[b] = 20
		}
	}
	tests := []struct {
		name     string
		playerAt func(t float64) float64
		carAt    func(t float64) float64
	}{
		{"stopped in the slow corner", func(float64) float64 { return 5600 }, onProfile(speeds, 4500, 1)},
		{"limping at half pace", onProfile(speeds, 3000, 0.5), onProfile(speeds, 2000, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, b, clock, h := raceEngine(t)
			tp := e.profiles.learning(0)
			tp.speed, tp.quiet, tp.quietLaps = speeds, make([]float32, len(speeds)), 1
			calledAt, closeAt, clearAt, passedAt, reach := -1.0, -1.0, -1.0, 0.0, 0
			for k := 0; k < 1200; k++ {
				now := float64(k) * 0.05
				h.SessionTime = float32(100 + now)
				p := &packets.PacketLapData{Header: h}
				p.LapData[0] = raceCar(float32(math.Mod(tt.playerAt(now), qualyTrackLen)), 46_000)
				p.LapData[1] = raceCar(float32(math.Mod(tt.carAt(now), qualyTrackLen)), 45_000)
				e.ProcessPacket(context.Background(), p)
				if calledAt < 0 {
					if calls := spokenCalls(t, b, "race_car_behind"); len(calls) > 0 {
						calledAt, reach = now, calls[0].Values.Behind.ReachSec
					}
				}
				if closeAt < 0 && len(spokenCalls(t, b, "race_car_behind_close")) > 0 {
					closeAt = now
				}
				if clearAt < 0 && len(spokenCalls(t, b, "race_car_behind_clear")) > 0 {
					clearAt = now
				}
				if passedAt == 0 && tt.carAt(now) >= tt.playerAt(now) {
					passedAt = now
				}
				clock.advance(50 * time.Millisecond)
			}
			if calledAt < 0 || passedAt == 0 {
				t.Fatalf("called at %v s, passed at %v s: want both", calledAt, passedAt)
			}
			if reach != int(QualyTrafficWarnDefaultSec) {
				t.Errorf("said %d s, want %v", reach, QualyTrafficWarnDefaultSec)
			}
			heardAt := calledAt + float64(RadioDeliveryLatencyMs+TrafficNumberHeardMs)/1000
			if d := passedAt - heardAt; math.Abs(d-QualyTrafficWarnDefaultSec) > 1 {
				t.Errorf("the car got there %.1f s after the number was heard, want %v ± 1", d, QualyTrafficWarnDefaultSec)
			}
			closeHeard := closeAt + float64(RadioDeliveryLatencyMs+TrafficKeyHeardMs)/1000
			if d := passedAt - closeHeard; closeAt < 0 || math.Abs(d-QualyTrafficCloseSec) > 0.5 {
				t.Errorf("on you now heard %.1f s before the car got there (made at %v), want %v ± 0.5", d, closeAt, QualyTrafficCloseSec)
			}
			if clearAt <= passedAt {
				t.Errorf("clear at %v s, the car got there at %v s: want it after", clearAt, passedAt)
			}
		})
	}
}
