package ai

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResolveDefaultModel(t *testing.T) {
	tests := []struct {
		provider, model, want string
	}{
		{"gemini", "", "gemini-flash-latest"},
		{"", "", "gemini-flash-latest"},
		{"openai", "", "gpt-4o-mini"},
		{"claude", "", "claude-opus-5"},
		{"Claude ", "", "claude-opus-5"},
		{"gemini", " custom-model ", "custom-model"},
	}
	for _, tt := range tests {
		if got := ResolveDefaultModel(tt.provider, tt.model); got != tt.want {
			t.Errorf("ResolveDefaultModel(%q, %q) = %q; want %q", tt.provider, tt.model, got, tt.want)
		}
	}
}

func TestIsOpenAIReasoningModel(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{"o1-mini", true},
		{"o3", true},
		{"o4-mini", true},
		{"gpt-5-mini", true},
		{"GPT-5", true},
		{"gpt-4o-mini", false},
		{"gpt-4.1", false},
		{"llama3", false},
	}
	for _, tt := range tests {
		if got := IsOpenAIReasoningModel(tt.model); got != tt.want {
			t.Errorf("IsOpenAIReasoningModel(%q) = %v; want %v", tt.model, got, tt.want)
		}
	}
}

func TestResolveProvider(t *testing.T) {
	keys := ServerKeys{Gemini: "env-gem", OpenAI: "env-oai", Claude: "env-claude"}
	tests := []struct {
		name                           string
		provider, key, baseURL         string
		keys                           ServerKeys
		wantProvider, wantKey, wantURL string
		wantCode                       string
	}{
		{name: "request key wins", provider: "gemini", key: "req-key", keys: keys, wantProvider: "gemini", wantKey: "req-key"},
		{name: "defaults to gemini with its server key", keys: keys, wantProvider: "gemini", wantKey: "env-gem"},
		{name: "openai server key", provider: "openai", keys: keys, wantProvider: "openai", wantKey: "env-oai"},
		{name: "claude server key", provider: "CLAUDE", keys: keys, wantProvider: "claude", wantKey: "env-claude"},
		{name: "openai ignores the base URL", provider: "openai", baseURL: "http://localhost:11434/v1", keys: keys, wantProvider: "openai", wantKey: "env-oai"},
		{
			name: "custom uses its base URL and never a server key", provider: "custom", baseURL: "http://localhost:11434/v1", keys: keys,
			wantProvider: "custom", wantURL: "http://localhost:11434/v1",
		},
		{name: "missing key", provider: "claude", wantProvider: "claude", wantCode: AIErrorMissingAPIKey},
		{name: "unknown provider", provider: "mistral", key: "k", wantProvider: "mistral", wantCode: AIErrorGeneric},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, conn, err := resolveProvider(tt.provider, tt.key, tt.baseURL, tt.keys)
			if conn.provider != tt.wantProvider {
				t.Errorf("expected provider %q, got %q", tt.wantProvider, conn.provider)
			}
			if tt.wantCode != "" {
				var streamErr *AIStreamError
				if !errors.As(err, &streamErr) || streamErr.Code != tt.wantCode {
					t.Fatalf("expected error code %s, got %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if conn.apiKey != tt.wantKey || conn.baseURL != tt.wantURL {
				t.Errorf("expected key %q and base URL %q, got %q and %q", tt.wantKey, tt.wantURL, conn.apiKey, conn.baseURL)
			}
		})
	}
}

