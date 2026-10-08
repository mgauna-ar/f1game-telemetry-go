package engineer

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

const qualyTrackLen = 5000

// qualyCar is a car out on track in a timed session.
func qualyCar(status uint8, lapDist, totalDist float32) packets.LapData {
	return packets.LapData{
		CurrentLapNum: 3,
		DriverStatus:  status,
		ResultStatus:  packets.ResultStatusActive,
		LapDistance:   lapDist,
		TotalDistance: totalDist,
	}
}

// qualyCtx is a lap data evaluation in a session of sessionType on qualyTrackLen metres, with
// the player in car 0.
func qualyCtx(sessionType uint8, phase DrivingPhase, cars ...packets.LapData) *EvaluationContext {
	lapPkt := &packets.PacketLapData{}
	copy(lapPkt.LapData[:], cars)
	return &EvaluationContext{
		Packet:         lapPkt,
		LapData:        lapPkt,
		Session:        &packets.PacketSessionData{SessionType: sessionType, TrackLength: qualyTrackLen},
		Config:         DefaultEngineerConfig(),
		PlayerCarIndex: 0,
		Phase:          phase,
	}
}

func subAlerts(dirs []Directive) []string {
	out := make([]string, 0, len(dirs))
	for _, d := range dirs {
		out = append(out, d.SubAlert)
	}
	return out
}

func directiveFor(dirs []Directive, subAlert string) *Directive {
	for i := range dirs {
		if dirs[i].SubAlert == subAlert {
			return &dirs[i]
		}
	}
	return nil
}

func TestTrackGapM(t *testing.T) {
	tests := []struct {
		name     string
		from, to float32
		want     float32
	}{
		{"ahead on the same lap", 1000, 1150, 150},
		{"behind wraps to nearly a lap", 1150, 1000, 4850},
		{"across the line", 4900, 50, 150},
		{"before the line counts back from it", -100, 50, 150},
		{"same spot", 300, 300, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := trackGapM(tt.from, tt.to, qualyTrackLen); math.Abs(float64(got-tt.want)) > 0.01 {
				t.Errorf("trackGapM(%v, %v) = %v, want %v", tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestQualifyingRule_CarBehindOnAPushLap(t *testing.T) {
	tests := []struct {
		name        string
		sessionType uint8
		phase       DrivingPhase
		rival       packets.LapData
		player      packets.LapData
		wantGap     float64 // 0: no call
	}{
		{
			// Session distances say nothing about track position in qualifying: the rival has
			// driven far less this session but is 150 m behind on track.
			name:        "close behind on track whatever the session distances",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 30000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 850, 12000),
			wantGap:     2.3,
		},
		{
			name:        "ahead in session distance but behind on track",
			sessionType: packets.SessionQ2,
			phase:       PhaseInLap,
			player:      qualyCar(packets.DriverStatusInLap, 1000, 10000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 900, 45000),
			wantGap:     1.5,
		},
		{
			name:        "behind across the line",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 100, 9000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 4950, 4950),
			wantGap:     2.3,
		},
		{
			name:        "in practice too",
			sessionType: packets.SessionP2,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 850, 850),
			wantGap:     2.3,
		},
		{
			name:        "earlier than the line was",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 650, 650),
			wantGap:     5.4,
		},
		{
			name:        "too far back",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 500, 500),
		},
		{
			name:        "just ahead, so not behind",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 1050, 1050),
		},
		{
			name:        "not on a push lap",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusOutLap, 900, 900),
		},
		{
			name:        "in the pit lane",
			sessionType: packets.SessionQ1,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival: func() packets.LapData {
				l := qualyCar(packets.DriverStatusFlyingLap, 900, 900)
				l.PitStatus = packets.PitStatusPitting
				return l
			}(),
		},
		{
			name:        "the player is pushing too",
			sessionType: packets.SessionQ1,
			phase:       PhaseFlyingLap,
			player:      qualyCar(packets.DriverStatusFlyingLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 900, 900),
		},
		{
			name:        "not in a race",
			sessionType: packets.SessionRace,
			phase:       PhaseOutLap,
			player:      qualyCar(packets.DriverStatusOutLap, 1000, 1000),
			rival:       qualyCar(packets.DriverStatusFlyingLap, 900, 900),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := NewQualifyingRule()
			dirs := rule.Evaluate(qualyCtx(tt.sessionType, tt.phase, tt.player, tt.rival))
			d := directiveFor(dirs, "inlap_traffic_behind")
			if tt.wantGap == 0 {
				if d != nil {
					t.Fatalf("expected no car behind call, got %+v", d)
				}
				return
			}
			if d == nil {
				t.Fatalf("expected a car behind call, got %v", subAlerts(dirs))
			}
			if d.Values == nil || d.Values.Behind == nil || d.Values.Behind.GapSec != tt.wantGap {
				t.Fatalf("gap = %+v, want %v s", d.Values, tt.wantGap)
			}
		})
	}
}

