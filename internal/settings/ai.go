package settings

import (
	"context"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"
)

const aiSettingsKey = "ai_settings"

// Chat providers the AI settings can hold a model and an API key for.
const (
	ProviderGemini = "gemini"
	ProviderOpenAI = "openai"
	ProviderClaude = "claude"
	ProviderCustom = "custom"
)

// Providers lists every known chat provider, in the order used to pick a default from the keys set.
var Providers = []string{ProviderGemini, ProviderOpenAI, ProviderClaude, ProviderCustom}

// NormalizeProvider lower-cases and trims a provider name.
func NormalizeProvider(p string) string {
	return strings.ToLower(strings.TrimSpace(p))
}

// IsProvider reports whether p names a known chat provider.
func IsProvider(p string) bool {
	return slices.Contains(Providers, p)
}

// AI is the chat provider setup chosen in the dashboard. APIKeys never leave the server: the API
// only reports whether a key is saved.
type AI struct {
	Provider string            `json:"provider,omitempty"`
	Models   map[string]string `json:"models,omitempty"`
	BaseURL  string            `json:"base_url,omitempty"`
	APIKeys  map[string]string `json:"api_keys,omitempty"`
}

// AIUpdate changes part of the saved AI settings. Absent fields keep their saved value. An empty
// model or API key removes the saved one, so the .env value or the built-in default applies again.
type AIUpdate struct {
	Provider *string           `json:"provider,omitempty"`
	Models   map[string]string `json:"models,omitempty"`
	BaseURL  *string           `json:"base_url,omitempty"`
	APIKeys  map[string]string `json:"api_keys,omitempty"`
}

// LoadAI returns the saved AI settings, and false when none were saved yet.
func LoadAI(ctx context.Context, store Store) (AI, bool, error) {
	var a AI
	ok, err := load(ctx, store, aiSettingsKey, &a)
	return a, ok, err
}

// SaveAI stores the AI settings.
func SaveAI(ctx context.Context, store Store, a AI) error {
	return save(ctx, store, aiSettingsKey, a)
}

// Apply returns a copy of a with u applied. Changing the base URL drops the saved custom provider
// key, so a key is only ever sent to the endpoint it was entered for.
func (a AI) Apply(u AIUpdate) (AI, error) {
	out := AI{
		Provider: a.Provider,
		Models:   maps.Clone(a.Models),
		BaseURL:  a.BaseURL,
		APIKeys:  maps.Clone(a.APIKeys),
	}

	if u.Provider != nil {
		p := NormalizeProvider(*u.Provider)
		if p != "" && !IsProvider(p) {
			return AI{}, fmt.Errorf("unknown provider %q", *u.Provider)
		}
		out.Provider = p
	}

	if u.BaseURL != nil {
		baseURL := strings.TrimSpace(*u.BaseURL)
		if err := validateBaseURL(baseURL); err != nil {
			return AI{}, err
		}
		if baseURL != out.BaseURL {
			delete(out.APIKeys, ProviderCustom)
		}
		out.BaseURL = baseURL
	}

	var err error
	if out.Models, err = mergeByProvider(out.Models, u.Models); err != nil {
		return AI{}, err
	}
	if out.APIKeys, err = mergeByProvider(out.APIKeys, u.APIKeys); err != nil {
		return AI{}, err
	}
	return out, nil
}

// mergeByProvider sets each non-empty value in changes and deletes each empty one.
func mergeByProvider(current, changes map[string]string) (map[string]string, error) {
	for provider, value := range changes {
		p := NormalizeProvider(provider)
		if !IsProvider(p) {
			return nil, fmt.Errorf("unknown provider %q", provider)
		}
		value = strings.TrimSpace(value)
		if value == "" {
			delete(current, p)
			continue
		}
		if current == nil {
			current = make(map[string]string)
		}
		current[p] = value
	}
	if len(current) == 0 {
		return nil, nil
	}
	return current, nil
}

