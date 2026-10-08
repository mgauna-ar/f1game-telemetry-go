package engineer

import (
	"context"
	"encoding/json"
	"slices"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// planRace is a 30-lap race on a 5 km track whose pit entry, at 4800 m, is known (calls to box
// this lap must come before 4300 m), with the game's pit plan set and the tyres 10 laps old.
type planRace struct {
	t       *testing.T
	e       *EngineerEngine
	b       *mockBroadcaster
	clock   *testClock
	h       packets.PacketHeader
	session packets.PacketSessionData
	lap     uint8
}

func newPlanRace(t *testing.T, ideal, latest uint8) *planRace {
	t.Helper()
	e, b, clock, h := raceEngine(t)
	e.pitLanes.entrySamples[0] = []float32{4800}
	r := &planRace{t: t, e: e, b: b, clock: clock, h: h, session: packets.PacketSessionData{
		Header: h, SessionType: packets.SessionRace, TrackLength: 5000, TotalLaps: 30,
		PitStopWindowIdealLap: ideal, PitStopWindowLatestLap: latest, PitStopRejoinPosition: 9,
	}}
	r.sendSession()
	r.tyres(10)
	return r
}

func (r *planRace) sendSession() {
	s := r.session
	r.e.ProcessPacket(context.Background(), &s)
}

func (r *planRace) plan(ideal, latest uint8) {
	r.session.PitStopWindowIdealLap, r.session.PitStopWindowLatestLap = ideal, latest
	r.sendSession()
}

func (r *planRace) safetyCar(status uint8) {
	r.session.SafetyCarStatus = status
	r.sendSession()
}

func (r *planRace) tyres(age uint8) {
	r.e.ProcessPacket(context.Background(), &packets.PacketCarStatusData{Header: r.h, CarStatusData: [packets.MaxCars]packets.CarStatusData{
		{TyresAgeLaps: age},
	}})
}

// planLapTime is how long a lap of planRace takes.
const planLapTime = 80 * time.Second

func (r *planRace) drive(lap uint8, lapDistance float32, pitStatus uint8) {
	r.clock.advance(time.Second)
	if lap != r.lap {
		r.clock.advance(planLapTime)
		r.lap = lap
	}
	r.e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: r.h, LapData: [packets.MaxCars]packets.LapData{
		{CurrentLapNum: lap, CarPosition: 5, LapDistance: lapDistance, DriverStatus: packets.DriverStatusOnTrack, PitStatus: pitStatus},
	}})
}

// pitStop drives the player through a stop on lap.
func (r *planRace) pitStop(lap uint8) {
	r.drive(lap, 4850, packets.PitStatusPitting)
	r.drive(lap, 4900, packets.PitStatusInPitArea)
	r.drive(lap+1, 50, packets.PitStatusPitting)
	r.drive(lap+1, 300, packets.PitStatusNone)
}

// spokenCalls returns the broadcast directives with this sub_alert.
func spokenCalls(t *testing.T, b *mockBroadcaster, subAlert string) []EngineerDirective {
	t.Helper()
	b.mu.Lock()
	defer b.mu.Unlock()
	var calls []EngineerDirective
	for _, raw := range b.broadcasts {
		var d EngineerDirective
		if err := json.Unmarshal(raw, &d); err != nil {
			t.Fatalf("decode directive: %v", err)
		}
		if d.SubAlert == subAlert {
			calls = append(calls, d)
		}
	}
	return calls
}

func TestPitPlan_HeadsUpThenBoxThenTheReminder(t *testing.T) {
	r := newPlanRace(t, 12, 15)

	r.drive(11, 200, packets.PitStatusNone) // too early in the lap
	if n := spoken(t, r.b, "pit_plan_next_lap"); n != 0 {
		t.Fatalf("heads-up said %d times at 4%% of the lap, want none yet", n)
	}
	r.drive(11, 1000, packets.PitStatusNone)
	r.drive(11, 1500, packets.PitStatusNone)
	headsUp := spokenCalls(t, r.b, "pit_plan_next_lap")
	if len(headsUp) != 1 {
		t.Fatalf("heads-up said %d times, want once", len(headsUp))
	}
	if headsUp[0].Box != "" || headsUp[0].Values == nil || headsUp[0].Values.Position != 9 {
		t.Errorf("heads-up = box %q, values %+v; want no box timing and the rejoin position 9", headsUp[0].Box, headsUp[0].Values)
	}
	r.drive(11, 4500, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_entry_reminder"); n != 0 {
		t.Errorf("pit entry reminder on the heads-up lap, want none")
	}

	r.drive(12, 100, packets.PitStatusNone)
	box := spokenCalls(t, r.b, "pit_plan_box")
	if len(box) != 1 || box[0].Box != BoxThisLap || box[0].Values == nil || box[0].Values.Position != 9 {
		t.Fatalf("box calls = %+v, want one \"box this lap\" with the rejoin position 9", box)
	}
	r.clock.advance(PitEntryReminderMinGapMs * time.Millisecond)
	r.drive(12, 4400, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_entry_reminder"); n != 1 {
		t.Errorf("pit entry reminder said %d times, want once", n)
	}
	if n := spoken(t, r.b, "tyre_set_advisory"); n != 0 {
		t.Errorf("tyre_set_advisory said %d times next to the plan's calls, want none", n)
	}
}

