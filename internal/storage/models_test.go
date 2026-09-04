package storage

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSession_MarshalJSON(t *testing.T) {
	tests := []struct {
		name            string
		session         Session
		expectedSnippet string
	}{
		{
			name: "Non-empty weather forecast array",
			session: Session{
				ID:              1,
				SessionUID:      "0x1234567890ABCDEF",
				TrackName:       "Monza",
				WeatherForecast: `[{"TimeOffset":0,"Weather":1,"RainPercentage":10}]`,
			},
			expectedSnippet: `"weather_forecast":[{"TimeOffset":0,"Weather":1,"RainPercentage":10}]`,
		},
		{
			name: "Empty weather forecast string",
			session: Session{
				ID:              2,
				SessionUID:      "0x1234567890ABCDEF",
				TrackName:       "Spa",
				WeatherForecast: "",
			},
			expectedSnippet: `"weather_forecast":[]`,
		},
		{
			name: "Whitespace weather forecast string",
			session: Session{
				ID:              3,
				SessionUID:      "0x1234567890ABCDEF",
				TrackName:       "Silverstone",
				WeatherForecast: "   ",
			},
			expectedSnippet: `"weather_forecast":[]`,
		},
		{
			name: "Null weather forecast string",
			session: Session{
				ID:              4,
				SessionUID:      "0x1234567890ABCDEF",
				TrackName:       "Monaco",
				WeatherForecast: "null",
			},
			expectedSnippet: `"weather_forecast":[]`,
		},
		{
			name: "Invalid JSON weather forecast string",
			session: Session{
				ID:              5,
				SessionUID:      "0x1234567890ABCDEF",
				TrackName:       "Suzuka",
				WeatherForecast: "invalid-json-text",
			},
			expectedSnippet: `"weather_forecast":[]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.session)
			if err != nil {
				t.Fatalf("json.Marshal failed: %v", err)
			}
			jsonStr := string(data)
			if !strings.Contains(jsonStr, tt.expectedSnippet) {
				t.Errorf("expected snippet %s in output, got: %s", tt.expectedSnippet, jsonStr)
			}
		})
	}
}

func TestSession_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name             string
		jsonInput        string
		expectedForecast string
	}{
		{
			name:             "Raw JSON array weather forecast",
			jsonInput:        `{"id":1,"weather_forecast":[{"TimeOffset":5,"Weather":3}]}`,
			expectedForecast: `[{"TimeOffset":5,"Weather":3}]`,
		},
		{
			name:             "Quoted JSON string weather forecast (legacy)",
			jsonInput:        `{"id":2,"weather_forecast":"[{\"TimeOffset\":5,\"Weather\":3}]"}`,
			expectedForecast: `[{"TimeOffset":5,"Weather":3}]`,
		},
		{
			name:             "Null weather forecast",
			jsonInput:        `{"id":3,"weather_forecast":null}`,
			expectedForecast: "",
		},
		{
			name:             "Empty array weather forecast",
			jsonInput:        `{"id":4,"weather_forecast":[]}`,
			expectedForecast: "[]",
		},
		{
			name:             "Missing weather forecast",
			jsonInput:        `{"id":5}`,
			expectedForecast: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var s Session
			if err := json.Unmarshal([]byte(tt.jsonInput), &s); err != nil {
				t.Fatalf("json.Unmarshal failed: %v", err)
			}
			if s.WeatherForecast != tt.expectedForecast {
				t.Errorf("expected WeatherForecast %q, got %q", tt.expectedForecast, s.WeatherForecast)
			}
		})
	}
}
