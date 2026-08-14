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

	req := httptest.NewRequest(http.MethodGet, "/api/ai/config-status", nil)
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
		prompt := buildSystemPrompt(nil)
		if !strings.Contains(prompt, "Ingeniero de Pista") {
			t.Errorf("expected prompt to contain role definition")
		}
		if !strings.Contains(prompt, "no hay dos vueltas seleccionadas") {
			t.Errorf("expected prompt to mention no laps selected")
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
			BrakingSummary:    "Lap A frena 8m más tarde en Copse.",
			ApexSpeedSummary:  "Lap B mantiene 4 km/h más de velocidad en Stowe.",
			ZoomedRange: &ZoomedRangeInfo{
				StartDistanceMeters: 1200,
				EndDistanceMeters:   1900,
				Description:         "Copse & Maggotts/Becketts",
				DeltaInSegment:      -0.120,
				SpeedDiffAtApex:     3.5,
				BrakingDiffMeters:   5.0,
			},
		}

		prompt := buildSystemPrompt(ctx)
		if !strings.Contains(prompt, "Silverstone") {
			t.Errorf("expected track name Silverstone in prompt")
		}
		if !strings.Contains(prompt, "1:27.097") {
			t.Errorf("expected lap A time in prompt")
		}
		if !strings.Contains(prompt, "TRAMO EN ZOOM SELECCIONADO") {
			t.Errorf("expected zoomed range in prompt")
		}
		if !strings.Contains(prompt, "Copse & Maggotts/Becketts") {
			t.Errorf("expected zoomed range description in prompt")
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
