package engineer

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// qualyFlatMps is the pace of the flat profile on qualyTrackLen before anyone has set a lap.
const qualyFlatMps = AverageRaceSpeedMetersPerSec

// withMotion gives the cars of ctx the last 4 s of motion: car i driving at speeds[i] m/s (0:
// standing) up to where it is now, so its pace share is known. It is evaluated with the default
// delivery lead.
func withMotion(ctx *EvaluationContext, speeds map[int]float64) *EvaluationContext {
	m := &carMotion{}
	cars := ctx.LapData.LapData
	for k := 40; k >= 0; k-- {
		p := &packets.PacketLapData{}
		for i := range cars {
			p.LapData[i] = cars[i]
			p.LapData[i].LapDistance = cars[i].LapDistance - float32(speeds[i]*float64(k)*0.1)
		}
		m.sample(p, float32(100-float64(k)*0.1), qualyTrackLen, nil)
	}
	ctx.Motion = m
	ctx.DeliveryLeadMs = RadioDeliveryLatencyMs
	return ctx
}

// A push-lap car behind is called once the driver would hear the number QualyTrafficWarnSec
// before it gets there: from both cars' pace, not the gap on the road.
func TestQualifyingRule_CarBehindWhenItReachesYou(t *testing.T) {
	v := qualyFlatMps
	tests := []struct {
		name      string
		phase     DrivingPhase
		player    packets.LapData
		rival     packets.LapData
		speeds    map[int]float64
		session   uint8
		wantAlert string // "" for no call
		wantReach int
		wantRoad  float64
	}{
		{
			// 107 m back, closing at 15% of its pace: it gets there in 11 s, 8 s after the number is heard.
			name:      "an 85% out-lap: the number is when it gets there",
			phase:     PhaseOutLap,
			player:    qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:     qualyCar(packets.DriverStatusFlyingLap, 893, 893),
			speeds:    map[int]float64{0: 0.85 * v, 1: v},
			wantAlert: "inlap_traffic_behind", wantReach: 8, wantRoad: 1.6,
		},
		{
			name:   "not yet a bit further back",
			phase:  PhaseOutLap,
			player: qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:  qualyCar(packets.DriverStatusFlyingLap, 880, 880),
			speeds: map[int]float64{0: 0.85 * v, 1: v},
		},
		{
			// The gap on the road is 2.6 s, the old rule's call; at its pace the car is 23 s away.
			name:   "far away on the road at out-lap pace",
			phase:  PhaseOutLap,
			player: qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:  qualyCar(packets.DriverStatusFlyingLap, 830, 830),
			speeds: map[int]float64{0: 0.9 * v, 1: v},
		},
		{
			// Still at push pace just past the line, but taken at InLapPaceShare.
			name:      "an in-lap: the player is about to slow down",
			phase:     PhaseInLap,
			player:    qualyCar(packets.DriverStatusInLap, 100, 100),
			rival:     qualyCar(packets.DriverStatusFlyingLap, 4873, 4873),
			speeds:    map[int]float64{0: v, 1: v},
			wantAlert: "inlap_traffic_behind", wantReach: 7, wantRoad: 3.5,
		},
		{
			name:      "right behind: no number",
			phase:     PhaseOutLap,
			player:    qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:     qualyCar(packets.DriverStatusFlyingLap, 970, 970),
			speeds:    map[int]float64{0: 0.85 * v, 1: v},
			wantAlert: "inlap_traffic_behind_now", wantRoad: 0.5,
		},
		{
			name:   "as fast as the car behind: not closing",
			phase:  PhaseOutLap,
			player: qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:  qualyCar(packets.DriverStatusFlyingLap, 990, 990),
			speeds: map[int]float64{0: v, 1: v},
		},
		{
			// 450 m back across the line, about to start its push lap; the player is slow.
			name:      "a car about to start a push lap",
			phase:     PhaseOutLap,
			player:    qualyCar(packets.DriverStatusOutLap, 50, 50),
			rival:     qualyCar(packets.DriverStatusOutLap, 4600, 4600),
			speeds:    map[int]float64{0: 0.3 * v, 1: v},
			wantAlert: "inlap_traffic_behind", wantReach: 7, wantRoad: 6.9,
		},
		{
			name:   "an out-lap car far from the line isn't pushing",
			phase:  PhaseOutLap,
			player: qualyCar(packets.DriverStatusOutLap, 2000, 2000),
			rival:  qualyCar(packets.DriverStatusOutLap, 1990, 1990),
			speeds: map[int]float64{0: 0.3 * v, 1: v},
		},
		{
			name:   "the player is pushing too",
			phase:  PhaseFlyingLap,
			player: qualyCar(packets.DriverStatusFlyingLap, 1000, 1000),
			rival:  qualyCar(packets.DriverStatusFlyingLap, 970, 970),
			speeds: map[int]float64{0: 0.5 * v, 1: v},
		},
		{
			name:    "not in a race",
			session: packets.SessionRace,
			phase:   PhaseOutLap,
			player:  qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:   qualyCar(packets.DriverStatusFlyingLap, 970, 970),
			speeds:  map[int]float64{0: 0.5 * v, 1: v},
		},
		{
			name:  "in the pit lane",
			phase: PhaseOutLap,
			player: func() packets.LapData {
				l := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
				return l
			}(),
			rival: func() packets.LapData {
				l := qualyCar(packets.DriverStatusFlyingLap, 970, 970)
				l.PitStatus = packets.PitStatusPitting
				return l
			}(),
			speeds: map[int]float64{0: 0.5 * v, 1: v},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session := tt.session
			if session == 0 {
				session = packets.SessionQ1
			}
			ctx := withMotion(qualyCtx(session, tt.phase, tt.player, tt.rival), tt.speeds)
			dirs := NewQualifyingRule().Evaluate(ctx)
			var d *Directive
			for _, alert := range []string{"inlap_traffic_behind", "inlap_traffic_behind_now"} {
				if got := directiveFor(dirs, alert); got != nil {
					d = got
				}
			}
			if tt.wantAlert == "" {
				if d != nil {
					t.Fatalf("expected no car behind call, got %s %+v", d.SubAlert, d.Values.Behind)
				}
				return
			}
			if d == nil || d.SubAlert != tt.wantAlert {
				t.Fatalf("expected %s, got %v", tt.wantAlert, subAlerts(dirs))
			}
			if b := d.Values.Behind; b.ReachSec != tt.wantReach || b.GapSec != tt.wantRoad {
				t.Fatalf("reach %d s, road %v s; want %d s, %v s", b.ReachSec, b.GapSec, tt.wantReach, tt.wantRoad)
			}
		})
	}
}

