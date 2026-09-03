package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResolveDefaultModel(t *testing.T) {
	if m := ResolveDefaultModel("gemini", ""); m != "gemini-flash-lite-latest" {
		t.Errorf("expected gemini-flash-lite-latest, got %s", m)
	}
	if m := ResolveDefaultModel("openai", ""); m != "gpt-4o-mini" {
		t.Errorf("expected gpt-4o-mini, got %s", m)
	}
	if m := ResolveDefaultModel("gemini", "custom-model"); m != "custom-model" {
		t.Errorf("expected custom-model, got %s", m)
	}
}

func TestResolveProviderAndKey(t *testing.T) {
	p, k := ResolveProviderAndKey("gemini", "req-key", "env-gem", "env-oai")
	if p != "gemini" || k != "req-key" {
		t.Errorf("expected gemini & req-key, got %s & %s", p, k)
	}

	p, k = ResolveProviderAndKey("", "", "env-gem", "env-oai")
	if p != "gemini" || k != "env-gem" {
		t.Errorf("expected gemini & env-gem, got %s & %s", p, k)
	}

	p, k = ResolveProviderAndKey("openai", "", "env-gem", "env-oai")
	if p != "openai" || k != "env-oai" {
		t.Errorf("expected openai & env-oai, got %s & %s", p, k)
	}
}

