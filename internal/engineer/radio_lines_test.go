package engineer

import (
	"strings"
	"testing"
	"time"
)

// emitNow says a call at once, past the radio gates, as the engine does once they let it through.
func emitNow(e *EngineerEngine, d Directive, alertKey string, heldForMs int64) Directive {
	e.mu.Lock()
	defer e.mu.Unlock()
	if d.SubAlert == "" {
		d.SubAlert = alertKey
	}
	if d.Category == "" {
		d.Category = e.alertRules[alertKey].Category
	}
	return e.emitDirectiveLocked(createTestHeader(0, 4242, 0), d, alertKey, heldForMs)
}

func TestEngineerEngine_WordableCalls(t *testing.T) {
	tests := []struct {
		name     string
		wording  bool
		alertKey string
		urgency  string
		box      BoxCall
		heldMs   int64
		want     bool
	}{
		{"a routine call", true, "tyre_wear", UrgencyMedium, BoxCallNone, 0, true},
		{"a low urgency call", true, "gap_report", UrgencyLow, BoxCallNone, 0, true},
		{"AI wording off", false, "tyre_wear", UrgencyMedium, BoxCallNone, 0, false},
		{"an urgent call", true, "tyre_wear", UrgencyHigh, BoxCallNone, 0, false},
		{"a critical call", true, "damage_wing", UrgencyCritical, BoxCallNone, 0, false},
		{"a call to box", true, "tyre_wear", UrgencyMedium, BoxCallInstruction, 0, false},
		{"a pit stop option", true, "pit_clean_air", UrgencyLow, BoxCallOption, 0, false},
		{"a call said at a moment", true, "rival_attack", UrgencyMedium, BoxCallNone, 0, false},
		{"held until it stays useful long enough to word", true, "tyre_wear", UrgencyMedium, BoxCallNone, ConditionMaxDelayMs - RadioLineMinTTLMs, true},
		{"held until too little of its life is left", true, "tyre_wear", UrgencyMedium, BoxCallNone, ConditionMaxDelayMs - RadioLineMinTTLMs + 1, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := NewEngineerEngine(nil)
			e.SetRadioWording(tt.wording)
			d := emitNow(e, Directive{Urgency: tt.urgency, BoxCall: tt.box}, tt.alertKey, tt.heldMs)
			if d.Wordable != tt.want {
				t.Errorf("Wordable = %v, want %v (ttl %d ms)", d.Wordable, tt.want, d.TTLMs)
			}
		})
	}
}

func TestEngineerEngine_WordableGoesOnTheWire(t *testing.T) {
	r := newTimedRace(t)
	r.e.SetRadioWording(true)
	r.make("tyre_wear", UrgencyMedium)
	r.tick(0)
	calls := spokenCalls(t, r.b, "tyre_wear")
	if len(calls) != 1 || !calls[0].Wordable {
		t.Fatalf("calls %+v, want one wordable tyre wear call", calls)
	}
}

func TestEngineerEngine_WordedCallKeepsTheRadioBusyWhileWorded(t *testing.T) {
	for _, wording := range []bool{false, true} {
		r := newTimedRace(t)
		r.e.SetRadioWording(wording)
		r.make("fuel_delta", UrgencyMedium)
		r.make("engine_temp", UrgencyMedium)
		r.tick(0)
		want := time.Duration(RadioDeliveryLatencyMs+DefaultSpeechMs+GlobalRadioChatterCooldownMs) * time.Millisecond
		if wording {
			want += RadioLineLeadMs * time.Millisecond
		}
		if got := r.saidBy("engine_temp", 20*time.Second); got != want {
			t.Errorf("wording %v: the next call came %v after a routine call, want %v", wording, got, want)
		}
	}
}

func TestEngineerEngine_WordedCallLooksFurtherAheadForAStraight(t *testing.T) {
	// The AI's line takes RadioLineLeadMs to come, on top of the delivery, at 80 m/s.
	wordedStartM := float32(RadioDeliveryLatencyMs+RadioLineLeadMs) / 1000 * 80
	for _, wording := range []bool{false, true} {
		r := newTimedRace(t)
		r.e.profiles.tracks[0] = learnedTrack()
		r.e.SetRadioWording(wording)
		r.lap.LapDistance = 1000 - wordedStartM + 1
		r.make("tyre_wear", UrgencyMedium)
		r.tick(0)
		if said := spoken(t, r.b, "tyre_wear") == 1; said != wording {
			t.Errorf("wording %v: said %v at %.0f m, want it said only when the line takes time to word", wording, said, r.lap.LapDistance)
		}
	}
}

