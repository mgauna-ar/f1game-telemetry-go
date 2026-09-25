package engineer

import (
	"sort"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// sessionForecast returns the weather forecast samples that belong to the
// session being driven, soonest first. The game also sends samples for the
// other sessions of the weekend (a qualifying storm, say), which must not
// drive calls in the race.
func sessionForecast(p *packets.PacketSessionData) []packets.WeatherForecastSample {
	if p == nil {
		return nil
	}
	n := min(int(p.NumWeatherForecastSamples), len(p.WeatherForecastSamples))
	var samples []packets.WeatherForecastSample
	for i := 0; i < n; i++ {
		sample := p.WeatherForecastSamples[i]
		if sample.SessionType == p.SessionType {
			samples = append(samples, sample)
		}
	}
	sort.SliceStable(samples, func(a, b int) bool { return samples[a].TimeOffset < samples[b].TimeOffset })
	return samples
}
