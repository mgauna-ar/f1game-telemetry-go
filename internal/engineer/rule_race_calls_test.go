package engineer

import (
	"context"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestEngineerEngine_RaceFinishSaysTheResult(t *testing.T) {
	tests := []struct {
		name        string
		sessionType uint8
		pos         uint8
		want        string // "" for no call
	}{
		{"win", packets.SessionRace, 1, "race_finish_win"},
		{"podium", packets.SessionRace, 3, "race_finish_podium"},
		{"points", packets.SessionRace, 9, "race_finish_points"},
		{"outside the points", packets.SessionRace, 15, "race_finish"},
		{"ninth in a sprint scores nothing", packets.SessionSprintRace, 9, "race_finish"},
		{"eighth in a sprint scores", packets.SessionSprintRace, 8, "race_finish_points"},
		{"the end of qualifying is no race finish", packets.SessionQ3, 4, ""},
		{"nor the end of practice", packets.SessionP1, 4, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &mockBroadcaster{}
			e := newTestEngineerEngine(b)
			h := createTestHeader(packets.PacketFormat2025, 880, 0)
			e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: h, SessionType: tt.sessionType, TrackLength: qualyTrackLen})
			e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 20, CarPosition: tt.pos, ResultStatus: packets.ResultStatusFinished, DriverStatus: packets.DriverStatusOnTrack},
			}})
			for _, key := range []string{"race_finish_win", "race_finish_podium", "race_finish_points", "race_finish"} {
				want := 0
				if key == tt.want {
					want = 1
				}
				if got := spoken(t, b, key); got != want {
					t.Errorf("%s said %d times, want %d", key, got, want)
				}
			}
		})
	}
}