func TestPitPlan_LatestLapCallOnlyWhenTheStopWasNotMade(t *testing.T) {
	t.Run("ignored", func(t *testing.T) {
		r := newPlanRace(t, 12, 15)
		for lap := uint8(12); lap <= 15; lap++ {
			r.drive(lap, 100, packets.PitStatusNone)
			r.drive(lap, 4900, packets.PitStatusNone)
		}
		if n := spoken(t, r.b, "pit_plan_box"); n != 1 {
			t.Errorf("plan box call said %d times, want once", n)
		}
		if got := spokenBoxes(t, r.b, "pit_window_close"); !slices.Equal(got, []BoxTiming{BoxThisLap}) {
			t.Errorf("latest-lap calls = %v, want one \"box this lap\" on lap 15", got)
		}
	})
	t.Run("made", func(t *testing.T) {
		r := newPlanRace(t, 12, 15)
		r.drive(12, 100, packets.PitStatusNone)
		r.pitStop(12)
		for lap := uint8(14); lap <= 15; lap++ {
			r.drive(lap, 100, packets.PitStatusNone)
		}
		if n := spoken(t, r.b, "pit_window_close"); n != 0 {
			t.Errorf("latest-lap call said %d times after the stop, want none", n)
		}
	})
}

func TestPitPlan_NextStopOfATwoStopRace(t *testing.T) {
	r := newPlanRace(t, 12, 15)
	r.drive(12, 100, packets.PitStatusNone)
	r.pitStop(12)
	// The game moves the plan to the second stop.
	r.plan(24, 27)
	r.drive(23, 1000, packets.PitStatusNone)
	r.drive(24, 100, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_plan_next_lap"); n != 1 {
		t.Errorf("heads-up said %d times for the second stop, want once", n)
	}
	if n := spoken(t, r.b, "pit_plan_box"); n != 2 {
		t.Errorf("plan box calls = %d, want one per stop (2)", n)
	}
}

func TestPitPlan_PlanMovedToThisLapPastThePitEntryWaitsForTheLine(t *testing.T) {
	r := newPlanRace(t, 14, 16)
	r.drive(12, 4500, packets.PitStatusNone)
	r.plan(12, 16)
	r.drive(12, 4550, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_plan_box"); n != 0 {
		t.Fatalf("box call said past this lap's pit entry, want it to wait for the line")
	}
	r.drive(13, 100, packets.PitStatusNone)
	if got := spokenBoxes(t, r.b, "pit_plan_box"); !slices.Equal(got, []BoxTiming{BoxThisLap}) {
		t.Errorf("box calls = %v, want one \"box this lap\" on lap 13", got)
	}
}

func TestPitPlan_IdealIsTheLatestLap(t *testing.T) {
	r := newPlanRace(t, 12, 12)
	r.drive(12, 100, packets.PitStatusNone)
	r.drive(12, 2000, packets.PitStatusNone)
	if n, m := spoken(t, r.b, "pit_plan_box"), spoken(t, r.b, "pit_window_close"); n != 1 || m != 0 {
		t.Errorf("box calls = %d, latest-lap calls = %d; want 1 and 0", n, m)
	}
}

