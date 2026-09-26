package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// captureUpstream is an OpenAI-compatible server that answers "Copy." and keeps the system
// prompt of each request.
type captureUpstream struct {
	mu      sync.Mutex
	prompts []string
}

func (u *captureUpstream) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	raw, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(raw, &body)
	if len(body.Messages) > 0 && body.Messages[0].Role == "system" {
		u.mu.Lock()
		u.prompts = append(u.prompts, body.Messages[0].Content)
		u.mu.Unlock()
	}
	w.Header().Set("Content-Type", "text/event-stream")
	_, _ = io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Copy.\"}}]}\n\ndata: [DONE]\n\n")
}

func chatRequest(upstreamURL string, chatContext map[string]any) map[string]any {
	return map[string]any{
		"provider": "custom", "base_url": upstreamURL, "api_key": "key", "model": "local-model",
		"messages": []map[string]string{{"role": "user", "content": "How did it go?"}},
		"context":  chatContext,
	}
}

func TestAIChat_BuildsSessionDebriefOnTheServer(t *testing.T) {
	server, repo := newSettingsTestServer(t, ServerConfig{})
	ctx := context.Background()
	session := &storage.Session{SessionUID: "0xABC", TrackName: "Suzuka", SessionType: "Race", Weather: "Clear"}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("save session: %v", err)
	}
	if err := repo.SaveParticipants(ctx, session.ID, []storage.Participant{{SessionID: session.ID, CarIndex: 0, RaceNumber: 16, Name: "Charles Leclerc"}}); err != nil {
		t.Fatalf("save participants: %v", err)
	}
	if err := repo.SaveLap(ctx, &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 91_234, IsValid: true, TyreCompound: "Medium"}, false); err != nil {
		t.Fatalf("save lap: %v", err)
	}

	up := &captureUpstream{}
	srv := httptest.NewServer(up)
	defer srv.Close()

	rec := doJSON(t, server, http.MethodPost, "/api/ai/chat", chatRequest(srv.URL, map[string]any{
		"context_mode": "session_debrief", "session_id": session.ID,
	}))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Copy.") {
		t.Fatalf("status = %d body = %q, want a streamed answer", rec.Code, rec.Body.String())
	}
	if len(up.prompts) != 1 {
		t.Fatalf("expected one upstream request, got %d", len(up.prompts))
	}
	for _, want := range []string{"post-session debrief", "- Circuit: Suzuka", "- P1: Charles Leclerc (#16)", "Best Lap: 1:31.234"} {
		if !strings.Contains(up.prompts[0], want) {
			t.Errorf("expected %q in the system prompt:\n%s", want, up.prompts[0])
		}
	}
}

func TestAIChat_RejectsUnknownContextBeforeStreaming(t *testing.T) {
	server, _ := newSettingsTestServer(t, ServerConfig{})
	up := &captureUpstream{}
	srv := httptest.NewServer(up)
	defer srv.Close()

	tests := []struct {
		name    string
		context map[string]any
		status  int
	}{
		{"unknown session", map[string]any{"context_mode": "session_debrief", "session_id": 9999}, http.StatusNotFound},
		{"unknown lap", map[string]any{"context_mode": "comparator", "lap_a_id": 9998, "lap_b_id": 9999}, http.StatusNotFound},
		{"unknown mode", map[string]any{"context_mode": "telepathy"}, http.StatusBadRequest},
		{"debrief without a session", map[string]any{"context_mode": "session_debrief"}, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doJSON(t, server, http.MethodPost, "/api/ai/chat", chatRequest(srv.URL, tt.context))
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tt.status, rec.Body.String())
			}
			if ct := rec.Header().Get("Content-Type"); strings.Contains(ct, "event-stream") {
				t.Fatalf("expected a JSON error, not an event stream")
			}
			var body ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil || body.Code != ai.AIErrorInvalidRequest || body.Error == "" {
				t.Fatalf("body = %+v (%v), want code %s and a message", body, err, ai.AIErrorInvalidRequest)
			}
		})
	}
	if len(up.prompts) != 0 {
		t.Fatalf("expected no provider request, got %d", len(up.prompts))
	}
}

func TestAIChat_UsesSavedVoiceForTheEngineer(t *testing.T) {
	server, repo := newSettingsTestServer(t, ServerConfig{})
	if err := settings.SaveVoice(context.Background(), repo, settings.Voice{Persona: "custom", CustomPrompt: "You are a calm strategist.", DriverCallsign: " Checo "}); err != nil {
		t.Fatalf("save voice: %v", err)
	}
	up := &captureUpstream{}
	srv := httptest.NewServer(up)
	defer srv.Close()

	req := chatRequest(srv.URL, map[string]any{"context_mode": "live"})
	req["persona"] = "custom"
	if rec := doJSON(t, server, http.MethodPost, "/api/ai/chat", req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %q", rec.Code, rec.Body.String())
	}
	prompt := up.prompts[0]
	if !strings.Contains(prompt, "You are a calm strategist.") || !strings.Contains(prompt, `"Checo"`) {
		t.Errorf("expected the saved custom persona and call-sign in the prompt:\n%s", prompt)
	}
	if !strings.Contains(prompt, "Standing by for live on-track telemetry") {
		t.Errorf("expected the standby text without an engine:\n%s", prompt)
	}
}
