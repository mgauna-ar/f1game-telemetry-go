package main

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestSimRain(t *testing.T) {
	tests := []struct {
		t       float32
		weather uint8
		tempC   int8
	}{
		{0, packets.WeatherOvercast, 32},
		{45, packets.WeatherLightRain, 32},
		{100, packets.WeatherHeavyRain, 26},
		{130, packets.WeatherLightRain, 25},
		{175, packets.WeatherOvercast, 25},
		{250, packets.WeatherOvercast, 32},
	}
	for _, tt := range tests {
		if w, c := simRainWeather(tt.t), simRainTrackTemp(tt.t); w != tt.weather || c != tt.tempC {
			t.Errorf("at %v s: weather %d, %d °C; want %d, %d °C", tt.t, w, c, tt.weather, tt.tempC)
		}
	}
}
