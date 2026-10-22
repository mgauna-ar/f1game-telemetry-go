package engineer

import (
	"context"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// madeCalls is a rule that makes the calls a test queues on the next packet. The calls use real
// alert keys, so the engine gates them by those keys' configs.
type madeCalls struct{ queued []Directive }

func (r *madeCalls) Name() string                         { return "made" }
func (r *madeCalls) Category() string                     { return string(DirectiveCategoryCoaching) }
func (r *madeCalls) ValidPhases() []DrivingPhase          { return nil }
func (r *madeCalls) AlertKeys() map[string]AlertKeyConfig { return nil }
func (r *madeCalls) Reset(DedupScope)                     {}
func (r *madeCalls) Evaluate(*EvaluationContext) []Directive {
	q := r.queued
	r.queued = nil
	return q
}

// timedRace is a race on lap 10, with the radio's real spacing, where only the calls the test
// asks for are made.
type timedRace struct {
	t     *testing.T
	e     *EngineerEngine
	b     *mockBroadcaster
	clock *testClock
	h     packets.PacketHeader
	calls *madeCalls
	lap   packets.LapData // the player's lap data sent on each tick
}

func newTimedRace(t *testing.T) *timedRace {
	t.Helper()
	b := &mockBroadcaster{}
	e := NewEngineerEngine(b)
	clock := newTestClock()
	clock.install(e)
	r := &timedRace{t: t, e: e, b: b, clock: clock, h: createTestHeader(packets.PacketFormat2025, 4242, 0), calls: &madeCalls{},
		lap: packets.LapData{CurrentLapNum: 10, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack}}
	e.rules = []EngineerRule{r.calls}
	e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: r.h, SessionType: packets.SessionRace, TrackLength: 5000})
	r.tick(0)
	return r
}

// make queues a call for the next packet.
func (r *timedRace) make(alertKey, urgency string) {
	r.calls.queued = append(r.calls.queued, Directive{ID: alertKey, Category: r.e.alertRules[alertKey].Category, SubAlert: alertKey, Urgency: urgency})
}

// tick moves the clock on by d and sends the player's lap data.
func (r *timedRace) tick(d time.Duration) {
	r.clock.advance(d)
	r.e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: r.h, LapData: [packets.MaxCars]packets.LapData{r.lap}})
}

// saidBy ticks every 500 ms up to d from now and reports how long it took until alertKey was said,
// or -1 when it wasn't.
func (r *timedRace) saidBy(alertKey string, d time.Duration) time.Duration {
	r.t.Helper()
	for waited := time.Duration(0); waited <= d; waited += 500 * time.Millisecond {
		if spoken(r.t, r.b, alertKey) > 0 {
			return waited
		}
		r.tick(500 * time.Millisecond)
	}
	return -1
}

func TestEngineerEngine_RoutineCallWaitsForTheRadio(t *testing.T) {
	// The radio is busy for the call's delivery and speech, then a gap.
	defaultCall := RadioDeliveryLatencyMs + DefaultSpeechMs + GlobalRadioChatterCooldownMs
	longCall := RadioDeliveryLatencyMs + LongSpeechMs + GlobalRadioChatterCooldownMs
	tests := []struct {
		name, first, firstUrgency string
		want                      int // ms until the routine call after it is said
	}{
		{"after a call", "fuel_delta", UrgencyMedium, defaultCall},
		{"after a long report", "gap_report", UrgencyLow, longCall},
		{"after a critical call, with a breather", "tyre_puncture", UrgencyCritical, defaultCall + CriticalBreatherMs},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newTimedRace(t)
			r.make(tt.first, tt.firstUrgency)
			r.make("engine_temp", UrgencyMedium) // another category: no category cooldown
			r.tick(0)
			if spoken(t, r.b, tt.first) != 1 || spoken(t, r.b, "engine_temp") != 0 {
				t.Fatalf("first call said %d times, engine temperature %d times; want the first said and the engine temperature held",
					spoken(t, r.b, tt.first), spoken(t, r.b, "engine_temp"))
			}
			if got := r.saidBy("engine_temp", 20*time.Second); got != time.Duration(tt.want)*time.Millisecond {
				t.Errorf("engine temperature said after %v, want %v", got, time.Duration(tt.want)*time.Millisecond)
			}
		})
	}
}

func TestEngineerEngine_UrgentCallDoesNotWaitForTheRadio(t *testing.T) {
	r := newTimedRace(t)
	r.make("gap_report", UrgencyLow)
	r.tick(0)
	r.make("pit_entry_reminder", UrgencyHigh)
	r.tick(time.Second)
	if n := spoken(t, r.b, "pit_entry_reminder"); n != 1 {
		t.Fatalf("an urgent call during a report was said %d times, want at once", n)
	}
}