// A slow car ahead of a pushing player is called by when the player reaches it, before the line.
func TestQualifyingRule_SlowCarAheadWhenYouReachIt(t *testing.T) {
	v := qualyFlatMps
	tests := []struct {
		name      string
		player    packets.LapData
		rival     packets.LapData
		speeds    map[int]float64
		wantAlert string
		wantReach int
	}{
		{
			// 300 m ahead, closing at half the player's pace: 9.2 s away, 6 once the number is heard.
			name:      "a slow car on an in-lap",
			player:    qualyCar(packets.DriverStatusFlyingLap, 2000, 2000),
			rival:     qualyCar(packets.DriverStatusInLap, 2300, 2300),
			speeds:    map[int]float64{0: v, 1: 0.5 * v},
			wantAlert: "qualy_traffic_ahead", wantReach: 6,
		},
		{
			name:      "right in front: no number",
			player:    qualyCar(packets.DriverStatusFlyingLap, 2000, 2000),
			rival:     qualyCar(packets.DriverStatusOutLap, 2040, 2040),
			speeds:    map[int]float64{0: v, 1: 0.5 * v},
			wantAlert: "qualy_traffic_ahead_now",
		},
		{
			name:   "a car going faster is no traffic",
			player: qualyCar(packets.DriverStatusFlyingLap, 2000, 2000),
			rival:  qualyCar(packets.DriverStatusOutLap, 2100, 2100),
			speeds: map[int]float64{0: 0.8 * v, 1: v},
		},
		{
			name:   "a car also pushing",
			player: qualyCar(packets.DriverStatusFlyingLap, 2000, 2000),
			rival:  qualyCar(packets.DriverStatusFlyingLap, 2100, 2100),
			speeds: map[int]float64{0: v, 1: 0.5 * v},
		},
		{
			name:   "met only after the line",
			player: qualyCar(packets.DriverStatusFlyingLap, 4800, 4800),
			rival:  qualyCar(packets.DriverStatusInLap, 4950, 4950),
			speeds: map[int]float64{0: v, 1: 0.5 * v},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseFlyingLap, tt.player, tt.rival), tt.speeds)
			dirs := NewQualifyingRule().Evaluate(ctx)
			d := directiveFor(dirs, tt.wantAlert)
			if tt.wantAlert == "" {
				if len(dirs) != 0 {
					t.Fatalf("expected no call, got %v", subAlerts(dirs))
				}
				return
			}
			if d == nil || d.Values.Ahead.ReachSec != tt.wantReach {
				t.Fatalf("expected %s in %d s, got %v %+v", tt.wantAlert, tt.wantReach, subAlerts(dirs), d)
			}
		})
	}
}

// Each car is called once on its way to the player, even across phases; a call the radio never
// said (the repeat limit dropped it) is made again, so a second car close behind the first is
// called too.
func TestQualifyingRule_TrafficCallsOncePerCar(t *testing.T) {
	v := qualyFlatMps
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	first := qualyCar(packets.DriverStatusFlyingLap, 895, 895)
	second := qualyCar(packets.DriverStatusFlyingLap, 600, 600)
	speeds := map[int]float64{0: 0.85 * v, 1: v, 2: v}
	rule := NewQualifyingRule()
	lastSaid := map[string]int64{}
	eval := func(now int64, phase DrivingPhase, cars ...packets.LapData) []Directive {
		ctx := withMotion(qualyCtx(packets.SessionQ1, phase, cars...), speeds)
		ctx.Now, ctx.LastSaid = now, lastSaid
		return rule.Evaluate(ctx)
	}

	if d := directiveFor(eval(1000, PhaseOutLap, player, first, second), "inlap_traffic_behind"); d == nil {
		t.Fatal("expected the first car to be called")
	}
	lastSaid["inlap_traffic_behind"] = 1000
	if dirs := eval(1050, PhaseOutLap, player, first, second); len(dirs) != 0 {
		t.Fatalf("the first car was called again: %v", subAlerts(dirs))
	}
	if dirs := eval(1100, PhaseInLap, player, first, second); directiveFor(dirs, "inlap_traffic_behind") != nil {
		t.Fatalf("a phase change called the first car again: %v", subAlerts(dirs))
	}

	second.LapDistance = 894 // now as close as the first
	if d := directiveFor(eval(2000, PhaseOutLap, player, first, second), "inlap_traffic_behind"); d == nil {
		t.Fatal("expected the second car to get its own call")
	}
	// The radio didn't say it: it is made again.
	if d := directiveFor(eval(2050, PhaseOutLap, player, first, second), "inlap_traffic_behind"); d == nil {
		t.Fatal("a call the radio never said wasn't made again")
	}
	lastSaid["inlap_traffic_behind"] = 2050
	if dirs := eval(2100, PhaseOutLap, player, first, second); len(dirs) != 0 {
		t.Fatalf("the second car was called twice: %v", subAlerts(dirs))
	}
}

