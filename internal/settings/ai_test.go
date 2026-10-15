package settings

import (
	"context"
	"errors"
	"testing"
)

// memStore is an in-memory Store.
type memStore map[string]string

func (m memStore) GetSetting(_ context.Context, key string) (string, error) { return m[key], nil }
func (m memStore) SetSetting(_ context.Context, key, value string) error {
	m[key] = value
	return nil
}

type failingStore struct{}

func (failingStore) GetSetting(context.Context, string) (string, error) {
	return "", errors.New("disk gone")
}
func (failingStore) SetSetting(context.Context, string, string) error { return errors.New("disk gone") }

func testDefaultModel(provider string) string { return "default-" + provider }

// testDefaultRadioModel has a radio model for every provider but the custom one.
func testDefaultRadioModel(provider string) string {
	if provider == ProviderCustom {
		return ""
	}
	return "radio-" + provider
}

func strPtr(s string) *string { return &s }

func TestResolveAI_BuiltInDefaultsWhenNothingIsSet(t *testing.T) {
	eff := ResolveAI(AI{}, AIEnv{}, testDefaultModel, testDefaultRadioModel)

	if eff.Provider != ProviderGemini {
		t.Errorf("provider = %q, want %q", eff.Provider, ProviderGemini)
	}
	for _, p := range Providers {
		if got := eff.Models[p]; got != "default-"+p {
			t.Errorf("model for %s = %q, want the built-in default", p, got)
		}
		wantRadio := "radio-" + p
		if p == ProviderCustom {
			wantRadio = "default-" + p
		}
		if got := eff.RadioModels[p]; got != wantRadio {
			t.Errorf("radio model for %s = %q, want %q", p, got, wantRadio)
		}
		if eff.HasKey(p) || eff.SavedKeys[p] || eff.EnvKeys[p] {
			t.Errorf("%s reports a key although none is set", p)
		}
	}
}

func TestResolveAI_PicksTheFirstProviderWithAKey(t *testing.T) {
	eff := ResolveAI(AI{}, AIEnv{APIKeys: map[string]string{ProviderClaude: "sk-ant"}}, testDefaultModel, testDefaultRadioModel)
	if eff.Provider != ProviderClaude {
		t.Errorf("provider = %q, want %q (the only provider with a key)", eff.Provider, ProviderClaude)
	}
	if !eff.EnvKeys[ProviderClaude] || eff.SavedKeys[ProviderClaude] {
		t.Errorf("claude key state = env %v saved %v, want env only", eff.EnvKeys[ProviderClaude], eff.SavedKeys[ProviderClaude])
	}
}

func TestResolveAI_EnvProviderAndModelApplyUntilTheDashboardSavesAChoice(t *testing.T) {
	env := AIEnv{
		Provider: "OpenAI",
		Model:    "gpt-env",
		APIKeys:  map[string]string{ProviderGemini: "g-env", ProviderOpenAI: "o-env"},
	}

	eff := ResolveAI(AI{}, env, testDefaultModel, testDefaultRadioModel)
	if eff.Provider != ProviderOpenAI {
		t.Errorf("provider = %q, want LLM_PROVIDER %q", eff.Provider, ProviderOpenAI)
	}
	if eff.Models[ProviderOpenAI] != "gpt-env" {
		t.Errorf("openai model = %q, want LLM_MODEL", eff.Models[ProviderOpenAI])
	}
	if eff.Models[ProviderGemini] != "default-gemini" {
		t.Errorf("gemini model = %q, LLM_MODEL must only apply to LLM_PROVIDER", eff.Models[ProviderGemini])
	}

	saved := AI{
		Provider: ProviderGemini,
		Models:   map[string]string{ProviderOpenAI: "gpt-saved"},
		APIKeys:  map[string]string{ProviderOpenAI: "o-saved"},
	}
	eff = ResolveAI(saved, env, testDefaultModel, testDefaultRadioModel)
	if eff.Provider != ProviderGemini {
		t.Errorf("provider = %q, the saved choice must win over LLM_PROVIDER", eff.Provider)
	}
	if eff.Models[ProviderOpenAI] != "gpt-saved" {
		t.Errorf("openai model = %q, the saved model must win over LLM_MODEL", eff.Models[ProviderOpenAI])
	}
	filled := eff.Fill(AIRequest{Provider: ProviderOpenAI})
	if filled.APIKey != "o-saved" {
		t.Errorf("openai key = %q, the saved key must win over the env key", filled.APIKey)
	}
	if !eff.SavedKeys[ProviderOpenAI] || !eff.EnvKeys[ProviderOpenAI] {
		t.Error("openai must report both a saved and an env key")
	}
}

