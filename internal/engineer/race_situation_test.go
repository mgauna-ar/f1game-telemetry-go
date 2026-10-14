package engineer

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// seededFlagsRule is a FlagsRule that has seen the session's first packets, so it calls what
// changes from there on.
func seededFlagsRule() *FlagsRule {
	r := NewFlagsRule()
	r.sessionSeen, r.lapSeen = true, true
	return r
}

// battleCtx is lap 8 of a race with the player (car 0) in P5, 0.9 s behind car 1 in P4 and 0.6 s
// ahead of car 2 in P6, all racing.
func battleCtx() *EvaluationContext {
	lapPkt := &packets.PacketLapData{}
	for i, pos := range []uint8{5, 4, 6} {
		lapPkt.LapData[i] = packets.LapData{CarPosition: pos, CurrentLapNum: 8, LapDistance: 1200,
			ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
	}
	lapPkt.LapData[0].DeltaToCarInFrontMSPart = 900
	lapPkt.LapData[2].DeltaToCarInFrontMSPart = 600
	return &EvaluationContext{
		Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
		PacketFormat: packets.PacketFormat2025, TeammateCarIndex: -1,
		Session: &packets.PacketSessionData{SessionType: packets.SessionRace, TrackLength: 5000},
	}
}

func TestRaceGapSec(t *testing.T) {
	ctx := battleCtx()
	laps := ctx.LapData
	laps.LapData[3] = packets.LapData{CarPosition: 7, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}

	if got := raceGapSec(ctx, 1, 0); got != 0.9 {
		t.Errorf("nose to tail: gap = %v, want the 0.9 s delta to the car in front", got)
	}

	// Cars further apart: their deltas to the leader.
	laps.LapData[0].DeltaToRaceLeaderMSPart = 3000
	laps.LapData[3].DeltaToRaceLeaderMSPart = 5000
	if got := raceGapSec(ctx, 0, 3); got != 2.0 {
		t.Errorf("by the leader deltas: gap = %v, want 2.0", got)
	}

	// No timing: the distance at the player's race pace, 50 m/s over 100 s laps of 5 km. A Safety
	// Car lap is no race pace.
	laps.LapData[0].DeltaToRaceLeaderMSPart, laps.LapData[3].DeltaToRaceLeaderMSPart = 0, 0
	laps.LapData[0].TotalDistance, laps.LapData[3].TotalDistance = 10_000, 9_900
	ctx.PlayerLaps = []LapRecord{
		{LapNumber: 5, LapTimeMS: 100_000, Valid: true},
		{LapNumber: 6, LapTimeMS: 140_000, Valid: true},
		{LapNumber: 7, LapTimeMS: 100_000, Valid: true},
	}
	if got := raceGapSec(ctx, 0, 3); got != 2.0 {
		t.Errorf("by distance at race pace: gap = %v, want 2.0", got)
	}
	ctx.PlayerLaps = nil
	if got, want := raceGapSec(ctx, 0, 3), 100/AverageRaceSpeedMetersPerSec; got != want {
		t.Errorf("by distance before a lap: gap = %v, want %v", got, want)
	}
	if got := raceGapSec(ctx, 3, 0); got >= 0 {
		t.Errorf("the other way round: gap = %v, want it negative", got)
	}
}

func TestRivalsRule_OnlyCarsRacingThePlayer(t *testing.T) {
	tests := []struct {
		name  string
		setup func(l *packets.LapData)
		want  bool
	}{
		{"on track", nil, true},
		{"pitting", func(l *packets.LapData) { l.PitStatus = packets.PitStatusPitting }, false},
		{"in its pit box", func(l *packets.LapData) { l.PitStatus = packets.PitStatusInPitArea }, false},
		{"retired", func(l *packets.LapData) { l.ResultStatus = packets.ResultStatusRetired }, false},
		{"in the garage", func(l *packets.LapData) { l.DriverStatus = packets.DriverStatusInGarage }, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := battleCtx()
			if tt.setup != nil {
				tt.setup(&ctx.LapData.LapData[2])
				tt.setup(&ctx.LapData.LapData[1])
			}
			dirs := NewRivalsRule().Evaluate(ctx)
			defend, attack := directiveFor(dirs, "rival_defend") != nil, directiveFor(dirs, "rival_attack") != nil
			if defend != tt.want || attack != tt.want {
				t.Fatalf("defend = %v, attack = %v, want %v: %v", defend, attack, tt.want, subAlerts(dirs))
			}
		})
	}
}

