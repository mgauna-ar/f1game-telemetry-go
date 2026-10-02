package engineer

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// testClock is a clock tests move by hand.
type testClock struct{ t time.Time }

func (c *testClock) now() time.Time            { return c.t }
func (c *testClock) advance(d time.Duration)   { c.t = c.t.Add(d) }
func newTestClock() *testClock                 { return &testClock{t: time.UnixMilli(1_700_000_000_000)} }
func (c *testClock) install(e *EngineerEngine) { e.now = c.now }

// spoken returns how many directives with this sub_alert the engine broadcast.
func spoken(t *testing.T, b *mockBroadcaster, subAlert string) int {
	t.Helper()
	b.mu.Lock()
	defer b.mu.Unlock()
	n := 0
	for _, raw := range b.broadcasts {
		var d EngineerDirective
		if err := json.Unmarshal(raw, &d); err != nil {
			t.Fatalf("decode directive: %v", err)
		}
		if d.SubAlert == subAlert {
			n++
		}
	}
	return n
}

// raceEngine starts a race session on lap 10 with the player on track.
func raceEngine(t *testing.T) (*EngineerEngine, *mockBroadcaster, *testClock, packets.PacketHeader) {
	t.Helper()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	clock := newTestClock()
	clock.install(e)
	header := createTestHeader(packets.PacketFormat2025, 4242, 0)
	e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: header, SessionType: packets.SessionRace, TrackLength: 5000})
	e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: header, LapData: [packets.MaxCars]packets.LapData{
		{CurrentLapNum: 10, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack},
	}})
	return e, b, clock, header
}

func TestEngineerEngine_RedFlagEndsAtTheRestart(t *testing.T) {
	ctx := context.Background()
	session := func(h packets.PacketHeader, redFlags uint8) *packets.PacketSessionData {
		return &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, NumRedFlagPeriods: redFlags}
	}
	lap := func(h packets.PacketHeader, lapNum uint8) *packets.PacketLapData {
		return &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: lapNum, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack},
		}}
	}

	t.Run("lights out ends it", func(t *testing.T) {
		e, _, _, h := raceEngine(t)
		e.ProcessPacket(ctx, session(h, 1))
		if e.currentPhase != PhaseRedFlag {
			t.Fatalf("phase = %v after the red flag count went up, want %v", e.currentPhase, PhaseRedFlag)
		}
		e.ProcessPacket(ctx, lap(h, 10))
		e.ProcessPacket(ctx, session(h, 1))
		if e.currentPhase != PhaseRedFlag {
			t.Fatalf("phase = %v while still red-flagged on the same lap, want %v", e.currentPhase, PhaseRedFlag)
		}
		e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'L', 'G', 'O', 'T'}})
		e.ProcessPacket(ctx, lap(h, 10))
		if e.currentPhase != PhaseRacing {
			t.Fatalf("phase = %v after the restart, want %v", e.currentPhase, PhaseRacing)
		}
	})

	t.Run("a new lap ends it", func(t *testing.T) {
		e, _, _, h := raceEngine(t)
		e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'R', 'D', 'F', 'L'}})
		if e.currentPhase != PhaseRedFlag {
			t.Fatalf("phase = %v after RDFL, want %v", e.currentPhase, PhaseRedFlag)
		}
		e.ProcessPacket(ctx, lap(h, 11))
		if e.currentPhase != PhaseRacing {
			t.Fatalf("phase = %v on the next lap, want %v", e.currentPhase, PhaseRacing)
		}
	})

	t.Run("joining after a red flag starts none", func(t *testing.T) {
		b := &mockBroadcaster{}
		e := newTestEngineerEngine(b)
		h := createTestHeader(packets.PacketFormat2025, 777, 0)
		e.ProcessPacket(ctx, session(h, 1))
		e.ProcessPacket(ctx, lap(h, 30))
		if e.currentPhase != PhaseRacing {
			t.Fatalf("phase = %v when the session already had a red flag, want %v", e.currentPhase, PhaseRacing)
		}
	})
}