func TestQualifyingRule_CarBehindOncePerCar(t *testing.T) {
	rule := NewQualifyingRule()
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	first := qualyCar(packets.DriverStatusFlyingLap, 850, 850)
	second := qualyCar(packets.DriverStatusFlyingLap, 500, 500)

	if dirs := rule.Evaluate(qualyCtx(packets.SessionQ1, PhaseOutLap, player, first, second)); directiveFor(dirs, "inlap_traffic_behind") == nil {
		t.Fatalf("expected the first car to be called, got %v", subAlerts(dirs))
	}
	if dirs := rule.Evaluate(qualyCtx(packets.SessionQ1, PhaseOutLap, player, first, second)); directiveFor(dirs, "inlap_traffic_behind") != nil {
		t.Fatalf("the same car was called twice on one lap")
	}
	second.LapDistance = 800 // now close behind too
	dirs := rule.Evaluate(qualyCtx(packets.SessionQ1, PhaseOutLap, player, first, second))
	if d := directiveFor(dirs, "inlap_traffic_behind"); d == nil || d.Values.Behind.GapSec != 3.1 {
		t.Fatalf("expected the second car to get its own call at 3.1 s, got %+v", d)
	}
}

// qualyHistory is a session history whose best lap is bestMS.
func qualyHistory(bestMS uint32) *packets.PacketSessionHistoryData {
	h := &packets.PacketSessionHistoryData{BestLapTimeLapNum: 1}
	h.LapHistoryData[0].LapTimeInMS = bestMS
	return h
}

// withBestLaps gives the cars of ctx their best laps, by car index.
func withBestLaps(ctx *EvaluationContext, bests map[int]uint32) *EvaluationContext {
	var hist [packets.MaxCars]*packets.PacketSessionHistoryData
	for idx, best := range bests {
		hist[idx] = qualyHistory(best)
	}
	ctx.CarHistory = &hist
	return ctx
}

func TestPushPaceMps(t *testing.T) {
	tests := []struct {
		name  string
		bests map[int]uint32 // best lap by car; car 1 is measured
		want  float64
	}{
		{"nobody has set a lap", nil, AverageRaceSpeedMetersPerSec},
		{"the car's own best", map[int]uint32{1: 80_000, 2: 78_000}, 62.5},
		{"no lap yet: the session's best", map[int]uint32{2: 80_000}, 62.5},
		{"a best far off the session's: the session's best", map[int]uint32{1: 90_000, 2: 80_000}, 62.5},
		{"a best just off the session's is the car's own", map[int]uint32{1: 85_000, 2: 80_000}, 58.82},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := qualyCtx(packets.SessionQ1, PhaseOutLap)
			if tt.bests != nil {
				withBestLaps(ctx, tt.bests)
			}
			if got := roundTo(pushPaceMps(ctx, 1), 2); got != tt.want {
				t.Errorf("pushPaceMps = %v, want %v", got, tt.want)
			}
		})
	}
}