func TestRivalsRule_NoDefendCallForTheCarThatPitsForTheUndercut(t *testing.T) {
	r := newRivalRace(t)
	r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 1500
	r.send()
	r.clock.advance(time.Minute)                          // past the cooldown of the opening gap report
	r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 800 // the game's gap as it dives in
	r.pit(rrBehind, packets.PitStatusPitting)
	r.pit(rrBehind, packets.PitStatusInPitArea)
	r.pit(rrBehind, packets.PitStatusPitting)
	if n := spoken(t, r.b, "undercut_window"); n != 1 {
		t.Fatalf("undercut calls = %d, want 1", n)
	}
	if n := spoken(t, r.b, "rival_defend"); n != 0 {
		t.Fatalf("defend calls for the car in the pits = %d, want none", n)
	}
	r.pit(rrBehind, packets.PitStatusNone) // back out, right behind
	if n := spoken(t, r.b, "rival_defend"); n != 1 {
		t.Fatalf("defend calls once it is back on track = %d, want 1", n)
	}
}

func TestRivalsRule_AttackSaysTheTrend(t *testing.T) {
	tests := []struct {
		name      string
		gapsMS    [2]uint32 // the gap ahead at the last two lap ends
		wantTrend GapTrendDirection
		wantRate  float64
	}{
		{"closing", [2]uint32{1500, 1200}, GapClosing, 0.3},
		{"opening", [2]uint32{600, 800}, GapOpening, 0.2},
		{"not measured yet", [2]uint32{}, "", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := battleCtx()
			if tt.gapsMS[0] > 0 {
				ctx.PlayerLaps = []LapRecord{
					{LapNumber: 6, CarAheadIdx: 1, GapAheadMS: tt.gapsMS[0], CarBehindIdx: -1},
					{LapNumber: 7, CarAheadIdx: 1, GapAheadMS: tt.gapsMS[1], CarBehindIdx: -1},
				}
			}
			d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_attack")
			if d == nil || d.Values == nil || d.Values.Ahead == nil {
				t.Fatalf("expected rival_attack with the gap ahead, got %+v", d)
			}
			if g := d.Values.Ahead; g.GapSec != 0.9 || g.Trend != tt.wantTrend || g.PerLapSec != tt.wantRate {
				t.Fatalf("gap ahead = %+v, want 0.9 s, %q at %v a lap", *g, tt.wantTrend, tt.wantRate)
			}
			if strings.Contains(d.Message, "catching") || (tt.wantTrend == GapClosing) != strings.Contains(d.Message, "closing") {
				t.Fatalf("message %q: only a closing gap says so, and nothing says catching", d.Message)
			}
		})
	}
}

func TestRivalsRule_TheTeammateAheadHasItsOwnCall(t *testing.T) {
	ctx := battleCtx()
	ctx.TeammateCarIndex = 1
	if d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_attack"); d != nil {
		t.Fatalf("rival_attack on the teammate: %+v", d)
	}
	ctx.Config.EnabledCategories["teammate_ahead"] = false
	if d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_attack"); d == nil {
		t.Fatal("expected rival_attack on the teammate while the teammate call is off")
	}
}

func TestTeammateRule_AheadOncePerApproach(t *testing.T) {
	ctx := battleCtx()
	ctx.TeammateCarIndex = 1
	rule := NewTeammateRule()
	calls := func() int {
		n := 0
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "teammate_ahead" {
				n++
			}
		}
		return n
	}
	if n := calls(); n != 1 {
		t.Fatalf("teammate ahead calls = %d, want 1", n)
	}
	ctx.LapData.LapData[0].CurrentLapNum = 9
	if n := calls(); n != 0 {
		t.Fatalf("teammate ahead calls on the next lap, still behind them = %d, want none", n)
	}
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 3500 // they pull away
	if n := calls(); n != 0 {
		t.Fatalf("teammate ahead calls at 3.5 s = %d, want none", n)
	}
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 1500 // back on them
	if n := calls(); n != 1 {
		t.Fatalf("teammate ahead calls on the next approach = %d, want 1", n)
	}

	// Not when another car runs between them.
	ctx = battleCtx()
	ctx.TeammateCarIndex = 1
	ctx.LapData.LapData[1].CarPosition = 3
	ctx.LapData.LapData[3] = packets.LapData{CarPosition: 4, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
	if dirs := NewTeammateRule().Evaluate(ctx); directiveFor(dirs, "teammate_proximity") != nil {
		t.Fatalf("teammate ahead call with a car between: %v", subAlerts(dirs))
	}
}