func TestFlagsRule_FastestLapOnlyThePlayers(t *testing.T) {
	event := func(vehicle uint8) *packets.PacketEventData {
		p := &packets.PacketEventData{EventStringCode: [4]uint8{'F', 'T', 'L', 'P'}}
		p.EventDetails.Data[0] = vehicle
		return p
	}
	for _, tt := range []struct {
		vehicle uint8
		want    bool
	}{{0, true}, {4, false}} {
		ctx := &EvaluationContext{Packet: event(tt.vehicle), Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		if got := directiveFor(NewFlagsRule().Evaluate(ctx), "race_fastest_lap") != nil; got != tt.want {
			t.Errorf("fastest lap by car %d: call = %v, want %v", tt.vehicle, got, tt.want)
		}
	}
}

func TestFlagsRule_Penalties(t *testing.T) {
	rule := NewFlagsRule()
	step := func(timeSec, driveThroughs, stopGos uint8) *Directive {
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{Penalties: timeSec, NumUnservedDriveThroughPens: driveThroughs, NumUnservedStopGoPens: stopGos}
		ctx := &EvaluationContext{Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "penalties" {
				return &d
			}
		}
		return nil
	}
	expect := func(d *Directive, subAlert string, seconds int) {
		t.Helper()
		if d == nil || d.SubAlert != subAlert {
			t.Fatalf("expected %s, got %+v", subAlert, d)
		}
		got := 0
		if d.Values != nil {
			got = d.Values.PenaltySec
		}
		if got != seconds {
			t.Fatalf("penalty seconds = %d, want %d", got, seconds)
		}
	}

	expect(step(5, 0, 0), "penalties_incurred", 5)
	if d := step(5, 0, 0); d != nil {
		t.Fatalf("the same penalty was called again: %+v", d)
	}
	expect(step(10, 0, 0), "penalties_incurred", 5) // a second one: its own five seconds
	if d := step(0, 0, 0); d != nil {               // served at the stop
		t.Fatalf("serving a penalty is no new one: %+v", d)
	}
	expect(step(5, 0, 0), "penalties_incurred", 5) // a new one after the stop is still called
	expect(step(5, 1, 0), "penalty_drive_through", 0)
	expect(step(5, 1, 1), "penalty_stop_go", 0)
}

func TestFlagsRule_TrackLimitsSaysTheCount(t *testing.T) {
	lapPkt := &packets.PacketLapData{}
	lapPkt.LapData[0] = packets.LapData{CornerCuttingWarnings: 3}
	ctx := &EvaluationContext{Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
		Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
	d := directiveFor(NewFlagsRule().Evaluate(ctx), "track_limits_warnings")
	if d == nil || d.Values == nil || d.Values.Count != 3 {
		t.Fatalf("expected 3 warnings in the values, got %+v", d)
	}
}

func TestRivalsRule_DRSOnlyWhenAvailable(t *testing.T) {
	rivalsCtx := func(rivalDRS, playerDRS uint8) *EvaluationContext {
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{CarPosition: 5, CurrentLapNum: 8, DeltaToCarInFrontMSPart: 700}
		lapPkt.LapData[1] = packets.LapData{CarPosition: 6, CurrentLapNum: 8, DeltaToCarInFrontMSPart: 600}
		lapPkt.LapData[2] = packets.LapData{CarPosition: 4, CurrentLapNum: 8}
		status := &packets.PacketCarStatusData{}
		status.CarStatusData[0].DRSAllowed = playerDRS
		status.CarStatusData[1].DRSAllowed = rivalDRS
		return &EvaluationContext{
			Packet: lapPkt, LapData: lapPkt, Status: status, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			PacketFormat: packets.PacketFormat2025,
			Session:      &packets.PacketSessionData{SessionType: packets.SessionRace},
		}
	}
	tests := []struct {
		name                 string
		rivalDRS, playerDRS  uint8
		wantDefend, wantAtck string
	}{
		{"no DRS yet", 0, 0, "rival_defend", "rival_attack"},
		{"both have DRS", 1, 1, "rival_defend_drs", "rival_attack_drs"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dirs := NewRivalsRule().Evaluate(rivalsCtx(tt.rivalDRS, tt.playerDRS))
			defend, attack := directiveFor(dirs, tt.wantDefend), directiveFor(dirs, tt.wantAtck)
			if defend == nil || defend.ID != "rival_defend" || defend.Values.Behind.GapSec != 0.6 {
				t.Errorf("expected %s with the 0.6 s gap behind, got %v", tt.wantDefend, subAlerts(dirs))
			}
			if attack == nil || attack.ID != "rival_attack" || attack.Values.Ahead.GapSec != 0.7 {
				t.Errorf("expected %s with the 0.7 s gap ahead, got %v", tt.wantAtck, subAlerts(dirs))
			}
		})
	}
}

func TestTyresRule_WearWarningThenCritical(t *testing.T) {
	rule := NewTyresRule()
	wear := func(pct float32) []Directive {
		dmg := &packets.PacketCarDamageData{}
		dmg.CarDamageData[0].TyresWear = [4]float32{pct, pct, pct, pct}
		return rule.Evaluate(&EvaluationContext{Packet: dmg, Damage: dmg, Config: DefaultEngineerConfig(), Phase: PhaseRacing})
	}
	if d := directiveFor(wear(45), "tyre_wear"); d == nil || d.Urgency != UrgencyLow {
		t.Fatalf("expected the wear warning at 45%%, got %+v", d)
	}
	if d := directiveFor(wear(78), "tyre_wear_critical"); d == nil || d.Urgency != UrgencyHigh {
		t.Fatalf("expected the critical wear call at 78%%, got %+v", d)
	}
}

// Car indexes of rivalRace.
const (
	rrPlayer = 0
	rrAhead  = 1
	rrBehind = 2
)

// rivalRace is a 20-lap race on a 5 km track on lap 10, with the player in P5, 1.5 s behind the
// car ahead (P4) and 100 m ahead of the car behind (P6), all on track.
type rivalRace struct {
	t       *testing.T
	e       *EngineerEngine
	b       *mockBroadcaster
	clock   *testClock
	h       packets.PacketHeader
	session packets.PacketSessionData
	lap     packets.PacketLapData
}

func newRivalRace(t *testing.T) *rivalRace {
	t.Helper()
	e, b, clock, h := raceEngine(t)
	r := &rivalRace{t: t, e: e, b: b, clock: clock, h: h,
		session: packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, TotalLaps: 20},
		lap:     packets.PacketLapData{Header: h},
	}
	for i, pos := range map[int]uint8{rrPlayer: 5, rrAhead: 4, rrBehind: 6} {
		r.lap.LapData[i] = packets.LapData{CurrentLapNum: 10, CarPosition: pos, LapDistance: 1200,
			DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive}
	}
	r.lap.LapData[rrPlayer].TotalDistance = 46_200
	r.lap.LapData[rrAhead].TotalDistance = 46_300
	r.lap.LapData[rrBehind].TotalDistance = 46_100
	r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 1500
	r.sendSession()
	r.send()
	return r
}

