package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func newSettingsTestServer(t *testing.T, cfg ServerConfig) (*Server, storage.Repository) {
	t.Helper()
	repo, err := storage.NewSQLiteRepository(filepath.Join(t.TempDir(), "settings.db"))
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	t.Cleanup(func() { repo.Close() })
	hub := NewHub()
	return NewServerWithFS(repo, hub, hub, fstest.MapFS{}, cfg), repo
}

func doJSON(t *testing.T, s *Server, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	s.Router().ServeHTTP(rec, req)
	return rec
}

func decodeAISettings(t *testing.T, rec *httptest.ResponseRecorder) AISettingsResponse {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	var resp AISettingsResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode AI settings: %v", err)
	}
	return resp
}

func TestAISettings_KeysAreSavedButNeverReturned(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})
	const secret = "sk-ant-very-secret"

	rec := doJSON(t, server, http.MethodPut, "/api/settings/ai", map[string]any{
		"provider": "claude",
		"models":   map[string]string{"claude": "claude-test"},
		"api_keys": map[string]string{"claude": secret},
	})
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatal("PUT response contains the API key")
	}
	put := decodeAISettings(t, rec)
	if !put.Saved || put.Provider != settings.ProviderClaude {
		t.Errorf("PUT response = %+v, want saved claude", put)
	}

	rec = doJSON(t, server, http.MethodGet, "/api/settings/ai", nil)
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatal("GET response contains the API key")
	}
	got := decodeAISettings(t, rec)
	claude := got.Providers[settings.ProviderClaude]
	if !claude.HasSavedKey || claude.HasEnvKey || claude.Model != "claude-test" {
		t.Errorf("claude status = %+v, want a saved key and the saved model", claude)
	}
	for _, p := range settings.Providers {
		if _, ok := got.Providers[p]; !ok {
			t.Errorf("response is missing provider %s", p)
		}
	}
}

func TestAISettings_EnvVarsApplyUntilTheDashboardSaves(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{
		GeminiAPIKey: "g-env",
		OpenAIAPIKey: "o-env",
		LLMProvider:  "openai",
		LLMModel:     "gpt-env",
	})

	got := decodeAISettings(t, doJSON(t, server, http.MethodGet, "/api/settings/ai", nil))
	if got.Saved || got.Provider != settings.ProviderOpenAI {
		t.Errorf("got saved %v provider %q, want unsaved openai from LLM_PROVIDER", got.Saved, got.Provider)
	}
	if got.Providers[settings.ProviderOpenAI].Model != "gpt-env" {
		t.Errorf("openai model = %q, want LLM_MODEL", got.Providers[settings.ProviderOpenAI].Model)
	}
	if got.Providers[settings.ProviderGemini].Model != ai.DefaultGeminiModel {
		t.Errorf("gemini model = %q, want the built-in default", got.Providers[settings.ProviderGemini].Model)
	}
	if !got.Providers[settings.ProviderGemini].HasEnvKey || got.Providers[settings.ProviderClaude].HasEnvKey {
		t.Error("env key flags don't match the env vars")
	}

	rec := doJSON(t, server, http.MethodGet, "/api/ai/config-status", nil)
	var status ai.AIConfigStatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("decode config status: %v", err)
	}
	if status.DefaultProvider != "openai" || status.DefaultModel != "gpt-env" || !status.HasGeminiEnvKey || !status.HasOpenAIEnvKey {
		t.Errorf("config-status = %+v, want it to agree with the AI settings", status)
	}

	got = decodeAISettings(t, doJSON(t, server, http.MethodPut, "/api/settings/ai", map[string]any{"provider": "gemini"}))
	if got.Provider != settings.ProviderGemini {
		t.Errorf("provider after saving = %q, the dashboard choice must win over LLM_PROVIDER", got.Provider)
	}
}

func TestAISettings_RejectsUnknownProviders(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})
	for _, body := range []map[string]any{
		{"provider": "skynet"},
		{"api_keys": map[string]string{"skynet": "key"}},
		{"base_url": "ftp://example.com"},
	} {
		if rec := doJSON(t, server, http.MethodPut, "/api/settings/ai", body); rec.Code != http.StatusBadRequest {
			t.Errorf("PUT %v = %d, want 400", body, rec.Code)
		}
	}
}