func TestTeammateRule_RetiredTeammateIsNotCalled(t *testing.T) {
	ctx := battleCtx()
	ctx.TeammateCarIndex = 1
	tm := &ctx.LapData.LapData[1]
	tm.ResultStatus, tm.PitStatus = packets.ResultStatusRetired, packets.PitStatusPitting
	if dirs := NewTeammateRule().Evaluate(ctx); len(dirs) != 0 {
		t.Fatalf("calls about a retired teammate: %v", subAlerts(dirs))
	}
}

func TestTeammate_DoubleStack(t *testing.T) {
	ctx := context.Background()
	limiter := func(r *rivalRace) {
		status := &packets.PacketCarStatusData{Header: r.h}
		status.CarStatusData[rrPlayer].PitLimiterStatus = 1
		r.e.ProcessPacket(ctx, status)
	}

	t.Run("as the player comes in on the limiter", func(t *testing.T) {
		r := newRivalRace(t)
		r.e.teammateCarIndex = rrAhead
		r.pit(rrAhead, packets.PitStatusInPitArea)
		limiter(r)
		r.pit(rrPlayer, packets.PitStatusPitting)
		if n := spoken(t, r.b, "teammate_doublestack"); n != 1 {
			t.Fatalf("double-stack calls on pit entry = %d, want 1", n)
		}
		r.pit(rrPlayer, packets.PitStatusInPitArea)
		r.pit(rrPlayer, packets.PitStatusPitting)
		if n := spoken(t, r.b, "teammate_doublestack"); n != 1 {
			t.Fatalf("double-stack calls after the stop = %d, want 1", n)
		}
	})

	t.Run("when told to box this lap", func(t *testing.T) {
		r := newRivalRace(t)
		r.e.teammateCarIndex = rrAhead
		r.e.boxDueLap = 10
		r.pit(rrAhead, packets.PitStatusPitting)
		if n := spoken(t, r.b, "teammate_doublestack"); n != 1 {
			t.Fatalf("double-stack calls with the box call made = %d, want 1", n)
		}
		if n := spoken(t, r.b, "teammate_pitting"); n != 0 {
			t.Fatalf("teammate pitting calls on top of the double-stack = %d, want none", n)
		}
	})

	t.Run("not on the way out", func(t *testing.T) {
		r := newRivalRace(t)
		r.e.teammateCarIndex = rrAhead
		r.pit(rrPlayer, packets.PitStatusPitting)
		r.pit(rrPlayer, packets.PitStatusInPitArea)
		r.lap.LapData[rrAhead].PitStatus = packets.PitStatusPitting
		r.pit(rrPlayer, packets.PitStatusPitting)
		if n := spoken(t, r.b, "teammate_doublestack"); n != 0 {
			t.Fatalf("double-stack calls as the player leaves = %d, want none", n)
		}
	})

	t.Run("not for a drive-through", func(t *testing.T) {
		r := newRivalRace(t)
		r.e.teammateCarIndex = rrAhead
		r.lap.LapData[rrPlayer].NumUnservedDriveThroughPens = 1
		r.pit(rrAhead, packets.PitStatusInPitArea)
		r.pit(rrPlayer, packets.PitStatusPitting)
		if n := spoken(t, r.b, "teammate_doublestack"); n != 0 {
			t.Fatalf("double-stack calls on a drive-through = %d, want none", n)
		}
	})
}