// trafficEval evaluates rule on one moment of an out-lap: the player at 85% of the flat pace, the
// cars behind on push laps, calls the radio said in lastSaid.
func trafficEval(rule *QualifyingRule, lastSaid map[string]int64, now int64, phase DrivingPhase, cars ...packets.LapData) []Directive {
	speeds := map[int]float64{0: 0.85 * qualyFlatMps}
	for i := 1; i < len(cars); i++ {
		speeds[i] = qualyFlatMps
	}
	ctx := withMotion(qualyCtx(packets.SessionQ1, phase, cars...), speeds)
	ctx.Now, ctx.LastSaid = now, lastSaid
	return rule.Evaluate(ctx)
}

// sayAll marks the calls dirs as said at now.
func sayAll(lastSaid map[string]int64, dirs []Directive, now int64) {
	for _, d := range dirs {
		lastSaid[d.ID] = now
	}
}

// "On you now" comes QualyTrafficCloseSec before the car gets there, after a warning that said
// enough seconds to give it room; not after one that came late.
func TestQualifyingRule_OnYouNow(t *testing.T) {
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	pushing := func(lapM float32) packets.LapData { return qualyCar(packets.DriverStatusFlyingLap, lapM, lapM) }

	rule, said := NewQualifyingRule(), map[string]int64{}
	sayAll(said, trafficEval(rule, said, 1000, PhaseOutLap, player, pushing(893)), 1000)
	if dirs := trafficEval(rule, said, 1100, PhaseOutLap, player, pushing(950)); directiveFor(dirs, "inlap_traffic_close") != nil {
		t.Fatal("on you now 3.3 s before it gets there")
	}
	dirs := trafficEval(rule, said, 1200, PhaseOutLap, player, pushing(955))
	if directiveFor(dirs, "inlap_traffic_close") == nil {
		t.Fatalf("expected on you now 3 s before it gets there, got %v", subAlerts(dirs))
	}
	sayAll(said, dirs, 1200)
	if dirs := trafficEval(rule, said, 1300, PhaseOutLap, player, pushing(960)); len(dirs) != 0 {
		t.Fatalf("said again: %v", subAlerts(dirs))
	}

	late, saidLate := NewQualifyingRule(), map[string]int64{}
	dirs = trafficEval(late, saidLate, 1000, PhaseOutLap, player, pushing(925))
	if d := directiveFor(dirs, "inlap_traffic_behind"); d == nil || d.Values.Behind.ReachSec >= TrafficCloseMinSaidSec {
		t.Fatalf("expected a late warning, got %v", subAlerts(dirs))
	}
	saidLate["inlap_traffic_behind"] = 1000
	if dirs := trafficEval(late, saidLate, 1200, PhaseOutLap, player, pushing(955)); len(dirs) != 0 {
		t.Fatalf("on you now right after a late warning: %v", subAlerts(dirs))
	}
}

// "Clear" comes once the car went by and is QualyClearAheadM ahead, once; not while another is
// coming (its warning is the call), and not for a car that stopped pushing.
func TestQualifyingRule_Clear(t *testing.T) {
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	pushing := func(lapM float32) packets.LapData { return qualyCar(packets.DriverStatusFlyingLap, lapM, lapM) }
	far := pushing(100) // a push-lap car far behind: no warning yet
	warned := func(t *testing.T) (*QualifyingRule, map[string]int64) {
		t.Helper()
		rule, said := NewQualifyingRule(), map[string]int64{}
		sayAll(said, trafficEval(rule, said, 1000, PhaseOutLap, player, pushing(893), far), 1000)
		sayAll(said, trafficEval(rule, said, 1100, PhaseOutLap, player, pushing(990), far), 1100)
		trafficEval(rule, said, 1200, PhaseOutLap, player, pushing(1010), far) // it went by
		return rule, said
	}

	t.Run("once, when it is through", func(t *testing.T) {
		rule, said := warned(t)
		if dirs := trafficEval(rule, said, 1300, PhaseOutLap, player, pushing(1020), far); directiveFor(dirs, "inlap_traffic_clear") != nil {
			t.Fatal("clear while it is still alongside")
		}
		dirs := trafficEval(rule, said, 1400, PhaseOutLap, player, pushing(1040), far)
		if directiveFor(dirs, "inlap_traffic_clear") == nil {
			t.Fatalf("expected clear, got %v", subAlerts(dirs))
		}
		sayAll(said, dirs, 1400)
		if dirs := trafficEval(rule, said, 1500, PhaseOutLap, player, pushing(1060), far); len(dirs) != 0 {
			t.Fatalf("said again: %v", subAlerts(dirs))
		}
	})
	t.Run("not with another coming: its warning instead", func(t *testing.T) {
		rule, said := warned(t)
		dirs := trafficEval(rule, said, 1400, PhaseOutLap, player, pushing(1040), pushing(895))
		if directiveFor(dirs, "inlap_traffic_clear") != nil || directiveFor(dirs, "inlap_traffic_behind") == nil {
			t.Fatalf("expected the next car's warning and no clear, got %v", subAlerts(dirs))
		}
		sayAll(said, dirs, 1400)
		if dirs := trafficEval(rule, said, 1500, PhaseOutLap, player, pushing(1060), pushing(898)); directiveFor(dirs, "inlap_traffic_clear") != nil {
			t.Fatal("clear for the first car while the second comes")
		}
	})
	t.Run("not for a car that stopped pushing", func(t *testing.T) {
		rule, said := warned(t)
		inLap := qualyCar(packets.DriverStatusInLap, 1040, 1040)
		if dirs := trafficEval(rule, said, 1400, PhaseOutLap, player, inLap, far); len(dirs) != 0 {
			t.Fatalf("expected no call, got %v", subAlerts(dirs))
		}
	})
}

