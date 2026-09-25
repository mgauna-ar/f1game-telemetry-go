package engineer

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func weekendForecast() *packets.PacketSessionData {
	s := &packets.PacketSessionData{
		SessionType:               packets.SessionRace,
		Weather:                   packets.WeatherClear,
		NumWeatherForecastSamples: 3,
	}
	s.WeatherForecastSamples[0] = packets.WeatherForecastSample{SessionType: packets.SessionQ1, TimeOffset: 5, Weather: packets.WeatherStorm, RainPercentage: 99}
	s.WeatherForecastSamples[1] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 10, Weather: packets.WeatherLightCloud, RainPercentage: 10}
	s.WeatherForecastSamples[2] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 5, Weather: packets.WeatherClear, RainPercentage: 5}
	return s
}

func TestSessionForecast_KeepsCurrentSessionSoonestFirst(t *testing.T) {
	got := sessionForecast(weekendForecast())
	if len(got) != 2 {
		t.Fatalf("expected the 2 race samples, got %+v", got)
	}
	if got[0].TimeOffset != 5 || got[1].TimeOffset != 10 {
		t.Fatalf("expected samples sorted by time offset, got %+v", got)
	}
	if sessionForecast(nil) != nil {
		t.Fatalf("expected no samples without a session packet")
	}
}

func TestWeatherCalls_IgnoreOtherSessionsForecast(t *testing.T) {
	ctx := &EvaluationContext{
		Session: weekendForecast(),
		Status: &packets.PacketCarStatusData{
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{VisualTyreCompound: packets.CompoundMedium, TyresAgeLaps: 4},
			},
		},
		Config:         DefaultEngineerConfig(),
		PlayerCarIndex: 0,
		Phase:          PhaseRacing,
	}

	for _, rule := range []EngineerRule{NewFlagsRule(), NewTyresRule()} {
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "flags_rain" || d.ID == "tyre_crossover" {
				t.Fatalf("a qualifying storm forecast must not drive race calls, got %+v", d)
			}
		}
	}
}