func TestUndercut_Silent(t *testing.T) {
	tests := []struct {
		name  string
		setup func(r *rivalRace)
	}{
		{"the teammate", func(r *rivalRace) { r.e.teammateCarIndex = rrBehind }},
		{"in for a drive-through", func(r *rivalRace) { r.lap.LapData[rrBehind].NumUnservedDriveThroughPens = 1 }},
		{"in for a stop-go", func(r *rivalRace) { r.lap.LapData[rrBehind].NumUnservedStopGoPens = 1 }},
		{"too far back", func(r *rivalRace) { r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 3000 }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRivalRace(t)
			tt.setup(r)
			r.send()
			r.stop(rrBehind)
			if n := spoken(t, r.b, "undercut_window"); n != 0 {
				t.Fatalf("undercut calls = %d, want none", n)
			}
		})
	}
}

func TestFlagsRule_PenaltiesInThePitLaneAndUnderTheSafetyCar(t *testing.T) {
	t.Run("pit lane", func(t *testing.T) {
		r := newRivalRace(t)
		r.pit(rrPlayer, packets.PitStatusPitting)
		r.lap.LapData[rrPlayer].Penalties = 5 // speeding in the pit lane
		r.send()
		if n := spoken(t, r.b, "penalties_incurred"); n != 1 {
			t.Fatalf("pit lane penalty calls = %d, want 1", n)
		}
	})
	t.Run("Safety Car", func(t *testing.T) {
		r := newRivalRace(t)
		r.session.SafetyCarStatus = packets.SafetyCarFull
		r.sendSession()
		r.lap.LapData[rrPlayer].Penalties = 5
		r.send()
		if n := spoken(t, r.b, "penalties_incurred"); n != 1 {
			t.Fatalf("penalty calls under the Safety Car = %d, want 1", n)
		}
	})
}

func TestFlagsRule_JoiningMidSessionIsSilent(t *testing.T) {
	ctx := context.Background()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	newTestClock().install(e)
	h := createTestHeader(packets.PacketFormat2025, 5150, 0)
	session := func(redFlags uint8) *packets.PacketSessionData {
		return &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, TotalLaps: 30,
			NumRedFlagPeriods: redFlags, Weather: packets.WeatherLightRain}
	}
	e.ProcessPacket(ctx, session(1))
	e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{{
		CurrentLapNum: 12, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive,
		Penalties: 5, NumUnservedDriveThroughPens: 1, CornerCuttingWarnings: 3,
	}}})
	for _, key := range []string{"red_flag", "flags_rain_live", "penalties_incurred", "penalty_drive_through", "track_limits_warnings"} {
		if n := spoken(t, b, key); n != 0 {
			t.Errorf("%s said %d times on joining, want none", key, n)
		}
	}
	e.ProcessPacket(ctx, session(2))
	if n := spoken(t, b, "red_flag"); n != 1 {
		t.Fatalf("a new red flag said %d times, want 1", n)
	}
}

// startEngine is a race at lights out, with lap(d) sending the player's lap data d metres into lap 1.
func startEngine(t *testing.T) (e *EngineerEngine, b *mockBroadcaster, clock *testClock, h packets.PacketHeader, lap func(d float32)) {
	t.Helper()
	b = &mockBroadcaster{}
	e = newTestEngineerEngine(b)
	clock = newTestClock()
	clock.install(e)
	h = createTestHeader(packets.PacketFormat2025, 6060, 0)
	e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, TotalLaps: 20})
	lap = func(d float32) {
		e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{{
			CurrentLapNum: 1, CarPosition: 5, LapDistance: d, TotalDistance: d,
			DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive,
		}}})
	}
	return e, b, clock, h, lap
}

func event(h packets.PacketHeader, code string, data ...uint8) *packets.PacketEventData {
	p := &packets.PacketEventData{Header: h}
	copy(p.EventStringCode[:], code)
	copy(p.EventDetails.Data[:], data)
	return p
}

func wingDamage(h packets.PacketHeader, pct uint8) *packets.PacketCarDamageData {
	return &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{FrontLeftWingDamage: pct}}}
}

