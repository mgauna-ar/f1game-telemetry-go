package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// directiveCapture keeps the calls the engine broadcast.
type directiveCapture struct {
	mu    sync.Mutex
	calls []engineer.EngineerDirective
}

func (c *directiveCapture) Broadcast(data []byte) {
	var d engineer.EngineerDirective
	if json.Unmarshal(data, &d) == nil {
		c.mu.Lock()
		c.calls = append(c.calls, d)
		c.mu.Unlock()
	}
}

// gapReportCall drives a race on lap 10, alone on track in P5, into its first call: a gap report.
func gapReportCall(t *testing.T, eng *engineer.EngineerEngine, capture *directiveCapture) engineer.EngineerDirective {
	t.Helper()
	ctx := context.Background()
	h := packets.PacketHeader{PacketFormat: packets.PacketFormat2025, SessionUID: 4242, SessionTime: 100}
	eng.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackLength: 5000})
	eng.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
		{CurrentLapNum: 10, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack},
	}})
	capture.mu.Lock()
	defer capture.mu.Unlock()
	for _, d := range capture.calls {
		if d.SubAlert == "gap_report" {
			return d
		}
	}
	t.Fatalf("no gap report in %+v", capture.calls)
	return engineer.EngineerDirective{}
}

// lineUpstream is an OpenAI-compatible server that answers with a fixed line, or an error, and
// keeps the model of each request.
type lineUpstream struct {
	mu     sync.Mutex
	line   string
	status int
	models []string
}

func (u *lineUpstream) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Model string `json:"model"`
	}
	raw, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(raw, &body)
	u.mu.Lock()
	u.models = append(u.models, body.Model)
	line, status := u.line, u.status
	u.mu.Unlock()
	if status != 0 {
		w.WriteHeader(status)
		_, _ = io.WriteString(w, `{"error":{"message":"slow down"}}`)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", line)
}

// radioLineServer is a server with a race engine and a custom AI server for radio lines.
func radioLineServer(t *testing.T, up *lineUpstream) (*Server, *engineer.EngineerEngine, *directiveCapture) {
	t.Helper()
	server, _ := newSettingsTestServer(t, ServerConfig{})
	capture := &directiveCapture{}
	eng := engineer.NewEngineerEngine(capture)
	server.SetEngineerEngine(eng)
	srv := httptest.NewServer(up)
	t.Cleanup(srv.Close)
	rec := doJSON(t, server, http.MethodPut, "/api/settings/ai", map[string]any{
		"provider":     "custom",
		"base_url":     srv.URL,
		"radio_models": map[string]string{"custom": "local-radio"},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("save AI settings: status %d body %q", rec.Code, rec.Body.String())
	}
	return server, eng, capture
}

func radioLineBody(id string) map[string]any {
	return map[string]any{
		"directive_id": id, "language": "en", "persona": "bono",
		"baseline": "Gap report. P5, nobody close.",
	}
}

func TestAIRadioLine_WordsTheCall(t *testing.T) {
	up := &lineUpstream{line: "Running P5 in clear air, nobody close."}
	server, eng, capture := radioLineServer(t, up)
	call := gapReportCall(t, eng, capture)
	if !call.Wordable {
		t.Fatalf("gap report %+v isn't wordable with AI wording on and a server address saved", call)
	}

	rec := doJSON(t, server, http.MethodPost, "/api/ai/radio-line", radioLineBody(call.ID))
	var resp ai.RadioLineResponse
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &resp) != nil || resp.Text != up.line {
		t.Fatalf("status %d body %q, want the line", rec.Code, rec.Body.String())
	}
	if len(up.models) != 1 || up.models[0] != "local-radio" {
		t.Errorf("models %v, want the radio model", up.models)
	}

	// The race context the AI race engineer reads says what the driver heard.
	snap := eng.RaceContext()
	if len(snap.Calls) == 0 || snap.Calls[len(snap.Calls)-1].Said != up.line {
		t.Errorf("recent calls %+v, want the line said", snap.Calls)
	}
}

func TestAIRadioLine_Errors(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		status   int // the AI server's error status, or 0 to answer with line
		body     func(id string) map[string]any
		wantCode int
		wantErr  string
	}{
		{"unknown call", "Fine.", 0, func(string) map[string]any { return radioLineBody("directive_1_nothing") }, http.StatusNotFound, ai.AIErrorInvalidRequest},
		{"no baseline", "Fine.", 0, func(id string) map[string]any {
			b := radioLineBody(id)
			b["baseline"] = "  "
			return b
		}, http.StatusBadRequest, ai.AIErrorInvalidRequest},
		{"a line that changes the facts", "P5, the car ahead is 3 seconds up the road.", 0, radioLineBody, http.StatusUnprocessableEntity, ai.AIErrorRadioLineRejected},
		{"the provider's error", "", http.StatusTooManyRequests, radioLineBody, http.StatusTooManyRequests, ai.AIErrorQuotaExceeded},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server, eng, capture := radioLineServer(t, &lineUpstream{line: tt.line, status: tt.status})
			call := gapReportCall(t, eng, capture)
			rec := doJSON(t, server, http.MethodPost, "/api/ai/radio-line", tt.body(call.ID))
			var payload ai.AIErrorPayload
			_ = json.Unmarshal(rec.Body.Bytes(), &payload)
			if rec.Code != tt.wantCode || payload.Code != tt.wantErr {
				t.Errorf("status %d code %q body %q, want %d %q", rec.Code, payload.Code, rec.Body.String(), tt.wantCode, tt.wantErr)
			}
		})
	}
}

func TestAIRadioLine_WordingFollowsTheSettings(t *testing.T) {
	t.Run("switched off in the voice settings", func(t *testing.T) {
		server, eng, capture := radioLineServer(t, &lineUpstream{line: "Fine."})
		if rec := doJSON(t, server, http.MethodPut, "/api/settings/voice", map[string]any{"persona": "bono", "ai_radio_lines": false}); rec.Code != http.StatusOK {
			t.Fatalf("save voice: %d %q", rec.Code, rec.Body.String())
		}
		call := gapReportCall(t, eng, capture)
		if call.Wordable {
			t.Error("a call is wordable with AI wording switched off")
		}
		if rec := doJSON(t, server, http.MethodPost, "/api/ai/radio-line", radioLineBody(call.ID)); rec.Code != http.StatusNotFound {
			t.Errorf("status %d, want 404 for a call the AI doesn't word", rec.Code)
		}
	})

	t.Run("no AI provider ready", func(t *testing.T) {
		server, _ := newSettingsTestServer(t, ServerConfig{})
		capture := &directiveCapture{}
		eng := engineer.NewEngineerEngine(capture)
		server.SetEngineerEngine(eng)
		if call := gapReportCall(t, eng, capture); call.Wordable {
			t.Error("a call is wordable without an AI key")
		}
	})

	t.Run("a key from the environment", func(t *testing.T) {
		server, _ := newSettingsTestServer(t, ServerConfig{GeminiAPIKey: "env-key"})
		capture := &directiveCapture{}
		eng := engineer.NewEngineerEngine(capture)
		server.SetEngineerEngine(eng)
		if call := gapReportCall(t, eng, capture); !call.Wordable {
			t.Error("a call isn't wordable with the default provider's key in the environment")
		}
	})
}
