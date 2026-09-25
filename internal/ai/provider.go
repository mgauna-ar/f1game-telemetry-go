package ai

import (
	"context"
	"net/http"
	"strings"
)

// Provider IDs accepted by chat and model list requests.
const (
	ProviderGemini = "gemini"
	ProviderOpenAI = "openai"
	ProviderClaude = "claude"
	// ProviderCustom is any OpenAI-compatible server (Ollama, LM Studio, ...) at a user-set base URL.
	ProviderCustom = "custom"
)

// Default models used when a request does not name one.
const (
	DefaultGeminiModel = "gemini-flash-latest"
	DefaultOpenAIModel = "gpt-4o-mini"
	DefaultClaudeModel = "claude-opus-5"
)

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

// ServerKeys are the API keys configured on the server. A key sent with the request takes priority.
type ServerKeys struct {
	Gemini string
	OpenAI string
	Claude string
}

// connection is how one request reaches its provider.
type connection struct {
	provider string
	apiKey   string
	baseURL  string
}

// provider describes one AI service: its default model, which server key it uses, and how
// to list its models and hold a chat with it.
type provider struct {
	defaultModel string
	// serverKey picks the provider's key from the server's keys. Nil means only a key sent
	// with the request is used, and none is required.
	serverKey func(ServerKeys) string
	// customBaseURL is true when the request's base URL is used instead of the provider's own.
	customBaseURL bool
	listModels    func(ctx context.Context, conn connection) ([]AIModelItem, error)
	newChat       func(conn connection, model, systemPrompt string, messages []AIChatMessage) chatSession
}

var providers = map[string]provider{
	ProviderGemini: {
		defaultModel: DefaultGeminiModel,
		serverKey:    func(k ServerKeys) string { return k.Gemini },
		listModels:   fetchGeminiModels,
		newChat:      newGeminiChat,
	},
	ProviderOpenAI: {
		defaultModel: DefaultOpenAIModel,
		serverKey:    func(k ServerKeys) string { return k.OpenAI },
		listModels:   fetchOpenAIModels,
		newChat:      newOpenAIChat,
	},
	ProviderClaude: {
		defaultModel: DefaultClaudeModel,
		serverKey:    func(k ServerKeys) string { return k.Claude },
		listModels:   fetchClaudeModels,
		newChat:      newClaudeChat,
	},
	ProviderCustom: {
		defaultModel:  DefaultOpenAIModel,
		customBaseURL: true,
		listModels:    fetchOpenAIModels,
		newChat:       newOpenAIChat,
	},
}

// ResolveProvider normalizes a requested provider ID, defaulting to Gemini.
func ResolveProvider(reqProvider string) string {
	id := strings.ToLower(strings.TrimSpace(reqProvider))
	if id == "" {
		return ProviderGemini
	}
	return id
}

// DefaultModel returns the model used for the provider when a request does not name one.
func DefaultModel(providerID string) string {
	if p, ok := providers[ResolveProvider(providerID)]; ok {
		return p.defaultModel
	}
	return DefaultGeminiModel
}

// ResolveDefaultModel returns the requested model or the default model for the provider.
func ResolveDefaultModel(providerID, reqModel string) string {
	if model := strings.TrimSpace(reqModel); model != "" {
		return model
	}
	return DefaultModel(providerID)
}

// resolveProvider looks up the requested provider and how to reach it: the request's key or
// the server's key, and the base URL for OpenAI-compatible servers. The connection names the
// resolved provider even when an error is returned.
func resolveProvider(reqProvider, reqAPIKey, reqBaseURL string, keys ServerKeys) (provider, connection, error) {
	conn := connection{provider: ResolveProvider(reqProvider), apiKey: strings.TrimSpace(reqAPIKey)}
	p, ok := providers[conn.provider]
	if !ok {
		return p, conn, &AIStreamError{
			StatusCode: http.StatusBadRequest,
			Code:       AIErrorGeneric,
			Message:    "Unknown AI provider " + conn.provider,
			Provider:   conn.provider,
		}
	}

	if p.serverKey != nil {
		if conn.apiKey == "" {
			conn.apiKey = strings.TrimSpace(p.serverKey(keys))
		}
		if conn.apiKey == "" {
			return p, conn, &AIStreamError{
				StatusCode: http.StatusUnauthorized,
				Code:       AIErrorMissingAPIKey,
				Message:    "No API key configured for " + conn.provider,
				Provider:   conn.provider,
			}
		}
	}
	if p.customBaseURL {
		conn.baseURL = strings.TrimSpace(reqBaseURL)
	}
	return p, conn, nil
}