func TestEngineerEngine_ConditionsOutlastRadioSilence(t *testing.T) {
	ctx := context.Background()

	t.Run("wing damage at the start is said once it is over", func(t *testing.T) {
		e, b, clock, h, lap := startEngine(t)
		e.ProcessPacket(ctx, event(h, packets.EventLightsOut))
		lap(300)
		if e.currentPhase != PhaseRaceStart {
			t.Fatalf("phase = %v, want %v", e.currentPhase, PhaseRaceStart)
		}
		e.ProcessPacket(ctx, wingDamage(h, 25))
		e.ProcessPacket(ctx, event(h, packets.EventRetirement, 3)) // no condition of the car
		clock.advance(5 * time.Second)
		lap(700)
		if n := spoken(t, b, "wing_damage"); n != 0 {
			t.Fatalf("wing damage said %d times during the start, want it kept for after", n)
		}
		clock.advance(5 * time.Second)
		lap(RaceStartPhaseDistanceM + 100)
		if n := spoken(t, b, "wing_damage"); n != 1 {
			t.Fatalf("wing damage said %d times after the start, want 1", n)
		}
		if n := spoken(t, b, "car_retirement"); n != 0 {
			t.Fatalf("a retirement during the start said %d times after it, want none", n)
		}
	})

	t.Run("its useful life counts from the end of the silence", func(t *testing.T) {
		e, b, clock, h, lap := startEngine(t)
		e.ProcessPacket(ctx, event(h, packets.EventStartLights))
		lap(0)
		e.ProcessPacket(ctx, wingDamage(h, 25))
		for range 12 { // two minutes on the grid
			clock.advance(10 * time.Second)
			lap(0)
		}
		e.ProcessPacket(ctx, event(h, packets.EventLightsOut))
		e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: 0.9, Speed: 120}}})
		for range 3 { // 30 s of braking once the start is over
			clock.advance(10 * time.Second)
			lap(RaceStartPhaseDistanceM + 100)
		}
		if n := spoken(t, b, "wing_damage"); n != 0 {
			t.Fatalf("wing damage said %d times while braking", n)
		}
		e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250}}})
		if n := spoken(t, b, "wing_damage"); n != 1 {
			t.Fatalf("wing damage said %d times off the brakes, want 1", n)
		}
	})

	t.Run("but not for ever", func(t *testing.T) {
		e, b, clock, h, lap := startEngine(t)
		e.ProcessPacket(ctx, event(h, packets.EventStartLights))
		lap(0)
		e.ProcessPacket(ctx, wingDamage(h, 25))
		for range 24 { // four minutes on the grid
			clock.advance(10 * time.Second)
			lap(0)
		}
		e.ProcessPacket(ctx, event(h, packets.EventLightsOut))
		lap(RaceStartPhaseDistanceM + 100)
		if n := spoken(t, b, "wing_damage"); n != 0 {
			t.Fatalf("wing damage said %d times after %v of silence, want none", n, 4*time.Minute)
		}
	})
}

func TestEngineerEngine_SprintFromTheWeekend(t *testing.T) {
	weekend := func(sessions ...uint8) (n uint8, structure [packets.MaxSessionsInWeekend]uint8) {
		copy(structure[:], sessions)
		return uint8(len(sessions)), structure
	}
	sprintWeekend := []uint8{packets.SessionP1, packets.SessionSprintQ1, packets.SessionSprintQ2, packets.SessionSprintQ3,
		packets.SessionRace, packets.SessionQ1, packets.SessionQ2, packets.SessionQ3, packets.SessionRace2}
	tests := []struct {
		name        string
		sessionType uint8
		weekend     []uint8
		want        string
	}{
		{"the sprint of a sprint weekend", packets.SessionRace, sprintWeekend, "race_finish"},
		{"the Grand Prix after it", packets.SessionRace2, sprintWeekend, "race_finish_points"},
		{"a Grand Prix weekend", packets.SessionRace, []uint8{packets.SessionP1, packets.SessionQ1, packets.SessionRace}, "race_finish_points"},
		{"two races of one type", packets.SessionRace, []uint8{packets.SessionRace, packets.SessionQ1, packets.SessionRace}, "race_finish_points"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &mockBroadcaster{}
			e := newTestEngineerEngine(b)
			h := createTestHeader(packets.PacketFormat2025, 881, 0)
			s := &packets.PacketSessionData{Header: h, SessionType: tt.sessionType, TrackLength: 5000}
			s.NumSessionsInWeekend, s.WeekendStructure = weekend(tt.weekend...)
			e.ProcessPacket(context.Background(), s)
			e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 20, CarPosition: 9, ResultStatus: packets.ResultStatusFinished, DriverStatus: packets.DriverStatusOnTrack},
			}})
			if n := spoken(t, b, tt.want); n != 1 {
				t.Fatalf("%s said %d times for P9, want 1", tt.want, n)
			}
		})
	}
}