// A second push-lap car QualyTrainSec behind the first is named in the same warning, and counts
// as warned.
func TestQualifyingRule_TwoPushLapCars(t *testing.T) {
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	pushing := func(lapM float32) packets.LapData { return qualyCar(packets.DriverStatusFlyingLap, lapM, lapM) }

	rule, said := NewQualifyingRule(), map[string]int64{}
	dirs := trafficEval(rule, said, 1000, PhaseOutLap, player, pushing(893), pushing(865))
	if d := directiveFor(dirs, "inlap_traffic_behind_two"); d == nil || d.Values.Behind.ReachSec != 8 {
		t.Fatalf("expected two cars in 8 s, got %v", subAlerts(dirs))
	}
	sayAll(said, dirs, 1000)
	if dirs := trafficEval(rule, said, 1100, PhaseOutLap, player, pushing(895), pushing(868)); len(dirs) != 0 {
		t.Fatalf("the second car was warned again: %v", subAlerts(dirs))
	}

	apart := NewQualifyingRule()
	dirs = trafficEval(apart, map[string]int64{}, 1000, PhaseOutLap, player, pushing(893), pushing(860))
	if directiveFor(dirs, "inlap_traffic_behind") == nil {
		t.Fatalf("a car 3.4 s behind the first isn't the same warning: %v", subAlerts(dirs))
	}
}

// Leaving the garage, a push-lap car reaching the pit exit as the player gets there is warned of,
// once; then its follow-ups come as usual.
func TestQualifyingRule_PitExit(t *testing.T) {
	leaving := qualyCar(packets.DriverStatusOutLap, 250, 250)
	leaving.PitStatus = packets.PitStatusPitting
	pushing := func(lapM float32) packets.LapData { return qualyCar(packets.DriverStatusFlyingLap, lapM, lapM) }
	pitLane := func(player, rival packets.LapData) *EvaluationContext {
		ctx := withMotion(qualyCtx(packets.SessionQ1, PhasePitLane, player, rival), map[int]float64{0: 22.2, 1: qualyFlatMps})
		ctx.PreviousPhase = PhaseInGarage
		ctx.Telemetry = &packets.PacketCarTelemetryData{}
		ctx.Telemetry.CarTelemetryData[0].Speed = 80
		return ctx
	}
	eval := func(rule *QualifyingRule, said map[string]int64, now int64, rival packets.LapData) []Directive {
		ctx := pitLane(leaving, rival)
		ctx.Now, ctx.LastSaid = now, said
		ctx.TrackProfile = &trackProfile{exitM: []float32{400}}
		return rule.Evaluate(ctx)
	}
	// 150 m to the exit at 80 km/h: 6.75 s. A car 520 m before it gets there in 8 s, inside the
	// window; one 780 m before, in 12 s, after it.
	tests := []struct {
		name  string
		rival packets.LapData
		want  bool
	}{
		{"a car there as the player joins", pushing(4880), true},
		{"a car well after", pushing(4620), false},
		{"a car not pushing", qualyCar(packets.DriverStatusInLap, 4880, 4880), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, said := NewQualifyingRule(), map[string]int64{}
			dirs := eval(rule, said, 1000, tt.rival)
			if got := directiveFor(dirs, "qualy_pit_exit_traffic") != nil; got != tt.want {
				t.Fatalf("pit exit call %v, want %v (%v)", got, tt.want, subAlerts(dirs))
			}
			if !tt.want {
				return
			}
			sayAll(said, dirs, 1000)
			if dirs := eval(rule, said, 1100, tt.rival); len(dirs) != 0 {
				t.Fatalf("said again: %v", subAlerts(dirs))
			}
			if a := rule.behind[1]; !a.warned || !a.fromPitExit {
				t.Fatalf("the car isn't warned of: %+v", a)
			}
			// Still in the pit lane at the limiter's pace, close: "on you now" waits for the track.
			if dirs := eval(rule, said, 1200, pushing(200)); directiveFor(dirs, "inlap_traffic_close") != nil {
				t.Fatal("on you now in the pit lane")
			}
			// Just joined: not until the player's pace on track is known.
			joined := qualyCar(packets.DriverStatusOutLap, 310, 310)
			onTrack := func(now int64) []Directive {
				ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseOutLap, joined, pushing(260)), map[int]float64{0: 52, 1: qualyFlatMps})
				ctx.Now, ctx.LastSaid = now, said
				return rule.Evaluate(ctx)
			}
			if dirs := onTrack(1300); directiveFor(dirs, "inlap_traffic_close") != nil {
				t.Fatal("on you now the moment the player joined")
			}
			if dirs := onTrack(1300 + PaceWindowShortMs); directiveFor(dirs, "inlap_traffic_close") == nil {
				t.Fatalf("expected on you now once the player's pace is known, got %v", subAlerts(dirs))
			}
		})
	}

	t.Run("not before the exit is known", func(t *testing.T) {
		if dirs := NewQualifyingRule().Evaluate(pitLane(leaving, pushing(4880))); len(dirs) != 0 {
			t.Fatalf("expected no call, got %v", subAlerts(dirs))
		}
	})
}

