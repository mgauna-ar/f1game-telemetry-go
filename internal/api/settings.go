package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
)

// AISettingsResponse is the AI setup in force. It never carries an API key, only whether one is
// saved from the dashboard or set in the environment.
type AISettingsResponse struct {
	Saved     bool                        `json:"saved"`
	Provider  string                      `json:"provider"`
	BaseURL   string                      `json:"base_url"`
	Providers map[string]AIProviderStatus `json:"providers"`
}

// AIProviderStatus is the model and key state of one chat provider.
type AIProviderStatus struct {
	Model       string `json:"model"`
	HasSavedKey bool   `json:"has_saved_key"`
	HasEnvKey   bool   `json:"has_env_key"`
}

// VoiceSettingsResponse is the saved race engineer voice, and whether it was ever saved.
type VoiceSettingsResponse struct {
	Saved bool `json:"saved"`
	settings.Voice
}

// PTTSettingsResponse is the saved push-to-talk setup, and whether it was ever saved.
type PTTSettingsResponse struct {
	Saved bool `json:"saved"`
	settings.PTT
}

// EngineerSettingsResponse is the saved race engineer setup, and whether it was ever saved.
type EngineerSettingsResponse struct {
	Saved bool `json:"saved"`
	settings.Engineer
}

// SettingsChangedMessage tells the dashboards on /ws/engineer that a settings section was saved,
// so they reload it. Source is the X-Dashboard-Client id of the tab that saved it, which ignores
// its own message; Version is the engineer settings' new version.
type SettingsChangedMessage struct {
	Type    string `json:"type" tstype:"'settings_changed'"`
	Section string `json:"section" tstype:"SettingsSection"`
	Source  string `json:"source,omitempty"`
	Version int64  `json:"version,omitempty"`
}

const settingsChangedMessageType = "settings_changed"

func (m SettingsChangedMessage) engineerMessageType() string { return m.Type }

// DashboardClientHeader carries the random id a dashboard tab sends with its settings saves.
const DashboardClientHeader = "X-Dashboard-Client"

// maxDashboardClientIDLen caps the client id copied into settings_changed messages.
const maxDashboardClientIDLen = 64

// broadcastSettingsChanged tells every dashboard that section was saved by the tab that sent r.
func (s *Server) broadcastSettingsChanged(r *http.Request, section string, version int64) {
	source := strings.TrimSpace(r.Header.Get(DashboardClientHeader))
	if len(source) > maxDashboardClientIDLen {
		source = source[:maxDashboardClientIDLen]
	}
	s.broadcastEngineer(SettingsChangedMessage{
		Type:    settingsChangedMessageType,
		Section: section,
		Source:  source,
		Version: version,
	})
}

func (s *Server) setupSettingsRoutes(r chi.Router) {
	r.Get("/settings/ai", s.handleGetAISettings)
	r.Put("/settings/ai", s.handlePutAISettings)
	r.Get("/settings/voice", s.handleGetVoiceSettings)
	r.Put("/settings/voice", s.handlePutVoiceSettings)
	r.Get("/settings/ptt", s.handleGetPTTSettings)
	r.Put("/settings/ptt", s.handlePutPTTSettings)
	r.Get("/settings/engineer", s.handleGetEngineerSettings)
	r.Put("/settings/engineer", s.handlePutEngineerSettings)
	r.Get("/settings/engineer/defaults", s.handleGetEngineerSettingsDefaults)
}

// aiEnv is the AI setup from environment variables.
func (s *Server) aiEnv() settings.AIEnv {
	return settings.AIEnv{
		Provider: s.config.LLMProvider,
		Model:    s.config.LLMModel,
		APIKeys: map[string]string{
			settings.ProviderGemini: s.config.GeminiAPIKey,
			settings.ProviderOpenAI: s.config.OpenAIAPIKey,
			settings.ProviderClaude: s.config.ClaudeAPIKey,
		},
	}
}

// defaultAIModel returns the built-in model for a provider. The ai package owns those names.
func defaultAIModel(provider string) string {
	return ai.ResolveDefaultModel(provider, "")
}

// effectiveAI layers the saved AI settings over env vars and built-in defaults. It reports whether
// settings were ever saved.
func (s *Server) effectiveAI(ctx context.Context) (settings.EffectiveAI, bool, error) {
	var saved settings.AI
	ok := false
	if s.repo != nil {
		var err error
		if saved, ok, err = settings.LoadAI(ctx, s.repo); err != nil {
			return settings.EffectiveAI{}, false, err
		}
	}
	return settings.ResolveAI(saved, s.aiEnv(), defaultAIModel), ok, nil
}

