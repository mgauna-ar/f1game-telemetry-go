package engineer

import (
	"context"
	"encoding/binary"
	"math"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// damage sends the player's tyre wear and tyre damage.
func damage(h packets.PacketHeader, wear [4]float32, tyreDamage [4]uint8) *packets.PacketCarDamageData {
	return &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{TyresWear: wear, TyresDamage: tyreDamage}}}
}

func TestEngineerEngine_PunctureNeedsADamageJumpOrAPressureDrop(t *testing.T) {
	ctx := context.Background()
	noWear := wheels[float32](20, 20, 20, 20)

	t.Run("damage jump", func(t *testing.T) {
		e, b, clock, h := raceEngine(t)
		e.ProcessPacket(ctx, damage(h, noWear, wheels[uint8](0, 0, 0, 0)))
		clock.advance(500 * time.Millisecond)
		e.ProcessPacket(ctx, damage(h, noWear, wheels[uint8](0, 0, 45, 0)))
		if n := spoken(t, b, "tyre_puncture"); n != 1 {
			t.Fatalf("puncture said %d times after a 45%% damage jump, want 1", n)
		}
	})

	t.Run("damage that climbs slowly is no puncture", func(t *testing.T) {
		e, b, clock, h := raceEngine(t)
		for d := uint8(0); d <= 60; d += 5 {
			e.ProcessPacket(ctx, damage(h, noWear, wheels[uint8](d, 0, 0, 0)))
			clock.advance(time.Second)
		}
		if n := spoken(t, b, "tyre_puncture"); n != 0 {
			t.Fatalf("puncture said %d times for damage climbing 5%% a second, want 0", n)
		}
	})

	t.Run("pressure drop", func(t *testing.T) {
		e, b, _, h := raceEngine(t)
		tele := &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{Speed: 250, TyresPressure: wheels[float32](23.5, 23.4, 21.8, 16.5)},
		}}
		e.ProcessPacket(ctx, tele)
		if n := spoken(t, b, "tyre_puncture"); n != 1 {
			t.Fatalf("puncture said %d times with the rear right 5 PSI down, want 1", n)
		}
	})

	t.Run("a worn tyre is no puncture", func(t *testing.T) {
		e, b, _, h := raceEngine(t)
		e.ProcessPacket(ctx, damage(h, wheels[float32](96, 60, 60, 60), wheels[uint8](0, 0, 0, 0)))
		if n := spoken(t, b, "tyre_puncture"); n != 0 {
			t.Fatalf("puncture said %d times at 96%% wear, want 0", n)
		}
		if n := spoken(t, b, "tyre_worn_out"); n != 1 {
			t.Fatalf("tyre_worn_out said %d times at 96%% wear, want 1", n)
		}
	})
}