// livePrompt builds a live-mode prompt around a server briefing.
func livePrompt(briefing LiveBriefing, persona, language string, edit ...func(*TelemetryAnalysisContext)) string {
	tc := &TelemetryAnalysisContext{ContextMode: ContextModeLive, Live: &briefing}
	for _, e := range edit {
		e(tc)
	}
	return BuildSystemPrompt(tc, persona, language)
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
			ContextMode: ContextModeSessionDebrief,
			Debrief:     &SessionDebrief{Summary: "SESSION OVERVIEW:\n- Circuit: Silverstone\n- Session Type: Race\n- P1: Verstappen (Best: 1:28.120)"},
		}
		prompt := BuildSystemPrompt(ctx, "", "")
		if !strings.Contains(prompt, "session debrief") {
			t.Errorf("expected prompt to be session debrief prompt")
		}
		if !strings.Contains(prompt, "Circuit: Silverstone") {
			t.Errorf("expected session summary to be included in prompt")
		}
	})

	t.Run("session debrief without data", func(t *testing.T) {
		prompt := BuildSystemPrompt(&TelemetryAnalysisContext{ContextMode: ContextModeSessionDebrief}, "", "")
		if !strings.Contains(prompt, "No classification data") {
			t.Errorf("expected the debrief prompt to say there is no data, got:\n%s", prompt)
		}
	})

	t.Run("general mode", func(t *testing.T) {
		prompt := BuildSystemPrompt(&TelemetryAnalysisContext{ContextMode: ContextModeGeneral}, "", "en")
		if !strings.Contains(prompt, "personal F1 Race Engineer") || strings.Contains(prompt, "COMPARATIVE TELEMETRY DATA") {
			t.Errorf("expected the general assistant prompt, got:\n%s", prompt)
		}
	})

	t.Run("live session mode - colapinto persona in Spanish", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{Summary: "LIVE STATUS:\n- Track: Monza\n- Safety Car: Active"}, "colapinto", "es")
		if !strings.Contains(prompt, "argentino") || !strings.Contains(prompt, "gomas") {
			t.Errorf("expected prompt to contain Argentine motorsport persona")
		}
		if !strings.Contains(prompt, "1-2 short sentences") {
			t.Errorf("expected prompt to contain brevity constraint")
		}
	})

	t.Run("live session mode - colapinto persona in English", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{Summary: "LIVE STATUS:\n- Track: Monza"}, "colapinto", "en")
		if !strings.Contains(prompt, "Franco Colapinto") || !strings.Contains(prompt, "Tyres in window") { //nolint:misspell // "Tyres" is correct British English (used consistently throughout F1 codebase)
			t.Errorf("expected prompt to contain Colapinto English persona")
		}
	})

	t.Run("live session mode - bono persona in English", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{Summary: "LIVE STATUS:\n- Track: Silverstone"}, "bono", "en")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Hammer time") {
			t.Errorf("expected prompt to contain Bono English persona")
		}
	})

	t.Run("live session mode - bono persona in Spanish", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{Summary: "LIVE STATUS:\n- Track: Silverstone"}, "bono", "es")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Modo carrera") {
			t.Errorf("expected prompt to contain Bono Spanish persona")
		}
	})

	t.Run("live session mode - custom persona", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{}, "custom", "en", func(tc *TelemetryAnalysisContext) {
			tc.CustomPersonaPrompt = "You are an aggressive Red Bull strategist."
		})
		if !strings.Contains(prompt, "aggressive Red Bull strategist") {
			t.Errorf("expected prompt to contain custom persona prompt")
		}
	})

	t.Run("live session mode - default persona falls back to bono", func(t *testing.T) {
		prompt := livePrompt(LiveBriefing{}, "", "")
		if !strings.Contains(prompt, "Peter 'Bono' Bonnington") || !strings.Contains(prompt, "Hammer time") {
			t.Errorf("expected default prompt to be Bono English persona")
		}
	})

	t.Run("live session mode - standby without telemetry", func(t *testing.T) {
		prompt := BuildSystemPrompt(&TelemetryAnalysisContext{ContextMode: ContextModeLive}, "bono", "en")
		if !strings.Contains(prompt, "Standing by for live on-track telemetry") {
			t.Errorf("expected the standby text without a briefing, got:\n%s", prompt)
		}
	})

	t.Run("live session mode - with driver call-sign", func(t *testing.T) {
		promptEn := livePrompt(LiveBriefing{}, "bono", "en", func(tc *TelemetryAnalysisContext) { tc.DriverCallsign = "Max" })
		if !strings.Contains(promptEn, `DRIVER CALL-SIGN: The driver's name or call-sign is "Max"`) {
			t.Errorf("expected prompt to contain English driver call-sign directive")
		}

		promptEs := livePrompt(LiveBriefing{}, "colapinto", "es", func(tc *TelemetryAnalysisContext) { tc.DriverCallsign = "Franco" })
		if !strings.Contains(promptEs, `NOMBRE / CALL-SIGN DEL PILOTO: El nombre o apodo del piloto es "Franco"`) {
			t.Errorf("expected prompt to contain Spanish driver call-sign directive")
		}
	})

	t.Run("live session mode - qualifying session protocol", func(t *testing.T) {
		qualy := LiveBriefing{SessionType: "Qualifying 3 (Q3)", TrackName: "Silverstone", Summary: "LIVE STATUS"}
		promptEn := livePrompt(qualy, "bono", "en")
		if !strings.Contains(promptEn, "QUALIFYING PROTOCOL") || !strings.Contains(promptEn, "single-lap flying pace") {
			t.Errorf("expected prompt to contain English qualifying protocol, got: %s", promptEn)
		}

		promptEs := livePrompt(qualy, "colapinto", "es")
		if !strings.Contains(promptEs, "PROTOCOLO DE CLASIFICACIÓN / QUALY") || !strings.Contains(promptEs, "vuelta rápida lanzada") {
			t.Errorf("expected prompt to contain Spanish qualifying protocol, got: %s", promptEs)
		}
	})

	t.Run("live session mode - practice session protocol", func(t *testing.T) {
		practice := LiveBriefing{SessionType: "Practice 2 (FP2)", TrackName: "Monza", Summary: "LIVE STATUS"}
		promptEn := livePrompt(practice, "bono", "en")
		if !strings.Contains(promptEn, "FREE PRACTICE PROTOCOL") || !strings.Contains(promptEn, "setup feedback") {
			t.Errorf("expected prompt to contain English practice protocol, got: %s", promptEn)
		}

		promptEs := livePrompt(practice, "colapinto", "es")
		if !strings.Contains(promptEs, "PROTOCOLO DE PRÁCTICAS LIBRES") || !strings.Contains(promptEs, "puesta a punto") {
			t.Errorf("expected prompt to contain Spanish practice protocol, got: %s", promptEs)
		}
	})

	t.Run("live session mode - incident status", func(t *testing.T) {
		sc := LiveBriefing{IncidentStatus: "safety_car"}
		if promptEn := livePrompt(sc, "bono", "en"); !strings.Contains(promptEn, "FULL SAFETY CAR ACTIVE") {
			t.Errorf("expected prompt to contain full safety car incident directive in English, got: %s", promptEn)
		}
		if promptEs := livePrompt(sc, "colapinto", "es"); !strings.Contains(promptEs, "AUTO DE SEGURIDAD EN PISTA") {
			t.Errorf("expected prompt to contain full safety car incident directive in Spanish, got: %s", promptEs)
		}
	})

	t.Run("live session mode - 2026 mandate and driving phase protocol", func(t *testing.T) {
		promptEn := livePrompt(LiveBriefing{PacketFormat: 2026, DrivingPhase: "GRID"}, "bono", "en")
		if !strings.Contains(promptEn, "F1 2026 REGULATION MANDATE") || !strings.Contains(promptEn, "Traditional DRS DOES NOT EXIST") {
			t.Errorf("expected English prompt to mandate 2026 DRS abolition, got: %s", promptEn)
		}
		if !strings.Contains(promptEn, "STARTING GRID ACTIVE") {
			t.Errorf("expected English prompt to include starting grid protocol, got: %s", promptEn)
		}

		promptEs := livePrompt(LiveBriefing{PacketFormat: 2026, DrivingPhase: "POST_RACE"}, "colapinto", "es")
		if !strings.Contains(promptEs, "MANDATO REGLAMENTARIO F1 2026") || !strings.Contains(promptEs, "El DRS tradicional NO EXISTE") {
			t.Errorf("expected Spanish prompt to mandate 2026 DRS abolition, got: %s", promptEs)
		}
		if !strings.Contains(promptEs, "CARRERA FINALIZADA / BANDERA A CUADROS") {
			t.Errorf("expected Spanish prompt to include post-race protocol, got: %s", promptEs)
		}
	})

	t.Run("live session mode - no text sniffing", func(t *testing.T) {
		// The phase and the 2026 rules come from the engine, never from words in the summary.
		prompt := livePrompt(LiveBriefing{PacketFormat: 2025, Summary: "STATUS: STARTING GRID 2026"}, "bono", "en")
		if strings.Contains(prompt, "F1 2026 REGULATION MANDATE") || strings.Contains(prompt, "STARTING GRID ACTIVE") {
			t.Errorf("expected no 2026 mandate or grid protocol from summary text, got: %s", prompt)
		}
	})

	t.Run("with telemetry context and zoom", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{ContextMode: ContextModeComparator, Comparison: &LapComparison{
			TrackName:        "Silverstone",
			SessionTypeA:     "Qualifying",
			SessionTypeB:     "Qualifying",
			LapAName:         "Max Verstappen - Lap 5",
			LapBName:         "Lewis Hamilton - Lap 6",
			LapATime:         "1:27.097",
			LapBTime:         "1:27.340",
			TimeDeltaSeconds: -0.243,
			FasterLap:        "Lap A",
			CompoundA:        "SOFT",
			CompoundB:        "SOFT",
			SectorsA:         [3]string{"27.810s", "34.110s", "25.177s"},
			SectorsB:         [3]string{"27.950s", "34.020s", "25.370s"},
			TopSpeedA:        332.5,
			TopSpeedB:        330.1,
			ERSUsedPctA:      42.5,
			ERSUsedPctB:      50.2,
			BrakingSummary:   "Lap A brakes 8m later into Copse.",
			ApexSpeedSummary: "Lap B carries 4 km/h more speed in Stowe.",
			Zoom: &ZoomedRangeInfo{
				StartDistanceMeters: 1200,
				EndDistanceMeters:   1600,
				Description:         "Copse & Maggotts/Becketts",
				DeltaInSegment:      -0.082,
				SpeedDiffAtApex:     3.4,
				BrakingDiffMeters:   8.0,
				HasBrakingDiff:      true,
			},
		}}

		prompt := BuildSystemPrompt(ctx, "", "")
		for _, want := range []string{
			"Track: Silverstone | Session: Qualifying",
			"1:27.097",
			"Sector 3: Your time (25.177s) vs Benchmark (25.370s)",
			"ZOOMED SECTOR FOCUSED BY DRIVER",
			"Copse & Maggotts/Becketts",
			"Braking point difference: 8.0 meters",
		} {
			if !strings.Contains(prompt, want) {
				t.Errorf("expected %q in prompt:\n%s", want, prompt)
			}
		}
	})

	t.Run("with cross-session context", func(t *testing.T) {
		ctx := &TelemetryAnalysisContext{ContextMode: ContextModeComparator, Comparison: &LapComparison{
			TrackName:        "Spa-Francorchamps",
			SessionTypeA:     "Practice 1",
			SessionTypeB:     "Qualifying",
			WeatherA:         "Dry",
			WeatherB:         "Light Rain",
			CrossSession:     true,
			LapAName:         "Max Verstappen - Lap 5",
			LapBName:         "Lando Norris - Lap 8",
			LapATime:         "1:44.500",
			LapBTime:         "1:45.200",
			TimeDeltaSeconds: -0.700,
			FasterLap:        "Lap A",
		}}

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

	models, err := fetchOpenAIModels(context.Background(), connection{provider: ProviderCustom, apiKey: "bad-key", baseURL: ts.URL})
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
	if streamErr.Code != AIErrorInvalidAPIKey || streamErr.Provider != ProviderCustom {
		t.Errorf("expected an invalid key error from the custom provider, got %s from %s", streamErr.Code, streamErr.Provider)
	}
}

func TestFetchModels_FiltersByProvider(t *testing.T) {
	var gotGeminiKey, gotGeminiQuery string
	gemini := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotGeminiKey, gotGeminiQuery = r.Header.Get("x-goog-api-key"), r.URL.RawQuery
		_, _ = io.WriteString(w, `{"models":[
			{"name":"models/gemini-flash-latest","displayName":"Gemini Flash","supportedGenerationMethods":["generateContent"]},
			{"name":"models/gemini-2.5-flash-image","supportedGenerationMethods":["generateContent"]},
			{"name":"models/text-embedding-004","supportedGenerationMethods":["embedContent"]}]}`)
	}))
	defer gemini.Close()
	useGeminiBaseURL(t, gemini.URL)

	openAIModels := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"data":[{"id":"gpt-4o-mini"},{"id":"o4-mini"},{"id":"whisper-1"},{"id":"llama3.1"},{"id":"nomic-embedding"}]}`)
	}))
	defer openAIModels.Close()

	ids := func(models []AIModelItem) string {
		out := make([]string, 0, len(models))
		for _, m := range models {
			out = append(out, m.ID)
		}
		return strings.Join(out, ",")
	}

	models, provider, err := FetchModels(context.Background(), AIFetchModelsRequest{Provider: "gemini"}, ServerKeys{Gemini: "secret"})
	if err != nil || provider != "gemini" || ids(models) != "gemini-flash-latest" {
		t.Fatalf("expected only the Gemini chat model, got %q from %s (err %v)", ids(models), provider, err)
	}
	if gotGeminiKey != "secret" || strings.Contains(gotGeminiQuery, "secret") {
		t.Fatalf("expected the Gemini key in a header and not the URL, got header %q query %q", gotGeminiKey, gotGeminiQuery)
	}

	models, _, err = FetchModels(context.Background(), AIFetchModelsRequest{Provider: "custom", BaseURL: openAIModels.URL}, ServerKeys{})
	if err != nil || ids(models) != "gpt-4o-mini,o4-mini,llama3.1" {
		t.Fatalf("expected a custom server's own model names, got %q (err %v)", ids(models), err)
	}
}

func TestReadSSEData(t *testing.T) {
	body := strings.NewReader("event: ping\ndata: hello\n\ndata: \n\ndata: world\n\ndata: [DONE]\n\ndata: after done\n\n")
	var got []string
	if err := readSSEData(context.Background(), body, func(p string) { got = append(got, p) }); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Join(got, ",") != "hello,world" {
		t.Errorf("expected payloads before [DONE], got %q", got)
	}

	var last []string
	_ = readSSEData(context.Background(), strings.NewReader("data: no trailing newline"), func(p string) { last = append(last, p) })
	if len(last) != 1 || last[0] != "no trailing newline" {
		t.Errorf("expected the final unterminated line to be read, got %q", last)
	}
}

func TestSSEWriter_SendsTextOnlyThenDone(t *testing.T) {
	rec := httptest.NewRecorder()
	out := sseWriter{w: rec, flusher: rec}
	out.text("Box ")
	out.text("")
	out.text(`"now"`)
	out.done()

	want := "data: {\"text\":\"Box \"}\n\ndata: {\"text\":\"\\\"now\\\"\"}\n\ndata: [DONE]\n\n"
	if got := rec.Body.String(); got != want {
		t.Errorf("stream = %q, want %q", got, want)
	}
}

type fakeLiveRace struct {
	briefing LiveBriefing
	ok       bool
}

func (f fakeLiveRace) LiveBriefing() (LiveBriefing, bool) { return f.briefing, f.ok }

type fakeRecorded struct {
	debrief    SessionDebrief
	debriefErr error
	comparison *LapComparison
	calls      []string
	zoom       *ChatZoomRange
	focus      string
}

func (f *fakeRecorded) SessionDebrief(_ context.Context, id int64, focus string) (SessionDebrief, error) {
	f.calls = append(f.calls, "debrief")
	f.focus = focus
	return f.debrief, f.debriefErr
}

func (f *fakeRecorded) LapComparison(_ context.Context, a, b int64, zoom *ChatZoomRange) (*LapComparison, error) {
	f.calls = append(f.calls, "comparison")
	f.zoom = zoom
	return f.comparison, nil
}

func TestBuildChatContext(t *testing.T) {
	ctx := context.Background()
	briefing := LiveBriefing{
		Summary:        "LIVE PIT WALL DATA:\n- Car ahead: P2 Charles Leclerc, 1.100s ahead of you",
		TrackName:      "Silverstone",
		PacketFormat:   2026,
		IncidentStatus: "vsc",
	}
	fresh := fakeLiveRace{ok: true, briefing: briefing}
	voice := ChatOptions{CustomPersonaPrompt: "Be calm.", DriverCallsign: "Max"}

	t.Run("no context is a general chat", func(t *testing.T) {
		tc, err := BuildChatContext(ctx, nil, ChatOptions{})
		if err != nil || tc.ContextMode != ContextModeGeneral || tc.Live != nil || tc.Debrief != nil || tc.Comparison != nil {
			t.Fatalf("expected an empty general context, got %+v, %v", tc, err)
		}
	})

	t.Run("live chat uses the server's race picture", func(t *testing.T) {
		opts := voice
		opts.Live = fresh
		tc, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeLive}, opts)
		if err != nil || tc.Live == nil || tc.Live.Summary != briefing.Summary {
			t.Fatalf("expected the server briefing, got %+v, %v", tc, err)
		}
		if tc.CustomPersonaPrompt != "Be calm." || tc.DriverCallsign != "Max" {
			t.Fatalf("expected the saved voice settings on the context, got %+v", tc)
		}
		prompt := BuildSystemPrompt(tc, "bono", "en")
		if !strings.Contains(prompt, "Charles Leclerc, 1.100s ahead of you") || !strings.Contains(prompt, "USING THE PIT WALL DATA") {
			t.Fatalf("expected the prompt to carry the pit wall data and how to use it:\n%s", prompt)
		}
	})

	t.Run("live chat without fresh telemetry stands by", func(t *testing.T) {
		for _, live := range []LiveRaceSource{fakeLiveRace{ok: false}, nil} {
			tc, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeLive}, ChatOptions{Live: live})
			if err != nil || tc.Live != nil {
				t.Fatalf("expected no briefing, got %+v, %v", tc, err)
			}
		}
	})

	t.Run("debrief loads the recorded session", func(t *testing.T) {
		rec := &fakeRecorded{debrief: SessionDebrief{Summary: "P1: Verstappen"}}
		tc, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeSessionDebrief, SessionID: 7}, ChatOptions{Recorded: rec, Live: fresh})
		if err != nil || tc.Debrief == nil || tc.Debrief.Summary != "P1: Verstappen" || tc.Live != nil {
			t.Fatalf("expected the session debrief only, got %+v, %v", tc, err)
		}
	})

	t.Run("debrief passes the chart it was opened from", func(t *testing.T) {
		rec := &fakeRecorded{debrief: SessionDebrief{Summary: "P1: Verstappen", Focus: DebriefFocusStints, FocusData: "TYRE STINTS & DEGRADATION:\n- P1 Verstappen"}}
		tc, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeSessionDebrief, SessionID: 7, Focus: DebriefFocusStints}, ChatOptions{Recorded: rec})
		if err != nil || rec.focus != DebriefFocusStints {
			t.Fatalf("expected the stints focus passed to the source, got %q, %v", rec.focus, err)
		}
		prompt := BuildSystemPrompt(tc, "", "en")
		if !strings.Contains(prompt, "WHAT THE USER IS LOOKING AT") || !strings.Contains(prompt, "degradation tab") || !strings.Contains(prompt, "TYRE STINTS & DEGRADATION") {
			t.Fatalf("expected the prompt to name the chart and carry its data:\n%s", prompt)
		}
	})

	t.Run("debrief errors are returned", func(t *testing.T) {
		notFound := errors.New("session 7 not found")
		rec := &fakeRecorded{debriefErr: notFound}
		if _, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeSessionDebrief, SessionID: 7}, ChatOptions{Recorded: rec}); !errors.Is(err, notFound) {
			t.Fatalf("expected the source's error, got %v", err)
		}
	})

	t.Run("comparator needs both laps", func(t *testing.T) {
		rec := &fakeRecorded{comparison: &LapComparison{TrackName: "Monza"}}
		tc, err := BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeComparator, LapAID: 1}, ChatOptions{Recorded: rec})
		if err != nil || tc.Comparison != nil || len(rec.calls) != 0 {
			t.Fatalf("expected no comparison with one lap, got %+v, %v, calls %v", tc, err, rec.calls)
		}

		zoom := &ChatZoomRange{StartMeters: 100, EndMeters: 400}
		tc, err = BuildChatContext(ctx, &ChatContextRequest{ContextMode: ContextModeComparator, LapAID: 1, LapBID: 2, Zoom: zoom}, ChatOptions{Recorded: rec})
		if err != nil || tc.Comparison == nil || tc.Comparison.TrackName != "Monza" || rec.zoom != zoom {
			t.Fatalf("expected the lap comparison with the zoom, got %+v, %v", tc, err)
		}
	})

	t.Run("invalid requests", func(t *testing.T) {
		for name, req := range map[string]*ChatContextRequest{
			"unknown mode":        {ContextMode: "telepathy"},
			"debrief without id":  {ContextMode: ContextModeSessionDebrief},
			"unknown focus":       {ContextMode: ContextModeSessionDebrief, SessionID: 7, Focus: "weather"},
			"zoom ends too early": {ContextMode: ContextModeComparator, LapAID: 1, LapBID: 2, Zoom: &ChatZoomRange{StartMeters: 300, EndMeters: 300}},
		} {
			if _, err := BuildChatContext(ctx, req, ChatOptions{Recorded: &fakeRecorded{}}); !errors.Is(err, ErrInvalidChatContext) {
				t.Errorf("%s: expected ErrInvalidChatContext, got %v", name, err)
			}
		}
	})
}