func validateBaseURL(raw string) error {
	if raw == "" {
		return nil
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Errorf("base URL must be an http or https address, got %q", raw)
	}
	return nil
}

// AIEnv is the AI setup from environment variables (a .env file included). It applies until the
// dashboard saves a choice of its own.
type AIEnv struct {
	Provider string            // LLM_PROVIDER
	Model    string            // LLM_MODEL, the model for Provider
	APIKeys  map[string]string // GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY by provider
}

// EffectiveAI is the AI setup in force after layering the saved settings over env vars and the
// built-in defaults.
type EffectiveAI struct {
	Provider  string
	BaseURL   string
	Models    map[string]string // the model each known provider uses
	SavedKeys map[string]bool   // providers with a key saved from the dashboard
	EnvKeys   map[string]bool   // providers with a key from an env var
	keys      map[string]string
}

// ResolveAI layers saved settings over env vars over built-in defaults. defaultModel returns the
// built-in model for a provider; the ai package owns those names.
func ResolveAI(saved AI, env AIEnv, defaultModel func(provider string) string) EffectiveAI {
	eff := EffectiveAI{
		BaseURL:   saved.BaseURL,
		Models:    make(map[string]string, len(Providers)),
		SavedKeys: make(map[string]bool, len(Providers)),
		EnvKeys:   make(map[string]bool, len(Providers)),
		keys:      make(map[string]string, len(Providers)),
	}

	autoProvider := ""
	for _, p := range Providers {
		savedKey := strings.TrimSpace(saved.APIKeys[p])
		envKey := strings.TrimSpace(env.APIKeys[p])
		eff.SavedKeys[p] = savedKey != ""
		eff.EnvKeys[p] = envKey != ""
		switch {
		case savedKey != "":
			eff.keys[p] = savedKey
		case envKey != "":
			eff.keys[p] = envKey
		}
		if autoProvider == "" && p != ProviderCustom && eff.keys[p] != "" {
			autoProvider = p
		}
	}
	if autoProvider == "" {
		autoProvider = ProviderGemini
	}

	// LLM_MODEL belongs to LLM_PROVIDER, or to the provider picked from the keys when it is unset.
	envProvider := NormalizeProvider(env.Provider)
	if !IsProvider(envProvider) {
		envProvider = autoProvider
	}

	eff.Provider = NormalizeProvider(saved.Provider)
	if !IsProvider(eff.Provider) {
		eff.Provider = envProvider
	}

	for _, p := range Providers {
		model := strings.TrimSpace(saved.Models[p])
		if model == "" && p == envProvider {
			model = strings.TrimSpace(env.Model)
		}
		if model == "" {
			model = defaultModel(p)
		}
		eff.Models[p] = model
	}
	return eff
}

// HasKey reports whether provider has an API key, saved or from an env var.
func (e EffectiveAI) HasKey(provider string) bool {
	return e.keys[provider] != ""
}

// AIRequest is the provider part of a chat or model-list request.
type AIRequest struct {
	Provider string
	Model    string
	APIKey   string
	BaseURL  string
}

// Fill completes what a request left empty. A saved or env API key is only added when the request
// goes to the endpoint the key belongs to, so a client can't send the server's key to a base URL
// of its own choosing.
func (e EffectiveAI) Fill(r AIRequest) AIRequest {
	out := r
	out.Provider = NormalizeProvider(r.Provider)
	if out.Provider == "" {
		out.Provider = e.Provider
	}
	if strings.TrimSpace(out.Model) == "" {
		out.Model = e.Models[out.Provider]
	}

	requestBaseURL := strings.TrimSpace(r.BaseURL)
	if requestBaseURL == "" && out.Provider == ProviderCustom {
		out.BaseURL = e.BaseURL
	}
	ownEndpoint := requestBaseURL == "" || (out.Provider == ProviderCustom && requestBaseURL == e.BaseURL)
	if strings.TrimSpace(out.APIKey) == "" && ownEndpoint {
		out.APIKey = e.keys[out.Provider]
	}
	return out
}
