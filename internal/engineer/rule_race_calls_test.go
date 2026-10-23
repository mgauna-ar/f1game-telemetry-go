package engineer

import (
	"context"
	"strings"
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
	rule := seededFlagsRule()
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
	d := directiveFor(seededFlagsRule().Evaluate(ctx), "track_limits_warnings")
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
		for i := range 3 {
			lapPkt.LapData[i].ResultStatus, lapPkt.LapData[i].DriverStatus = packets.ResultStatusActive, packets.DriverStatusOnTrack
		}
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
		{"no timing, too far on track", func(r *rivalRace) {
			r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 0
			r.lap.LapData[rrAhead].TotalDistance = 46_600 // 400 m: 6 s at 65 m/s
		}},
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

// The defend call is urgent: said at once under braking, right after an attack call, and for a
// new car right behind a few seconds after the last.
func TestRivalsRule_DefendSaidAtOnce(t *testing.T) {
	t.Run("under braking", func(t *testing.T) {
		r := newRivalRace(t)
		r.e.ProcessPacket(context.Background(), &packets.PacketCarTelemetryData{Header: r.h,
			CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: 0.9, Speed: 120}}})
		r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 800
		r.send()
		calls := spokenCalls(t, r.b, "rival_defend")
		if len(calls) != 1 || calls[0].Urgency != UrgencyHigh {
			t.Fatalf("defend calls under braking = %+v, want one, urgent", calls)
		}
	})
	t.Run("right after an attack call", func(t *testing.T) {
		r := newRivalRace(t)
		r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 1000
		r.send()
		if n := spoken(t, r.b, "rival_attack"); n != 1 {
			t.Fatalf("attack calls = %d, want 1", n)
		}
		r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 800
		r.send()
		if n := spoken(t, r.b, "rival_defend"); n != 1 {
			t.Fatalf("defend calls a second after the attack call = %d, want 1", n)
		}
	})
	t.Run("a new car right behind 4 s after the last", func(t *testing.T) {
		r := newRivalRace(t)
		r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 800
		r.send()
		// The car behind goes by the next car, which comes within a second.
		r.clock.advance(3 * time.Second)
		r.lap.LapData[rrBehind].CarPosition = 7
		r.lap.LapData[3] = packets.LapData{CurrentLapNum: 10, CarPosition: 6, LapDistance: 1200, TotalDistance: 46_150,
			DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive, DeltaToCarInFrontMSPart: 700}
		r.send()
		if n := spoken(t, r.b, "rival_defend"); n != 2 {
			t.Fatalf("defend calls = %d, want 2: one per car", n)
		}
	})
}