func TestPitPlan_Silent(t *testing.T) {
	tests := []struct {
		name  string
		setup func(r *planRace)
	}{
		{"in the race's last laps", func(r *planRace) { r.plan(29, 30) }},
		{"tyres just fitted", func(r *planRace) { r.tyres(1) }},
		{"no plan", func(r *planRace) { r.plan(0, 0) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPlanRace(t, 12, 15)
			tt.setup(r)
			for lap := uint8(11); lap <= 30; lap++ {
				r.drive(lap, 1000, packets.PitStatusNone)
			}
			for _, sub := range []string{"pit_plan_next_lap", "pit_plan_box", "pit_window_close"} {
				if n := spoken(t, r.b, sub); n != 0 {
					t.Errorf("%s said %d times, want none", sub, n)
				}
			}
		})
	}
}

func TestPitPlan_FlashbackBeforeTheStopUndoesIt(t *testing.T) {
	r := newPlanRace(t, 12, 15)
	r.drive(12, 100, packets.PitStatusNone)
	r.pitStop(12)
	r.drive(11, 3000, packets.PitStatusNone) // flashback
	r.drive(12, 100, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_plan_box"); n != 2 {
		t.Errorf("plan box calls = %d, want the call again after the flashback (2)", n)
	}
}

func TestPitPlan_SafetyCarOnThePlansLapAfterTheCallToBox(t *testing.T) {
	r := newPlanRace(t, 12, 15)
	r.drive(12, 100, packets.PitStatusNone)
	r.drive(12, 2000, packets.PitStatusNone)
	r.safetyCar(packets.SafetyCarFull)
	if n, m := spoken(t, r.b, "safety_car"), spoken(t, r.b, "safety_car_box"); n != 1 || m != 0 {
		t.Errorf("safety_car = %d, safety_car_box = %d; want 1 and 0 (the call to box this lap stands)", n, m)
	}
	r.clock.advance(PitEntryReminderMinGapMs * time.Millisecond)
	r.drive(12, 4400, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_entry_reminder"); n != 1 {
		t.Errorf("pit entry reminder said %d times, want once", n)
	}
}

func TestPitPlan_SafetyCarTheLapBeforeTakesTheStopEarly(t *testing.T) {
	r := newPlanRace(t, 12, 15)
	r.drive(11, 2000, packets.PitStatusNone)
	r.safetyCar(packets.SafetyCarFull)
	r.drive(11, 2100, packets.PitStatusNone)
	if got := spokenBoxes(t, r.b, "safety_car_box"); !slices.Equal(got, []BoxTiming{BoxThisLap}) {
		t.Errorf("Safety Car calls to box = %v, want one \"box this lap\"", got)
	}
	r.pitStop(11)
	r.drive(13, 100, packets.PitStatusNone)
	if n := spoken(t, r.b, "pit_plan_box"); n != 0 {
		t.Errorf("plan box call said %d times after the stop under the Safety Car, want none", n)
	}
}

func TestSafetyCar_BoxesNearThePlansStop(t *testing.T) {
	tests := []struct {
		name   string
		lap    uint8
		status uint8
		setup  func(r *planRace)
		want   string
	}{
		{"Safety Car five laps before the plan", 15, packets.SafetyCarFull, nil, "safety_car_box"},
		{"Safety Car ten laps before the plan", 10, packets.SafetyCarFull, nil, "safety_car"},
		{"VSC two laps before the plan", 18, packets.SafetyCarVirtual, nil, "vsc_box"},
		{"VSC five laps before the plan", 15, packets.SafetyCarVirtual, nil, "vsc"},
		{"Safety Car after the window", 23, packets.SafetyCarFull, nil, "safety_car"},
		{"no plan", 15, packets.SafetyCarFull, func(r *planRace) { r.plan(0, 0) }, "safety_car"},
		{"plan's calls off", 15, packets.SafetyCarFull, func(r *planRace) {
			cfg := r.e.GetConfig()
			cfg.EnabledCategories = map[string]bool{"pit_plan_box": false}
			r.e.SetConfig(cfg)
		}, "safety_car"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPlanRace(t, 20, 22)
			if tt.setup != nil {
				tt.setup(r)
			}
			r.drive(tt.lap, 1000, packets.PitStatusNone)
			r.safetyCar(tt.status)
			for _, sub := range []string{"safety_car", "safety_car_box", "vsc", "vsc_box"} {
				want := 0
				if sub == tt.want {
					want = 1
				}
				if n := spoken(t, r.b, sub); n != want {
					t.Errorf("%s said %d times, want %d", sub, n, want)
				}
			}
		})
	}
}