func TestResolveAI_EnvModelWithoutEnvProviderAppliesToTheDefaultProvider(t *testing.T) {
	env := AIEnv{Model: "gpt-env", APIKeys: map[string]string{ProviderOpenAI: "o-env"}}
	eff := ResolveAI(AI{}, env, testDefaultModel, testDefaultRadioModel)
	if eff.Provider != ProviderOpenAI || eff.Models[ProviderOpenAI] != "gpt-env" {
		t.Errorf("got provider %q model %q, want openai with LLM_MODEL", eff.Provider, eff.Models[ProviderOpenAI])
	}
}

func TestResolveAI_IgnoresUnknownProviders(t *testing.T) {
	eff := ResolveAI(AI{Provider: "skynet"}, AIEnv{Provider: "hal"}, testDefaultModel, testDefaultRadioModel)
	if eff.Provider != ProviderGemini {
		t.Errorf("provider = %q, want the default for unknown names", eff.Provider)
	}
}

func TestResolveAI_RadioModels(t *testing.T) {
	saved := AI{
		Models:      map[string]string{ProviderCustom: "llama3", ProviderClaude: "claude-opus-5-5"},
		RadioModels: map[string]string{ProviderGemini: " gemini-flash-latest "},
	}
	eff := ResolveAI(saved, AIEnv{}, testDefaultModel, testDefaultRadioModel)

	want := map[string]string{
		ProviderGemini: "gemini-flash-latest", // the saved radio model, trimmed
		ProviderClaude: "radio-claude",        // the built-in radio model, not the saved chat model
		ProviderOpenAI: "radio-openai",
		ProviderCustom: "llama3", // no built-in radio model: the custom chat model answers
	}
	for p, model := range want {
		if got := eff.RadioModels[p]; got != model {
			t.Errorf("radio model for %s = %q, want %q", p, got, model)
		}
	}
}

