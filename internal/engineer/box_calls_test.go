package engineer

import (
	"context"
	"encoding/json"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestBoxTimingAt(t *testing.T) {
	tests := []struct {
		name                         string
		lapDistance, entry, leadDist float32
		want                         BoxTiming
	}{
		{"well before the entry", 1000, 4800, 500, BoxThisLap},
		{"just before the call point", 4299, 4800, 500, BoxThisLap},
		{"at the call point", 4300, 4800, 500, BoxNextLap},
		{"past the entry", 4900, 4800, 500, BoxNextLap},
		{"longer lead", 3900, 4800, 1000, BoxNextLap},
		{"entry just after the line, early in the lap", 200, 100, 500, BoxThisLap},
		{"entry just after the line, late in the lap", 4700, 100, 500, BoxNextLap},
		{"entry unknown, first half", 2000, 0, 500, BoxThisLap},
		{"entry unknown, second half", 3000, 0, 500, BoxASAP},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := boxTimingAt(tt.lapDistance, 5000, tt.entry, tt.leadDist); got != tt.want {
				t.Errorf("boxTimingAt(%v) = %s, want %s", tt.lapDistance, got, tt.want)
			}
		})
	}
}

func TestPitLanes_LearnsTheEntryFromCarsThatPit(t *testing.T) {
	session := &packets.PacketSessionData{TrackId: 7, TrackLength: 5000}
	prev, next := &packets.PacketLapData{}, &packets.PacketLapData{}
	set := func(i int, before, after uint8, lapDistance float32, driverStatus uint8) {
		prev.LapData[i] = packets.LapData{PitStatus: before, DriverStatus: driverStatus}
		next.LapData[i] = packets.LapData{PitStatus: after, LapDistance: lapDistance, DriverStatus: driverStatus}
	}
	set(1, packets.PitStatusNone, packets.PitStatusPitting, 4790, packets.DriverStatusInLap)
	set(2, packets.PitStatusNone, packets.PitStatusPitting, 4810, packets.DriverStatusInLap)
	set(3, packets.PitStatusNone, packets.PitStatusPitting, 4805, packets.DriverStatusInLap)
	set(4, packets.PitStatusNone, packets.PitStatusInPitArea, 100, packets.DriverStatusInLap)   // already in the box
	set(5, packets.PitStatusPitting, packets.PitStatusPitting, 200, packets.DriverStatusInLap)  // was already pitting
	set(6, packets.PitStatusNone, packets.PitStatusPitting, -20, packets.DriverStatusInLap)     // before the line on lap 1
	set(7, packets.PitStatusNone, packets.PitStatusPitting, 6000, packets.DriverStatusInLap)    // past the track's length
	set(8, packets.PitStatusNone, packets.PitStatusPitting, 2500, packets.DriverStatusInGarage) // in the garage

	lanes := newPitLanes()
	lanes.learn(session, prev, next)
	if got := lanes.entrySamples[7]; !slices.Equal(got, []float32{4790, 4810, 4805}) {
		t.Fatalf("samples = %v, want the three cars that started pitting", got)
	}
	if got := lanes.entry(7); got != 4805 {
		t.Errorf("entry = %v, want the median 4805", got)
	}
	if got := lanes.entry(3); got != 0 {
		t.Errorf("entry of an unknown track = %v, want 0", got)
	}

	// Only the latest samples are kept.
	for range PitEntryMaxSamples {
		lanes.learn(session, prev, next)
	}
	if n := len(lanes.entrySamples[7]); n != PitEntryMaxSamples {
		t.Errorf("kept %d samples, want %d", n, PitEntryMaxSamples)
	}
}

// memPitLaneStore is a settings store that reports each save.
type memPitLaneStore struct {
	mu     sync.Mutex
	values map[string]string
	saved  chan string
}

func (s *memPitLaneStore) GetSetting(_ context.Context, key string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.values[key], nil
}

func (s *memPitLaneStore) SetSetting(_ context.Context, key, value string) error {
	s.mu.Lock()
	s.values[key] = value
	s.mu.Unlock()
	s.saved <- value
	return nil
}