func TestEngineerEngine_ColdCallsWaitForTheSafetyCarToSettle(t *testing.T) {
	r := newTimedRace(t)
	r.e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: r.h, SessionType: packets.SessionRace, TrackLength: 5000, SafetyCarStatus: packets.SafetyCarFull})
	if r.e.currentPhase != PhaseSafetyCar {
		t.Fatalf("phase = %v, want %v", r.e.currentPhase, PhaseSafetyCar)
	}
	r.make("flags_sc", UrgencyCritical)
	r.make("tyre_cold", UrgencyLow)
	r.make("engine_temp", UrgencyMedium)
	r.tick(0)

	// The deployment's critical call gets its breather; the engine temperature follows it, the
	// cold tyres wait for the Safety Car to settle.
	breather := time.Duration(RadioDeliveryLatencyMs+DefaultSpeechMs+GlobalRadioChatterCooldownMs+CriticalBreatherMs) * time.Millisecond
	if got := r.saidBy("engine_temp", 20*time.Second); got != breather {
		t.Errorf("engine temperature said after %v, want after the Safety Car call's breather (%v)", got, breather)
	}
	if spoken(t, r.b, "tyre_cold") != 0 {
		t.Fatal("cold tyres said in the Safety Car's first seconds")
	}
	if got := breather + r.saidBy("tyre_cold", 20*time.Second); got != SCColdCallDelayMs*time.Millisecond {
		t.Errorf("cold tyres said %v into the Safety Car, want %v", got, SCColdCallDelayMs*time.Millisecond)
	}
}

func TestEngineerEngine_ReportsAndAeroZonesKeepTheirOwnCooldown(t *testing.T) {
	afterRadio := time.Duration(RadioDeliveryLatencyMs+LongSpeechMs+GlobalRadioChatterCooldownMs) * time.Millisecond
	for _, first := range []string{"gap_report", "aero_straight_anticipation"} {
		t.Run(first, func(t *testing.T) {
			r := newTimedRace(t)
			r.make(first, UrgencyLow)
			r.tick(0)
			r.tick(afterRadio)
			r.make("rival_attack", UrgencyMedium)
			r.tick(0)
			if n := spoken(t, r.b, "rival_attack"); n != 1 {
				t.Errorf("the attack call after %s was said %d times, want once: not held by the rivals cooldown", first, n)
			}
		})
	}

	// The attack calls keep their own: a defend call doesn't hold them back once the radio is free.
	r := newTimedRace(t)
	r.make("rival_defend", UrgencyHigh)
	r.tick(0)
	r.tick(time.Duration(RadioDeliveryLatencyMs+TrafficSpeechMs+GlobalRadioChatterCooldownMs) * time.Millisecond)
	r.make("rival_attack", UrgencyMedium)
	r.tick(0)
	if n := spoken(t, r.b, "rival_attack"); n != 1 {
		t.Errorf("the attack call after a defend call was said %d times, want once: not held by the defend call's cooldown", n)
	}
}

// learnedTrack is a profile of a 5 km track whose only quiet stretch runs from 1000 to 2000 m,
// driven at 80 m/s.
func learnedTrack() *trackProfile {
	bins := quietBins(5000)
	t := &trackProfile{quiet: make([]float32, bins), speed: make([]float32, bins), quietLaps: QuietLearnMinLaps}
	for b := range bins {
		t.speed[b] = 80
		if b >= 20 && b < 40 {
			t.quiet[b] = 1
		}
	}
	return t
}

func TestEngineerEngine_RoutineCallWaitsForAStraight(t *testing.T) {
	speechStartM := float32(RadioDeliveryLatencyMs) / 1000 * 80 // how far the player runs before speech starts
	tests := []struct {
		name        string
		lapDistance float32
		said        bool
	}{
		{"in a corner", 500, false},
		{"speech starts on the straight", 1000 - speechStartM + 1, true},
		{"on the straight", 1200, true},
		{"too near the straight's end to say it", 2000 - speechStartM - 300, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newTimedRace(t)
			r.e.profiles.tracks[0] = learnedTrack()
			r.lap.LapDistance = tt.lapDistance
			r.make("tyre_wear", UrgencyMedium)
			r.tick(0)
			if said := spoken(t, r.b, "tyre_wear") == 1; said != tt.said {
				t.Errorf("at %v m: said = %v, want %v", tt.lapDistance, said, tt.said)
			}
		})
	}

	t.Run("gives up waiting after a share of its life", func(t *testing.T) {
		r := newTimedRace(t)
		r.e.profiles.tracks[0] = learnedTrack()
		r.lap.LapDistance = 500
		r.make("tyre_wear", UrgencyMedium)
		r.tick(0)
		want := time.Duration(QuietWaitShare*ConditionMaxDelayMs) * time.Millisecond
		if got := r.saidBy("tyre_wear", time.Minute); got != want {
			t.Errorf("said after %v off the straight, want after %v", got, want)
		}
	})

	t.Run("under a Safety Car the straights don't apply", func(t *testing.T) {
		r := newTimedRace(t)
		r.e.profiles.tracks[0] = learnedTrack()
		r.e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: r.h, SessionType: packets.SessionRace, TrackLength: 5000, SafetyCarStatus: packets.SafetyCarVirtual})
		r.lap.LapDistance = 500
		r.make("tyre_wear", UrgencyMedium)
		r.tick(0)
		if n := spoken(t, r.b, "tyre_wear"); n != 1 {
			t.Errorf("said %d times off the brakes under a VSC, want once", n)
		}
	})

	t.Run("a track not learned yet goes by the brakes and the wheel", func(t *testing.T) {
		r := newTimedRace(t)
		r.lap.LapDistance = 500
		r.make("tyre_wear", UrgencyMedium)
		r.tick(0)
		if n := spoken(t, r.b, "tyre_wear"); n != 1 {
			t.Errorf("said %d times off the brakes on an unlearned track, want once", n)
		}
	})
}