func TestTyresRule_CrossoverWaitsForTheWeather(t *testing.T) {
	cfg := DefaultEngineerConfig()
	status := func(compound uint8) *packets.PacketCarStatusData {
		return &packets.PacketCarStatusData{CarStatusData: [packets.MaxCars]packets.CarStatusData{{VisualTyreCompound: compound, TyresAgeLaps: 6}}}
	}
	session := func(weather uint8, next *packets.WeatherForecastSample) *packets.PacketSessionData {
		s := &packets.PacketSessionData{SessionType: packets.SessionRace, Weather: weather}
		if next != nil {
			s.NumWeatherForecastSamples = 1
			s.WeatherForecastSamples[0] = *next
		}
		return s
	}
	wetSoon := &packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 5, Weather: packets.WeatherLightRain, RainPercentage: 80}
	drySoon := &packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 5, Weather: packets.WeatherLightCloud, RainPercentage: 10}

	// run evaluates the rule at t=0 and again after heldMs with the same weather and tyres.
	run := func(compound, weather uint8, next *packets.WeatherForecastSample, heldMs int64) []Directive {
		rule := NewTyresRule()
		ctx := &EvaluationContext{Session: session(weather, next), Status: status(compound), Config: cfg, Phase: PhaseRacing}
		first := rule.Evaluate(ctx)
		ctx.Now = heldMs
		return append(first, rule.Evaluate(ctx)...)
	}
	crossover := func(dirs []Directive) (Directive, bool) {
		for _, d := range dirs {
			switch d.ID {
			case "tyre_crossover", "tyre_crossover_slicks", "tyre_crossover_wet", "tyre_crossover_inter":
				return d, true
			}
		}
		return Directive{}, false
	}

	tests := []struct {
		name     string
		compound uint8
		weather  uint8
		next     *packets.WeatherForecastSample
		heldMs   int64
		wantID   string // "" for no call
		wantBox  BoxCall
	}{
		{"forecast rain alone", packets.CompoundMedium, packets.WeatherOvercast, wetSoon, CrossoverRainConfirmMs, "", BoxCallNone},
		{"rain just started", packets.CompoundMedium, packets.WeatherLightRain, wetSoon, CrossoverRainConfirmMs - 1, "", BoxCallNone},
		{"rain held, still wet ahead", packets.CompoundMedium, packets.WeatherLightRain, wetSoon, CrossoverRainConfirmMs, "tyre_crossover", BoxCallInstruction},
		{"rain held, drying ahead", packets.CompoundMedium, packets.WeatherLightRain, drySoon, CrossoverRainConfirmMs, "", BoxCallNone},
		{"heavy rain is called at once", packets.CompoundSoft, packets.WeatherHeavyRain, nil, 0, "tyre_crossover", BoxCallInstruction},
		{"dry track not long enough", packets.CompoundInter, packets.WeatherLightCloud, drySoon, CrossoverDryConfirmMs - 1, "", BoxCallNone},
		{"dry track held: slicks are an option", packets.CompoundInter, packets.WeatherLightCloud, drySoon, CrossoverDryConfirmMs, "tyre_crossover_slicks", BoxCallOption},
		{"dry now but rain ahead", packets.CompoundInter, packets.WeatherLightCloud, wetSoon, CrossoverDryConfirmMs, "", BoxCallNone},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d, ok := crossover(run(tt.compound, tt.weather, tt.next, tt.heldMs))
			switch {
			case tt.wantID == "" && ok:
				t.Fatalf("expected no crossover call, got %+v", d)
			case tt.wantID != "" && !ok:
				t.Fatalf("expected %s, got none", tt.wantID)
			case ok && (d.ID != tt.wantID || d.BoxCall != tt.wantBox):
				t.Fatalf("got %s (box %v), want %s (box %v)", d.ID, d.BoxCall, tt.wantID, tt.wantBox)
			}
		})
	}
}

func TestEngineerEngine_StintStartsOnAStopWithAUsedSet(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	lap := func(lapNum, stops uint8) *packets.PacketLapData {
		return &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: lapNum, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack, NumPitStops: stops},
		}}
	}
	worn := damage(h, wheels[float32](42, 30, 30, 30), wheels[uint8](0, 0, 0, 0))

	e.ProcessPacket(ctx, worn)
	if n := spoken(t, b, "tyre_wear"); n != 1 {
		t.Fatalf("tyre_wear said %d times at 42%%, want 1", n)
	}

	// A stop for a used set (5 laps old): the tyre age never drops to zero.
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, lap(11, 1))
	e.ProcessPacket(ctx, damage(h, wheels[float32](25, 20, 20, 20), wheels[uint8](0, 0, 0, 0)))
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, worn)
	if n := spoken(t, b, "tyre_wear"); n != 2 {
		t.Fatalf("tyre_wear said %d times after a stop for a used set, want 2", n)
	}
}

func TestEngineerEngine_FlashbackReArmsDamageCalls(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	wing := func(pct uint8) *packets.PacketCarDamageData {
		return &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{FrontLeftWingDamage: pct}}}
	}

	e.ProcessPacket(ctx, wing(25))
	if n := spoken(t, b, "wing_damage"); n != 1 {
		t.Fatalf("wing damage said %d times, want 1", n)
	}
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, wing(25))
	if n := spoken(t, b, "wing_damage"); n != 1 {
		t.Fatalf("wing damage said %d times for the same damage, want 1", n)
	}

	// The driver flashes back before the crash, then crashes again.
	e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'F', 'L', 'B', 'K'}})
	e.ProcessPacket(ctx, wing(0))
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, wing(30))
	if n := spoken(t, b, "wing_damage"); n != 2 {
		t.Fatalf("wing damage said %d times after a flashback and a new crash, want 2", n)
	}
}

