package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
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

	writeJSON(w, http.StatusOK, AIConfigStatusResponse{
		HasGeminiEnvKey: geminiKey != "",
		HasOpenAIEnvKey: openaiKey != "",
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	})
}

// resolveAIProviderAndKey normalizes the provider and retrieves the active API key (from payload or server config).
func (s *Server) resolveAIProviderAndKey(reqProvider, reqAPIKey string) (provider, apiKey string) {
	provider = strings.ToLower(strings.TrimSpace(reqProvider))
	if provider == "" {
		provider = "gemini"
	}

	apiKey = strings.TrimSpace(reqAPIKey)
	if apiKey == "" {
		if provider == "gemini" {
			apiKey = strings.TrimSpace(s.config.GeminiAPIKey)
		} else {
			apiKey = strings.TrimSpace(s.config.OpenAIAPIKey)
		}
	}
	return provider, apiKey
}

// resolveDefaultModel returns the requested model or default model for the provider.
func resolveDefaultModel(provider, reqModel string) string {
	model := strings.TrimSpace(reqModel)
	if model != "" {
		return model
	}
	if provider == "gemini" {
		return "gemini-flash-lite-latest"
	}
	return "gpt-4o-mini"
}

// handleAIFetchModels queries the provider API for available active text-generation models.
func (s *Server) handleAIFetchModels(w http.ResponseWriter, r *http.Request) {
	var req AIFetchModelsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid payload: %v", err), http.StatusBadRequest)
		return
	}

	provider, apiKey := s.resolveAIProviderAndKey(req.Provider, req.APIKey)

	if apiKey == "" && provider != "custom" {
		writeJSON(w, http.StatusUnauthorized, AIErrorPayload{
			Error:    fmt.Sprintf("No API Key configured for %s", provider),
			Code:     AIErrorMissingAPIKey,
			Provider: provider,
		})
		return
	}

	var models []AIModelItem
	var err error

	if provider == "gemini" {
		models, err = fetchGeminiModels(r.Context(), apiKey)
	} else {
		models, err = fetchOpenAIModels(r.Context(), req.BaseURL, apiKey)
	}

	if err != nil {
		statusCode := http.StatusInternalServerError
		payload := AIErrorPayload{
			Error:    err.Error(),
			Code:     AIErrorGeneric,
			Provider: provider,
		}
		if aiErr, ok := err.(*AIStreamError); ok {
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

	writeJSON(w, http.StatusOK, AIFetchModelsResponse{Models: models})
}

// handleAIChat handles streaming LLM chat requests for Lap Comparator telemetry analysis.
func (s *Server) handleAIChat(w http.ResponseWriter, r *http.Request) {
	var req AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	// Resolve Provider and API Key
	provider, apiKey := s.resolveAIProviderAndKey(req.Provider, req.APIKey)

	if apiKey == "" && provider != "custom" {
		writeJSON(w, http.StatusUnauthorized, AIErrorPayload{
			Error:    fmt.Sprintf("No API Key provided for %s. Please configure it in settings or set the environment variable.", provider),
			Code:     AIErrorMissingAPIKey,
			Provider: provider,
		})
		return
	}

	// Model fallback defaults
	model := resolveDefaultModel(provider, req.Model)

	// Setup SSE streaming headers
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSONError(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	systemPrompt := buildSystemPrompt(req.Context, req.Persona, req.Language)

	var streamErr error
	if provider == "gemini" {
		streamErr = streamGemini(r.Context(), apiKey, model, systemPrompt, req.Messages, w, flusher)
	} else {
		// OpenAI or OpenAI-compatible custom endpoint
		baseURL := req.BaseURL
		if baseURL == "" {
			baseURL = "https://api.openai.com/v1"
		}
		streamErr = streamOpenAI(r.Context(), baseURL, apiKey, model, systemPrompt, req.Messages, w, flusher)
	}

	if streamErr != nil {
		slog.Error("Error during AI chat streaming", "provider", provider, "error", streamErr)
		payload := AIErrorPayload{
			Error:    streamErr.Error(),
			Code:     AIErrorGeneric,
			Provider: provider,
		}
		if aiErr, ok := streamErr.(*AIStreamError); ok {
			payload.Code = aiErr.Code
			payload.Message = aiErr.Message
			payload.Provider = aiErr.Provider
		}
		errPayload, _ := json.Marshal(payload)
		fmt.Fprintf(w, "data: %s\n\n", string(errPayload))
		flusher.Flush()
	}
}