// The car behind is called at the gap the driver set, measured at its own pace: a fast car from
// further back, a slow one closer.
func TestQualifyingRule_CarBehindAtItsPace(t *testing.T) {
	player := qualyCar(packets.DriverStatusOutLap, 1000, 1000)
	pushing := func(lapDist float32) packets.LapData {
		return qualyCar(packets.DriverStatusFlyingLap, lapDist, lapDist)
	}
	tests := []struct {
		name    string
		warnSec float32        // the driver's setting (0: a setup saved without it)
		bests   map[int]uint32 // best lap by car
		rivals  []packets.LapData
		wantCar int     // car called (0: none)
		wantGap float64 // its gap
	}{
		{"a fast car from further back", 6, map[int]uint32{1: 68_000}, []packets.LapData{pushing(580)}, 1, 5.7},
		{"a slow car only closer", 6, map[int]uint32{1: 100_000}, []packets.LapData{pushing(650)}, 0, 0},
		{"no setting: the default", 0, nil, []packets.LapData{pushing(650)}, 1, 5.4},
		{"the driver's shortest gap", 3, nil, []packets.LapData{pushing(750)}, 0, 0},
		{"the driver's longest gap", 10, nil, []packets.LapData{pushing(400)}, 1, 9.2},
		{
			"the car that gets there first, not the nearest",
			6, map[int]uint32{1: 85_000, 2: 79_500},
			[]packets.LapData{pushing(700), pushing(690)}, 2, 4.9,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := withBestLaps(qualyCtx(packets.SessionQ1, PhaseOutLap, append([]packets.LapData{player}, tt.rivals...)...), tt.bests)
			ctx.Config.QualyCarBehindSec = tt.warnSec
			rule := NewQualifyingRule()
			d := directiveFor(rule.Evaluate(ctx), "inlap_traffic_behind")
			if tt.wantCar == 0 {
				if d != nil {
					t.Fatalf("expected no car behind call, got %+v", d)
				}
				return
			}
			if d == nil || d.Values == nil || d.Values.Behind == nil || d.Values.Behind.GapSec != tt.wantGap {
				t.Fatalf("expected a car behind call at %v s, got %+v", tt.wantGap, d)
			}
			if rule.behindCalled[tt.wantCar] != player.CurrentLapNum {
				t.Fatalf("car %d wasn't the one called", tt.wantCar)
			}
		})
	}
}

// Traffic ahead is measured at the player's own pace.
func TestQualifyingRule_TrafficAheadAtThePlayersPace(t *testing.T) {
	fast := map[int]uint32{0: 68_000} // 73.5 m/s on qualyTrackLen

	t.Run("slow car ahead on a push lap", func(t *testing.T) {
		ctx := withBestLaps(qualyCtx(packets.SessionQ1, PhaseFlyingLap,
			qualyCar(packets.DriverStatusFlyingLap, 2000, 2000), qualyCar(packets.DriverStatusInLap, 2350, 2350)), fast)
		ctx.Telemetry = &packets.PacketCarTelemetryData{}
		ctx.Telemetry.CarTelemetryData[0].Speed, ctx.Telemetry.CarTelemetryData[1].Speed = 280, 160
		d := directiveFor(NewQualifyingRule().Evaluate(ctx), "qualy_traffic_ahead")
		if d == nil || d.Values.Ahead.GapSec != 4.8 {
			t.Fatalf("expected the slow car at 4.8 s, got %+v", d)
		}
	})
	t.Run("out-lap gap", func(t *testing.T) {
		ctx := withBestLaps(qualyCtx(packets.SessionQ1, PhaseOutLap,
			qualyCar(packets.DriverStatusOutLap, 4000, 4000), qualyCar(packets.DriverStatusOutLap, 4280, 4280)), fast)
		d := directiveFor(NewQualifyingRule().Evaluate(ctx), "qualy_traffic")
		if d == nil || d.Values.Ahead.GapSec != 3.8 {
			t.Fatalf("expected traffic at 3.8 s, got %+v", d)
		}
	})
}

func TestQualifyingRule_OutLapTrafficAhead(t *testing.T) {
	tests := []struct {
		name     string
		player   packets.LapData
		rival    packets.LapData
		want     string
		wantGap  float64
		noRivals bool
	}{
		{
			name:    "car close ahead whatever the session distances",
			player:  qualyCar(packets.DriverStatusOutLap, 4000, 30000),
			rival:   qualyCar(packets.DriverStatusOutLap, 4150, 9000),
			want:    "qualy_traffic",
			wantGap: 2.3,
		},
		{
			name:    "car ahead across the line",
			player:  qualyCar(packets.DriverStatusOutLap, 4900, 4900),
			rival:   qualyCar(packets.DriverStatusOutLap, 50, 50),
			want:    "qualy_traffic",
			wantGap: 2.3,
		},
		{
			name:   "gap ahead bigger than the clean air setting",
			player: qualyCar(packets.DriverStatusOutLap, 4000, 4000),
			rival:  qualyCar(packets.DriverStatusOutLap, 4400, 4400),
			want:   "qualy_clean_air",
		},
		{
			name:   "car just behind is no traffic",
			player: qualyCar(packets.DriverStatusOutLap, 4000, 4000),
			rival:  qualyCar(packets.DriverStatusOutLap, 3950, 3950),
			want:   "qualy_clean_air",
		},
		{
			name:     "nobody else on track",
			player:   qualyCar(packets.DriverStatusOutLap, 4000, 4000),
			noRivals: true,
			want:     "qualy_clean_air",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cars := []packets.LapData{tt.player}
			if !tt.noRivals {
				cars = append(cars, tt.rival)
			}
			rule := NewQualifyingRule()
			dirs := rule.Evaluate(qualyCtx(packets.SessionQ2, PhaseOutLap, cars...))
			d := directiveFor(dirs, tt.want)
			if d == nil {
				t.Fatalf("expected %s, got %v", tt.want, subAlerts(dirs))
			}
			if tt.wantGap > 0 && (d.Values == nil || d.Values.Ahead == nil || d.Values.Ahead.GapSec != tt.wantGap) {
				t.Fatalf("gap = %+v, want %v s", d.Values, tt.wantGap)
			}
			if again := rule.Evaluate(qualyCtx(packets.SessionQ2, PhaseOutLap, cars...)); directiveFor(again, tt.want) != nil {
				t.Fatalf("called twice on one out-lap")
			}
		})
	}

	t.Run("not before the final sector", func(t *testing.T) {
		dirs := NewQualifyingRule().Evaluate(qualyCtx(packets.SessionQ2, PhaseOutLap,
			qualyCar(packets.DriverStatusOutLap, 2000, 2000), qualyCar(packets.DriverStatusOutLap, 2100, 2100)))
		if len(dirs) != 0 {
			t.Fatalf("expected no call mid-lap, got %v", subAlerts(dirs))
		}
	})
}