func TestEngineerEngine_FinishWithATimePenaltyWaitsForTheClassification(t *testing.T) {
	ctx := context.Background()
	setup := func(t *testing.T, penalties uint8) (*EngineerEngine, *mockBroadcaster, *testClock, func()) {
		b := &mockBroadcaster{}
		e := newTestEngineerEngine(b)
		clock := newTestClock()
		clock.install(e)
		h := createTestHeader(packets.PacketFormat2025, 882, 0)
		e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000})
		finish := func() {
			e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 20, CarPosition: 5, Penalties: penalties, ResultStatus: packets.ResultStatusFinished, DriverStatus: packets.DriverStatusOnTrack},
			}})
		}
		finish()
		return e, b, clock, finish
	}
	finishes := func(t *testing.T, b *mockBroadcaster) []EngineerDirective {
		t.Helper()
		return append(spokenCalls(t, b, "race_finish"), spokenCalls(t, b, "race_finish_points")...)
	}

	t.Run("no penalty: said at the flag", func(t *testing.T) {
		_, b, _, _ := setup(t, 0)
		if calls := finishes(t, b); len(calls) != 1 || calls[0].Values.Position != 5 {
			t.Fatalf("finish calls = %+v, want P5 at once", calls)
		}
	})
	t.Run("the classification's place", func(t *testing.T) {
		e, b, _, _ := setup(t, 5)
		if calls := finishes(t, b); len(calls) != 0 {
			t.Fatalf("finish said before the classification: %+v", calls)
		}
		c := &packets.PacketFinalClassificationData{Header: createTestHeader(packets.PacketFormat2025, 882, 0), NumCars: 20}
		c.ClassificationData[0].Position = 7
		e.ProcessPacket(ctx, c)
		if calls := finishes(t, b); len(calls) != 1 || calls[0].Values.Position != 7 {
			t.Fatalf("finish calls = %+v, want P7 from the classification", calls)
		}
	})
	t.Run("no classification: the track position in the end", func(t *testing.T) {
		_, b, clock, finish := setup(t, 5)
		clock.advance(FinishClassificationWaitMs * time.Millisecond)
		finish()
		if calls := finishes(t, b); len(calls) != 1 || calls[0].Values.Position != 5 {
			t.Fatalf("finish calls = %+v, want P5 after the wait", calls)
		}
	})
}

func TestFinalLap_Lapped(t *testing.T) {
	tests := []struct {
		name    string
		lapDist float32
		flag    bool
		want    int
	}{
		{"once the leader takes the flag", 2000, true, 1},
		{"not before", 2000, false, 0},
		{"not with the line near", 4500, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRivalRace(t)
			r.toLap(19, tt.lapDist)
			if tt.flag {
				r.e.ProcessPacket(context.Background(), event(r.h, packets.EventChequeredFlag))
			}
			r.send()
			if n := spoken(t, r.b, "race_final_lap"); n != tt.want {
				t.Fatalf("final lap calls a lap down = %d, want %d", n, tt.want)
			}
		})
	}
}