// A stop under a VSC says the stop time, and no "limiter off, push now": not at the pit exit
// line, nor when the VSC ends with the limiter turned off past the line; the green flag is said
// on the out-lap. A green-flag stop is unchanged.
func TestEngineerEngine_NoPushAfterAStopUnderTheVSC(t *testing.T) {
	ctx := context.Background()
	limiter := func(r *planRace, on uint8) {
		r.e.ProcessPacket(ctx, &packets.PacketCarStatusData{Header: r.h, CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{TyresAgeLaps: 10, PitLimiterStatus: on}, // the new set shows later: the stop count starts the stint
		}})
	}
	// The stop count goes up as the car leaves its box (from lap 10 here), which starts a new stint on
	// that packet: the stop is still timed.
	lap := func(r *planRace, lapNum uint8, dist float32, driver, pit uint8, timerMs uint16) {
		r.clock.advance(time.Second)
		stops := uint8(0)
		if lapNum == 10 {
			stops = 1
		}
		r.e.ProcessPacket(ctx, &packets.PacketLapData{Header: r.h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: lapNum, CarPosition: 5, LapDistance: dist, DriverStatus: driver, PitStatus: pit, PitStopTimerInMS: timerMs,
				NumPitStops: stops},
		}})
	}
	tests := []struct {
		name           string
		sc             uint8
		offPastTheLine bool
		want           int
	}{
		{"green flag", packets.SafetyCarNone, false, 1},
		{"green flag, limiter off past the line", packets.SafetyCarNone, true, 1},
		{"VSC", packets.SafetyCarVirtual, false, 0},
		{"VSC, limiter off past the line", packets.SafetyCarVirtual, true, 0},
		{"Safety Car, limiter off past the line", packets.SafetyCarFull, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPlanRace(t, 0, 0)
			r.drive(9, 1000, packets.PitStatusNone)
			r.safetyCar(tt.sc)
			limiter(r, 1)
			lap(r, 9, 4850, packets.DriverStatusOnTrack, packets.PitStatusPitting, 0)
			lap(r, 9, 4900, packets.DriverStatusOnTrack, packets.PitStatusInPitArea, 2400)
			lap(r, 10, 50, packets.DriverStatusOnTrack, packets.PitStatusPitting, 2400)
			if !tt.offPastTheLine {
				limiter(r, 0)
			}
			lap(r, 10, 300, packets.DriverStatusOutLap, packets.PitStatusNone, 0)
			limiter(r, 0)
			r.clock.advance(20 * time.Second)
			r.safetyCar(packets.SafetyCarNone)
			lap(r, 10, 1500, packets.DriverStatusOutLap, packets.PitStatusNone, 0)
			limiter(r, 0)

			if n := spoken(t, r.b, "pit_stop_fast"); n != 1 {
				t.Errorf("stop time said %d times, want once", n)
			}
			if n := spoken(t, r.b, "pit_limiter_exit"); n != tt.want {
				t.Errorf("pit_limiter_exit said %d times, want %d", n, tt.want)
			}
			// The restart finds the player on their out-lap: green is still said.
			wantGreen := 0
			if tt.sc != packets.SafetyCarNone {
				wantGreen = 1
			}
			if n := spoken(t, r.b, "flags_green"); n != wantGreen {
				t.Errorf("flags_green said %d times, want %d", n, wantGreen)
			}
		})
	}
}

func TestPitStopDurationDirective_NeverSaysToPush(t *testing.T) {
	for _, sec := range []float32{2.2, 3.2, 5.5} {
		msg := strings.ToLower(pitStopDurationDirective(sec).Message)
		if strings.Contains(msg, "push") || strings.Contains(msg, "make up") {
			t.Errorf("%.1f s stop: %q says to push", sec, msg)
		}
	}
}

// The end of a Safety Car comes twice: the session status and the "Resume Race" event. Green is
// said once, whichever comes first, however far apart, and again for the next Safety Car.
func TestEngineerEngine_GreenFlagOncePerSafetyCar(t *testing.T) {
	resume := func(r *planRace) {
		var payload [12]byte
		payload[0], payload[1] = packets.SafetyCarFull, packets.SafetyCarEventResumeRace
		r.e.ProcessPacket(context.Background(), &packets.PacketEventData{
			Header: r.h, EventStringCode: [4]uint8{'S', 'C', 'A', 'R'}, EventDetails: packets.EventDataDetails{Data: payload},
		})
	}
	for _, statusFirst := range []bool{true, false} {
		t.Run(map[bool]string{true: "status first", false: "event first"}[statusFirst], func(t *testing.T) {
			r := newPlanRace(t, 0, 0)
			r.drive(12, 1000, packets.PitStatusNone)
			for period := 1; period <= 2; period++ {
				r.safetyCar(packets.SafetyCarFull)
				r.clock.advance(30 * time.Second)
				r.drive(12, 1500, packets.PitStatusNone)
				if statusFirst {
					r.safetyCar(packets.SafetyCarNone)
					r.clock.advance(15 * time.Second)
					r.drive(12, 1600, packets.PitStatusNone)
					resume(r)
				} else {
					resume(r)
					r.clock.advance(15 * time.Second)
					r.drive(12, 1600, packets.PitStatusNone)
					r.safetyCar(packets.SafetyCarNone)
				}
				r.clock.advance(15 * time.Second)
				r.drive(12, 2000, packets.PitStatusNone)
				if n := spoken(t, r.b, "flags_green"); n != period {
					t.Fatalf("after Safety Car %d green said %d times, want %d", period, n, period)
				}
			}
		})
	}
}

