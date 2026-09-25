package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// claudeSSEReply streams Anthropic Messages API events, naming each by its "type" field.
func claudeSSEReply(t *testing.T, events ...string) func(w http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "text/event-stream")
		for _, ev := range events {
			var head struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal([]byte(ev), &head); err != nil {
				t.Errorf("bad scripted event %s: %v", ev, err)
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", head.Type, ev)
		}
	}
}

// claudeErrorReply answers with an Anthropic API error the SDK does not retry.
func claudeErrorReply(status int, errType, message string) func(w http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("x-should-retry", "false")
		w.WriteHeader(status)
		fmt.Fprintf(w, `{"type":"error","error":{"type":%q,"message":%q}}`, errType, message)
	}
}

const (
	claudeMessageStart = `{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":12,"output_tokens":1}}}`
	claudeMessageStop  = `{"type":"message_stop"}`
)

func claudeStop(reason string) string {
	return fmt.Sprintf(`{"type":"message_delta","delta":{"stop_reason":%q,"stop_sequence":null},"usage":{"output_tokens":20}}`, reason)
}

// claudeTextAnswer streams one text block and ends the turn.
func claudeTextAnswer(t *testing.T, chunks ...string) func(w http.ResponseWriter) {
	events := make([]string, 0, len(chunks)+5)
	events = append(events, claudeMessageStart, `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`)
	for _, c := range chunks {
		events = append(events, fmt.Sprintf(`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":%q}}`, c))
	}
	events = append(events, `{"type":"content_block_stop","index":0}`, claudeStop("end_turn"), claudeMessageStop)
	return claudeSSEReply(t, events...)
}

// claudeToolCallAnswer thinks, says a few words and calls get_driver and get_standings.
func claudeToolCallAnswer(t *testing.T) func(w http.ResponseWriter) {
	return claudeSSEReply(t,
		claudeMessageStart,
		`{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig-1"}}`,
		`{"type":"content_block_stop","index":0}`,
		`{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}`,
		`{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Checking. "}}`,
		`{"type":"content_block_stop","index":1}`,
		`{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_driver","input":{}}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\"driver\":"}}`,
		`{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"\"Norris\"}"}}`,
		`{"type":"content_block_stop","index":2}`,
		`{"type":"content_block_start","index":3,"content_block":{"type":"tool_use","id":"toolu_2","name":"get_standings","input":{}}}`,
		`{"type":"content_block_stop","index":3}`,
		claudeStop("tool_use"),
		claudeMessageStop,
	)
}

func useClaudeBaseURL(t *testing.T, url string) {
	t.Helper()
	prev := claudeAPIBaseURL
	claudeAPIBaseURL = url
	t.Cleanup(func() { claudeAPIBaseURL = prev })
}