// The pit exit is learned in qualifying from the cars leaving their garages, and kept.
func TestTrackProfiles_LearnsThePitExitInQualifying(t *testing.T) {
	p := newTrackProfiles()
	session := &packets.PacketSessionData{SessionType: packets.SessionQ1, TrackLength: qualyTrackLen}
	prev, next := &packets.PacketLapData{}, &packets.PacketLapData{}
	prev.LapData[3] = qualyCar(packets.DriverStatusOutLap, 395, 0)
	prev.LapData[3].PitStatus = packets.PitStatusPitting
	next.LapData[3] = qualyCar(packets.DriverStatusOutLap, 401, 0)
	p.learnPitLane(session, prev, next)
	if got := p.profile(0).exit(); got != 401 {
		t.Fatalf("exit %v, want 401", got)
	}
	again := newTrackProfiles()
	if err := again.load(p.snapshot()); err != nil || again.profile(0).exit() != 401 {
		t.Fatalf("a track with only its exit learned wasn't kept: %v", err)
	}
}

// "Push now" isn't said right after the pit exit call warned of a car coming.
func TestTrafficRule_NoPushNowAfterThePitExitCall(t *testing.T) {
	status := func(limiter uint8) *packets.PacketCarStatusData {
		return &packets.PacketCarStatusData{CarStatusData: [packets.MaxCars]packets.CarStatusData{{PitLimiterStatus: limiter}}}
	}
	for _, tt := range []struct {
		name    string
		key     string
		saidAgo int64 // ms since the pit exit call (-1: never)
		want    bool
	}{
		{"no pit exit call", "qualy_pit_exit_traffic", -1, true},
		{"just after one", "qualy_pit_exit_traffic", 2000, false},
		{"long after one", "qualy_pit_exit_traffic", PitExitCallFreshMs + 1000, true},
		{"just after one in a race", "race_pit_exit_traffic", 2000, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			rule := NewTrafficRule()
			ctx := &EvaluationContext{Status: status(1), Phase: PhasePitLane, Now: 100_000, LastSaid: map[string]int64{}}
			rule.Evaluate(ctx)
			ctx.Status = status(0)
			if tt.saidAgo >= 0 {
				ctx.LastSaid[tt.key] = ctx.Now - tt.saidAgo
			}
			if got := directiveFor(rule.Evaluate(ctx), "pit_limiter_exit") != nil; got != tt.want {
				t.Fatalf("push now %v, want %v", got, tt.want)
			}
		})
	}
}

// The traffic calls and their follow-ups go through the pit limiter's hold: a car doesn't wait.
func TestTrafficCalls_SaidOnThePitLimiter(t *testing.T) {
	keys := NewQualifyingRule().AlertKeys()
	for _, key := range []string{"inlap_traffic_behind", "qualy_traffic_ahead", "inlap_traffic_close", "inlap_traffic_clear", "qualy_pit_exit_traffic"} {
		if cfg, ok := keys[key]; !ok || !cfg.PitLaneCall || cfg.MaxDelayMs != TrafficMaxDelayMs {
			t.Errorf("%s: %+v", key, cfg)
		}
	}
}

// A warned car that falls well back for a while is warned again when it comes back.
func TestQualifyingRule_TrafficWarnedAgainAfterFallingBack(t *testing.T) {
	v := qualyFlatMps
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	rival := qualyCar(packets.DriverStatusFlyingLap, 895, 895)
	rule := NewQualifyingRule()
	lastSaid := map[string]int64{}
	eval := func(now int64, playerShare float64) []Directive {
		ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseOutLap, player, rival), map[int]float64{0: playerShare * v, 1: v})
		ctx.Now, ctx.LastSaid = now, lastSaid
		return rule.Evaluate(ctx)
	}
	if len(eval(1000, 0.85)) != 1 {
		t.Fatal("expected the car to be called")
	}
	lastSaid["inlap_traffic_behind"] = 1000
	eval(1050, 0.85)
	// The player speeds up: the car is no longer coming.
	for now := int64(2000); now <= 2000+TrafficRearmMs; now += 500 {
		eval(now, 0.98)
	}
	if dirs := eval(6000, 0.85); len(dirs) != 1 {
		t.Fatalf("expected the car to be warned again, got %v", subAlerts(dirs))
	}
}

