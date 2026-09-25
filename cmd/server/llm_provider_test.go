package main

import "testing"

func TestLLMProviderFromEnv(t *testing.T) {
	tests := []struct{ raw, want string }{
		{"", ""},
		{"gemini", "gemini"},
		{" Claude ", "claude"},
		{"OPENAI", "openai"},
		{"custom", "custom"},
		{"anthropic", ""},
	}
	for _, tt := range tests {
		if got := llmProviderFromEnv(tt.raw); got != tt.want {
			t.Errorf("llmProviderFromEnv(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}