func TestEngineerEngine_CallHeldWhileBrakingPlaysAfterwards(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	braking := &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: 0.9, Speed: 120}}}
	wingDamage := &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{FrontLeftWingDamage: 25}}}

	e.ProcessPacket(ctx, braking)
	e.ProcessPacket(ctx, wingDamage)
	if n := spoken(t, b, "wing_damage"); n != 0 {
		t.Fatalf("wing damage was said %d times while braking, want it held", n)
	}

	clock.advance(2 * time.Second)
	e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250}}})
	if n := spoken(t, b, "wing_damage"); n != 1 {
		t.Fatalf("wing damage was said %d times after braking, want 1", n)
	}
	e.ProcessPacket(ctx, wingDamage)
	if n := spoken(t, b, "wing_damage"); n != 1 {
		t.Fatalf("wing damage was said %d times, want it said once", n)
	}
}

func TestEngineerEngine_HeldCallExpires(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	braking := &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: 0.9, Speed: 120}}}

	e.ProcessPacket(ctx, braking)
	e.ProcessPacket(ctx, &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{FrontLeftWingDamage: 25}}})
	clock.advance(time.Duration(ConditionMaxDelayMs+1) * time.Millisecond)
	e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250}}})
	if n := spoken(t, b, "wing_damage"); n != 0 {
		t.Fatalf("a held call older than its useful life was said %d times, want 0", n)
	}
}

func TestEngineerEngine_RepeatLimitAppliesToUrgentCalls(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	hot := &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250, EngineTemperature: 150}}}

	for range 30 {
		e.ProcessPacket(ctx, hot)
		clock.advance(16 * time.Millisecond)
	}
	if n := spoken(t, b, "radiator_overheat"); n != 1 {
		t.Fatalf("critical engine temperature was said %d times in half a second, want 1", n)
	}

	clock.advance(time.Duration(EngineTempMinRepeatMs) * time.Millisecond)
	e.ProcessPacket(ctx, hot)
	if n := spoken(t, b, "radiator_overheat"); n != 2 {
		t.Fatalf("critical engine temperature was said %d times after the repeat window, want 2", n)
	}
}

func TestEngineerEngine_OneCallPerCrash(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	collision := &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'C', 'O', 'L', 'L'}}
	collision.EventDetails.Data[0] = 0
	collision.EventDetails.Data[1] = 4

	for range 4 {
		e.ProcessPacket(ctx, collision)
		clock.advance(200 * time.Millisecond)
	}
	if n := spoken(t, b, "car_collision"); n != 1 {
		t.Fatalf("one crash's collision events made %d calls, want 1", n)
	}
}

func TestEngineerEngine_StartReactionIsSaidAfterTheStart(t *testing.T) {
	ctx := context.Background()
	b := &mockBroadcaster{}
	e := newTestEngineerEngine(b)
	h := createTestHeader(packets.PacketFormat2025, 9090, 0)
	lap1 := func(dist float32) *packets.PacketLapData {
		return &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, CarPosition: 4, LapDistance: dist, TotalDistance: dist, DriverStatus: packets.DriverStatusOnTrack},
		}}
	}

	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, StartReactionTime: 0.21})
	e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'S', 'T', 'L', 'G'}})
	e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'L', 'G', 'O', 'T'}})
	e.ProcessPacket(ctx, lap1(300))
	if e.currentPhase != PhaseRaceStart {
		t.Fatalf("phase = %v right after the launch, want %v", e.currentPhase, PhaseRaceStart)
	}
	if n := spoken(t, b, "start_reaction_fast"); n != 0 { // 0.21 s
		t.Fatalf("reaction time said %d times during the start, want it kept for after", n)
	}

	e.ProcessPacket(ctx, lap1(RaceStartPhaseDistanceM+200))
	if e.currentPhase != PhaseRacing {
		t.Fatalf("phase = %v past the start zone, want %v", e.currentPhase, PhaseRacing)
	}
	if n := spoken(t, b, "start_reaction_fast"); n != 1 {
		t.Fatalf("reaction time said %d times after the start, want 1", n)
	}
}

func TestEngineerEngine_SpeechTTL(t *testing.T) {
	e := newTestEngineerEngine(&mockBroadcaster{})
	tests := []struct {
		name     string
		alertKey string
		heldMs   int64
		want     int64
	}{
		{"moment call", "rival_defend", 0, MomentMaxDelayMs},
		{"default call is capped", "pit_window", 0, MaxSpeechTTLMs},
		{"condition call is capped", "tyre_wear", 0, MaxSpeechTTLMs},
		{"held call keeps what is left", "pit_window", DefaultMaxDelayMs - 8_000, 8_000},
		{"never below the floor", "rival_defend", MomentMaxDelayMs, MinSpeechTTLMs},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := e.speechTTLMs(tt.alertKey, tt.heldMs); got != tt.want {
				t.Errorf("speechTTLMs(%q, %d) = %d, want %d", tt.alertKey, tt.heldMs, got, tt.want)
			}
		})
	}
}

