package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleAIConfigStatus(t *testing.T) {
	server, _ := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/ai/config-status", http.NoBody)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var status AIConfigStatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode config status response: %v", err)
	}

	if status.DefaultProvider == "" {
		t.Errorf("expected default provider to be populated")
	}
	if status.DefaultModel == "" {
		t.Errorf("expected default model to be populated")
	}
}

func TestBuildSystemPrompt(t *testing.T) {
	t.Run("nil context", func(t *testing.T) {
		prompt := buildSystemPrompt(nil, "", "")
		if !strings.Contains(prompt, "Race Engineer") {
			t.Errorf("expected prompt to contain role definition")
		}
		if !strings.Contains(prompt, "specific telemetry data is not active") {
			t.Errorf("expected prompt to mention no specific telemetry active")
		}
	})

	t.Run("session debrief mode", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode:    "session_debrief",
			SessionSummary: "SESSION OVERVIEW:\n- Circuit: Silverstone\n- Session Type: Race\n- P1: Verstappen (Best: 1:28.120)",
		}
		prompt := buildSystemPrompt(ctx, "", "")
		if !strings.Contains(prompt, "session debrief") {
			t.Errorf("expected prompt to be session debrief prompt")
		}
		if !strings.Contains(prompt, "Circuit: Silverstone") {
			t.Errorf("expected session summary to be included in prompt")
		}
	})

	t.Run("live session mode - colapinto persona in Spanish", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Monza\n- Safety Car: Active\n- Rain: 85% in 5 min",
		}
		prompt := buildSystemPrompt(ctx, "colapinto", "es")
		if !strings.Contains(prompt, "argentino") || !strings.Contains(prompt, "gomas") {
			t.Errorf("expected prompt to contain Argentine motorsport persona")
		}
		if !strings.Contains(prompt, "MAXIMUM 2 SHORT SENTENCES") {
			t.Errorf("expected prompt to contain brevity constraint")
		}
	})

	t.Run("live session mode - colapinto persona in English", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Monza\n- Safety Car: Active",
		}
		prompt := buildSystemPrompt(ctx, "colapinto", "en")
		if !strings.Contains(prompt, "Franco Colapinto") || !strings.Contains(prompt, "Tyres in window") {
			t.Errorf("expected prompt to contain Colapinto English persona")
		}
	})

	t.Run("live session mode - bono persona in English", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Gap: +1.2s",
		}
		prompt := buildSystemPrompt(ctx, "bono", "en")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Hammer time") {
			t.Errorf("expected prompt to contain Bono English persona")
		}
	})

	t.Run("live session mode - bono persona in Spanish", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Gap: +1.2s",
		}
		prompt := buildSystemPrompt(ctx, "bono", "es")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Modo carrera") {
			t.Errorf("expected prompt to contain Bono Spanish persona")
		}
	})

	t.Run("live session mode - custom persona", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode:         "live",
			LiveSummary:         "LIVE STATUS:\n- Track: Spa",
			CustomPersonaPrompt: "You are an aggressive Red Bull strategist.",
		}
		prompt := buildSystemPrompt(ctx, "custom", "en")
		if !strings.Contains(prompt, "aggressive Red Bull strategist") {
			t.Errorf("expected prompt to contain custom persona prompt")
		}
	})

	t.Run("with telemetry context and zoom", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			TrackName:         "Silverstone",
			SessionType:       "Qualifying",
			LapAName:          "Max Verstappen - Lap 5",
			LapBName:          "Lewis Hamilton - Lap 6",
			LapATimeFormatted: "1:27.097",
			LapBTimeFormatted: "1:27.340",
			TimeDeltaSeconds:  -0.243,
			FasterLap:         "Lap A",
			LapACompound:      "SOFT",
			LapBCompound:      "SOFT",
			LapAS1Formatted:   "27.810",
			LapBS1Formatted:   "27.950",
			LapAS2Formatted:   "34.110",
			LapBS2Formatted:   "34.020",
			LapAS3Formatted:   "25.177",
			LapBS3Formatted:   "25.370",
			TopSpeedA:         332.5,
			TopSpeedB:         330.1,
			ERSAUsedPercent:   42.5,
			ERSBUsedPercent:   50.2,
			BrakingSummary:    "Lap A brakes 8m later into Copse.",
			ApexSpeedSummary:  "Lap B carries 4 km/h more speed in Stowe.",
			ZoomedRange: &ZoomedRangeInfo{
				StartDistanceMeters: 1200,
				EndDistanceMeters:   1600,
				Description:         "Copse & Maggotts/Becketts",
				DeltaInSegment:      -0.082,
				SpeedDiffAtApex:     3.4,
				BrakingDiffMeters:   8.0,
			},
		}

		prompt := buildSystemPrompt(ctx, "", "")
		if !strings.Contains(prompt, "Silverstone") {
			t.Errorf("expected track name Silverstone in prompt")
		}
		if !strings.Contains(prompt, "1:27.097") {
			t.Errorf("expected lap A time in prompt")
		}
		if !strings.Contains(prompt, "ZOOMED SECTOR FOCUSED BY DRIVER") {
			t.Errorf("expected zoomed range in prompt")
		}
		if !strings.Contains(prompt, "Copse & Maggotts/Becketts") {
			t.Errorf("expected zoomed range description in prompt")
		}
	})

	t.Run("with cross-session context", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			TrackName:         "Spa-Francorchamps",
			SessionType:       "Practice 1",
			SessionBType:      "Qualifying",
			WeatherA:          "Dry",
			WeatherB:          "Light Rain",
			CrossSession:      true,
			LapAName:          "Max Verstappen - Lap 5",
			LapBName:          "Lando Norris - Lap 8",
			LapATimeFormatted: "1:44.500",
			LapBTimeFormatted: "1:45.200",
			TimeDeltaSeconds:  -0.700,
			FasterLap:         "Lap A",
		}

		prompt := buildSystemPrompt(ctx, "", "")
		if !strings.Contains(prompt, "Cross-Session Comparison") {
			t.Errorf("expected prompt to mention Cross-Session Comparison")
		}
		if !strings.Contains(prompt, "Lap A Session: Practice 1 (Weather: Dry)") {
			t.Errorf("expected Lap A session and weather")
		}
		if !strings.Contains(prompt, "Lap B Session: Qualifying (Weather: Light Rain)") {
			t.Errorf("expected Lap B session and weather")
		}
	})
}