// The player's in-lap pace is learned once past the slowing down after the line, and then used
// for the next in-lap's start.
func TestQualifyingRule_LearnsTheInLapPace(t *testing.T) {
	v := qualyFlatMps
	rule := NewQualifyingRule()
	for range 50 {
		rule.Evaluate(withMotion(qualyCtx(packets.SessionQ1, PhaseInLap, qualyCar(packets.DriverStatusInLap, 3000, 3000)),
			map[int]float64{0: 0.5 * v}))
	}
	if math.Abs(rule.inLapShare-0.5) > 0.001 {
		t.Fatalf("learned %v, want 0.5", rule.inLapShare)
	}
	// Just past the line at push pace, 140 m ahead: at half pace it is 4.3 s off, 1.3 once heard.
	ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseInLap,
		qualyCar(packets.DriverStatusInLap, 100, 100), qualyCar(packets.DriverStatusFlyingLap, 4960, 4960)),
		map[int]float64{0: v, 1: v})
	if d := directiveFor(rule.Evaluate(ctx), "inlap_traffic_behind_now"); d == nil {
		t.Fatal("the learned in-lap pace wasn't used")
	}
}

// After a flashback nobody's pace is known: no call until the player's has been measured again.
func TestQualifyingRule_NoTrafficCallRightAfterAFlashback(t *testing.T) {
	ctx := withMotion(qualyCtx(packets.SessionQ1, PhaseOutLap,
		qualyCar(packets.DriverStatusOutLap, 1000, 1000), qualyCar(packets.DriverStatusFlyingLap, 970, 970)),
		map[int]float64{0: 30, 1: 65})
	ctx.Motion.reset()
	if dirs := NewQualifyingRule().Evaluate(ctx); len(dirs) != 0 {
		t.Fatalf("expected no call while the samples refill, got %v", subAlerts(dirs))
	}
}

func TestCarMotion_PaceShare(t *testing.T) {
	flat := paceProfile{lapM: qualyTrackLen, flatMps: 50}
	feed := func(m *carMotion, at float32, lapM float32) {
		p := &packets.PacketLapData{}
		p.LapData[0].LapDistance = lapM
		m.sample(p, at, qualyTrackLen, nil)
	}

	t.Run("across the line", func(t *testing.T) {
		var m carMotion
		for k := range 40 {
			feed(&m, float32(k)*0.1, float32(math.Mod(4900+float64(k)*4, qualyTrackLen)))
		}
		if share, ok := m.paceShare(0, PaceWindowLongMs, flat); !ok || math.Abs(share-0.8) > 0.001 {
			t.Fatalf("share %v (%v), want 0.8", share, ok)
		}
	})
	t.Run("a jump starts the samples again", func(t *testing.T) {
		var m carMotion
		for k := range 40 {
			feed(&m, float32(k)*0.1, 1000+float32(k)*4)
		}
		feed(&m, 4.1, 3000) // the garage
		if _, ok := m.paceShare(0, PaceWindowShortMs, flat); ok {
			t.Fatal("a teleport counted as driving")
		}
	})
	t.Run("one sample out of order is skipped", func(t *testing.T) {
		var m carMotion
		for k := range 10 {
			feed(&m, float32(k)*0.1, 1000+float32(k)*4)
		}
		feed(&m, 0.5, 1020)
		feed(&m, 1.0, 1040)
		if share, ok := m.paceShare(0, PaceWindowShortMs, flat); !ok || math.Abs(share-0.8) > 0.001 {
			t.Fatalf("share %v (%v), want 0.8", share, ok)
		}
	})
	t.Run("not before the window has passed", func(t *testing.T) {
		var m carMotion
		feed(&m, 0, 1000)
		feed(&m, 0.2, 1010)
		if _, ok := m.paceShare(0, PaceWindowShortMs, flat); ok {
			t.Fatal("a pace from less than the window")
		}
	})
}

func TestPaceProfile_LearnedSpeeds(t *testing.T) {
	bins := quietBins(qualyTrackLen)
	tp := &trackProfile{speed: make([]float32, bins), quiet: make([]float32, bins), quietLaps: 1}
	for b := range tp.speed {
		tp.speed[b] = 50
	}
	tp.speed[0] = 25 // a slow first corner
	ctx := qualyCtx(packets.SessionQ1, PhaseOutLap)
	ctx.TrackProfile = tp
	prof := trafficProfile(ctx)
	if prof.source() != "player" {
		t.Fatalf("source %s, want the player's speeds", prof.source())
	}
	if got := prof.sec(4950, 100); math.Abs(got-3) > 0.001 {
		t.Errorf("across the line: %v s, want 3 (1 s to the line, 2 s round the slow corner)", got)
	}
	if got := prof.sec(-50, 100); math.Abs(got-3) > 0.001 {
		t.Errorf("from before the line: %v s, want 3", got)
	}
	tp.quietLaps = 0
	if trafficProfile(ctx).source() != "flat" {
		t.Error("speeds from no whole lap were used")
	}
}