func TestQualifyingRule_SlowCarAheadOnAPushLap(t *testing.T) {
	withSpeeds := func(ctx *EvaluationContext, speeds ...uint16) *EvaluationContext {
		ctx.Telemetry = &packets.PacketCarTelemetryData{}
		for i, s := range speeds {
			ctx.Telemetry.CarTelemetryData[i].Speed = s
		}
		return ctx
	}
	player := qualyCar(packets.DriverStatusFlyingLap, 2000, 2000)
	tests := []struct {
		name    string
		player  packets.LapData
		rival   packets.LapData
		speeds  []uint16
		wantGap float64
	}{
		{"slow car on an in-lap ahead", player, qualyCar(packets.DriverStatusInLap, 2200, 9000), []uint16{280, 160}, 3.1},
		{"car on an out-lap ahead", player, qualyCar(packets.DriverStatusOutLap, 2100, 100), []uint16{280, 200}, 1.5},
		{"car ahead also pushing", player, qualyCar(packets.DriverStatusFlyingLap, 2200, 2200), []uint16{280, 160}, 0},
		{"car ahead going faster", player, qualyCar(packets.DriverStatusOutLap, 2200, 2200), []uint16{180, 250}, 0},
		{"too far ahead", player, qualyCar(packets.DriverStatusInLap, 2400, 2400), []uint16{280, 160}, 0},
		{"past the line, not on this lap", qualyCar(packets.DriverStatusFlyingLap, 4950, 4950), qualyCar(packets.DriverStatusInLap, 100, 100), []uint16{280, 160}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := NewQualifyingRule()
			ctx := withSpeeds(qualyCtx(packets.SessionQ1, PhaseFlyingLap, tt.player, tt.rival), tt.speeds...)
			d := directiveFor(rule.Evaluate(ctx), "qualy_traffic_ahead")
			if tt.wantGap == 0 {
				if d != nil {
					t.Fatalf("expected no call, got %+v", d)
				}
				return
			}
			if d == nil || d.Values == nil || d.Values.Ahead == nil || d.Values.Ahead.GapSec != tt.wantGap {
				t.Fatalf("expected a slow car ahead call at %v s, got %+v", tt.wantGap, d)
			}
			if again := rule.Evaluate(ctx); directiveFor(again, "qualy_traffic_ahead") != nil {
				t.Fatalf("the same car was called twice on one lap")
			}
		})
	}
}

func TestQualifyingRule_InvalidLap(t *testing.T) {
	invalid := func(status uint8) packets.LapData {
		l := qualyCar(status, 2000, 2000)
		l.CurrentLapInvalid = 1
		return l
	}
	tests := []struct {
		name        string
		sessionType uint8
		lap         packets.LapData
		want        bool
	}{
		{"push lap in qualifying", packets.SessionQ1, invalid(packets.DriverStatusFlyingLap), true},
		{"push lap in practice", packets.SessionP1, invalid(packets.DriverStatusFlyingLap), true},
		{"out-lap", packets.SessionQ1, invalid(packets.DriverStatusOutLap), false},
		{"a race lap the game calls a flying lap", packets.SessionRace, invalid(packets.DriverStatusFlyingLap), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := NewQualifyingRule()
			ctx := qualyCtx(tt.sessionType, PhaseFlyingLap, tt.lap)
			got := directiveFor(rule.Evaluate(ctx), "qualy_deleted_lap") != nil
			if got != tt.want {
				t.Fatalf("lap deleted call = %v, want %v", got, tt.want)
			}
			if tt.want && directiveFor(rule.Evaluate(ctx), "qualy_deleted_lap") != nil {
				t.Fatalf("called twice on one lap")
			}
		})
	}
}

