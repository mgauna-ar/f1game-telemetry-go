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
	"sync"
	"testing"
)

// fakeTools records the calls it receives and answers each with a fixed result.
type fakeTools struct {
	mu    sync.Mutex
	calls []string
}

func (f *fakeTools) Definitions() []ToolDefinition {
	return []ToolDefinition{
		{Name: "get_standings", Description: "Running order"},
		{Name: "get_driver", Description: "One driver", Parameters: map[string]any{
			"type":       "object",
			"properties": map[string]any{"driver": map[string]any{"type": "string"}},
			"required":   []string{"driver"},
		}},
	}
}

func (f *fakeTools) Execute(_ context.Context, name string, args json.RawMessage) (any, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, name+" "+string(args))
	if name == "get_driver" {
		return map[string]any{"name": "Lando Norris", "position": 4}, nil
	}
	return nil, errors.New("unknown tool " + name)
}

// scriptedUpstream serves one scripted reply per request and records the request bodies.
type scriptedUpstream struct {
	t       *testing.T
	mu      sync.Mutex
	replies []func(w http.ResponseWriter)
	bodies  []map[string]any
}

func (s *scriptedUpstream) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(r.Body)
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		s.t.Errorf("request body is not JSON: %v", err)
	}
	s.mu.Lock()
	n := len(s.bodies)
	s.bodies = append(s.bodies, body)
	reply := s.replies[min(n, len(s.replies)-1)]
	s.mu.Unlock()
	reply(w)
}

func (s *scriptedUpstream) requests() []map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]map[string]any(nil), s.bodies...)
}

func sseReply(events ...string) func(w http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "text/event-stream")
		for _, ev := range events {
			fmt.Fprintf(w, "data: %s\n\n", ev)
		}
	}
}

func errorReply(status int, body string) func(w http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}
}

func startUpstream(t *testing.T, replies ...func(w http.ResponseWriter)) (up *scriptedUpstream, url string) {
	t.Helper()
	up = &scriptedUpstream{t: t, replies: replies}
	srv := httptest.NewServer(up)
	t.Cleanup(srv.Close)
	return up, srv.URL
}

func useGeminiBaseURL(t *testing.T, url string) {
	t.Helper()
	prev := geminiAPIBaseURL
	geminiAPIBaseURL = url
	t.Cleanup(func() { geminiAPIBaseURL = prev })
}

// clientText returns the text chunks written to the client and how many [DONE] markers it got.
func clientText(t *testing.T, rec *httptest.ResponseRecorder) (answer string, doneMarkers int) {
	t.Helper()
	var text strings.Builder
	_ = readSSEData(context.Background(), strings.NewReader(rec.Body.String()+"\n"), func(p string) {
		var chunk struct {
			Text string `json:"text"`
		}
		if json.Unmarshal([]byte(p), &chunk) == nil {
			text.WriteString(chunk.Text)
		}
	})
	return text.String(), strings.Count(rec.Body.String(), "data: [DONE]")
}

func jsonPath(t *testing.T, v any, path ...any) any {
	t.Helper()
	cur := v
	for _, key := range path {
		switch k := key.(type) {
		case string:
			m, ok := cur.(map[string]any)
			if !ok {
				t.Fatalf("expected an object at %v, got %T", key, cur)
			}
			cur = m[k]
		case int:
			a, ok := cur.([]any)
			if !ok || k >= len(a) {
				t.Fatalf("expected an array with index %d, got %v", k, cur)
			}
			cur = a[k]
		}
	}
	return cur
}

func jsonArray(t *testing.T, v any, path ...any) []any {
	t.Helper()
	a, ok := jsonPath(t, v, path...).([]any)
	if !ok {
		t.Fatalf("expected an array at %v", path)
	}
	return a
}

func jsonString(t *testing.T, v any, path ...any) string {
	t.Helper()
	str, ok := jsonPath(t, v, path...).(string)
	if !ok {
		t.Fatalf("expected a string at %v", path)
	}
	return str
}

var driverMessages = []AIChatMessage{{Role: "user", Content: "Where is Norris?"}}

