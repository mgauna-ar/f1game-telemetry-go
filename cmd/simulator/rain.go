package main

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// The rain scenario: the forecast, only approximate, has an 85% chance of rain in 2 minutes. It
// starts to rain at simRainStartSec, the rain gets heavy at simRainHeavySec, eases at
// simRainEaseSec and stops at simRainStopSec. The track cools 1 °C every 10 s from 32 °C while it
// rains, down to 25 °C, and warms back up once it stops.
const (
	simRainStartSec    = 40
	simRainHeavySec    = 70
	simRainEaseSec     = 120
	simRainStopSec     = 170
	simRainDryTempC    = 32
	simRainCoolTempC   = 25
	simRainTempStepSec = 10
)

// simRainWeather is the weather t seconds into the rain scenario's session.
func simRainWeather(t float32) uint8 {
	switch {
	case t < simRainStartSec:
		return packets.WeatherOvercast
	case t < simRainHeavySec:
		return packets.WeatherLightRain
	case t < simRainEaseSec:
		return packets.WeatherHeavyRain
	case t < simRainStopSec:
		return packets.WeatherLightRain
	}
	return packets.WeatherOvercast
}

// simRainTrackTemp is the track temperature t seconds into the rain scenario's session, in °C.
func simRainTrackTemp(t float32) int8 {
	steps := func(from float32) float64 { return math.Floor(float64(t-from) / simRainTempStepSec) }
	switch {
	case t < simRainStartSec:
		return simRainDryTempC
	case t < simRainStopSec:
		return int8(math.Max(simRainDryTempC-steps(simRainStartSec), simRainCoolTempC))
	}
	return int8(math.Min(simRainCoolTempC+steps(simRainStopSec), simRainDryTempC))
}