// fillAIRequest completes what a chat or model-list request left empty: the request's own values
// win, then the saved settings, then env vars, then built-in defaults.
func (s *Server) fillAIRequest(ctx context.Context, req settings.AIRequest) settings.AIRequest {
	eff, _, err := s.effectiveAI(ctx)
	if err != nil {
		slog.Error("Failed to load saved AI settings, using env vars and defaults", "error", err)
		eff = settings.ResolveAI(settings.AI{}, s.aiEnv(), defaultAIModel)
	}
	return eff.Fill(req)
}

func newAISettingsResponse(eff settings.EffectiveAI, saved bool) AISettingsResponse {
	resp := AISettingsResponse{
		Saved:     saved,
		Provider:  eff.Provider,
		BaseURL:   eff.BaseURL,
		Providers: make(map[string]AIProviderStatus, len(settings.Providers)),
	}
	for _, p := range settings.Providers {
		resp.Providers[p] = AIProviderStatus{
			Model:       eff.Models[p],
			HasSavedKey: eff.SavedKeys[p],
			HasEnvKey:   eff.EnvKeys[p],
		}
	}
	return resp
}

func (s *Server) handleGetAISettings(w http.ResponseWriter, r *http.Request) {
	eff, saved, err := s.effectiveAI(r.Context())
	if err != nil {
		slog.Error("Failed to load AI settings", "error", err)
		writeJSONError(w, "failed to load AI settings", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, newAISettingsResponse(eff, saved))
}

func (s *Server) handlePutAISettings(w http.ResponseWriter, r *http.Request) {
	if s.repo == nil {
		writeJSONError(w, "settings storage not available", http.StatusServiceUnavailable)
		return
	}
	var update settings.AIUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid AI settings payload: %v", err), http.StatusBadRequest)
		return
	}

	s.settingsMu.Lock()
	defer s.settingsMu.Unlock()

	current, _, err := settings.LoadAI(r.Context(), s.repo)
	if err != nil {
		slog.Error("Failed to load AI settings", "error", err)
		writeJSONError(w, "failed to load AI settings", http.StatusInternalServerError)
		return
	}
	next, err := current.Apply(update)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := settings.SaveAI(r.Context(), s.repo, next); err != nil {
		slog.Error("Failed to save AI settings", "error", err)
		writeJSONError(w, "failed to save AI settings", http.StatusInternalServerError)
		return
	}
	s.broadcastSettingsChanged(r, settings.SectionAI, 0)
	writeJSON(w, http.StatusOK, newAISettingsResponse(settings.ResolveAI(next, s.aiEnv(), defaultAIModel), true))
}