// modelsEndpoint is a fake OpenAI-compatible server that records the Authorization header it gets.
func modelsEndpoint(t *testing.T) (server *httptest.Server, lastAuth func() string) {
	t.Helper()
	var mu sync.Mutex
	auth := ""
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		auth = r.Header.Get("Authorization")
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"llama3"}]}`))
	}))
	t.Cleanup(ts.Close)
	return ts, func() string {
		mu.Lock()
		defer mu.Unlock()
		return auth
	}
}

func TestAIModels_UsesTheSavedEndpointAndKeyOnlyForThatEndpoint(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})
	saved, savedAuth := modelsEndpoint(t)
	other, otherAuth := modelsEndpoint(t)

	decodeAISettings(t, doJSON(t, server, http.MethodPut, "/api/settings/ai", map[string]any{
		"provider": "custom",
		"base_url": saved.URL,
		"api_keys": map[string]string{"custom": "c-key"},
	}))

	if rec := doJSON(t, server, http.MethodPost, "/api/ai/models", map[string]any{}); rec.Code != http.StatusOK {
		t.Fatalf("models with an empty request = %d, body %s", rec.Code, rec.Body.String())
	}
	if got := savedAuth(); got != "Bearer c-key" {
		t.Errorf("saved endpoint got Authorization %q, want the saved key", got)
	}

	rec := doJSON(t, server, http.MethodPost, "/api/ai/models", map[string]any{"provider": "custom", "base_url": other.URL})
	if rec.Code != http.StatusOK {
		t.Fatalf("models with another base URL = %d, body %s", rec.Code, rec.Body.String())
	}
	if got := otherAuth(); got != "" {
		t.Errorf("another endpoint got Authorization %q, the saved key must not be sent there", got)
	}
}

func TestVoiceSettings_RoundTrip(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})

	var before VoiceSettingsResponse
	if err := json.NewDecoder(doJSON(t, server, http.MethodGet, "/api/settings/voice", nil).Body).Decode(&before); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if before.Saved {
		t.Error("voice settings must report not saved on a fresh database")
	}

	voice := settings.Voice{Persona: "custom", Language: "es", CustomPrompt: "Calm", DriverCallsign: "Mati", NeuralVoice: "es-AR-TomasNeural", SpeechRate: 5, SpeechPitch: -10}
	if rec := doJSON(t, server, http.MethodPut, "/api/settings/voice", voice); rec.Code != http.StatusOK {
		t.Fatalf("PUT voice = %d", rec.Code)
	}

	var after VoiceSettingsResponse
	if err := json.NewDecoder(doJSON(t, server, http.MethodGet, "/api/settings/voice", nil).Body).Decode(&after); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !after.Saved || after.Voice != voice {
		t.Errorf("GET voice = %+v, want saved %+v", after, voice)
	}
}

// recordingInputManager is a mock input manager that keeps the last mapping per device type.
type recordingInputManager struct {
	*mockInputManager
	mu       sync.Mutex
	joystick input.Mapping
	keyboard input.Mapping
}

func (m *recordingInputManager) SetMapping(mapping input.Mapping) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if mapping.DeviceType == input.DeviceTypeJoystick {
		m.joystick = mapping
	} else {
		m.keyboard = mapping
	}
}

func (m *recordingInputManager) mappings() (joystick, keyboard input.Mapping) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.joystick, m.keyboard
}

func TestPTTSettings_SavedAppliedAndRestoredAfterRestart(t *testing.T) {
	server, repo := newSettingsTestServer(t, ServerConfig{})
	mgr := &recordingInputManager{mockInputManager: newMockInputManager()}
	server.SetInputManager(mgr)

	ptt := settings.PTT{Mode: settings.PTTModeToggle, KeyboardKey: "F12", KeyCode: 0x7B, Gamepad: &settings.GamepadButton{GamepadIndex: 0, ButtonIndex: 6}}
	if rec := doJSON(t, server, http.MethodPut, "/api/settings/ptt", ptt); rec.Code != http.StatusOK {
		t.Fatalf("PUT ptt = %d, body %s", rec.Code, rec.Body.String())
	}
	joy, key := mgr.mappings()
	if joy.ButtonIndex != 6 || key.KeyCode != 0x7B {
		t.Errorf("input manager got joystick %+v keyboard %+v, want the saved buttons", joy, key)
	}

	// A new server on the same database (an app restart) restores the mappings on its own.
	restarted := NewServerWithFS(repo, NewHub(), NewHub(), fstest.MapFS{}, ServerConfig{})
	freshMgr := &recordingInputManager{mockInputManager: newMockInputManager()}
	restarted.SetInputManager(freshMgr)
	t.Cleanup(func() { restarted.SetInputManager(nil) })
	joy, key = freshMgr.mappings()
	if joy.ButtonIndex != 6 || key.KeyCode != 0x7B {
		t.Errorf("after restart the input manager got joystick %+v keyboard %+v, want the saved buttons", joy, key)
	}

	var got PTTSettingsResponse
	if err := json.NewDecoder(doJSON(t, restarted, http.MethodGet, "/api/settings/ptt", nil).Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !got.Saved || got.Mode != settings.PTTModeToggle || got.Gamepad == nil || got.Gamepad.ButtonIndex != 6 {
		t.Errorf("GET ptt = %+v, want the saved setup", got)
	}

	if rec := doJSON(t, server, http.MethodPut, "/api/settings/ptt", map[string]any{"mode": "shout"}); rec.Code != http.StatusBadRequest {
		t.Errorf("PUT with an unknown mode = %d, want 400", rec.Code)
	}
	server.SetInputManager(nil)
}

func TestCrossSiteWritesAreRejected(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})

	crossSite := httptest.NewRequest(http.MethodPut, "/api/settings/voice", strings.NewReader(`{"persona":"bono"}`))
	crossSite.Header.Set("Sec-Fetch-Site", "cross-site")
	crossSite.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, crossSite)
	if rec.Code != http.StatusForbidden {
		t.Errorf("cross-site PUT = %d, want 403", rec.Code)
	}

	sameOrigin := httptest.NewRequest(http.MethodPut, "/api/settings/voice", strings.NewReader(`{"persona":"bono"}`))
	sameOrigin.Header.Set("Sec-Fetch-Site", "same-origin")
	rec = httptest.NewRecorder()
	server.Router().ServeHTTP(rec, sameOrigin)
	if rec.Code != http.StatusOK {
		t.Errorf("same-origin PUT = %d, want 200", rec.Code)
	}

	get := httptest.NewRequest(http.MethodGet, "/api/settings/ai", http.NoBody)
	get.Header.Set("Origin", "https://evil.example")
	rec = httptest.NewRecorder()
	server.Router().ServeHTTP(rec, get)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, other websites must not be able to read API responses", got)
	}
}