func TestEngineerEngine_PitLanesSurviveARestart(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	store := &memPitLaneStore{
		values: map[string]string{pitLaneSettingKey: `{"tracks":{"3":{"entry_m":[4700,4720,4710]}}}`},
		saved:  make(chan string, 4),
	}
	e := newTestEngineerEngine(&mockBroadcaster{})
	if err := e.UsePitLaneStore(ctx, store); err != nil {
		t.Fatalf("UsePitLaneStore: %v", err)
	}
	if got := e.pitLanes.entry(3); got != 4710 {
		t.Fatalf("loaded entry = %v, want 4710", got)
	}

	// A car pits at a track not seen before: the new entry is saved.
	h := createTestHeader(packets.PacketFormat2025, 77, 0)
	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackId: 9, TrackLength: 5000})
	lap := func(pitStatus uint8) *packets.PacketLapData {
		p := &packets.PacketLapData{Header: h}
		p.LapData[0] = packets.LapData{CurrentLapNum: 4, LapDistance: 1000, DriverStatus: packets.DriverStatusOnTrack}
		p.LapData[1] = packets.LapData{CurrentLapNum: 4, LapDistance: 3300, DriverStatus: packets.DriverStatusInLap, PitStatus: pitStatus}
		return p
	}
	e.ProcessPacket(ctx, lap(packets.PitStatusNone))
	e.ProcessPacket(ctx, lap(packets.PitStatusPitting))

	select {
	case raw := <-store.saved:
		restarted := newPitLanes()
		if err := restarted.load(raw); err != nil {
			t.Fatalf("load saved pit lanes: %v", err)
		}
		if restarted.entry(9) != 3300 || restarted.entry(3) != 4710 {
			t.Errorf("after a restart: entry(9) = %v, entry(3) = %v; want 3300 and 4710", restarted.entry(9), restarted.entry(3))
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the learned pit entry was never saved")
	}
	if got := e.GetConfig().PitCallLeadM; got != DefaultPitCallLeadM {
		t.Errorf("PitCallLeadM = %v, want the default %v", got, DefaultPitCallLeadM)
	}
}

// scriptedRule says the calls a test queues on the next packet.
type scriptedRule struct{ queued []Directive }

func (r *scriptedRule) Name() string                { return "scripted" }
func (r *scriptedRule) Category() string            { return string(DirectiveCategoryPitStrategy) }
func (r *scriptedRule) ValidPhases() []DrivingPhase { return nil }
func (r *scriptedRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{"test_box": {Category: DirectiveCategoryPitStrategy, ValidPhases: []DrivingPhase{PhaseRacing}}}
}
func (r *scriptedRule) Reset(DedupScope) {}
func (r *scriptedRule) Evaluate(*EvaluationContext) []Directive {
	q := r.queued
	r.queued = nil
	return q
}

// boxEngine is a race on a 5 km track whose pit entry, at 4800 m, is known. Calls to box this
// lap must come before 4300 m.
func boxEngine(t *testing.T) (*EngineerEngine, *mockBroadcaster, *testClock, *scriptedRule, func(lap uint8, lapDistance float32, pitStatus uint8)) {
	t.Helper()
	e, b, clock, h := raceEngine(t)
	e.pitLanes.entrySamples[0] = []float32{4800}
	rule := &scriptedRule{}
	e.rules = append(e.rules, rule)
	e.alertRules["test_box"] = rule.AlertKeys()["test_box"]
	drive := func(lap uint8, lapDistance float32, pitStatus uint8) {
		clock.advance(time.Second)
		e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: lap, CarPosition: 5, LapDistance: lapDistance, DriverStatus: packets.DriverStatusOnTrack, PitStatus: pitStatus},
		}})
	}
	return e, b, clock, rule, drive
}

func boxCall(urgency string, kind BoxCall) Directive {
	return Directive{ID: "test_box", Category: DirectiveCategoryPitStrategy, SubAlert: "tyre_puncture", Urgency: urgency, BoxCall: kind}
}

// spokenBoxes returns the box timing of each broadcast directive with this sub_alert.
func spokenBoxes(t *testing.T, b *mockBroadcaster, subAlert string) []BoxTiming {
	t.Helper()
	b.mu.Lock()
	defer b.mu.Unlock()
	var boxes []BoxTiming
	for _, raw := range b.broadcasts {
		var d EngineerDirective
		if err := json.Unmarshal(raw, &d); err != nil {
			t.Fatalf("decode directive: %v", err)
		}
		if d.SubAlert == subAlert {
			boxes = append(boxes, d.Box)
		}
	}
	return boxes
}

func TestEngineerEngine_UrgentBoxCallSaysWhenToPit(t *testing.T) {
	tests := []struct {
		name        string
		lapDistance float32
		entryKnown  bool
		want        BoxTiming
	}{
		{"well before the pit entry", 1000, true, BoxThisLap},
		{"too close to the pit entry", 4500, true, BoxNextLap},
		{"pit entry unknown, late in the lap", 3000, false, BoxASAP},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, b, _, rule, drive := boxEngine(t)
			if !tt.entryKnown {
				delete(e.pitLanes.entrySamples, 0)
			}
			rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallInstruction)}
			drive(10, tt.lapDistance, packets.PitStatusNone)
			if got := spokenBoxes(t, b, "tyre_puncture"); !slices.Equal(got, []BoxTiming{tt.want}) {
				t.Errorf("spoken = %v, want one call with %s", got, tt.want)
			}
		})
	}
}

