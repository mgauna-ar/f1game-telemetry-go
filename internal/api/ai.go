package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// handleAIConfigStatus returns the status of server-configured AI keys.
func (s *Server) handleAIConfigStatus(w http.ResponseWriter, r *http.Request) {
	geminiKey := strings.TrimSpace(s.config.GeminiAPIKey)
	openaiKey := strings.TrimSpace(s.config.OpenAIAPIKey)

	defaultProvider := "gemini"
	defaultModel := "gemini-flash-lite-latest"

	if geminiKey == "" && openaiKey != "" {
		defaultProvider = "openai"
		defaultModel = "gpt-4o-mini"
	}

	if s.config.LLMModel != "" {
		defaultModel = s.config.LLMModel
	}
	if s.config.LLMProvider != "" {
		defaultProvider = s.config.LLMProvider
	}

	writeJSON(w, http.StatusOK, ai.AIConfigStatusResponse{
		HasGeminiEnvKey: geminiKey != "",
		HasOpenAIEnvKey: openaiKey != "",
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	})
}

// handleAIFetchModels queries the provider API for available active text-generation models.
func (s *Server) handleAIFetchModels(w http.ResponseWriter, r *http.Request) {
	var req ai.AIFetchModelsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid payload: %v", err), http.StatusBadRequest)
		return
	}

	models, provider, err := ai.FetchModels(r.Context(), req, s.config.GeminiAPIKey, s.config.OpenAIAPIKey)
	if err != nil {
		statusCode := http.StatusInternalServerError
		payload := ai.AIErrorPayload{
			Error:    err.Error(),
			Code:     ai.AIErrorGeneric,
			Provider: provider,
		}
		if aiErr, ok := err.(*ai.AIStreamError); ok {
			if aiErr.StatusCode > 0 {
				statusCode = aiErr.StatusCode
			}
			payload.Code = aiErr.Code
			payload.Message = aiErr.Message
			payload.Provider = aiErr.Provider
		}
		writeJSON(w, statusCode, payload)
		return
	}

	writeJSON(w, http.StatusOK, ai.AIFetchModelsResponse{Models: models})
}

// handleAIChat handles streaming LLM chat requests for Lap Comparator telemetry analysis.
func (s *Server) handleAIChat(w http.ResponseWriter, r *http.Request) {
	var req ai.AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	provider, _ := ai.ResolveProviderAndKey(req.Provider, req.APIKey, s.config.GeminiAPIKey, s.config.OpenAIAPIKey)

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSONError(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	err := ai.StreamChat(r.Context(), req, s.config.GeminiAPIKey, s.config.OpenAIAPIKey, w, flusher)
	if err != nil {
		slog.Error("Error during AI chat streaming", "provider", provider, "error", err)
		payload := ai.AIErrorPayload{
			Error:    err.Error(),
			Code:     ai.AIErrorGeneric,
			Provider: provider,
		}
		if aiErr, ok := err.(*ai.AIStreamError); ok {
			payload.Code = aiErr.Code
			payload.Message = aiErr.Message
			payload.Provider = aiErr.Provider
		}
		errPayload, _ := json.Marshal(payload)
		fmt.Fprintf(w, "data: %s\n\n", string(errPayload))
		flusher.Flush()
	}
}

// handleAITTS handles POST /api/ai/tts HTTP requests and streams back the synthesized MP3 audio.
func (s *Server) handleAITTS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ai.AITTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		writeJSONError(w, "Field 'text' is required", http.StatusBadRequest)
		return
	}

	voiceName, _ := ai.ResolveVoice(req.Voice, req.Persona, req.Language)

	audioBytes, err := ai.SynthesizeEdgeNeuralTTS(r.Context(), req.Text, voiceName, req.Rate, req.Pitch)
	if err != nil {
		slog.Error("Speech synthesis failed", "voice", voiceName, "error", err)
		writeJSONError(w, fmt.Sprintf("Speech synthesis failed: %v", err), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(audioBytes)))
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audioBytes)
}

// handleGetEngineerConfig returns active Race Engineer Engine rules and triggers configuration.
func (s *Server) handleGetEngineerConfig(w http.ResponseWriter, r *http.Request) {
	if s.repo != nil {
		if cfg, err := engineer.LoadEngineerConfig(r.Context(), s.repo); err == nil && cfg != nil {
			writeJSON(w, http.StatusOK, *cfg)
			return
		}
	}
	var cfg engineer.EngineerConfig
	if s.engineerEngine != nil {
		cfg = s.engineerEngine.GetConfig()
	} else {
		cfg = engineer.DefaultEngineerConfig()
	}
	writeJSON(w, http.StatusOK, cfg)
}

// handleSetEngineerConfig updates active Race Engineer Engine rules and triggers configuration.
func (s *Server) handleSetEngineerConfig(w http.ResponseWriter, r *http.Request) {
	var req engineer.EngineerConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid config payload: %v", err), http.StatusBadRequest)
		return
	}
	if s.repo != nil {
		if err := engineer.SaveEngineerConfig(r.Context(), s.repo, req); err != nil {
			slog.Error("Failed to persist engineer config to database", "error", err)
		}
	}
	if s.engineerEngine != nil {
		s.engineerEngine.SetConfig(req)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "success",
		"config": req,
	})
}

// PTTConfigResponse returns the current global PTT mapping and active status.
type PTTConfigResponse struct {
	Status   string        `json:"status"`
	Mapping  input.Mapping `json:"mapping"`
	IsActive bool          `json:"is_active"`
}

// PTTSetConfigRequest represents the payload to update global PTT mapping.
type PTTSetConfigRequest struct {
	Mapping input.Mapping `json:"mapping"`
}

func (s *Server) handleGetPTTConfig(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	writeJSON(w, http.StatusOK, PTTConfigResponse{
		Status:   "ok",
		Mapping:  s.inputManager.GetMapping(),
		IsActive: s.inputManager.IsActive(),
	})
}

func (s *Server) handleSetPTTConfig(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	var req PTTSetConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	s.inputManager.SetMapping(req.Mapping)

	writeJSON(w, http.StatusOK, PTTConfigResponse{
		Status:   "ok",
		Mapping:  s.inputManager.GetMapping(),
		IsActive: s.inputManager.IsActive(),
	})
}

func (s *Server) handleStartPTTLearn(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	ch, err := s.inputManager.StartLearning(r.Context())
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	go func() {
		select {
		case m, ok := <-ch:
			if ok {
				payload, _ := json.Marshal(map[string]any{
					"type":    "ptt_learned",
					"mapping": m,
				})
				if s.engineerHub != nil {
					s.engineerHub.Broadcast(payload)
				}
			}
		case <-time.After(20 * time.Second):
			s.inputManager.CancelLearning()
		}
	}()

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "learning_started",
	})
}

func (s *Server) handleCancelPTTLearn(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	s.inputManager.CancelLearning()
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "learning_canceled",
	})
}