func TestFlagsRule_OneRainCallPerSpell(t *testing.T) {
	rule := NewFlagsRule()
	session := &packets.PacketSessionData{SessionType: packets.SessionRace, Weather: packets.WeatherOvercast, NumWeatherForecastSamples: 3}
	setRain := func(now, inFive uint8) {
		session.WeatherForecastSamples[0] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 0, RainPercentage: now}
		session.WeatherForecastSamples[1] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 5, RainPercentage: inFive}
		session.WeatherForecastSamples[2] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 10, RainPercentage: 90}
	}
	ctx := &EvaluationContext{Session: session, Packet: session, Config: DefaultEngineerConfig(), Phase: PhaseRacing}
	rainCalls := func(ticks int) int {
		n := 0
		for range ticks {
			for _, d := range rule.Evaluate(ctx) {
				if d.ID == "flags_rain" {
					n++
				}
			}
		}
		return n
	}

	setRain(60, 70)
	if n := rainCalls(10); n != 1 {
		t.Fatalf("two rainy samples in the horizon made %d calls over 10 packets, want 1", n)
	}
	setRain(10, 20)
	if n := rainCalls(3); n != 0 {
		t.Fatalf("a dry forecast made %d calls, want 0", n)
	}
	setRain(10, 80)
	if n := rainCalls(3); n != 1 {
		t.Fatalf("a new rain spell made %d calls, want 1", n)
	}

	rule = NewFlagsRule()
	session.Weather = packets.WeatherLightRain
	if n := rainCalls(3); n != 0 {
		t.Fatalf("a rain forecast while it already rains made %d calls, want 0", n)
	}
}

func TestRivalsRule_CallsTheSameCarAgainAfterItDropsBack(t *testing.T) {
	rule := NewRivalsRule()
	lapData := &packets.PacketLapData{}
	setGapBehind := func(ms uint16) {
		lapData.LapData[0] = packets.LapData{CurrentLapNum: 12, CarPosition: 5, TotalDistance: 60000}
		lapData.LapData[1] = packets.LapData{CurrentLapNum: 12, CarPosition: 6, TotalDistance: 59900, DeltaToCarInFrontMSPart: ms}
	}
	ctx := &EvaluationContext{
		Session:        &packets.PacketSessionData{SessionType: packets.SessionRace},
		LapData:        lapData,
		Packet:         lapData,
		Config:         DefaultEngineerConfig(),
		Phase:          PhaseRacing,
		PlayerCarIndex: 0,
	}
	defendCalls := func() int {
		n := 0
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "rival_defend" {
				n++
			}
		}
		return n
	}

	setGapBehind(800)
	if n := defendCalls(); n != 1 {
		t.Fatalf("car 0.8s behind made %d defend calls, want 1", n)
	}
	if n := defendCalls(); n != 0 {
		t.Fatalf("the same car still 0.8s behind made %d more calls, want 0", n)
	}
	setGapBehind(1300)
	if n := defendCalls(); n != 0 {
		t.Fatalf("car 1.3s behind made %d calls, want 0", n)
	}
	setGapBehind(1700)
	defendCalls()
	setGapBehind(800)
	if n := defendCalls(); n != 1 {
		t.Fatalf("the car closing in again after dropping back made %d calls, want 1", n)
	}
}

func TestQualyDangerPositions(t *testing.T) {
	tests := []struct {
		cars   int
		q1, q2 int
	}{
		{0, QualyQ1EliminationPositionThreshold, QualyQ2EliminationPositionThreshold},
		{20, 15, 10},
		{22, 16, 10},
	}
	for _, tt := range tests {
		q1, q2 := qualyDangerPositions(tt.cars)
		if q1 != tt.q1 || q2 != tt.q2 {
			t.Errorf("qualyDangerPositions(%d) = %d, %d, want %d, %d", tt.cars, q1, q2, tt.q1, tt.q2)
		}
	}
}