func TestEngineerEngine_FlashbackDropsHeldCalls(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	braking := &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Brake: 0.9, Speed: 120}}}
	e.ProcessPacket(ctx, braking)
	e.ProcessPacket(ctx, &packets.PacketCarDamageData{Header: h, CarDamageData: [packets.MaxCars]packets.CarDamageData{{FrontLeftWingDamage: 25}}})
	e.ProcessPacket(ctx, &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'F', 'L', 'B', 'K'}})

	clock.advance(2 * time.Second)
	e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250}}})
	if n := spoken(t, b, "wing_damage"); n != 0 {
		t.Fatalf("a call held before the flashback was said %d times, want 0", n)
	}
}

func TestEngineerEngine_FuelMixRestartAfterTheSafetyCar(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	session := func(sc uint8) *packets.PacketSessionData {
		return &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000, SafetyCarStatus: sc}
	}
	mix := func(m uint8) *packets.PacketCarStatusData {
		return &packets.PacketCarStatusData{Header: h, CarStatusData: [packets.MaxCars]packets.CarStatusData{{FuelMix: m, FuelRemainingLaps: 2, TyresAgeLaps: 5, ERSStoreEnergy: packets.MaxERSStoreEnergyJoules}}}
	}

	e.ProcessPacket(ctx, session(packets.SafetyCarFull))
	e.ProcessPacket(ctx, mix(packets.FuelMixStandard))
	if n := spoken(t, b, "fuel_mix_neutralized"); n != 1 {
		t.Fatalf("fuel_mix_neutralized said %d times under the Safety Car, want 1", n)
	}
	e.ProcessPacket(ctx, mix(packets.FuelMixLean))

	clock.advance(time.Minute)
	e.ProcessPacket(ctx, session(packets.SafetyCarNone))
	e.ProcessPacket(ctx, mix(packets.FuelMixLean))
	if e.currentPhase != PhaseRacing {
		t.Fatalf("phase = %v after the Safety Car, want %v", e.currentPhase, PhaseRacing)
	}
	if n := spoken(t, b, "fuel_mix_restart"); n != 1 {
		t.Fatalf("fuel_mix_restart said %d times at the restart on a lean mix, want 1", n)
	}

	// A second Safety Car is called again.
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, session(packets.SafetyCarVirtual))
	e.ProcessPacket(ctx, mix(packets.FuelMixStandard))
	if n := spoken(t, b, "fuel_mix_neutralized"); n != 2 {
		t.Fatalf("fuel_mix_neutralized said %d times by the second Safety Car, want 2", n)
	}
}

func TestEngineerEngine_EngineTemperatureStepsAreEachSaid(t *testing.T) {
	ctx := context.Background()
	e, b, clock, h := raceEngine(t)
	engine := func(c uint16) *packets.PacketCarTelemetryData {
		return &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{{Speed: 250, EngineTemperature: c}}}
	}

	e.ProcessPacket(ctx, engine(127))
	clock.advance(time.Minute)
	e.ProcessPacket(ctx, engine(137))
	if n := spoken(t, b, "radiator_overheat"); n != 1 {
		t.Fatalf("engine temperature over the limit said %d times, want 1", n)
	}
	if n := spoken(t, b, "radiator_overheat_high"); n != 1 {
		t.Fatalf("the climb to 137°C said %d times, want 1", n)
	}
}

// stopGoServed is the SGSV event of car carIdx after a stop-go of stopSec.
func stopGoServed(h packets.PacketHeader, carIdx uint8, stopSec float32) *packets.PacketEventData {
	evt := &packets.PacketEventData{Header: h, EventStringCode: [4]uint8{'S', 'G', 'S', 'V'}}
	evt.EventDetails.Data[0] = carIdx
	binary.LittleEndian.PutUint32(evt.EventDetails.Data[1:5], math.Float32bits(stopSec))
	return evt
}