func TestSafetyCar_BoxAfterThePlansStopIsSilent(t *testing.T) {
	r := newPlanRace(t, 12, 15)
	r.drive(12, 100, packets.PitStatusNone)
	r.pitStop(12)
	r.tyres(4)
	r.drive(14, 1000, packets.PitStatusNone)
	r.safetyCar(packets.SafetyCarFull)
	if n, m := spoken(t, r.b, "safety_car_box"), spoken(t, r.b, "safety_car"); n != 0 || m != 1 {
		t.Errorf("safety_car_box = %d, safety_car = %d; want 0 and 1 after the stop", n, m)
	}
}

func TestSafetyCar_EndingSaysWhichOne(t *testing.T) {
	tests := []struct {
		scType uint8
		want   string
	}{
		{packets.SafetyCarFull, "flags_sc_in"},
		{packets.SafetyCarVirtual, "vsc_ending"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			r := newPlanRace(t, 0, 0)
			r.drive(12, 1000, packets.PitStatusNone)
			r.safetyCar(tt.scType)
			var payload [12]byte
			payload[0], payload[1] = tt.scType, packets.SafetyCarEventReturning
			r.e.ProcessPacket(context.Background(), &packets.PacketEventData{
				Header: r.h, EventStringCode: [4]uint8{'S', 'C', 'A', 'R'}, EventDetails: packets.EventDataDetails{Data: payload},
			})
			if n := spoken(t, r.b, tt.want); n != 1 {
				t.Errorf("%s said %d times, want once", tt.want, n)
			}
		})
	}
}

func TestIsPlanHeadsUpLap(t *testing.T) {
	cfg := DefaultEngineerConfig()
	off := cfg.clone()
	off.EnabledCategories = map[string]bool{"pit_window": false}
	tests := []struct {
		name string
		ctx  EvaluationContext
		lap  int
		want bool
	}{
		{"the lap before the plan's", EvaluationContext{Config: cfg, PitPlan: PitPlanState{IdealLap: 12}}, 11, true},
		{"the plan's lap", EvaluationContext{Config: cfg, PitPlan: PitPlanState{IdealLap: 12}}, 12, false},
		{"plan done", EvaluationContext{Config: cfg, PitPlan: PitPlanState{IdealLap: 12, Done: true}}, 11, false},
		{"heads-up off", EvaluationContext{Config: off, PitPlan: PitPlanState{IdealLap: 12}}, 11, false},
		{"heads-up said this lap", EvaluationContext{Config: off, CallLaps: map[string]int{"pit_window": 11}}, 11, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isPlanHeadsUpLap(&tt.ctx, tt.lap); got != tt.want {
				t.Errorf("isPlanHeadsUpLap(lap %d) = %v, want %v", tt.lap, got, tt.want)
			}
		})
	}
}

func (r *planRace) braking(on bool) {
	var brake float32
	if on {
		brake = 0.8
	}
	r.e.ProcessPacket(context.Background(), &packets.PacketCarTelemetryData{Header: r.h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
		{Brake: brake},
	}})
}

func TestPitPlan_HeldHeadsUpIsNeverSaidLate(t *testing.T) {
	t.Run("into the plan's lap", func(t *testing.T) {
		r := newPlanRace(t, 12, 15)
		r.braking(true)
		r.drive(11, 1000, packets.PitStatusNone) // held while braking
		r.lap = 12                               // a short lap: the held call hasn't expired yet
		r.drive(12, 100, packets.PitStatusNone)
		r.braking(false)
		r.drive(12, 200, packets.PitStatusNone)
		if n := spoken(t, r.b, "pit_plan_next_lap"); n != 0 {
			t.Errorf("heads-up said %d times on the plan's lap, want none", n)
		}
		if n := spoken(t, r.b, "pit_plan_box"); n != 1 {
			t.Errorf("box call said %d times, want once", n)
		}
	})
	t.Run("after a call to box", func(t *testing.T) {
		r := newPlanRace(t, 12, 15)
		r.braking(true)
		r.drive(11, 1000, packets.PitStatusNone) // held while braking
		r.safetyCar(packets.SafetyCarFull)       // "Safety Car, we take the stop"
		r.braking(false)
		r.drive(11, 1100, packets.PitStatusNone)
		if n := spoken(t, r.b, "safety_car_box"); n != 1 {
			t.Fatalf("safety_car_box said %d times, want once", n)
		}
		if n := spoken(t, r.b, "pit_plan_next_lap"); n != 0 {
			t.Errorf("heads-up said %d times after the call to box, want none", n)
		}
	})
}
