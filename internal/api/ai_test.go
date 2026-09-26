package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
)

func TestAIErrorPayload(t *testing.T) {
	quota := &ai.AIStreamError{Code: ai.AIErrorQuotaExceeded, Message: "Quota exceeded.", RawMessage: "429", Provider: ai.ProviderOpenAI}

	tests := []struct {
		name string
		err  error
		want ai.AIErrorPayload
	}{
		{
			name: "plain error",
			err:  errors.New("connection reset"),
			want: ai.AIErrorPayload{Error: "connection reset", Code: ai.AIErrorGeneric, Provider: ai.ProviderGemini},
		},
		{
			name: "classified error",
			err:  quota,
			want: ai.AIErrorPayload{Error: "Quota exceeded.", Code: ai.AIErrorQuotaExceeded, Provider: ai.ProviderOpenAI, Message: "Quota exceeded."},
		},
		{
			name: "wrapped classified error",
			err:  fmt.Errorf("round 2: %w", quota),
			want: ai.AIErrorPayload{Error: "round 2: Quota exceeded.", Code: ai.AIErrorQuotaExceeded, Provider: ai.ProviderOpenAI, Message: "Quota exceeded."},
		},
		{
			name: "classified error without a provider or code",
			err:  &ai.AIStreamError{Message: "Something broke."},
			want: ai.AIErrorPayload{Error: "Something broke.", Code: ai.AIErrorGeneric, Provider: ai.ProviderGemini, Message: "Something broke."},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := aiErrorPayload(tt.err, ai.ProviderGemini); got != tt.want {
				t.Errorf("aiErrorPayload() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestAIHandlers_BadPayloadReturnsInvalidRequestCode(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})

	for _, path := range []string{"/api/ai/chat", "/api/ai/models", "/api/ai/tts"} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			server.Router().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader("bad json")))

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			var body ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body.Code != ai.AIErrorInvalidRequest || body.Error == "" {
				t.Errorf("body = %+v, want code %s and a message", body, ai.AIErrorInvalidRequest)
			}
		})
	}
}

func TestAIChat_StreamsProviderErrorsAsAnErrorFrame(t *testing.T) {
	// No OpenAI key anywhere, so the provider refuses before any text is sent.
	server, _ := newSettingsTestServer(t, ServerConfig{})

	rec := doJSON(t, server, http.MethodPost, "/api/ai/chat", map[string]any{
		"provider": "openai",
		"messages": []map[string]string{{"role": "user", "content": "Radio check"}},
	})

	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type = %q, want text/event-stream", ct)
	}
	frame, ok := strings.CutPrefix(strings.TrimSpace(rec.Body.String()), "data: ")
	if !ok {
		t.Fatalf("body = %q, want one SSE data frame", rec.Body.String())
	}
	var payload ai.AIErrorPayload
	if err := json.Unmarshal([]byte(frame), &payload); err != nil {
		t.Fatalf("decode frame %q: %v", frame, err)
	}
	if payload.Code != ai.AIErrorMissingAPIKey || payload.Provider != ai.ProviderOpenAI || payload.Error == "" {
		t.Errorf("error frame = %+v, want MISSING_API_KEY from openai", payload)
	}
}