func TestQualifyingRule_SessionClock(t *testing.T) {
	clockCtx := func(phase DrivingPhase, secondsLeft uint16) *EvaluationContext {
		s := &packets.PacketSessionData{SessionType: packets.SessionQ3, SessionTimeLeft: secondsLeft, TrackLength: qualyTrackLen}
		return &EvaluationContext{Packet: s, Session: s, Config: DefaultEngineerConfig(), Phase: phase}
	}

	t.Run("in the garage: go out now", func(t *testing.T) {
		d := directiveFor(NewQualifyingRule().Evaluate(clockCtx(PhaseInGarage, 150)), "qualy_session_time_garage")
		if d == nil || d.Values == nil || d.Values.Minutes != 3 {
			t.Fatalf("expected the garage clock call with 3 minutes, got %+v", d)
		}
	})
	t.Run("on track: cross the line in time", func(t *testing.T) {
		d := directiveFor(NewQualifyingRule().Evaluate(clockCtx(PhaseOutLap, 100)), "qualy_session_time")
		if d == nil || d.Values.Minutes != 2 {
			t.Fatalf("expected the on-track clock call with 2 minutes, got %+v", d)
		}
	})
	t.Run("once a session, whatever the phase changes", func(t *testing.T) {
		rule := NewQualifyingRule()
		if len(rule.Evaluate(clockCtx(PhaseInGarage, 170))) != 1 {
			t.Fatal("expected the first call")
		}
		for _, phase := range []DrivingPhase{PhasePitLane, PhaseOutLap, PhaseInLap} {
			rule.Reset(DedupScopePhase)
			if dirs := rule.Evaluate(clockCtx(phase, 160)); len(dirs) != 0 {
				t.Fatalf("called again in %v: %v", phase, subAlerts(dirs))
			}
		}
	})
	t.Run("waits for the end of a push lap", func(t *testing.T) {
		rule := NewQualifyingRule()
		if dirs := rule.Evaluate(clockCtx(PhaseFlyingLap, 170)); len(dirs) != 0 {
			t.Fatalf("called during a push lap: %v", subAlerts(dirs))
		}
		rule.Reset(DedupScopePhase)
		if directiveFor(rule.Evaluate(clockCtx(PhaseInLap, 120)), "qualy_session_time") == nil {
			t.Fatal("expected the call once the push lap ended")
		}
	})
}

func TestQualifyingRule_Elimination(t *testing.T) {
	elimCtx := func(sessionType uint8, phase DrivingPhase, pos uint8) *EvaluationContext {
		s := &packets.PacketSessionData{SessionType: sessionType, SessionTimeLeft: 240, TrackLength: qualyTrackLen}
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = qualyCar(packets.DriverStatusOutLap, 1000, 1000)
		lapPkt.LapData[0].CarPosition = pos
		return &EvaluationContext{
			Packet: s, Session: s, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: phase,
			Participants: &packets.PacketParticipantsData{NumActiveCars: 22},
		}
	}

	tests := []struct {
		name        string
		sessionType uint8
		pos         uint8
		want        string
	}{
		{"in the Q1 drop zone", packets.SessionQ1, 17, "qualy_elimination_danger"},
		{"last place through Q1", packets.SessionQ1, 16, "qualy_elimination_bubble"},
		{"safe in Q1", packets.SessionQ1, 15, ""},
		{"in the Q2 drop zone", packets.SessionQ2, 12, "qualy_elimination_danger"},
		{"nobody is knocked out of Q3", packets.SessionQ3, 10, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dirs := NewQualifyingRule().Evaluate(elimCtx(tt.sessionType, PhaseOutLap, tt.pos))
			if tt.want == "" {
				if len(dirs) != 0 {
					t.Fatalf("expected no call, got %v", subAlerts(dirs))
				}
				return
			}
			d := directiveFor(dirs, tt.want)
			if d == nil || d.Values == nil || d.Values.Position != int(tt.pos) || d.Values.Minutes != 4 {
				t.Fatalf("expected %s for P%d with 4 minutes, got %+v", tt.want, tt.pos, d)
			}
		})
	}

	t.Run("again only after leaving the zone", func(t *testing.T) {
		rule := NewQualifyingRule()
		steps := []struct {
			pos   uint8
			phase DrivingPhase
			calls int
		}{
			{17, PhaseInGarage, 1},
			{17, PhaseOutLap, 0},
			{18, PhaseInLap, 0},
			{12, PhaseInLap, 0}, // out of the zone
			{17, PhaseFlyingLap, 0},
			{17, PhaseInLap, 1}, // back in: called once the push lap ends
			{17, PhaseInGarage, 0},
		}
		for i, step := range steps {
			rule.Reset(DedupScopePhase)
			if got := len(rule.Evaluate(elimCtx(packets.SessionQ1, step.phase, step.pos))); got != step.calls {
				t.Fatalf("step %d (P%d, %v): %d calls, want %d", i, step.pos, step.phase, got, step.calls)
			}
		}
	})
}