func TestEngineerEngine_HeldCallsOutlastAPause(t *testing.T) {
	for _, paused := range []bool{true, false} {
		name := "the clock runs"
		if paused {
			name = "paused"
		}
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			r := newTimedRace(t)
			sessionTime := float32(100)
			send := func(d time.Duration, clockRuns bool, brake float32) {
				r.clock.advance(d)
				if clockRuns {
					sessionTime += float32(d.Seconds())
				}
				h := r.h
				h.SessionTime = sessionTime
				r.e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: brake, Speed: 150}}})
				r.e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{r.lap}})
			}
			for range 5 {
				send(100*time.Millisecond, true, 0)
			}

			// Held while braking, then the game stands still for longer than the call's life.
			r.make("tyre_wear", UrgencyMedium)
			send(100*time.Millisecond, true, 0.9)
			for range 90 {
				send(time.Second, !paused, 0.9)
			}
			if n := spoken(t, r.b, "tyre_wear"); n != 0 {
				t.Fatalf("said %d times while braking or paused", n)
			}
			send(100*time.Millisecond, true, 0)
			want := 0
			if paused {
				want = 1
			}
			if n := spoken(t, r.b, "tyre_wear"); n != want {
				t.Errorf("said %d times once off the brakes, want %d", n, want)
			}
		})
	}
}

func TestRivalsRule_AttackCallMadeAgainWhenNeverSaid(t *testing.T) {
	ctx := battleCtx()
	ctx.Now = 1_000_000
	rule := NewRivalsRule()
	if directiveFor(rule.Evaluate(ctx), "rival_attack") == nil {
		t.Fatal("expected the attack call")
	}
	ctx.Now += MomentMaxDelayMs + 1
	ctx.LastSaid = map[string]int64{"rival_attack": 1_000_000}
	if d := directiveFor(rule.Evaluate(ctx), "rival_attack"); d != nil {
		t.Fatalf("the attack call was made again after it was said: %+v", d)
	}

	rule = NewRivalsRule()
	ctx.Now = 1_000_000
	rule.Evaluate(ctx)
	ctx.LastSaid = nil
	ctx.Now += MomentMaxDelayMs / 2
	if d := directiveFor(rule.Evaluate(ctx), "rival_attack"); d != nil {
		t.Fatalf("the attack call was made again while it may still be said: %+v", d)
	}
	ctx.Now += MomentMaxDelayMs
	if directiveFor(rule.Evaluate(ctx), "rival_attack") == nil {
		t.Fatal("expected the attack call again: it went stale without being said")
	}
}

func TestEngineerEngine_HeldRoutineCallWaitsForAnUrgentOne(t *testing.T) {
	r := newTimedRace(t)
	r.e.profiles.tracks[0] = learnedTrack()
	r.lap.LapDistance = 500 // a corner: tyre wear waits for the straight
	r.make("tyre_wear", UrgencyMedium)
	r.tick(0)

	// The Safety Car comes out, called on the same packet: the straights no longer apply, and its
	// call goes first.
	r.clock.advance(time.Second)
	r.make("flags_sc", UrgencyCritical)
	r.e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: r.h, SessionType: packets.SessionRace, TrackLength: 5000, SafetyCarStatus: packets.SafetyCarFull})
	if spoken(t, r.b, "flags_sc") != 1 || spoken(t, r.b, "tyre_wear") != 0 {
		t.Fatalf("Safety Car said %d times, tyre wear %d times; want the Safety Car first and tyre wear after its breather",
			spoken(t, r.b, "flags_sc"), spoken(t, r.b, "tyre_wear"))
	}
	breather := time.Duration(RadioDeliveryLatencyMs+DefaultSpeechMs+GlobalRadioChatterCooldownMs+CriticalBreatherMs) * time.Millisecond
	if got := r.saidBy("tyre_wear", 20*time.Second); got != breather {
		t.Errorf("tyre wear said %v after the Safety Car call, want %v", got, breather)
	}
}

func TestEngineerEngine_RoutineCallMadeWithAnUrgentOneGoesAfterIt(t *testing.T) {
	r := newTimedRace(t)
	r.make("tyre_wear", UrgencyMedium) // a rule evaluated before the flags
	r.make("flags_sc", UrgencyCritical)
	r.tick(0)
	if spoken(t, r.b, "flags_sc") != 1 || spoken(t, r.b, "tyre_wear") != 0 {
		t.Fatalf("Safety Car said %d times, tyre wear %d times; want the Safety Car first and tyre wear after its breather",
			spoken(t, r.b, "flags_sc"), spoken(t, r.b, "tyre_wear"))
	}
}