func (s *Server) handleGetVoiceSettings(w http.ResponseWriter, r *http.Request) {
	var resp VoiceSettingsResponse
	if s.repo != nil {
		var err error
		if resp.Voice, resp.Saved, err = settings.LoadVoice(r.Context(), s.repo); err != nil {
			slog.Error("Failed to load voice settings", "error", err)
			writeJSONError(w, "failed to load voice settings", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handlePutVoiceSettings(w http.ResponseWriter, r *http.Request) {
	if s.repo == nil {
		writeJSONError(w, "settings storage not available", http.StatusServiceUnavailable)
		return
	}
	var voice settings.Voice
	if err := json.NewDecoder(r.Body).Decode(&voice); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid voice settings payload: %v", err), http.StatusBadRequest)
		return
	}
	if err := settings.SaveVoice(r.Context(), s.repo, voice); err != nil {
		slog.Error("Failed to save voice settings", "error", err)
		writeJSONError(w, "failed to save voice settings", http.StatusInternalServerError)
		return
	}
	s.broadcastSettingsChanged(r, settings.SectionVoice, 0)
	writeJSON(w, http.StatusOK, VoiceSettingsResponse{Saved: true, Voice: voice})
}

func (s *Server) handleGetPTTSettings(w http.ResponseWriter, r *http.Request) {
	var resp PTTSettingsResponse
	if s.repo != nil {
		var err error
		if resp.PTT, resp.Saved, err = settings.LoadPTT(r.Context(), s.repo); err != nil {
			slog.Error("Failed to load push-to-talk settings", "error", err)
			writeJSONError(w, "failed to load push-to-talk settings", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handlePutPTTSettings(w http.ResponseWriter, r *http.Request) {
	if s.repo == nil {
		writeJSONError(w, "settings storage not available", http.StatusServiceUnavailable)
		return
	}
	var ptt settings.PTT
	if err := json.NewDecoder(r.Body).Decode(&ptt); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid push-to-talk settings payload: %v", err), http.StatusBadRequest)
		return
	}
	ptt.Normalize()
	if err := ptt.Validate(); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := settings.SavePTT(r.Context(), s.repo, ptt); err != nil {
		slog.Error("Failed to save push-to-talk settings", "error", err)
		writeJSONError(w, "failed to save push-to-talk settings", http.StatusInternalServerError)
		return
	}
	if s.inputManager != nil {
		ptt.Apply(s.inputManager)
	}
	s.broadcastSettingsChanged(r, settings.SectionPTT, 0)
	writeJSON(w, http.StatusOK, PTTSettingsResponse{Saved: true, PTT: ptt})
}

func (s *Server) handleGetEngineerSettings(w http.ResponseWriter, r *http.Request) {
	resp := EngineerSettingsResponse{Engineer: settings.DefaultEngineer()}
	if s.repo != nil {
		var err error
		if resp.Engineer, resp.Saved, err = settings.LoadEngineer(r.Context(), s.repo); err != nil {
			slog.Error("Failed to load race engineer settings", "error", err)
			writeJSONError(w, "failed to load race engineer settings", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleGetEngineerSettingsDefaults returns the built-in race engineer setup, which the settings
// panel uses for "Reset to defaults" so the UI and the engine share one set of values.
func (s *Server) handleGetEngineerSettingsDefaults(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, settings.DefaultEngineer())
}

// handlePutEngineerSettings saves the race engineer setup and applies it to the engine. Fields the
// request leaves out keep their saved value; a request based on an older version gets 409.
func (s *Server) handlePutEngineerSettings(w http.ResponseWriter, r *http.Request) {
	if s.repo == nil {
		writeJSONError(w, "settings storage not available", http.StatusServiceUnavailable)
		return
	}

	s.settingsMu.Lock()
	defer s.settingsMu.Unlock()

	current, _, err := settings.LoadEngineer(r.Context(), s.repo)
	if err != nil {
		slog.Error("Failed to load race engineer settings", "error", err)
		writeJSONError(w, "failed to load race engineer settings", http.StatusInternalServerError)
		return
	}
	update := current.Clone()
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid race engineer settings payload: %v", err), http.StatusBadRequest)
		return
	}
	next, err := current.Apply(update)
	if errors.Is(err, settings.ErrVersionConflict) {
		writeJSONErrorCode(w, err.Error(), http.StatusConflict, ErrorCodeSettingsConflict)
		return
	}
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := settings.SaveEngineer(r.Context(), s.repo, next); err != nil {
		slog.Error("Failed to save race engineer settings", "error", err)
		writeJSONError(w, "failed to save race engineer settings", http.StatusInternalServerError)
		return
	}
	if s.engineerEngine != nil {
		s.engineerEngine.SetConfig(next.EngineConfig())
	}
	s.broadcastSettingsChanged(r, settings.SectionEngineer, next.Version)
	writeJSON(w, http.StatusOK, EngineerSettingsResponse{Saved: true, Engineer: next})
}

// restorePTTSettings applies the saved push-to-talk setup to a newly attached input manager, so
// the in-game talk button works after a restart before any dashboard is opened. It also repairs a
// setup saved without the key code of its key.
func (s *Server) restorePTTSettings(ctx context.Context, mgr input.Manager) {
	if s.repo == nil || mgr == nil {
		return
	}
	ptt, ok, err := settings.LoadPTT(ctx, s.repo)
	if err != nil {
		slog.Error("Failed to load push-to-talk settings", "error", err)
		return
	}
	if !ok {
		return
	}
	savedKeyCode := ptt.KeyCode
	ptt.Normalize()
	if ptt.KeyCode != savedKeyCode {
		if err := settings.SavePTT(ctx, s.repo, ptt); err != nil {
			slog.Error("Failed to save repaired push-to-talk settings", "error", err)
		}
	}
	ptt.Apply(mgr)
}