func TestQualifyingRule_CooldownOncePerInLap(t *testing.T) {
	rule := NewQualifyingRule()
	if directiveFor(rule.Evaluate(qualyCtx(packets.SessionQ2, PhaseInLap, qualyCar(packets.DriverStatusInLap, 100, 100))), "inlap_cooldown") != nil {
		t.Fatal("the cool-down call came at the line, over the lap result")
	}
	ctx := qualyCtx(packets.SessionQ2, PhaseInLap, qualyCar(packets.DriverStatusInLap, 1000, 1000))
	if directiveFor(rule.Evaluate(ctx), "inlap_cooldown") == nil {
		t.Fatal("expected the cool-down call")
	}
	if directiveFor(rule.Evaluate(ctx), "inlap_cooldown") != nil {
		t.Fatal("the cool-down call repeated on one in-lap")
	}
}

// The calls a qualifying run needs reach the radio through the engine's gates: the car behind on a
// push lap on the out-lap, and a yellow flag and a slow car ahead in the flying lap's radio silence.
func TestEngineerEngine_QualifyingRunCalls(t *testing.T) {
	ctx := context.Background()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	clock := newTestClock()
	clock.install(e)
	h := createTestHeader(packets.PacketFormat2025, 777, 0)
	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionQ1, TrackLength: qualyTrackLen, SessionTimeLeft: 900})

	lap := func(cars ...packets.LapData) *packets.PacketLapData {
		p := &packets.PacketLapData{Header: h}
		copy(p.LapData[:], cars)
		return p
	}

	e.ProcessPacket(ctx, lap(qualyCar(packets.DriverStatusOutLap, 1000, 30000), qualyCar(packets.DriverStatusFlyingLap, 850, 12000)))
	if e.currentPhase != PhaseOutLap || spoken(t, b, "inlap_traffic_behind") != 1 {
		t.Fatalf("phase %v, car behind calls %d: want the call on the out-lap", e.currentPhase, spoken(t, b, "inlap_traffic_behind"))
	}

	clock.advance(30 * time.Second)
	player := qualyCar(packets.DriverStatusFlyingLap, 2000, 32000)
	player.CurrentLapNum = 4
	e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 280}, {Speed: 150}}})
	e.ProcessPacket(ctx, lap(player, qualyCar(packets.DriverStatusInLap, 2200, 14000)))
	if e.currentPhase != PhaseFlyingLap || spoken(t, b, "qualy_traffic_ahead") != 1 {
		t.Fatalf("phase %v, slow car ahead calls %d: want the call on the push lap", e.currentPhase, spoken(t, b, "qualy_traffic_ahead"))
	}

	clock.advance(5 * time.Second)
	e.ProcessPacket(ctx, &packets.PacketCarStatusData{Header: h, CarStatusData: [packets.MaxCars]packets.CarStatusData{{VehicleFIAFlags: packets.VehicleFIAFlagYellow}}})
	if spoken(t, b, "flags_yellow") != 1 {
		t.Fatal("expected the yellow flag through the push lap's radio silence")
	}
}