// The push-lap speeds come from every car on a push lap, and are used before the player's own once
// most of the lap was seen.
func TestTrackProfiles_LearnPushSpeeds(t *testing.T) {
	p := newTrackProfiles()
	var m carMotion
	learn := p.pushSteps(0, qualyTrackLen)
	feed := func(at float32, pushing, other float32) {
		lap := &packets.PacketLapData{}
		lap.LapData[0] = qualyCar(packets.DriverStatusOutLap, other, 0)
		lap.LapData[1] = qualyCar(packets.DriverStatusFlyingLap, pushing, 0)
		m.sample(lap, at, qualyTrackLen, learn)
	}
	// Car 1 pushes round 80% of the lap at 40 m/s in the first half and 80 after; the player
	// drives at 10 m/s, which says nothing of a push lap.
	at, x := float32(0), float32(0)
	for x < 0.8*qualyTrackLen {
		v := float32(40)
		if x >= qualyTrackLen/2 {
			v = 80
		}
		feed(at, x, 100+at*10)
		at, x = at+0.05, x+v*0.05
	}
	tp := p.profile(0)
	if tp.pushSpeeds(qualyTrackLen) != nil {
		t.Fatal("push speeds used before most of the lap was seen")
	}
	ctx := qualyCtx(packets.SessionQ1, PhaseOutLap)
	ctx.TrackProfile = tp
	if trafficProfile(ctx).source() != "flat" {
		t.Fatal("expected the flat profile until then")
	}
	for x < qualyTrackLen {
		feed(at, float32(math.Mod(float64(x), qualyTrackLen)), 100+at*10)
		at, x = at+0.05, x+80*0.05
	}
	speeds := tp.pushSpeeds(qualyTrackLen)
	if len(speeds) != quietBins(qualyTrackLen) || math.Abs(float64(speeds[10]-40)) > 0.5 || math.Abs(float64(speeds[80]-80)) > 0.5 {
		t.Fatalf("push speeds %v", speeds)
	}
	if prof := trafficProfile(ctx); prof.source() != "push" || math.Abs(prof.sec(500, 100)-2.5) > 0.05 {
		t.Fatalf("profile %s, 100 m in %v s: want the push speeds, 2.5 s", prof.source(), prof.sec(500, 100))
	}

	// One odd first sample (a step across a braking point) doesn't set a bin: its first samples are
	// averaged.
	p.learnPushSpeed(1, qualyTrackLen, 25, 90)
	for range 27 {
		p.learnPushSpeed(1, qualyTrackLen, 25, 36)
	}
	if got := p.profile(1).push[0]; math.Abs(float64(got)-36) > 2.5 {
		t.Errorf("a bin first seen at 90 m/s, then 27 times at 36: %v m/s", got)
	}

	// They are kept with the track.
	again := newTrackProfiles()
	if err := again.load(p.snapshot()); err != nil || again.profile(0).pushSpeeds(qualyTrackLen) == nil {
		t.Fatalf("push speeds not kept: %v", err)
	}
}

func TestRadioDelivery_LeadMs(t *testing.T) {
	var d radioDelivery
	for range TrafficLeadMinSamples - 1 {
		d.trafficStartMs = append(d.trafficStartMs, 200)
	}
	if got := d.leadMs(); got != RadioDeliveryLatencyMs {
		t.Fatalf("with too few reports: %d, want %d", got, RadioDeliveryLatencyMs)
	}
	d.trafficStartMs = []int{400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 3000}
	if got := d.leadMs(); got != 1100 {
		t.Fatalf("p80 = %d, want 1100", got)
	}
	d.trafficStartMs = []int{100, 100, 100, 100, 100}
	if got := d.leadMs(); got != TrafficLeadMinMs {
		t.Fatalf("clamped: %d, want %d", got, TrafficLeadMinMs)
	}

	e := NewEngineerEngine(nil)
	for k := range 6 {
		e.RecordRadioHeard(RadioHeard{DirectiveID: "directive_" + string(rune('a'+k)) + "_inlap_traffic_behind", Outcome: "said", StartMs: 900})
	}
	e.RecordRadioHeard(RadioHeard{DirectiveID: "directive_x_inlap_traffic_behind", Outcome: "said", WaitMs: 3000, StartMs: 4000})
	e.RecordRadioHeard(RadioHeard{DirectiveID: "directive_y_qualy_lap_result", Outcome: "said", StartMs: 4000})
	if got := e.delivery.leadMs(); got != 900 {
		t.Fatalf("lead from the reports %d, want 900: calls that waited and other calls don't count", got)
	}
}

// trafficRun drives the engine through a qualifying out-lap or in-lap at 20 Hz with a push-lap car
// coming from behind, and reports when the call was heard and when the car got there.
type trafficRun struct {
	playerAt func(t float64) float64 // the player's lap distance at session time t
	rivalAt  func(t float64) float64
	status   uint8 // the player's driver status
	// speeds is the player's learned speed in each QuietBinM bin (nil: none learned), or with
	// push, the push-lap speeds learned from the cars.
	speeds []float32
	push   bool
}

// onProfile is where a car starting at lap distance start, driving share of the speeds in each
// QuietBinM bin, is at session time t, sampled every 50 ms.
func onProfile(speeds []float32, start, share float64) func(t float64) float64 {
	at := []float64{start}
	for k := 1; k <= 1200; k++ {
		x := at[k-1]
		b := int(math.Mod(x, qualyTrackLen) / QuietBinM)
		at = append(at, x+share*float64(speeds[min(b, len(speeds)-1)])*0.05)
	}
	return func(t float64) float64 { return at[min(int(math.Round(t/0.05)), len(at)-1)] }
}

// trafficTimes is when the calls of one approach were made and when the car got there, in session
// seconds (-1: not made).
type trafficTimes struct {
	reach                     int
	heardAt, closeAt, clearAt float64
	passedAt                  float64
}