func TestEngineerEngine_LateBoxCallWaitsForTheLine(t *testing.T) {
	t.Run("said as box this lap on the next lap", func(t *testing.T) {
		_, b, _, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyMedium, BoxCallInstruction)}
		drive(10, 4500, packets.PitStatusNone)
		drive(10, 4900, packets.PitStatusNone)
		if got := spokenBoxes(t, b, "tyre_puncture"); len(got) != 0 {
			t.Fatalf("spoken %v before the line, want nothing", got)
		}
		drive(11, 50, packets.PitStatusNone)
		if got := spokenBoxes(t, b, "tyre_puncture"); !slices.Equal(got, []BoxTiming{BoxThisLap}) {
			t.Errorf("spoken = %v after the line, want one box this lap", got)
		}
	})

	t.Run("forgotten when the driver pits anyway", func(t *testing.T) {
		_, b, _, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyMedium, BoxCallInstruction)}
		drive(10, 4500, packets.PitStatusNone)
		drive(10, 4850, packets.PitStatusPitting)
		drive(11, 50, packets.PitStatusInPitArea)
		drive(11, 400, packets.PitStatusNone)
		if got := spokenBoxes(t, b, "tyre_puncture"); len(got) != 0 {
			t.Errorf("spoken %v after the driver pitted, want nothing", got)
		}
	})

	t.Run("an option is said at once", func(t *testing.T) {
		_, b, _, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyLow, BoxCallOption)}
		drive(10, 4500, packets.PitStatusNone)
		if got := spokenBoxes(t, b, "tyre_puncture"); !slices.Equal(got, []BoxTiming{BoxNextLap}) {
			t.Errorf("spoken = %v, want one call with next_lap", got)
		}
	})
}

func TestEngineerEngine_PitEntryReminder(t *testing.T) {
	t.Run("once, at the call point of the lap the stop is due", func(t *testing.T) {
		_, b, clock, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallInstruction)}
		drive(10, 1000, packets.PitStatusNone)
		clock.advance(30 * time.Second)
		drive(10, 4200, packets.PitStatusNone)
		if n := spoken(t, b, "pit_entry_reminder"); n != 0 {
			t.Fatalf("reminder said %d times before the call point", n)
		}
		drive(10, 4350, packets.PitStatusNone)
		drive(10, 4450, packets.PitStatusNone)
		if n := spoken(t, b, "pit_entry_reminder"); n != 1 {
			t.Errorf("reminder said %d times, want once", n)
		}
	})

	t.Run("on the next lap for a call that came too late", func(t *testing.T) {
		_, b, clock, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallInstruction)}
		drive(10, 4500, packets.PitStatusNone)
		drive(10, 4600, packets.PitStatusNone)
		clock.advance(30 * time.Second)
		drive(11, 4350, packets.PitStatusNone)
		if n := spoken(t, b, "pit_entry_reminder"); n != 1 {
			t.Errorf("reminder said %d times on the next lap, want once", n)
		}
	})

	t.Run("not when the driver already pitted", func(t *testing.T) {
		_, b, clock, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallInstruction)}
		drive(10, 1000, packets.PitStatusNone)
		clock.advance(30 * time.Second)
		drive(10, 4100, packets.PitStatusPitting) // a pit lane that starts early
		drive(10, 4350, packets.PitStatusPitting)
		if n := spoken(t, b, "pit_entry_reminder"); n != 0 {
			t.Errorf("reminder said %d times in the pit lane", n)
		}
	})

	t.Run("not right after the call", func(t *testing.T) {
		_, b, _, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallInstruction)}
		drive(10, 4200, packets.PitStatusNone)
		drive(10, 4350, packets.PitStatusNone)
		if n := spoken(t, b, "pit_entry_reminder"); n != 0 {
			t.Errorf("reminder said %d times a second after the call", n)
		}
	})

	t.Run("not after an option", func(t *testing.T) {
		_, b, clock, rule, drive := boxEngine(t)
		rule.queued = []Directive{boxCall(UrgencyCritical, BoxCallOption)}
		drive(10, 1000, packets.PitStatusNone)
		clock.advance(30 * time.Second)
		drive(10, 4350, packets.PitStatusNone)
		if n := spoken(t, b, "pit_entry_reminder"); n != 0 {
			t.Errorf("reminder said %d times after a Safety Car style option", n)
		}
	})
}