func TestEffectiveAIReady(t *testing.T) {
	tests := []struct {
		name  string
		saved AI
		env   AIEnv
		want  bool
	}{
		{"nothing set", AI{}, AIEnv{}, false},
		{"a saved key", AI{Provider: ProviderClaude, APIKeys: map[string]string{ProviderClaude: "k"}}, AIEnv{}, true},
		{"a key for another provider", AI{Provider: ProviderClaude, APIKeys: map[string]string{ProviderGemini: "k"}}, AIEnv{}, false},
		{"an env key", AI{}, AIEnv{APIKeys: map[string]string{ProviderGemini: "k"}}, true},
		{"a custom server's address", AI{Provider: ProviderCustom, BaseURL: "http://localhost:11434/v1"}, AIEnv{}, true},
		{"a custom server without one", AI{Provider: ProviderCustom}, AIEnv{}, false},
	}
	for _, tt := range tests {
		if got := ResolveAI(tt.saved, tt.env, testDefaultModel, testDefaultRadioModel).Ready(); got != tt.want {
			t.Errorf("%s: Ready() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestVoiceWordsRadioCalls(t *testing.T) {
	on, off := true, false
	for _, tt := range []struct {
		lines *bool
		want  bool
	}{{nil, true}, {&on, true}, {&off, false}} {
		if got := (Voice{AIRadioLines: tt.lines}).WordsRadioCalls(); got != tt.want {
			t.Errorf("AIRadioLines %v: WordsRadioCalls() = %v, want %v", tt.lines, got, tt.want)
		}
	}
}

func TestAIApply(t *testing.T) {
	base := AI{
		Provider: ProviderGemini,
		Models:   map[string]string{ProviderGemini: "g-1"},
		BaseURL:  "http://localhost:11434/v1",
		APIKeys:  map[string]string{ProviderGemini: "g-key", ProviderCustom: "c-key"},
	}

	base.RadioModels = map[string]string{ProviderOpenAI: "gpt-radio"}

	got, err := base.Apply(AIUpdate{
		Provider:    strPtr(" Claude "),
		Models:      map[string]string{ProviderClaude: "claude-x", ProviderGemini: ""},
		RadioModels: map[string]string{ProviderClaude: " claude-fast ", ProviderOpenAI: ""},
		APIKeys:     map[string]string{ProviderClaude: " sk-ant ", ProviderGemini: ""},
	})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if got.Provider != ProviderClaude {
		t.Errorf("provider = %q, want %q", got.Provider, ProviderClaude)
	}
	if got.Models[ProviderClaude] != "claude-x" {
		t.Errorf("claude model = %q", got.Models[ProviderClaude])
	}
	if _, ok := got.Models[ProviderGemini]; ok {
		t.Error("an empty model must remove the saved one")
	}
	if got.RadioModels[ProviderClaude] != "claude-fast" {
		t.Errorf("claude radio model = %q, want it trimmed", got.RadioModels[ProviderClaude])
	}
	if _, ok := got.RadioModels[ProviderOpenAI]; ok {
		t.Error("an empty radio model must remove the saved one")
	}
	if got.APIKeys[ProviderClaude] != "sk-ant" {
		t.Errorf("claude key = %q, want it trimmed", got.APIKeys[ProviderClaude])
	}
	if _, ok := got.APIKeys[ProviderGemini]; ok {
		t.Error("an empty key must remove the saved one")
	}
	if got.APIKeys[ProviderCustom] != "c-key" || got.BaseURL != base.BaseURL {
		t.Error("fields absent from the update must keep their saved values")
	}
	if base.APIKeys[ProviderGemini] != "g-key" || base.Models[ProviderGemini] != "g-1" || base.RadioModels[ProviderOpenAI] != "gpt-radio" {
		t.Error("Apply must not modify the receiver's maps")
	}
}

func TestAIApply_NewBaseURLDropsTheCustomKey(t *testing.T) {
	base := AI{BaseURL: "http://localhost:11434/v1", APIKeys: map[string]string{ProviderCustom: "c-key", ProviderOpenAI: "o-key"}}

	same, err := base.Apply(AIUpdate{BaseURL: strPtr("http://localhost:11434/v1")})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if same.APIKeys[ProviderCustom] != "c-key" {
		t.Error("saving the same base URL must keep the custom key")
	}

	moved, err := base.Apply(AIUpdate{BaseURL: strPtr("https://example.com/v1")})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if _, ok := moved.APIKeys[ProviderCustom]; ok {
		t.Error("a new base URL must drop the custom key saved for the old one")
	}
	if moved.APIKeys[ProviderOpenAI] != "o-key" {
		t.Error("a new base URL must not touch other providers' keys")
	}

	both, err := base.Apply(AIUpdate{BaseURL: strPtr("https://example.com/v1"), APIKeys: map[string]string{ProviderCustom: "new-key"}})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if both.APIKeys[ProviderCustom] != "new-key" {
		t.Error("a key sent with the new base URL must be kept")
	}
}

func TestAIApply_RejectsBadInput(t *testing.T) {
	tests := map[string]AIUpdate{
		"unknown provider":       {Provider: strPtr("skynet")},
		"unknown model provider": {Models: map[string]string{"skynet": "t-800"}},
		"unknown key provider":   {APIKeys: map[string]string{"skynet": "key"}},
		"unknown radio provider": {RadioModels: map[string]string{"skynet": "t-1000"}},
		"file base URL":          {BaseURL: strPtr("file:///etc/passwd")},
		"base URL without host":  {BaseURL: strPtr("http://")},
	}
	for name, update := range tests {
		if _, err := (AI{}).Apply(update); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestEffectiveAIFill(t *testing.T) {
	saved := AI{
		Provider: ProviderCustom,
		Models:   map[string]string{ProviderCustom: "llama3"},
		BaseURL:  "http://localhost:11434/v1",
		APIKeys:  map[string]string{ProviderCustom: "c-key", ProviderOpenAI: "o-key"},
	}
	eff := ResolveAI(saved, AIEnv{APIKeys: map[string]string{ProviderGemini: "g-env"}}, testDefaultModel, testDefaultRadioModel)

	tests := []struct {
		name string
		req  AIRequest
		want AIRequest
	}{
		{
			name: "empty request uses the saved setup",
			req:  AIRequest{},
			want: AIRequest{Provider: ProviderCustom, Model: "llama3", APIKey: "c-key", BaseURL: "http://localhost:11434/v1"},
		},
		{
			name: "request values win",
			req:  AIRequest{Provider: "OPENAI", Model: "gpt-x", APIKey: "own-key"},
			want: AIRequest{Provider: ProviderOpenAI, Model: "gpt-x", APIKey: "own-key"},
		},
		{
			name: "provider without a saved key falls back to env and gets no base URL",
			req:  AIRequest{Provider: ProviderGemini},
			want: AIRequest{Provider: ProviderGemini, Model: "default-gemini", APIKey: "g-env"},
		},
		{
			name: "saved key is not sent to a base URL the request picked",
			req:  AIRequest{Provider: ProviderOpenAI, BaseURL: "https://attacker.example/v1"},
			want: AIRequest{Provider: ProviderOpenAI, Model: "default-openai", BaseURL: "https://attacker.example/v1"},
		},
		{
			name: "custom key is not sent to a different custom base URL",
			req:  AIRequest{Provider: ProviderCustom, BaseURL: "https://attacker.example/v1"},
			want: AIRequest{Provider: ProviderCustom, Model: "llama3", BaseURL: "https://attacker.example/v1"},
		},
		{
			name: "radio request gets the radio model",
			req:  AIRequest{Provider: ProviderClaude, Radio: true},
			want: AIRequest{Provider: ProviderClaude, Model: "radio-claude", Radio: true},
		},
		{
			name: "radio request on the custom provider gets its chat model",
			req:  AIRequest{Radio: true},
			want: AIRequest{Provider: ProviderCustom, Model: "llama3", APIKey: "c-key", BaseURL: "http://localhost:11434/v1", Radio: true},
		},
		{
			name: "radio request keeps its own model",
			req:  AIRequest{Provider: ProviderClaude, Model: "claude-x", Radio: true},
			want: AIRequest{Provider: ProviderClaude, Model: "claude-x", Radio: true},
		},
		{
			name: "custom key is sent to the saved custom base URL",
			req:  AIRequest{Provider: ProviderCustom, BaseURL: "http://localhost:11434/v1"},
			want: AIRequest{Provider: ProviderCustom, Model: "llama3", APIKey: "c-key", BaseURL: "http://localhost:11434/v1"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := eff.Fill(tt.req); got != tt.want {
				t.Errorf("Fill(%+v)\n got %+v\nwant %+v", tt.req, got, tt.want)
			}
		})
	}
}

func TestLoadSaveAI(t *testing.T) {
	ctx := context.Background()
	store := memStore{}

	if _, ok, err := LoadAI(ctx, store); err != nil || ok {
		t.Fatalf("LoadAI on an empty store = ok %v err %v, want not saved", ok, err)
	}
	want := AI{Provider: ProviderClaude, APIKeys: map[string]string{ProviderClaude: "sk-ant"}}
	if err := SaveAI(ctx, store, want); err != nil {
		t.Fatalf("SaveAI: %v", err)
	}
	got, ok, err := LoadAI(ctx, store)
	if err != nil || !ok {
		t.Fatalf("LoadAI = ok %v err %v", ok, err)
	}
	if got.Provider != want.Provider || got.APIKeys[ProviderClaude] != "sk-ant" {
		t.Errorf("LoadAI = %+v, want %+v", got, want)
	}

	if _, _, err := LoadAI(ctx, failingStore{}); err == nil {
		t.Error("LoadAI must report a storage error")
	}
	if err := SaveAI(ctx, failingStore{}, want); err == nil {
		t.Error("SaveAI must report a storage error")
	}
	if _, _, err := LoadAI(ctx, memStore{aiSettingsKey: "{not json"}); err == nil {
		t.Error("LoadAI must report a corrupt document")
	}
}