func (r *rivalRace) sendSession() {
	s := r.session
	r.e.ProcessPacket(context.Background(), &s)
}

// send sends the lap data a second after the last.
func (r *rivalRace) send() {
	r.clock.advance(time.Second)
	p := r.lap
	r.e.ProcessPacket(context.Background(), &p)
}

// pit sets car's pit status and sends the lap data.
func (r *rivalRace) pit(car int, status uint8) {
	r.lap.LapData[car].PitStatus = status
	r.send()
}

// stop drives car through a pit stop.
func (r *rivalRace) stop(car int) {
	r.pit(car, packets.PitStatusPitting)
	r.pit(car, packets.PitStatusInPitArea)
	r.pit(car, packets.PitStatusPitting)
	r.pit(car, packets.PitStatusNone)
}

// toLap moves every car to lap n, at lapDistance into it, a lap's time later.
func (r *rivalRace) toLap(n uint8, lapDistance float32) {
	r.clock.advance(planLapTime)
	for i := range r.lap.LapData {
		r.lap.LapData[i].CurrentLapNum, r.lap.LapData[i].LapDistance = n, lapDistance
	}
	r.send()
}

func TestOvercut_CarAheadPitsOncePerStop(t *testing.T) {
	r := newRivalRace(t)
	r.stop(rrAhead)
	calls := spokenCalls(t, r.b, "overcut_window")
	if len(calls) != 1 {
		t.Fatalf("overcut calls after one stop = %d, want 1", len(calls))
	}
	if v := calls[0].Values; v == nil || v.Ahead == nil || v.Ahead.GapSec != 1.5 {
		t.Fatalf("overcut values = %+v, want the car ahead 1.5 s up the road", calls[0].Values)
	}

	r.toLap(14, 1200)
	r.stop(rrAhead)
	if n := spoken(t, r.b, "overcut_window"); n != 2 {
		t.Fatalf("overcut calls after its second stop = %d, want 2", n)
	}
}

func TestOvercut_Silent(t *testing.T) {
	tests := []struct {
		name  string
		setup func(r *rivalRace)
	}{
		{"too far ahead", func(r *rivalRace) { r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 3000 }},
		{"no gap known", func(r *rivalRace) { r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 0 }},
		{"the teammate", func(r *rivalRace) { r.e.teammateCarIndex = rrAhead }},
		{"under the Safety Car", func(r *rivalRace) {
			r.session.SafetyCarStatus = packets.SafetyCarFull
			r.sendSession()
		}},
		{"under the VSC", func(r *rivalRace) {
			r.session.SafetyCarStatus = packets.SafetyCarVirtual
			r.sendSession()
		}},
		{"the player in the pit lane too", func(r *rivalRace) { r.lap.LapData[rrPlayer].PitStatus = packets.PitStatusPitting }},
		{"the player told to box", func(r *rivalRace) { r.e.boxDueLap = 10 }},
		{"in qualifying", func(r *rivalRace) {
			r.session.SessionType = packets.SessionQ1
			r.sendSession()
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRivalRace(t)
			tt.setup(r)
			r.send()
			r.stop(rrAhead)
			if n := spoken(t, r.b, "overcut_window"); n != 0 {
				t.Fatalf("overcut calls = %d, want none", n)
			}
		})
	}

	t.Run("the car behind pitting is the undercut", func(t *testing.T) {
		r := newRivalRace(t)
		r.stop(rrBehind)
		if spoken(t, r.b, "overcut_window") != 0 || spoken(t, r.b, "undercut_window") != 1 {
			t.Fatalf("overcut %d, undercut %d: want only the undercut",
				spoken(t, r.b, "overcut_window"), spoken(t, r.b, "undercut_window"))
		}
	})
}