func TestEngineerEngine_YellowFlagAtTheRaceStart(t *testing.T) {
	ctx := context.Background()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	h := createTestHeader(packets.PacketFormat2025, 778, 0)
	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: qualyTrackLen})
	e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'L', 'G', 'O', 'T'}})
	e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
		{CurrentLapNum: 1, LapDistance: 400, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive},
	}})
	if e.currentPhase != PhaseRaceStart {
		t.Fatalf("phase = %v, want %v", e.currentPhase, PhaseRaceStart)
	}
	e.ProcessPacket(ctx, &packets.PacketCarStatusData{Header: h, CarStatusData: [packets.MaxCars]packets.CarStatusData{{VehicleFIAFlags: packets.VehicleFIAFlagYellow}}})
	if spoken(t, b, "flags_yellow") != 1 {
		t.Fatal("expected the lap-one yellow flag through the start's radio silence")
	}
}

func TestFlagsRule_TrackLimitsInRacesOnly(t *testing.T) {
	for _, tt := range []struct {
		sessionType uint8
		want        bool
	}{{packets.SessionRace, true}, {packets.SessionQ1, false}, {packets.SessionP1, false}} {
		rule := NewFlagsRule()
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{CornerCuttingWarnings: 3}
		ctx := &EvaluationContext{
			Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: tt.sessionType},
		}
		if got := directiveFor(rule.Evaluate(ctx), "track_limits_warnings") != nil; got != tt.want {
			t.Errorf("session %d: track limits call = %v, want %v", tt.sessionType, got, tt.want)
		}
	}
}

// lapResultRun drives the qualifying rule through push laps in a 22-car Q1, with the player in
// car 0, car 1 in P1 and car 2 in P2.
type lapResultRun struct {
	t           *testing.T
	rule        *QualifyingRule
	now         int64
	sessionType uint8
	history     [packets.MaxCars]*packets.PacketSessionHistoryData
}

func newLapResultRun(t *testing.T, sessionType uint8, p1BestMS, p2BestMS uint32) *lapResultRun {
	r := &lapResultRun{t: t, rule: NewQualifyingRule(), now: 1_000_000, sessionType: sessionType}
	for idx, best := range map[int]uint32{1: p1BestMS, 2: p2BestMS} {
		h := &packets.PacketSessionHistoryData{BestLapTimeLapNum: 1}
		h.LapHistoryData[0].LapTimeInMS = best
		r.history[idx] = h
	}
	return r
}

// step evaluates one lap data packet after advancing the clock by ms.
func (r *lapResultRun) step(ms int64, status, lapNum uint8, invalid bool, lastLapMS uint32, pos uint8) []Directive {
	r.now += ms
	player := qualyCar(status, 100, 100)
	player.CurrentLapNum = lapNum
	player.LastLapTimeInMS = lastLapMS
	player.CarPosition = pos
	if invalid {
		player.CurrentLapInvalid = 1
	}
	p1, p2 := qualyCar(packets.DriverStatusInGarage, 0, 0), qualyCar(packets.DriverStatusInGarage, 0, 0)
	p1.CarPosition, p2.CarPosition = 1, 2
	if pos <= 2 {
		p1.CarPosition, p2.CarPosition = 2, 3
	}
	ctx := qualyCtx(r.sessionType, PhaseFlyingLap, player, p1, p2)
	ctx.Now = r.now
	ctx.CarHistory = &r.history
	ctx.Participants = &packets.PacketParticipantsData{NumActiveCars: 22}
	return r.rule.Evaluate(ctx)
}

// pushLap drives a push lap on lapNum to the line and returns the result said once the positions
// settle (nil when none).
func (r *lapResultRun) pushLap(lapNum uint8, invalid bool, lapMS uint32, pos uint8) *Directive {
	r.step(0, packets.DriverStatusFlyingLap, lapNum, false, 0, pos)
	r.step(30_000, packets.DriverStatusFlyingLap, lapNum, invalid, 0, pos)
	if d := directiveFor(r.step(1_000, packets.DriverStatusInLap, lapNum+1, false, lapMS, pos), "qualy_lap_result"); d != nil {
		r.t.Fatalf("lap result said before the positions settled: %+v", d)
	}
	for _, d := range r.step(QualyLapResultSettleMs, packets.DriverStatusInLap, lapNum+1, false, lapMS, pos) {
		if d.ID == "qualy_lap_result" {
			return &d
		}
	}
	return nil
}