func TestBuildSystemPrompt(t *testing.T) {
	t.Run("nil context", func(t *testing.T) {
		prompt := BuildSystemPrompt(nil, "", "")
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
		prompt := BuildSystemPrompt(ctx, "", "")
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
		prompt := BuildSystemPrompt(ctx, "colapinto", "es")
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
		prompt := BuildSystemPrompt(ctx, "colapinto", "en")
		if !strings.Contains(prompt, "Franco Colapinto") || !strings.Contains(prompt, "Tyres in window") { //nolint:misspell // "Tyres" is correct British English (used consistently throughout F1 codebase)
			t.Errorf("expected prompt to contain Colapinto English persona")
		}
	})

	t.Run("live session mode - bono persona in English", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Gap: +1.2s",
		}
		prompt := BuildSystemPrompt(ctx, "bono", "en")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Hammer time") {
			t.Errorf("expected prompt to contain Bono English persona")
		}
	})

	t.Run("live session mode - bono persona in Spanish", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Gap: +1.2s",
		}
		prompt := BuildSystemPrompt(ctx, "bono", "es")
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
		prompt := BuildSystemPrompt(ctx, "custom", "en")
		if !strings.Contains(prompt, "aggressive Red Bull strategist") {
			t.Errorf("expected prompt to contain custom persona prompt")
		}
	})

	t.Run("live session mode - default persona falls back to bono", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{
			ContextMode: "live",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Gap: +1.2s",
		}
		prompt := BuildSystemPrompt(ctx, "", "")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Hammer time") {
			t.Errorf("expected default prompt to be Bono English persona")
		}
	})

	t.Run("live session mode - with driver call-sign", func(t *testing.T) {
		ctxEn := &TelemetryAnalysisContext{
			ContextMode:    "live",
			LiveSummary:    "LIVE STATUS:\n- Track: Silverstone",
			DriverCallsign: "Max",
		}
		promptEn := BuildSystemPrompt(ctxEn, "bono", "en")
		if !strings.Contains(promptEn, `DRIVER CALL-SIGN: The driver's name or call-sign is "Max"`) {
			t.Errorf("expected prompt to contain English driver call-sign directive")
		}

		ctxEs := &TelemetryAnalysisContext{
			ContextMode:    "live",
			LiveSummary:    "LIVE STATUS:\n- Track: Monza",
			DriverCallsign: "Franco",
		}
		promptEs := BuildSystemPrompt(ctxEs, "colapinto", "es")
		if !strings.Contains(promptEs, `NOMBRE / CALL-SIGN DEL PILOTO: El nombre o apodo del piloto es "Franco"`) {
			t.Errorf("expected prompt to contain Spanish driver call-sign directive")
		}
	})

	t.Run("live session mode - qualifying session protocol", func(t *testing.T) {
		ctxQualy := &TelemetryAnalysisContext{
			ContextMode: "live",
			SessionType: "Qualifying 3 (Q3)",
			TrackName:   "Silverstone",
			LiveSummary: "LIVE STATUS:\n- Track: Silverstone\n- Session: Qualifying 3 (Q3)",
		}
		promptEn := BuildSystemPrompt(ctxQualy, "bono", "en")
		if !strings.Contains(promptEn, "QUALIFYING PROTOCOL") || !strings.Contains(promptEn, "single-lap flying pace") {
			t.Errorf("expected prompt to contain English qualifying protocol, got: %s", promptEn)
		}

		promptEs := BuildSystemPrompt(ctxQualy, "colapinto", "es")
		if !strings.Contains(promptEs, "PROTOCOLO DE CLASIFICACIÓN / QUALY") || !strings.Contains(promptEs, "vuelta rápida lanzada") {
			t.Errorf("expected prompt to contain Spanish qualifying protocol, got: %s", promptEs)
		}
	})

	t.Run("live session mode - practice session protocol", func(t *testing.T) {
		ctxPractice := &TelemetryAnalysisContext{
			ContextMode: "live",
			SessionType: "Practice 2 (FP2)",
			TrackName:   "Monza",
			LiveSummary: "LIVE STATUS:\n- Track: Monza\n- Session: Practice 2 (FP2)",
		}
		promptEn := BuildSystemPrompt(ctxPractice, "bono", "en")
		if !strings.Contains(promptEn, "FREE PRACTICE PROTOCOL") || !strings.Contains(promptEn, "setup feedback") {
			t.Errorf("expected prompt to contain English practice protocol, got: %s", promptEn)
		}

		promptEs := BuildSystemPrompt(ctxPractice, "colapinto", "es")
		if !strings.Contains(promptEs, "PROTOCOLO DE PRÁCTICAS LIBRES") || !strings.Contains(promptEs, "puesta a punto") {
			t.Errorf("expected prompt to contain Spanish practice protocol, got: %s", promptEs)
		}
	})

	t.Run("live session mode - dynamic urgency and incident status", func(t *testing.T) {
		ctxCrit := &TelemetryAnalysisContext{
			ContextMode:    "live",
			UrgencyLevel:   "critical",
			IncidentStatus: "safety_car",
		}
		promptEn := BuildSystemPrompt(ctxCrit, "bono", "en")
		if !strings.Contains(promptEn, "CRITICAL EMERGENCY") {
			t.Errorf("expected prompt to contain critical urgency in English, got: %s", promptEn)
		}
		if !strings.Contains(promptEn, "FULL SAFETY CAR ACTIVE") {
			t.Errorf("expected prompt to contain full safety car incident directive in English, got: %s", promptEn)
		}

		promptEs := BuildSystemPrompt(ctxCrit, "colapinto", "es")
		if !strings.Contains(promptEs, "EMERGENCIA CRÍTICA") {
			t.Errorf("expected prompt to contain critical urgency in Spanish, got: %s", promptEs)
		}
		if !strings.Contains(promptEs, "AUTO DE SEGURIDAD EN PISTA") {
			t.Errorf("expected prompt to contain full safety car incident directive in Spanish, got: %s", promptEs)
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

		prompt := BuildSystemPrompt(ctx, "", "")
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

		prompt := BuildSystemPrompt(ctx, "", "")
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

func TestParseGeminiError(t *testing.T) {
	t.Run("overloaded 503", func(t *testing.T) {
		body := []byte(`{"error": {"code": 503, "message": "The model is overloaded. Please try again later.", "status": "UNAVAILABLE"}}`)
		err := ParseGeminiError(503, body)
		if err.Code != AIErrorModelOverloaded {
			t.Errorf("expected code %s, got %s", AIErrorModelOverloaded, err.Code)
		}
		if err.Provider != "gemini" {
			t.Errorf("expected provider gemini, got %s", err.Provider)
		}
	})

	t.Run("quota exhausted 429", func(t *testing.T) {
		body := []byte(`{"error": {"code": 429, "message": "Resource has been exhausted (e.g. check quota).", "status": "RESOURCE_EXHAUSTED"}}`)
		err := ParseGeminiError(429, body)
		if err.Code != AIErrorQuotaExceeded {
			t.Errorf("expected code %s, got %s", AIErrorQuotaExceeded, err.Code)
		}
	})

	t.Run("invalid api key 400", func(t *testing.T) {
		body := []byte(`{"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}`)
		err := ParseGeminiError(400, body)
		if err.Code != AIErrorInvalidAPIKey {
			t.Errorf("expected code %s, got %s", AIErrorInvalidAPIKey, err.Code)
		}
	})

	t.Run("model not found 404", func(t *testing.T) {
		body := []byte(`{"error": {"code": 404, "message": "models/nonexistent is not found", "status": "NOT_FOUND"}}`)
		err := ParseGeminiError(404, body)
		if err.Code != AIErrorModelNotFound {
			t.Errorf("expected code %s, got %s", AIErrorModelNotFound, err.Code)
		}
	})
}

func TestParseOpenAIError(t *testing.T) {
	t.Run("insufficient quota 429", func(t *testing.T) {
		body := []byte(`{"error": {"message": "You exceeded your current quota, please check your plan and billing details.", "type": "insufficient_quota", "code": "insufficient_quota"}}`)
		err := ParseOpenAIError(429, body, "openai")
		if err.Code != AIErrorQuotaExceeded {
			t.Errorf("expected code %s, got %s", AIErrorQuotaExceeded, err.Code)
		}
	})

	t.Run("invalid key 401", func(t *testing.T) {
		body := []byte(`{"error": {"message": "Incorrect API key provided", "type": "invalid_request_error", "code": "invalid_api_key"}}`)
		err := ParseOpenAIError(401, body, "openai")
		if err.Code != AIErrorInvalidAPIKey {
			t.Errorf("expected code %s, got %s", AIErrorInvalidAPIKey, err.Code)
		}
	})

	t.Run("overloaded 503", func(t *testing.T) {
		body := []byte(`{"error": {"message": "The server is currently overloaded with other requests.", "type": "server_error"}}`)
		err := ParseOpenAIError(503, body, "openai")
		if err.Code != AIErrorModelOverloaded {
			t.Errorf("expected code %s, got %s", AIErrorModelOverloaded, err.Code)
		}
	})
}

func TestFetchOpenAIModels_ErrorHandling(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"Incorrect API key provided","type":"invalid_request_error","code":"invalid_api_key"}}`))
	}))
	defer ts.Close()

	models, err := FetchOpenAIModels(context.Background(), ts.URL, "bad-key")
	if err == nil {
		t.Fatalf("expected error from unauthorized response, got nil")
	}
	if models != nil {
		t.Fatalf("expected nil models on error, got %v", models)
	}

	streamErr, ok := err.(*AIStreamError)
	if !ok {
		t.Fatalf("expected *AIStreamError, got %T: %v", err, err)
	}
	if streamErr.Code != AIErrorInvalidAPIKey {
		t.Errorf("expected code %s, got %s", AIErrorInvalidAPIKey, streamErr.Code)
	}
}

func TestStreamSSEResponse(t *testing.T) {
	ctx := context.Background()
	body := strings.NewReader("data: hello\n\ndata: world\n\ndata: [DONE]\n\n")
	rec := httptest.NewRecorder()

	err := streamSSEResponse(ctx, body, rec, rec, strings.ToUpper)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := rec.Body.String()
	if !strings.Contains(output, "HELLO") || !strings.Contains(output, "WORLD") || !strings.Contains(output, "data: [DONE]\n\n") {
		t.Errorf("unexpected sse output: %s", output)
	}
}
