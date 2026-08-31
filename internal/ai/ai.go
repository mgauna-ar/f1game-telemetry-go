package ai

import (
	"context"
	"net/http"
	"strings"
)

// ResolveDefaultModel returns the requested model or default model for the provider.
func ResolveDefaultModel(provider, reqModel string) string {
	model := strings.TrimSpace(reqModel)
	if model != "" {
		return model
	}
	if provider == "gemini" {
		return "gemini-flash-lite-latest"
	}
	return "gpt-4o-mini"
}

// ResolveProviderAndKey normalizes the provider and retrieves the active API key.
func ResolveProviderAndKey(reqProvider, reqAPIKey, defaultGeminiKey, defaultOpenAIKey string) (provider, apiKey string) {
	provider = strings.ToLower(strings.TrimSpace(reqProvider))
	if provider == "" {
		provider = "gemini"
	}

	apiKey = strings.TrimSpace(reqAPIKey)
	if apiKey == "" {
		if provider == "gemini" {
			apiKey = strings.TrimSpace(defaultGeminiKey)
		} else {
			apiKey = strings.TrimSpace(defaultOpenAIKey)
		}
	}
	return provider, apiKey
}

// FetchModels queries provider APIs (Gemini or OpenAI-compatible) for available generative models.
func FetchModels(ctx context.Context, req AIFetchModelsRequest, defaultGeminiKey, defaultOpenAIKey string) ([]AIModelItem, string, error) {
	provider, apiKey := ResolveProviderAndKey(req.Provider, req.APIKey, defaultGeminiKey, defaultOpenAIKey)
	if apiKey == "" && provider != "custom" {
		return nil, provider, &AIStreamError{
			StatusCode: http.StatusUnauthorized,
			Code:       AIErrorMissingAPIKey,
			Message:    "No API Key configured for " + provider,
			Provider:   provider,
		}
	}

	var models []AIModelItem
	var err error
	if provider == "gemini" {
		models, err = FetchGeminiModels(ctx, apiKey)
	} else {
		models, err = FetchOpenAIModels(ctx, req.BaseURL, apiKey)
	}
	return models, provider, err
}

// StreamChat executes streaming LLM chat requests for Lap Comparator or live telemetry analysis.
func StreamChat(ctx context.Context, req AIChatRequest, defaultGeminiKey, defaultOpenAIKey string, w http.ResponseWriter, flusher http.Flusher) error {
	provider, apiKey := ResolveProviderAndKey(req.Provider, req.APIKey, defaultGeminiKey, defaultOpenAIKey)
	if apiKey == "" && provider != "custom" {
		return &AIStreamError{
			StatusCode: http.StatusUnauthorized,
			Code:       AIErrorMissingAPIKey,
			Message:    "No API Key provided for " + provider,
			Provider:   provider,
		}
	}

	model := ResolveDefaultModel(provider, req.Model)
	systemPrompt := BuildSystemPrompt(req.Context, req.Persona, req.Language)

	if provider == "gemini" {
		return StreamGemini(ctx, apiKey, model, systemPrompt, req.Messages, w, flusher)
	}

	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return StreamOpenAI(ctx, baseURL, apiKey, model, systemPrompt, req.Messages, w, flusher)
}