func TestClaudeChat_CallsToolsThenAnswers(t *testing.T) {
	up, url := startUpstream(t, claudeToolCallAnswer(t), claudeTextAnswer(t, "Norris is ", "P4."))
	useClaudeBaseURL(t, url)
	tools := &fakeTools{}
	rec := httptest.NewRecorder()

	if err := chatWith(ProviderClaude, connection{apiKey: "key"}, "claude-opus-5", tools, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	text, done := clientText(t, rec)
	if text != "Checking. Norris is P4." || done != 1 {
		t.Fatalf("expected the streamed text of both rounds and one [DONE], got %q with %d [DONE]", text, done)
	}
	if strings.Join(tools.calls, "|") != `get_driver {"driver":"Norris"}|get_standings {}` {
		t.Fatalf("expected both calls with their streamed input, got %v", tools.calls)
	}

	reqs, headers := up.requests(), up.requestHeaders()
	if len(reqs) != 2 {
		t.Fatalf("expected 2 upstream requests, got %d", len(reqs))
	}
	if headers[0].Get("X-Api-Key") != "key" || headers[0].Get("Anthropic-Version") == "" {
		t.Fatalf("expected the API key and version headers, got %v", headers[0])
	}
	first := reqs[0]
	if first["model"] != "claude-opus-5" || first["max_tokens"] != float64(claudeMaxTokens) || jsonString(t, first, "system", 0, "text") != "system" {
		t.Fatalf("unexpected request: %v", first)
	}
	if _, ok := first["temperature"]; ok {
		t.Fatalf("expected no temperature, which current Claude models reject")
	}
	if name := jsonString(t, first, "tools", 1, "name"); name != "get_driver" {
		t.Fatalf("expected the tools to be declared, got %v", name)
	}
	if req := jsonArray(t, first, "tools", 1, "input_schema", "required"); len(req) != 1 || req[0] != "driver" {
		t.Fatalf("expected the tool schema to keep its required fields, got %v", req)
	}
	if typ := jsonString(t, first, "tools", 0, "input_schema", "type"); typ != "object" {
		t.Fatalf("expected a parameterless tool to get an object schema, got %v", typ)
	}

	msgs := jsonArray(t, reqs[1], "messages")
	if len(msgs) != 3 {
		t.Fatalf("expected user, assistant call and tool results, got %v", msgs)
	}
	if sig := jsonString(t, msgs[1], "content", 0, "signature"); sig != "sig-1" {
		t.Fatalf("expected the thinking block to be replayed with its signature, got %v", msgs[1])
	}
	if input := jsonString(t, msgs[1], "content", 2, "input", "driver"); input != "Norris" {
		t.Fatalf("expected the rebuilt tool call input, got %v", msgs[1])
	}
	results := jsonArray(t, msgs[2], "content")
	if len(results) != 2 || jsonString(t, results[0], "tool_use_id") != "toolu_1" || !strings.Contains(fmt.Sprint(jsonPath(t, results[0], "content")), `"position":4`) {
		t.Fatalf("expected both results in one user turn, get_driver first, got %v", results)
	}
	if jsonPath(t, results[1], "is_error") != true || !strings.Contains(fmt.Sprint(jsonPath(t, results[1], "content")), "unknown tool get_standings") {
		t.Fatalf("expected the failing tool to be reported as an error, got %v", results[1])
	}
	if _, ok := reqs[1]["tool_choice"]; ok {
		t.Fatalf("expected tool calling to stay enabled on the second round")
	}
}

func TestClaudeChat_ForcesAnAnswerAfterMaxRounds(t *testing.T) {
	up, url := startUpstream(t, claudeToolCallAnswer(t))
	useClaudeBaseURL(t, url)
	rec := httptest.NewRecorder()

	if err := chatWith(ProviderClaude, connection{apiKey: "key"}, "claude-opus-5", &fakeTools{}, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reqs := up.requests()
	if len(reqs) != MaxToolRounds+1 {
		t.Fatalf("expected %d upstream requests, got %d", MaxToolRounds+1, len(reqs))
	}
	if choice := jsonString(t, reqs[MaxToolRounds], "tool_choice", "type"); choice != "none" {
		t.Fatalf("expected the last round to disable tool calls, got %v", choice)
	}
	if _, done := clientText(t, rec); done != 1 {
		t.Fatalf("expected one [DONE], got %d", done)
	}
}

func TestClaudeChat_RefusalIsAnError(t *testing.T) {
	_, url := startUpstream(t, claudeSSEReply(t,
		claudeMessageStart,
		`{"type":"message_delta","delta":{"stop_reason":"refusal","stop_sequence":null,"stop_details":{"type":"refusal","category":null,"explanation":null}},"usage":{"output_tokens":0}}`,
		claudeMessageStop,
	))
	useClaudeBaseURL(t, url)
	rec := httptest.NewRecorder()

	err := chatWith(ProviderClaude, connection{apiKey: "key"}, "claude-opus-5", nil, rec)
	var streamErr *AIStreamError
	if !errors.As(err, &streamErr) || streamErr.Message != claudeRefusalMessage || streamErr.Provider != ProviderClaude {
		t.Fatalf("expected a refusal error, got %v", err)
	}
	if _, done := clientText(t, rec); done != 0 {
		t.Fatalf("expected no [DONE] after a refusal")
	}
}

func TestClaudeChat_ClassifiesAPIErrors(t *testing.T) {
	cases := []struct {
		status       int
		errType, msg string
		wantCode     string
	}{
		{http.StatusUnauthorized, "authentication_error", "invalid x-api-key", AIErrorInvalidAPIKey},
		{statusOverloaded, "overloaded_error", "Overloaded", AIErrorModelOverloaded},
		{http.StatusTooManyRequests, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit", AIErrorQuotaExceeded},
		{http.StatusNotFound, "not_found_error", "model: claude-nope", AIErrorModelNotFound},
		{http.StatusBadRequest, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.", AIErrorQuotaExceeded},
	}
	for _, tc := range cases {
		t.Run(tc.errType, func(t *testing.T) {
			up, url := startUpstream(t, claudeErrorReply(tc.status, tc.errType, tc.msg))
			useClaudeBaseURL(t, url)
			rec := httptest.NewRecorder()

			err := chatWith(ProviderClaude, connection{apiKey: "key"}, "claude-opus-5", &fakeTools{}, rec)
			var streamErr *AIStreamError
			if !errors.As(err, &streamErr) || streamErr.Code != tc.wantCode || streamErr.RawMessage != tc.msg {
				t.Fatalf("expected %s carrying the API message, got %#v", tc.wantCode, err)
			}
			if n := len(up.requests()); n != 1 {
				t.Fatalf("expected no retry, got %d requests", n)
			}
		})
	}
}

func TestClaudeChat_IgnoresEnvironmentCredentials(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("ANTHROPIC_AUTH_TOKEN", "env-token")
	t.Setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:1")
	up, url := startUpstream(t, claudeTextAnswer(t, "Copy."))
	useClaudeBaseURL(t, url)
	rec := httptest.NewRecorder()

	req := AIChatRequest{Provider: "claude", Messages: driverMessages}
	if err := StreamChat(context.Background(), req, ServerKeys{Claude: "server-key"}, ChatOptions{}, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	header := up.requestHeaders()[0]
	if header.Get("X-Api-Key") != "server-key" || header.Get("Authorization") != "" {
		t.Fatalf("expected only the server's key, got key %q and authorization %q", header.Get("X-Api-Key"), header.Get("Authorization"))
	}
	if model := up.requests()[0]["model"]; model != DefaultClaudeModel {
		t.Fatalf("expected the default Claude model, got %v", model)
	}
	if text, _ := clientText(t, rec); text != "Copy." {
		t.Fatalf("expected the answer, got %q", text)
	}
}

func TestClaudeMessages_MergesRolesAndSkipsEmpty(t *testing.T) {
	msgs := claudeMessages([]AIChatMessage{
		{Role: "user", Content: "Radio check"},
		{Role: "user", Content: "Gap?"},
		{Role: "assistant", Content: ""},
		{Role: "assistant", Content: "1.2 seconds."},
	})
	if len(msgs) != 2 || msgs[0].Role != "user" || len(msgs[0].Content) != 2 || msgs[1].Role != "assistant" {
		t.Fatalf("unexpected messages: %+v", msgs)
	}
}

func TestFetchClaudeModels(t *testing.T) {
	var gotKey, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey, gotPath = r.Header.Get("X-Api-Key"), r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"data":[
			{"type":"model","id":"claude-opus-5","display_name":"Claude Opus 5","created_at":"2026-05-01T00:00:00Z"},
			{"type":"model","id":"claude-haiku-4-5","display_name":"Claude Haiku 4.5","created_at":"2025-10-01T00:00:00Z"}],
			"has_more":false,"first_id":"claude-opus-5","last_id":"claude-haiku-4-5"}`)
	}))
	defer srv.Close()
	useClaudeBaseURL(t, srv.URL)

	models, provider, err := FetchModels(context.Background(), AIFetchModelsRequest{Provider: "claude", APIKey: "key"}, ServerKeys{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider != ProviderClaude || gotKey != "key" || gotPath != "/v1/models" {
		t.Fatalf("expected a Claude models request with the key, got provider %s key %q path %q", provider, gotKey, gotPath)
	}
	if len(models) != 2 || models[0].ID != "claude-opus-5" || models[0].DisplayName != "Claude Opus 5" {
		t.Fatalf("unexpected models: %+v", models)
	}
}
