package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

// handleAIConfigStatus returns the status of server-configured AI keys.
func (s *Server) handleAIConfigStatus(w http.ResponseWriter, r *http.Request) {
	geminiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	openaiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))

	defaultProvider := "gemini"
	defaultModel := "gemini-flash-lite-latest"

	if geminiKey == "" && openaiKey != "" {
		defaultProvider = "openai"
		defaultModel = "gpt-4o-mini"
	}

	if envModel := os.Getenv("LLM_MODEL"); envModel != "" {
		defaultModel = envModel
	}
	if envProvider := os.Getenv("LLM_PROVIDER"); envProvider != "" {
		defaultProvider = envProvider
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AIConfigStatusResponse{
		HasGeminiEnvKey: geminiKey != "",
		HasOpenAIEnvKey: openaiKey != "",
		DefaultProvider: defaultProvider,
		DefaultModel:    defaultModel,
	})
}

// resolveAIProviderAndKey normalizes the provider and retrieves the active API key (from payload or env).
func resolveAIProviderAndKey(reqProvider, reqAPIKey string) (provider, apiKey string) {
	provider = strings.ToLower(strings.TrimSpace(reqProvider))
	if provider == "" {
		provider = "gemini"
	}

	apiKey = strings.TrimSpace(reqAPIKey)
	if apiKey == "" {
		if provider == "gemini" {
			apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
		} else {
			apiKey = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
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
		http.Error(w, fmt.Sprintf("Invalid payload: %v", err), http.StatusBadRequest)
		return
	}

	provider, apiKey := resolveAIProviderAndKey(req.Provider, req.APIKey)

	if apiKey == "" && provider != "custom" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(AIErrorPayload{
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
		w.Header().Set("Content-Type", "application/json")
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
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(payload)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AIFetchModelsResponse{Models: models})
}

// handleAIChat handles streaming LLM chat requests for Lap Comparator telemetry analysis.
func (s *Server) handleAIChat(w http.ResponseWriter, r *http.Request) {
	var req AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	// Resolve Provider and API Key
	provider, apiKey := resolveAIProviderAndKey(req.Provider, req.APIKey)

	if apiKey == "" && provider != "custom" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(AIErrorPayload{
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
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
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
		log.Printf("[AI Chat] Error during streaming: %v", streamErr)
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