func TestStreamGemini_CallsToolsThenAnswers(t *testing.T) {
	up, url := startUpstream(t,
		sseReply(`{"candidates":[{"content":{"role":"model","parts":[{"functionCall":{"name":"get_driver","args":{"driver":"Norris"}},"thoughtSignature":"sig-1"}]}}]}`),
		sseReply(
			`{"candidates":[{"content":{"parts":[{"text":"thinking out loud","thought":true},{"text":"Norris is "}]}}]}`,
			`{"candidates":[{"content":{"parts":[{"text":"P4."}]}}]}`,
		),
	)
	useGeminiBaseURL(t, url)
	tools := &fakeTools{}
	rec := httptest.NewRecorder()

	if err := StreamGemini(context.Background(), "key", "gemini-flash-latest", "system", driverMessages, tools, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	text, done := clientText(t, rec)
	if text != "Norris is P4." || done != 1 {
		t.Fatalf("expected the answer and one [DONE], got %q with %d [DONE]", text, done)
	}
	if len(tools.calls) != 1 || tools.calls[0] != `get_driver {"driver":"Norris"}` {
		t.Fatalf("expected one get_driver call, got %v", tools.calls)
	}

	reqs := up.requests()
	if len(reqs) != 2 {
		t.Fatalf("expected 2 upstream requests, got %d", len(reqs))
	}
	if name := jsonPath(t, reqs[0], "tools", 0, "functionDeclarations", 1, "name"); name != "get_driver" {
		t.Fatalf("expected the tools to be declared, got %v", name)
	}
	contents := jsonArray(t, reqs[1], "contents")
	if len(contents) != 3 {
		t.Fatalf("expected user, model call and function response, got %v", contents)
	}
	if sig := jsonPath(t, contents[1], "parts", 0, "thoughtSignature"); sig != "sig-1" {
		t.Fatalf("expected the function call part to be echoed with its thought signature, got %v", contents[1])
	}
	if pos := jsonPath(t, contents[2], "parts", 0, "functionResponse", "response", "result", "position"); pos != float64(4) {
		t.Fatalf("expected the tool result in the function response, got %v", contents[2])
	}
	if reqs[1]["toolConfig"] != nil {
		t.Fatalf("expected tool calling to stay enabled on the second round, got %v", reqs[1]["toolConfig"])
	}
}

func TestStreamGemini_ForcesAnAnswerAfterMaxRounds(t *testing.T) {
	up, url := startUpstream(t, sseReply(`{"candidates":[{"content":{"parts":[{"functionCall":{"name":"get_standings","args":{}}}]}}]}`))
	useGeminiBaseURL(t, url)
	rec := httptest.NewRecorder()

	if err := StreamGemini(context.Background(), "key", "", "system", driverMessages, &fakeTools{}, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	reqs := up.requests()
	if len(reqs) != MaxToolRounds+1 {
		t.Fatalf("expected %d upstream requests, got %d", MaxToolRounds+1, len(reqs))
	}
	if mode := jsonPath(t, reqs[MaxToolRounds], "toolConfig", "functionCallingConfig", "mode"); mode != "NONE" {
		t.Fatalf("expected the last round to disable function calls, got %v", mode)
	}
	errResult := jsonPath(t, reqs[1], "contents", 2, "parts", 0, "functionResponse", "response", "error")
	if errResult != "unknown tool get_standings" {
		t.Fatalf("expected a failing tool to report its error to the model, got %v", errResult)
	}
}

func TestStreamGemini_RetriesWithoutToolsWhenRejected(t *testing.T) {
	up, url := startUpstream(t,
		errorReply(http.StatusBadRequest, `{"error":{"code":400,"message":"Function calling is not enabled for models/gemma-3","status":"INVALID_ARGUMENT"}}`),
		sseReply(`{"candidates":[{"content":{"parts":[{"text":"Copy."}]}}]}`),
	)
	useGeminiBaseURL(t, url)
	rec := httptest.NewRecorder()

	if err := StreamGemini(context.Background(), "key", "gemma-3", "system", driverMessages, &fakeTools{}, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reqs := up.requests()
	if len(reqs) != 2 || reqs[1]["tools"] != nil {
		t.Fatalf("expected one retry without tools, got %v", reqs)
	}
	if text, _ := clientText(t, rec); text != "Copy." {
		t.Fatalf("expected the answer, got %q", text)
	}
}

func TestStreamGemini_DoesNotRetryAnInvalidKey(t *testing.T) {
	up, url := startUpstream(t, errorReply(http.StatusBadRequest, `{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}`))
	useGeminiBaseURL(t, url)
	rec := httptest.NewRecorder()

	err := StreamGemini(context.Background(), "bad", "", "system", driverMessages, &fakeTools{}, rec, rec)
	var streamErr *AIStreamError
	if !errors.As(err, &streamErr) || streamErr.Code != AIErrorInvalidAPIKey {
		t.Fatalf("expected an invalid key error, got %v", err)
	}
	if n := len(up.requests()); n != 1 {
		t.Fatalf("expected no retry, got %d requests", n)
	}
}

func TestGeminiContents_MergesRolesAndSkipsEmpty(t *testing.T) {
	contents := geminiContents([]AIChatMessage{
		{Role: "user", Content: "Radio check"},
		{Role: "user", Content: "Gap?"},
		{Role: "assistant", Content: "  "},
		{Role: "assistant", Content: "1.2 seconds."},
	})
	if len(contents) != 2 || contents[0].Role != "user" || len(contents[0].Parts) != 2 || contents[1].Role != "model" {
		t.Fatalf("unexpected contents: %+v", contents)
	}
}

func TestStreamOpenAI_CallsToolsThenAnswers(t *testing.T) {
	up, url := startUpstream(t,
		sseReply(
			`{"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_a","type":"function","function":{"name":"get_driver","arguments":""}}]}}]}`,
			`{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"driver\":"}}]}}]}`,
			`{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"Norris\"}"}}]}}]}`,
			`{"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_b","type":"function","function":{"name":"get_standings","arguments":"{}"}}]}}]}`,
			`[DONE]`,
		),
		sseReply(`{"choices":[{"delta":{"content":"Norris is "}}]}`, `{"choices":[{"delta":{"content":"P4."}}]}`, `[DONE]`),
	)
	tools := &fakeTools{}
	rec := httptest.NewRecorder()

	if err := StreamOpenAI(context.Background(), url, "key", "gpt-4o-mini", "system", driverMessages, tools, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	text, done := clientText(t, rec)
	if text != "Norris is P4." || done != 1 {
		t.Fatalf("expected the answer and one [DONE], got %q with %d [DONE]", text, done)
	}
	if strings.Join(tools.calls, "|") != `get_driver {"driver":"Norris"}|get_standings {}` {
		t.Fatalf("expected both calls with their streamed arguments, got %v", tools.calls)
	}

	reqs := up.requests()
	if len(reqs) != 2 {
		t.Fatalf("expected 2 upstream requests, got %d", len(reqs))
	}
	if name := jsonPath(t, reqs[0], "tools", 0, "function", "name"); name != "get_standings" {
		t.Fatalf("expected the tools to be declared, got %v", name)
	}
	if params := jsonPath(t, reqs[0], "tools", 0, "function", "parameters", "type"); params != "object" {
		t.Fatalf("expected a parameterless tool to get an empty object schema, got %v", params)
	}
	msgs := jsonArray(t, reqs[1], "messages")
	if len(msgs) != 5 {
		t.Fatalf("expected system, user, assistant call and two tool results, got %v", msgs)
	}
	if args := jsonPath(t, msgs[2], "tool_calls", 0, "function", "arguments"); args != `{"driver":"Norris"}` {
		t.Fatalf("expected the assistant turn to carry the rebuilt call, got %v", msgs[2])
	}
	if jsonString(t, msgs[3], "tool_call_id") != "call_a" || !strings.Contains(jsonString(t, msgs[3], "content"), `"position":4`) {
		t.Fatalf("expected the get_driver result for call_a, got %v", msgs[3])
	}
	if !strings.Contains(jsonString(t, msgs[4], "content"), `"error":"unknown tool get_standings"`) {
		t.Fatalf("expected the failing tool to report its error, got %v", msgs[4])
	}
	if _, ok := reqs[1]["tool_choice"]; ok {
		t.Fatalf("expected tool calling to stay enabled on the second round")
	}
}

func TestStreamOpenAI_ForcesAnAnswerAfterMaxRounds(t *testing.T) {
	up, url := startUpstream(t, sseReply(`{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c","function":{"name":"get_standings","arguments":"{}"}}]}}]}`, `[DONE]`))
	rec := httptest.NewRecorder()

	if err := StreamOpenAI(context.Background(), url, "key", "gpt-4o-mini", "system", driverMessages, &fakeTools{}, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reqs := up.requests()
	if len(reqs) != MaxToolRounds+1 || reqs[MaxToolRounds]["tool_choice"] != "none" {
		t.Fatalf("expected %d requests ending with tool_choice none, got %d", MaxToolRounds+1, len(reqs))
	}
}

func TestStreamOpenAI_RetriesWithoutToolsWhenRejected(t *testing.T) {
	up, url := startUpstream(t,
		errorReply(http.StatusBadRequest, `{"error":{"message":"registry.ollama.ai/library/llama3:latest does not support tools","type":"api_error"}}`),
		sseReply(`{"choices":[{"delta":{"content":"Copy."}}]}`, `[DONE]`),
	)
	rec := httptest.NewRecorder()

	if err := StreamOpenAI(context.Background(), url, "", "llama3", "system", driverMessages, &fakeTools{}, rec, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reqs := up.requests()
	if len(reqs) != 2 || reqs[1]["tools"] != nil {
		t.Fatalf("expected one retry without tools, got %v", reqs)
	}
}

func TestOpenAIToolCallAccumulator_WholeCallsOnOneIndex(t *testing.T) {
	var acc openAIToolCallAccumulator
	for _, id := range []string{"a", "b"} {
		d := openAIToolCallDelta{ID: id}
		d.Function.Name = "get_standings"
		d.Function.Arguments = "{}"
		acc.add(d)
	}
	var anon openAIToolCallDelta
	anon.Index = 2
	anon.Function.Name = "get_strategy"
	acc.add(anon)

	calls := acc.result()
	if len(calls) != 3 || calls[0].ID != "a" || calls[1].ID != "b" || calls[2].ID != "call_2" || calls[1].Function.Arguments != "{}" {
		t.Fatalf("expected three separate calls, got %+v", calls)
	}
}

func TestStreamChat_OffersToolsOnlyWithFreshTelemetry(t *testing.T) {
	cases := []struct {
		name      string
		live      LiveRaceSource
		mode      string
		wantTools bool
	}{
		{"fresh telemetry", fakeLiveRace{ok: true, briefing: LiveBriefing{Summary: "LIVE PIT WALL DATA"}}, "live", true},
		{"stale telemetry", fakeLiveRace{ok: false}, "live", false},
		{"lap comparator", fakeLiveRace{ok: true}, "comparator", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			up, url := startUpstream(t, sseReply(`{"choices":[{"delta":{"content":"Copy."}}]}`, `[DONE]`))
			rec := httptest.NewRecorder()
			req := AIChatRequest{
				Provider: "openai", APIKey: "key", BaseURL: url, Model: "gpt-4o-mini",
				Messages: driverMessages, Context: &TelemetryAnalysisContext{ContextMode: tc.mode},
			}
			if err := StreamChat(context.Background(), req, "", "", ChatOptions{Live: tc.live, Tools: &fakeTools{}}, rec, rec); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			body := up.requests()[0]
			_, hasTools := body["tools"]
			system := jsonString(t, body, "messages", 0, "content")
			if hasTools != tc.wantTools || strings.Contains(system, "LOOKING UP MORE DATA") != tc.wantTools {
				t.Fatalf("expected tools offered=%v, got tools=%v prompt:\n%s", tc.wantTools, hasTools, system)
			}
		})
	}
}