func TestQualifyingRule_LapResult(t *testing.T) {
	t.Run("position and gap to P1", func(t *testing.T) {
		d := newLapResultRun(t, packets.SessionQ2, 80_000, 80_100).pushLap(3, false, 80_345, 6)
		if d == nil || d.SubAlert != "qualy_lap_result" || d.Values.Position != 6 || d.Values.PoleGapSec != 0.345 || d.Values.Elimination != "" {
			t.Fatalf("expected P6, 0.345 off P1, safe; got %+v", d)
		}
	})
	t.Run("provisional pole and the margin to P2", func(t *testing.T) {
		d := newLapResultRun(t, packets.SessionQ3, 80_000, 80_100).pushLap(3, false, 79_912, 1)
		if d == nil || d.SubAlert != "qualy_lap_pole" || d.Values.PoleGapSec != 0.088 {
			t.Fatalf("expected provisional pole 0.088 clear; got %+v", d)
		}
	})
	t.Run("no improvement on a slower lap", func(t *testing.T) {
		run := newLapResultRun(t, packets.SessionQ2, 80_000, 80_100)
		run.pushLap(3, false, 80_345, 6)
		d := run.pushLap(5, false, 80_600, 7)
		if d == nil || d.SubAlert != "qualy_lap_no_improvement" || d.Values.Position != 7 || d.Values.PoleGapSec != 0 {
			t.Fatalf("expected no improvement, P7; got %+v", d)
		}
	})
	t.Run("an invalid lap has no result", func(t *testing.T) {
		if d := newLapResultRun(t, packets.SessionQ2, 80_000, 80_100).pushLap(3, true, 79_000, 1); d != nil {
			t.Fatalf("expected no result for an invalid lap, got %+v", d)
		}
	})
	t.Run("an abandoned push lap has no result", func(t *testing.T) {
		run := newLapResultRun(t, packets.SessionQ2, 80_000, 80_100)
		run.step(0, packets.DriverStatusFlyingLap, 3, false, 0, 9)
		run.step(10_000, packets.DriverStatusInLap, 3, false, 0, 9)
		run.step(30_000, packets.DriverStatusInLap, 4, false, 95_000, 9)
		if d := directiveFor(run.step(QualyLapResultSettleMs, packets.DriverStatusInLap, 4, false, 95_000, 9), "qualy_lap_no_improvement"); d != nil {
			t.Fatalf("expected no result after an abandoned lap, got %+v", d)
		}
	})
	t.Run("drop zone and last place through in Q1", func(t *testing.T) {
		for pos, want := range map[uint8]EliminationStatus{17: EliminationDropZone, 16: EliminationLastThrough, 15: ""} {
			d := newLapResultRun(t, packets.SessionQ1, 80_000, 80_100).pushLap(3, false, 81_000, pos)
			if d == nil || d.Values.Elimination != want {
				t.Errorf("P%d: elimination = %+v, want %q", pos, d, want)
			}
		}
	})
	t.Run("not outside qualifying", func(t *testing.T) {
		if d := newLapResultRun(t, packets.SessionP1, 80_000, 80_100).pushLap(3, false, 80_345, 6); d != nil {
			t.Fatalf("expected no lap result in practice, got %+v", d)
		}
	})
}

// The lap result reaches the radio through the next push lap's radio silence and after the
// chequered flag.
func TestEngineerEngine_LapResultGates(t *testing.T) {
	for _, tt := range []struct {
		name  string
		after packets.LapData
	}{
		{"straight into another push lap", packets.LapData{DriverStatus: packets.DriverStatusFlyingLap}},
		{"after the chequered flag", packets.LapData{DriverStatus: packets.DriverStatusInLap, ResultStatus: packets.ResultStatusFinished}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			b := &mockBroadcaster{}
			e := newTestEngineerEngine(b)
			clock := newTestClock()
			clock.install(e)
			h := createTestHeader(packets.PacketFormat2025, 779, 0)
			e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionQ3, TrackLength: qualyTrackLen, SessionTimeLeft: 600})
			push := qualyCar(packets.DriverStatusFlyingLap, 3000, 3000)
			push.CarPosition = 4
			e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{push}})

			after := qualyCar(tt.after.DriverStatus, 50, 5050)
			if tt.after.ResultStatus != 0 {
				after.ResultStatus = tt.after.ResultStatus
			}
			after.CurrentLapNum = push.CurrentLapNum + 1
			after.LastLapTimeInMS = 80_500
			after.CarPosition = 3
			e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{after}})
			clock.advance(QualyLapResultSettleMs * time.Millisecond)
			e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{after}})
			if spoken(t, b, "qualy_lap_result") != 1 {
				t.Fatalf("phase %v: expected the lap result to be said", e.currentPhase)
			}
		})
	}
}