func TestHandleAIChat_Validation(t *testing.T) {
	server, _ := setupTestServer(t)

	t.Run("invalid json payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/ai/chat", strings.NewReader("not a json"))
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	t.Run("missing api key with no env key", func(t *testing.T) {
		payload := AIChatRequest{
			Provider: "gemini",
			APIKey:   "",
			Messages: []AIChatMessage{
				{Role: "user", Content: "Analiza el sector 1"},
			},
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/chat", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, req)

		// Unless GEMINI_API_KEY is in host environment, this should return 401 Unauthorized
		if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusOK {
			t.Errorf("expected 401 or 200 (if host env set), got %d", rec.Code)
		}
	})
}

func TestHandleAIFetchModels_Validation(t *testing.T) {
	server, _ := setupTestServer(t)

	t.Run("invalid json payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/ai/models", strings.NewReader("bad"))
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	t.Run("missing api key", func(t *testing.T) {
		payload := AIFetchModelsRequest{
			Provider: "gemini",
			APIKey:   "",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/ai/models", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusOK {
			t.Errorf("expected 401 or 200 (if host env set), got %d", rec.Code)
		}
	})
}

func TestParseGeminiError(t *testing.T) {
	t.Run("overloaded 503", func(t *testing.T) {
		body := []byte(`{"error": {"code": 503, "message": "The model is overloaded. Please try again later.", "status": "UNAVAILABLE"}}`)
		err := parseGeminiError(503, body)
		if err.Code != AIErrorModelOverloaded {
			t.Errorf("expected code %s, got %s", AIErrorModelOverloaded, err.Code)
		}
		if err.Provider != "gemini" {
			t.Errorf("expected provider gemini, got %s", err.Provider)
		}
	})

	t.Run("quota exhausted 429", func(t *testing.T) {
		body := []byte(`{"error": {"code": 429, "message": "Resource has been exhausted (e.g. check quota).", "status": "RESOURCE_EXHAUSTED"}}`)
		err := parseGeminiError(429, body)
		if err.Code != AIErrorQuotaExceeded {
			t.Errorf("expected code %s, got %s", AIErrorQuotaExceeded, err.Code)
		}
	})

	t.Run("invalid api key 400", func(t *testing.T) {
		body := []byte(`{"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}`)
		err := parseGeminiError(400, body)
		if err.Code != AIErrorInvalidAPIKey {
			t.Errorf("expected code %s, got %s", AIErrorInvalidAPIKey, err.Code)
		}
	})

	t.Run("model not found 404", func(t *testing.T) {
		body := []byte(`{"error": {"code": 404, "message": "models/nonexistent is not found", "status": "NOT_FOUND"}}`)
		err := parseGeminiError(404, body)
		if err.Code != AIErrorModelNotFound {
			t.Errorf("expected code %s, got %s", AIErrorModelNotFound, err.Code)
		}
	})
}

func TestParseOpenAIError(t *testing.T) {
	t.Run("insufficient quota 429", func(t *testing.T) {
		body := []byte(`{"error": {"message": "You exceeded your current quota, please check your plan and billing details.", "type": "insufficient_quota", "code": "insufficient_quota"}}`)
		err := parseOpenAIError(429, body, "openai")
		if err.Code != AIErrorQuotaExceeded {
			t.Errorf("expected code %s, got %s", AIErrorQuotaExceeded, err.Code)
		}
	})

	t.Run("invalid key 401", func(t *testing.T) {
		body := []byte(`{"error": {"message": "Incorrect API key provided", "type": "invalid_request_error", "code": "invalid_api_key"}}`)
		err := parseOpenAIError(401, body, "openai")
		if err.Code != AIErrorInvalidAPIKey {
			t.Errorf("expected code %s, got %s", AIErrorInvalidAPIKey, err.Code)
		}
	})

	t.Run("overloaded 503", func(t *testing.T) {
		body := []byte(`{"error": {"message": "The server is currently overloaded with other requests.", "type": "server_error"}}`)
		err := parseOpenAIError(503, body, "openai")
		if err.Code != AIErrorModelOverloaded {
			t.Errorf("expected code %s, got %s", AIErrorModelOverloaded, err.Code)
		}
	})
}