func TestEngineerEngine_RadioCall(t *testing.T) {
	r := newTimedRace(t)
	r.e.SetRadioWording(true)
	r.calls.queued = append(r.calls.queued, Directive{
		ID: "tyre_wear", Category: DirectiveCategoryTyres, SubAlert: "tyre_wear", Urgency: UrgencyMedium,
		Message: "Front left tyre wear at 45%", Values: &DirectiveValues{Wheel: WheelFrontLeft, Pct: 45},
	})
	r.tick(0)
	d := spokenCalls(t, r.b, "tyre_wear")[0]

	facts, ok := r.e.RadioCall(d.ID)
	if !ok {
		t.Fatal("the call just said can't be worded")
	}
	if facts.Key != "tyre_wear" || facts.Message != "Front left tyre wear at 45%" || facts.Values != "front left; 45%" {
		t.Errorf("facts %+v", facts)
	}
	if !strings.Contains(facts.Situation, "Race") || !strings.Contains(facts.Situation, "P5") {
		t.Errorf("situation %q, want the session and position", facts.Situation)
	}
	if _, ok := r.e.RadioCall("directive_0_tyre_wear"); ok {
		t.Error("an unknown call can be worded")
	}

	// The line said goes into the race history the AI race engineer reads.
	r.e.RecordRadioLine(d.ID, "Front left's at 45, look after it.")
	briefing, _ := r.e.LiveBriefing()
	if !strings.Contains(briefing.Summary, `"Front left's at 45, look after it."`) {
		t.Errorf("summary doesn't say the line heard:\n%s", briefing.Summary)
	}

	r.clock.advance(time.Duration(d.TTLMs+1) * time.Millisecond)
	if _, ok := r.e.RadioCall(d.ID); ok {
		t.Error("a stale call can still be worded")
	}
}

func TestEngineerEngine_RadioCallOnlyForWordableCalls(t *testing.T) {
	e := NewEngineerEngine(nil)
	e.SetRadioWording(true)
	urgent := emitNow(e, Directive{Urgency: UrgencyCritical}, "tyre_puncture", 0)
	if _, ok := e.RadioCall(urgent.ID); ok {
		t.Error("an urgent call can be worded")
	}
}

func TestEngineerEngine_RecentLinesOfACall(t *testing.T) {
	clock := newTestClock()
	e := NewEngineerEngine(nil)
	clock.install(e)
	e.SetRadioWording(true)
	call := func() Directive {
		clock.advance(time.Millisecond)
		return emitNow(e, Directive{Urgency: UrgencyMedium}, "tyre_wear", 0)
	}

	lines := []string{"one", "two", "three", "four"}
	for _, line := range lines {
		d := call()
		e.RecordRadioLine(d.ID, line)
		// The same call said again by a dashboard in another language isn't another line.
		e.RecordRadioLine(d.ID, line+" (es)")
	}
	emitNow(e, Directive{Urgency: UrgencyMedium}, "fuel_delta", 0)

	facts, ok := e.RadioCall(call().ID)
	if !ok {
		t.Fatal("no facts")
	}
	if want := []string{"two", "three", "four"}; strings.Join(facts.Recent, "|") != strings.Join(want, "|") {
		t.Errorf("recent lines %q, want the last %d said for this call: %q", facts.Recent, RadioLineRecentLines, want)
	}
}

func TestDescribeValues(t *testing.T) {
	tests := []struct {
		values *DirectiveValues
		want   string
	}{
		{nil, ""},
		{&DirectiveValues{Position: 5, Ahead: &GapToCar{GapSec: 1.24, Trend: GapClosing, PerLapSec: 0.3}, Behind: &GapToCar{GapSec: 0.8, Trend: GapStable}},
			"position P5; car ahead 1.2 s, closing 0.3 s a lap; car behind 0.8 s, stable"},
		{&DirectiveValues{Sector: 2, DeltaSec: 0.31}, "sector 2; 0.3 s off the best"},
		{&DirectiveValues{Axle: AxleFront, Compound: TyreInter}, "front axle; inter tyre"},
		{&DirectiveValues{RainPct: 85, Minutes: 2}, "minutes: 2; 85% chance of rain"},
		{&DirectiveValues{FuelDeltaLaps: -0.42}, "fuel 0.4 laps short"},
		{&DirectiveValues{PoleGapSec: 0.088, Elimination: EliminationDropZone}, "0.088 s to pole; qualifying cut line: drop zone"},
		{&DirectiveValues{Ahead: &GapToCar{GapSec: 2.6, Trend: GapClosing, PerLapSec: 0.4, Name: "Hamilton", Compound: TyreMedium, TyreAgeDiffLaps: 8}, LapsToRange: 4},
			"car ahead 2.6 s, closing 0.4 s a lap, Hamilton, on medium tyres 8 laps older than ours; in battle range in about 4 laps"},
		{&DirectiveValues{Behind: &GapToCar{GapSec: 1.1, Compound: TyreSoft, TyreAgeDiffLaps: -5}}, "car behind 1.1 s, on soft tyres 5 laps fresher than ours"},
		{&DirectiveValues{TrackTempDeltaC: -7}, "track temperature down 7 °C (13 °F) this stint"},
	}
	for _, tt := range tests {
		if got := describeValues(tt.values); got != tt.want {
			t.Errorf("describeValues(%+v) = %q, want %q", tt.values, got, tt.want)
		}
	}
}