// A retirement is called when it may leave a car or debris out on track.
func TestFlagsRule_RetirementByReason(t *testing.T) {
	tests := []struct {
		name   string
		reason uint8
		pit    uint8
		driver uint8
		want   bool
	}{
		{"no reason given", packets.ResultReasonInvalid, packets.PitStatusNone, packets.DriverStatusOnTrack, true},
		{"retired", packets.ResultReasonRetired, packets.PitStatusNone, packets.DriverStatusOnTrack, true},
		{"terminal damage", packets.ResultReasonTerminalDamage, packets.PitStatusNone, packets.DriverStatusOnTrack, true},
		{"mechanical failure", packets.ResultReasonMechanicalFailure, packets.PitStatusNone, packets.DriverStatusOnTrack, true},
		{"retired in the pit lane", packets.ResultReasonRetired, packets.PitStatusPitting, packets.DriverStatusOnTrack, false},
		{"retired in the garage", packets.ResultReasonRetired, packets.PitStatusNone, packets.DriverStatusInGarage, false},
		{"black flagged", packets.ResultReasonBlackFlagged, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"inactive", packets.ResultReasonInactive, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"not enough laps", packets.ResultReasonNotEnoughLaps, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"finished", packets.ResultReasonFinished, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"red flagged", packets.ResultReasonRedFlagged, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"session skipped", packets.ResultReasonSessionSkipped, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
		{"session simulated", packets.ResultReasonSessionSimulated, packets.PitStatusNone, packets.DriverStatusOnTrack, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lapPkt := &packets.PacketLapData{}
			lapPkt.LapData[3] = packets.LapData{PitStatus: tt.pit, DriverStatus: tt.driver}
			var details packets.EventDataDetails
			details.Data[0], details.Data[1] = 3, tt.reason
			ctx := &EvaluationContext{
				Packet:  &packets.PacketEventData{EventStringCode: [4]uint8{'R', 'T', 'M', 'T'}, EventDetails: details},
				LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing, TeammateCarIndex: -1,
				Session: &packets.PacketSessionData{SessionType: packets.SessionRace},
			}
			if got := directiveFor(seededFlagsRule().Evaluate(ctx), "car_retirement") != nil; got != tt.want {
				t.Errorf("retirement called %v, want %v", got, tt.want)
			}
		})
	}
}

// A flashback takes a track limits warning back: the next one is called again.
func TestFlagsRule_TrackLimitsAfterAFlashback(t *testing.T) {
	rule := seededFlagsRule()
	threshold := uint8(DefaultEngineerConfig().CornerCutWarnThreshold)
	for i, tt := range []struct {
		warnings uint8
		want     bool
	}{{threshold, true}, {threshold - 1, false}, {threshold, true}, {threshold + 1, true}} {
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{CornerCuttingWarnings: tt.warnings}
		ctx := &EvaluationContext{Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		if got := directiveFor(rule.Evaluate(ctx), "track_limits_warnings") != nil; got != tt.want {
			t.Errorf("step %d, %d warnings: called %v, want %v", i, tt.warnings, got, tt.want)
		}
	}
}

// An engine failure is a fault, not wear: it stays on with the engine wear switch off, as in the
// Immersive and Minimal presets.
func TestAlertGates_TerminalEngineIsAFault(t *testing.T) {
	sw := allSwitches(true)
	sw["subDamageEngine"] = false
	if !EnabledCategoriesFromSwitches(sw)["damage_terminal_engine"] {
		t.Error("damage_terminal_engine is off with the engine wear switch off")
	}
	sw = allSwitches(true)
	sw["subDamageFaults"] = false
	if EnabledCategoriesFromSwitches(sw)["damage_terminal_engine"] {
		t.Error("damage_terminal_engine stays on with the mechanical faults switch off")
	}
}