// The undercut is called for every stop of the car behind, not once a stint.
func TestUndercut_OncePerStop(t *testing.T) {
	r := newRivalRace(t)
	r.stop(rrBehind)
	if n := spoken(t, r.b, "undercut_window"); n != 1 {
		t.Fatalf("undercut calls after one stop = %d, want 1", n)
	}
	r.toLap(14, 1200)
	r.stop(rrBehind)
	if n := spoken(t, r.b, "undercut_window"); n != 2 {
		t.Fatalf("undercut calls after its second stop = %d, want 2", n)
	}
}

func TestFinalLap(t *testing.T) {
	tests := []struct {
		name     string
		setup    func(r *rivalRace)
		lap      uint8
		lapDist  float32
		want     string // sub_alert said (empty: none)
		position int
	}{
		{"last lap", nil, 20, 300, "race_final_lap", 5},
		{"last lap in the lead", func(r *rivalRace) {
			r.lap.LapData[rrPlayer].CarPosition, r.lap.LapData[rrAhead].CarPosition = 1, 2
		}, 20, 300, "race_final_lap_lead", 1},
		{"under the Safety Car", func(r *rivalRace) {
			r.session.SafetyCarStatus = packets.SafetyCarFull
			r.sendSession()
		}, 20, 300, "race_final_lap", 5},
		{"the lap before", nil, 19, 300, "", 0},
		{"halfway round the last lap", nil, 20, 2600, "", 0},
		{"in the pit lane", func(r *rivalRace) { r.lap.LapData[rrPlayer].PitStatus = packets.PitStatusPitting }, 20, 300, "", 0},
		{"a one-lap race", func(r *rivalRace) {
			r.session.TotalLaps = 1
			r.sendSession()
		}, 1, 300, "", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRivalRace(t)
			if tt.setup != nil {
				tt.setup(r)
			}
			r.toLap(tt.lap, tt.lapDist)
			r.lap.LapData[rrPlayer].LapDistance += 100
			r.send()
			said := len(spokenCalls(t, r.b, "race_final_lap")) + len(spokenCalls(t, r.b, "race_final_lap_lead"))
			if tt.want == "" {
				if said != 0 {
					t.Fatalf("final lap calls = %d, want none", said)
				}
				return
			}
			calls := spokenCalls(t, r.b, tt.want)
			if said != 1 || len(calls) != 1 {
				t.Fatalf("final lap calls = %d (%s: %d), want one %s", said, tt.want, len(calls), tt.want)
			}
			if v := calls[0].Values; v == nil || v.Position != tt.position {
				t.Fatalf("final lap values = %+v, want position %d", calls[0].Values, tt.position)
			}
		})
	}

	t.Run("a flashback to the lap before says it again", func(t *testing.T) {
		r := newRivalRace(t)
		r.toLap(20, 300)
		r.toLap(19, 4000)
		r.toLap(20, 300)
		if n := spoken(t, r.b, "race_final_lap"); n != 2 {
			t.Fatalf("final lap calls = %d, want 2", n)
		}
	})
}