func TestTrafficRule_StopGoIsNotPartOfThePitStopTime(t *testing.T) {
	cfg := DefaultEngineerConfig()
	visit := func(timerMS uint16, stopGoSec float32) []Directive {
		rule := NewTrafficRule()
		lap := func(pitStatus uint8, timer uint16) *packets.PacketLapData {
			return &packets.PacketLapData{LapData: [packets.MaxCars]packets.LapData{{CurrentLapNum: 12, PitStatus: pitStatus, PitStopTimerInMS: timer}}}
		}
		eval := func(pkt packets.Packet, laps *packets.PacketLapData) []Directive {
			return rule.Evaluate(&EvaluationContext{Packet: pkt, LapData: laps, Config: cfg, Phase: PhasePitLane})
		}
		inBox := lap(packets.PitStatusInPitArea, timerMS)
		eval(inBox, inBox)
		if stopGoSec > 0 {
			eval(stopGoServed(packets.PacketHeader{}, 0, stopGoSec), inBox)
		}
		leaving := lap(packets.PitStatusPitting, timerMS)
		return eval(leaving, leaving)
	}
	stopSec := func(dirs []Directive) (float64, bool) {
		for _, d := range dirs {
			if d.ID == "pit_stop_duration" {
				return d.Values.StopSec, true
			}
		}
		return 0, false
	}

	if got, ok := stopSec(visit(2600, 0)); !ok || got != 2.6 {
		t.Fatalf("a 2.6 s stop: stop_sec = %v (said %v), want 2.6", got, ok)
	}
	if got, ok := stopSec(visit(7600, 5)); !ok || got != 2.6 {
		t.Fatalf("a 2.6 s stop after a 5 s stop-go: stop_sec = %v (said %v), want 2.6", got, ok)
	}
	if got, ok := stopSec(visit(5200, 5)); ok {
		t.Fatalf("a stop only for the stop-go was timed: stop_sec = %v, want no call", got)
	}
}

func TestCoachingRule_BestsFromValidLapsAndNoS3FromTheInLap(t *testing.T) {
	cfg := DefaultEngineerConfig()
	race := &packets.PacketSessionData{SessionType: packets.SessionRace}
	rule := NewCoachingRule()
	eval := func(l packets.LapData) []Directive {
		laps := &packets.PacketLapData{LapData: [packets.MaxCars]packets.LapData{l}}
		return rule.Evaluate(&EvaluationContext{Packet: laps, LapData: laps, Session: race, Config: cfg, Phase: PhaseRacing})
	}
	inSector2 := func(lapNum uint8, s1MS uint16, invalid uint8) packets.LapData {
		return packets.LapData{CurrentLapNum: lapNum, Sector: 1, Sector1TimeMSPart: s1MS, CurrentLapInvalid: invalid, DriverStatus: packets.DriverStatusFlyingLap}
	}

	eval(inSector2(2, 31_000, 0))
	// A cut corner gives a fast S1 on an invalid lap: it doesn't become the best.
	eval(inSector2(3, 29_000, 1))
	if dirs := eval(inSector2(4, 31_100, 0)); len(dirs) != 0 {
		t.Fatalf("a valid S1 0.1 s off the valid best was coached: %+v", dirs)
	}
	if best := rule.GetBestSector1MS(); best != 31_000 {
		t.Fatalf("best S1 = %d, want the valid lap's 31000", best)
	}

	// Lap 5 sets the S3 to beat (30 s).
	eval(packets.LapData{CurrentLapNum: 5, DriverStatus: packets.DriverStatusFlyingLap})
	eval(packets.LapData{CurrentLapNum: 5, Sector: 2, Sector1TimeMSPart: 31_000, Sector2TimeMSPart: 30_000, DriverStatus: packets.DriverStatusFlyingLap})
	eval(packets.LapData{CurrentLapNum: 6, LastLapTimeInMS: 91_000, DriverStatus: packets.DriverStatusFlyingLap})
	if best := rule.GetBestSector3MS(); best != 30_000 {
		t.Fatalf("best S3 = %d, want 30000", best)
	}
	// Lap 6 is the in-lap, lap 7 the out-lap: the out-lap's time minus the in-lap's S1 and S2
	// would be an S3 a second off; nothing is said.
	eval(packets.LapData{CurrentLapNum: 6, Sector: 2, Sector1TimeMSPart: 31_000, Sector2TimeMSPart: 30_000, DriverStatus: packets.DriverStatusInLap})
	eval(packets.LapData{CurrentLapNum: 7, LastLapTimeInMS: 95_000, DriverStatus: packets.DriverStatusOutLap})
	if dirs := eval(packets.LapData{CurrentLapNum: 8, LastLapTimeInMS: 92_000, DriverStatus: packets.DriverStatusFlyingLap}); len(dirs) != 0 {
		t.Fatalf("the lap after a stop was coached on a made-up S3: %+v", dirs)
	}
}