func (r trafficRun) runAll(t *testing.T) trafficTimes {
	t.Helper()
	ctx := context.Background()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	clock := newTestClock()
	clock.install(e)
	h := createTestHeader(packets.PacketFormat2025, 901, 0)
	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionQ1, TrackLength: qualyTrackLen, SessionTimeLeft: 900})
	switch {
	case r.push:
		e.profiles.learning(0).push = r.speeds
	case r.speeds != nil:
		tp := e.profiles.learning(0)
		tp.speed, tp.quiet, tp.quietLaps = r.speeds, make([]float32, len(r.speeds)), 1
	}

	calledAt := -1.0
	var reach int
	var passedAt float64
	closeAt, clearAt := -1.0, -1.0
	for k := 0; k < 1200; k++ {
		now := float64(k) * 0.05
		h.SessionTime = float32(100 + now)
		player := qualyCar(r.status, float32(math.Mod(r.playerAt(now), qualyTrackLen)), 0)
		rival := qualyCar(packets.DriverStatusFlyingLap, float32(math.Mod(r.rivalAt(now), qualyTrackLen)), 0)
		p := &packets.PacketLapData{Header: h}
		p.LapData[0], p.LapData[1] = player, rival
		e.ProcessPacket(ctx, p)
		if calledAt < 0 {
			if calls := spokenCalls(t, b, "inlap_traffic_behind"); len(calls) > 0 {
				calledAt, reach = now, calls[0].Values.Behind.ReachSec
			}
		}
		if closeAt < 0 && len(spokenCalls(t, b, "inlap_traffic_close")) > 0 {
			closeAt = now
		}
		if clearAt < 0 && len(spokenCalls(t, b, "inlap_traffic_clear")) > 0 {
			clearAt = now
		}
		if passedAt == 0 && r.rivalAt(now) >= r.playerAt(now) {
			passedAt = now
		}
		clock.advance(50 * time.Millisecond)
	}
	if calledAt < 0 || passedAt == 0 {
		t.Fatalf("called at %v s, passed at %v s: want both", calledAt, passedAt)
	}
	return trafficTimes{
		reach: reach, heardAt: calledAt + float64(RadioDeliveryLatencyMs+TrafficNumberHeardMs)/1000,
		closeAt: closeAt, clearAt: clearAt, passedAt: passedAt,
	}
}

// The car reaches the player QualyTrafficWarnSec (±1 s) after the driver hears the number.
func TestEngineerEngine_PushLapCarReachesYouWhenSaid(t *testing.T) {
	v := qualyFlatMps
	// A slow first kilometre and fast after it: a car's speed on the road changes fourfold.
	speeds := make([]float32, quietBins(qualyTrackLen))
	for b := range speeds {
		speeds[b] = 80
		if b < 20 {
			speeds[b] = 20
		}
	}
	tests := []struct {
		name string
		run  trafficRun
	}{
		{"an 85% out-lap", trafficRun{
			status:   packets.DriverStatusOutLap,
			playerAt: func(t float64) float64 { return 1000 + 0.85*v*t },
			rivalAt:  func(t float64) float64 { return 500 + v*t },
		}},
		{"a 70% out-lap", trafficRun{
			status:   packets.DriverStatusOutLap,
			playerAt: func(t float64) float64 { return 1000 + 0.7*v*t },
			rivalAt:  func(t float64) float64 { return 200 + v*t },
		}},
		{"an 80% out-lap into a slow section, on the player's speeds", trafficRun{
			status:   packets.DriverStatusOutLap,
			speeds:   speeds,
			playerAt: onProfile(speeds, 4300, 0.8),
			rivalAt:  onProfile(speeds, 3800, 1),
		}},
		{"the same on the push-lap speeds learned from the cars", trafficRun{
			status:   packets.DriverStatusOutLap,
			speeds:   speeds,
			push:     true,
			playerAt: onProfile(speeds, 4300, 0.8),
			rivalAt:  onProfile(speeds, 3800, 1),
		}},
		{"an in-lap that slows after the line", trafficRun{
			status: packets.DriverStatusInLap,
			// From push pace to InLapPaceShare over the first 5 s, then on at that pace.
			playerAt: func(t float64) float64 {
				if t < 5 {
					return 5000 + v*(t-0.035*t*t)
				}
				return 5000 + v*(5-0.035*25) + InLapPaceShare*v*(t-5)
			},
			rivalAt: func(t float64) float64 { return 4700 + v*t },
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.run.runAll(t)
			if got.reach != int(QualyTrafficWarnDefaultSec) {
				t.Errorf("said %d s, want %v", got.reach, QualyTrafficWarnDefaultSec)
			}
			if d := got.passedAt - got.heardAt; math.Abs(d-QualyTrafficWarnDefaultSec) > 1 {
				t.Errorf("the car got there %.1f s after the number was heard, want %v ± 1", d, QualyTrafficWarnDefaultSec)
			}
			// "On you now" is heard QualyTrafficCloseSec before it gets there, "clear" after it.
			closeHeard := got.closeAt + float64(RadioDeliveryLatencyMs+TrafficKeyHeardMs)/1000
			if d := got.passedAt - closeHeard; got.closeAt < 0 || math.Abs(d-QualyTrafficCloseSec) > 0.5 {
				t.Errorf("on you now heard %.1f s before the car got there (made at %v), want %v ± 0.5", d, got.closeAt, QualyTrafficCloseSec)
			}
			if got.clearAt <= got.passedAt {
				t.Errorf("clear at %v s, the car got there at %v s: want it after", got.clearAt, got.passedAt)
			}
		})
	}
}