func TestEvaluationContext_Is2026FromTheCar(t *testing.T) {
	tele2 := func(regs uint8) *packets.PacketCarTelemetry2Data {
		p := &packets.PacketCarTelemetry2Data{}
		p.CarTelemetry2Data[0].Regulations2026 = regs
		return p
	}
	tests := []struct {
		name   string
		format uint16
		tele2  *packets.PacketCarTelemetry2Data
		want   bool
	}{
		{"F1 25", packets.PacketFormat2025, nil, false},
		{"2026 format, before the car's flag", packets.PacketFormat2026, nil, true},
		{"2026 car", packets.PacketFormat2026, tele2(1), true},
		{"older car in the 2026 format", packets.PacketFormat2026, tele2(0), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := battleCtx()
			ctx.PacketFormat, ctx.Telemetry2 = tt.format, tt.tele2
			if got := ctx.Is2026(); got != tt.want {
				t.Fatalf("Is2026() = %v, want %v", got, tt.want)
			}
			wantDefend := "rival_defend"
			if tt.want {
				wantDefend = "rival_defend_override"
			}
			if dirs := NewRivalsRule().Evaluate(ctx); directiveFor(dirs, wantDefend) == nil {
				t.Fatalf("expected %s, got %v", wantDefend, subAlerts(dirs))
			}

			drs := event(packets.PacketHeader{PacketFormat: tt.format}, packets.EventDRSEnabled)
			ctx.Header, ctx.Packet = drs.Header, drs
			if said := directiveFor(seededFlagsRule().Evaluate(ctx), "flags_drs_enabled") != nil; said == tt.want {
				t.Fatalf("DRS enabled said = %v on a car with 2026 rules = %v", said, tt.want)
			}

			status := &packets.PacketCarStatusData{}
			status.CarStatusData[0].ERSDeployedThisLap = 3_900_000
			status.CarStatusData[0].ERSStoreEnergy = 2_000_000
			ctx.Header, ctx.Packet, ctx.Status = packets.PacketHeader{PacketFormat: tt.format}, status, status
			if said := directiveFor(NewERSRule().Evaluate(ctx), "ers_clipping") != nil; said == tt.want {
				t.Fatalf("4 MJ clipping said = %v on a car with 2026 rules = %v", said, tt.want)
			}
		})
	}
}

func TestCollisionDirective_Severity(t *testing.T) {
	tests := []struct {
		name     string
		format   uint16
		severity uint8
		want     string
		urgency  string
	}{
		{"F1 25 has no severity", packets.PacketFormat2025, packets.CollisionSeverityLow, "car_collision", UrgencyCritical},
		{"light", packets.PacketFormat2026, packets.CollisionSeverityLow, "car_collision_light", UrgencyHigh},
		{"medium", packets.PacketFormat2026, packets.CollisionSeverityMedium, "car_collision", UrgencyCritical},
		{"heavy", packets.PacketFormat2026, packets.CollisionSeverityHigh, "car_collision_heavy", UrgencyCritical},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := collisionDirective(packets.CollisionEventData{Vehicle1Idx: 0, Vehicle2Idx: 4, Severity: tt.severity}, tt.format)
			if d.ID != "car_collision" || d.SubAlert != tt.want || d.Urgency != tt.urgency {
				t.Fatalf("collision = %s %s (%s), want car_collision %s (%s)", d.ID, d.SubAlert, d.Urgency, tt.want, tt.urgency)
			}
		})
	}
}

func TestEngineerEngine_CollisionAtTheStartIsSaid(t *testing.T) {
	e, b, _, h, lap := startEngine(t)
	e.ProcessPacket(context.Background(), event(h, packets.EventLightsOut))
	lap(300)
	e.ProcessPacket(context.Background(), event(h, packets.EventCollision, 0, 4))
	if n := spoken(t, b, "car_collision"); n != 1 {
		t.Fatalf("contact at the start said %d times, want 1", n)
	}
}

func TestTeammateRule_PittingOncePerStop(t *testing.T) {
	ctx := battleCtx()
	ctx.TeammateCarIndex = 1
	rule := NewTeammateRule()
	calls := 0
	step := func(playerLap uint8, teammatePit uint8) {
		ctx.LapData.LapData[0].CurrentLapNum = playerLap
		ctx.LapData.LapData[1].PitStatus = teammatePit
		calls += len(subAlertsOf(rule.Evaluate(ctx), "teammate_pitting"))
	}
	step(8, packets.PitStatusPitting)
	step(9, packets.PitStatusInPitArea) // the player crosses the line meanwhile
	step(9, packets.PitStatusPitting)   // the teammate on the way out
	step(9, packets.PitStatusNone)
	if calls != 1 {
		t.Fatalf("teammate pitting calls for one stop = %d, want 1", calls)
	}
	step(14, packets.PitStatusPitting) // the next stop
	if calls != 2 {
		t.Fatalf("teammate pitting calls after a second stop = %d, want 2", calls)
	}
}

func subAlertsOf(dirs []Directive, subAlert string) []Directive {
	var out []Directive
	for _, d := range dirs {
		if d.SubAlert == subAlert {
			out = append(out, d)
		}
	}
	return out
}