// The rules mark the calls that ask the driver to pit, so the engine can say when to.
func TestRules_MarkBoxCalls(t *testing.T) {
	cfg := DefaultEngineerConfig()
	damage := func(wingPct uint8) *EvaluationContext {
		d := &packets.PacketCarDamageData{}
		d.CarDamageData[0].FrontLeftWingDamage = wingPct
		return &EvaluationContext{Damage: d, Config: cfg, Phase: PhaseRacing}
	}
	safetyCar := func(status uint8) *EvaluationContext {
		return &EvaluationContext{
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace, SafetyCarStatus: status},
			Config:  cfg, Phase: PhaseRacing,
		}
	}
	puncture := &packets.PacketCarDamageData{}
	puncture.CarDamageData[0].TyresWear = wheels[float32](96, 20, 20, 20)

	tests := []struct {
		name string
		dirs []Directive
		key  string
		want BoxCall
	}{
		{"puncture", NewTyresRule().Evaluate(&EvaluationContext{Damage: puncture, Config: cfg, Phase: PhaseRacing}), "tyre_puncture", BoxCallInstruction},
		{"critical wing damage", NewDamageRule().Evaluate(damage(60)), "damage_wing", BoxCallInstruction},
		{"light wing damage", NewDamageRule().Evaluate(damage(25)), "damage_wing", BoxCallNone},
		{"Safety Car", optionalDirective(NewFlagsRule().evaluateSafetyCar(safetyCar(packets.SafetyCarFull))), "flags_sc", BoxCallOption},
		{"Virtual Safety Car", optionalDirective(NewFlagsRule().evaluateSafetyCar(safetyCar(packets.SafetyCarVirtual))), "flags_sc", BoxCallOption},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, d := range tt.dirs {
				if d.ID == tt.key {
					if d.BoxCall != tt.want {
						t.Errorf("BoxCall = %v, want %v", d.BoxCall, tt.want)
					}
					return
				}
			}
			t.Fatalf("no %s call in %+v", tt.key, tt.dirs)
		})
	}
}

func optionalDirective(d *Directive) []Directive {
	if d == nil {
		return nil
	}
	return []Directive{*d}
}

// A call made on the pit limiter is said once the limiter is off instead of being lost.
func TestEngineerEngine_CallOnTheLimiterIsSaidAtThePitExit(t *testing.T) {
	e, b, _, rule, drive := boxEngine(t)
	limiter := func(on uint8) {
		status := &packets.PacketCarStatusData{Header: createTestHeader(packets.PacketFormat2025, 4242, 0)}
		status.CarStatusData[0].PitLimiterStatus = on
		e.ProcessPacket(context.Background(), status)
	}
	limiter(1)
	rule.queued = []Directive{{ID: "test_box", Category: DirectiveCategoryTyres, SubAlert: "tyre_wear", Urgency: UrgencyMedium}}
	drive(10, 1000, packets.PitStatusNone)
	if n := spoken(t, b, "tyre_wear"); n != 0 {
		t.Fatalf("said %d times on the limiter", n)
	}
	limiter(0)
	drive(10, 1100, packets.PitStatusNone)
	if n := spoken(t, b, "tyre_wear"); n != 1 {
		t.Errorf("said %d times after the limiter went off, want once", n)
	}
}

// The stop time is said as the car pulls out of its box, on the limiter, before the "limiter off"
// call at the pit exit.
func TestEngineerEngine_PitStopTimeIsSaid(t *testing.T) {
	e, b, clock, _, _ := boxEngine(t)
	h := createTestHeader(packets.PacketFormat2025, 4242, 0)
	status := &packets.PacketCarStatusData{Header: h}
	status.CarStatusData[0].PitLimiterStatus = 1
	e.ProcessPacket(context.Background(), status)
	drive := func(lap uint8, lapDistance float32, pitStatus uint8, timerMs uint16) {
		clock.advance(time.Second)
		e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: lap, LapDistance: lapDistance, DriverStatus: packets.DriverStatusInLap, PitStatus: pitStatus, PitStopTimerInMS: timerMs, PitStopShouldServePen: 1, Penalties: 5},
		}})
	}
	drive(10, 4900, packets.PitStatusPitting, 0)
	if n := spoken(t, b, "pit_serve_penalty"); n != 1 {
		t.Fatalf("penalty reminder said %d times, want once", n)
	}
	drive(11, 10, packets.PitStatusInPitArea, 1200) // standing in the box
	drive(11, 10, packets.PitStatusInPitArea, 2400)
	drive(11, 160, packets.PitStatusPitting, 2400)  // leaving it
	if n := spoken(t, b, "pit_stop_fast"); n != 1 { // 2.4 s
		t.Errorf("stop time said %d times leaving the box, want once", n)
	}
}
