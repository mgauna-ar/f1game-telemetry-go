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

// scriptedUpstream serves one scripted reply per request and records the request bodies and headers.
type scriptedUpstream struct {
	t       *testing.T
	mu      sync.Mutex
	replies []func(w http.ResponseWriter)
	bodies  []map[string]any
	headers []http.Header
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
	s.headers = append(s.headers, r.Header.Clone())
	reply := s.replies[min(n, len(s.replies)-1)]
	s.mu.Unlock()
	reply(w)
}

func (s *scriptedUpstream) requests() []map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]map[string]any(nil), s.bodies...)
}

func (s *scriptedUpstream) requestHeaders() []http.Header {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]http.Header(nil), s.headers...)
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

// chatWith runs one chat with the provider the way StreamChat does once the provider is resolved.
func chatWith(providerID string, conn connection, model string, tools ToolExecutor, rec *httptest.ResponseRecorder) error {
	return chatWithStyle(providerID, conn, model, tools, chatStyle{}, rec)
}

// chatWithStyle runs one chat answered in the given style.
func chatWithStyle(providerID string, conn connection, model string, tools ToolExecutor, style chatStyle, rec *httptest.ResponseRecorder) error {
	conn.provider = providerID
	chat := providers[providerID].newChat(conn, model, "system", driverMessages)
	out := sseWriter{w: rec, flusher: rec}
	if err := runChat(context.Background(), providerID, model, chat, tools, style, out); err != nil {
		return err
	}
	out.done()
	return nil
}

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

	if err := chatWith(ProviderGemini, connection{apiKey: "key"}, "gemini-flash-latest", tools, rec); err != nil {
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
	if key := up.requestHeaders()[0].Get("x-goog-api-key"); key != "key" {
		t.Fatalf("expected the API key in the x-goog-api-key header, got %q", key)
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

	if err := chatWith(ProviderGemini, connection{apiKey: "key"}, "", &fakeTools{}, rec); err != nil {
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

	if err := chatWith(ProviderGemini, connection{apiKey: "key"}, "gemma-3", &fakeTools{}, rec); err != nil {
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

	err := chatWith(ProviderGemini, connection{apiKey: "bad"}, "", &fakeTools{}, rec)
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

	if err := chatWith(ProviderOpenAI, connection{apiKey: "key", baseURL: url}, "gpt-4o-mini", tools, rec); err != nil {
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

	if err := chatWith(ProviderOpenAI, connection{apiKey: "key", baseURL: url}, "gpt-4o-mini", &fakeTools{}, rec); err != nil {
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

	if err := chatWith(ProviderOpenAI, connection{apiKey: "", baseURL: url}, "llama3", &fakeTools{}, rec); err != nil {
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
				Provider: "custom", APIKey: "key", BaseURL: url, Model: "gpt-4o-mini",
				Messages: driverMessages,
			}
			opts := ChatOptions{Live: tc.live, Tools: &fakeTools{}}
			chatCtx, err := BuildChatContext(context.Background(), &ChatContextRequest{ContextMode: tc.mode}, opts)
			if err != nil {
				t.Fatalf("unexpected context error: %v", err)
			}
			if err := StreamChat(context.Background(), req, chatCtx, ServerKeys{}, opts, rec, rec); err != nil {
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

func TestStreamGemini_QuickAnswerSettings(t *testing.T) {
	cases := []struct {
		model        string
		style        chatStyle
		wantThinking string
		wantMax      any
	}{
		{"gemini-2.5-flash", radioAnswerStyle, `{"thinkingBudget":0}`, float64(RadioAnswerMaxTokens)},
		{"gemini-flash-lite-latest", radioAnswerStyle, `{"thinkingLevel":"minimal"}`, float64(RadioAnswerMaxTokens)},
		{"models/gemini-3-flash-preview", radioAnswerStyle, `{"thinkingLevel":"minimal"}`, float64(RadioAnswerMaxTokens)},
		{"gemma-3", radioAnswerStyle, "", float64(RadioAnswerMaxTokens)},
		{"gemini-flash-lite-latest", chatStyle{}, "", nil},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("%s quick=%v", tc.model, tc.style.quick), func(t *testing.T) {
			up, url := startUpstream(t, sseReply(`{"candidates":[{"content":{"parts":[{"text":"Copy."}]}}]}`))
			useGeminiBaseURL(t, url)
			rec := httptest.NewRecorder()

			if err := chatWithStyle(ProviderGemini, connection{apiKey: "key"}, tc.model, nil, tc.style, rec); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			config, _ := up.requests()[0]["generationConfig"].(map[string]any)
			thinking := ""
			if v, ok := config["thinkingConfig"]; ok {
				b, _ := json.Marshal(v)
				thinking = string(b)
			}
			if thinking != tc.wantThinking || config["maxOutputTokens"] != tc.wantMax || config["temperature"] != geminiTemperature {
				t.Fatalf("got generation config %v, want thinking %s and max tokens %v", config, tc.wantThinking, tc.wantMax)
			}
		})
	}
}

func TestStreamOpenAI_QuickAnswerSettings(t *testing.T) {
	cases := []struct {
		model      string
		style      chatStyle
		wantMax    any
		wantEffort any
	}{
		{"gpt-4o-mini", radioAnswerStyle, float64(RadioAnswerMaxTokens), nil},
		{"gpt-5-mini", radioAnswerStyle, nil, "low"},
		{"o4-mini", radioAnswerStyle, nil, "low"},
		{"gpt-4o-mini", chatStyle{}, nil, nil},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("%s quick=%v", tc.model, tc.style.quick), func(t *testing.T) {
			up, url := startUpstream(t, sseReply(`{"choices":[{"delta":{"content":"Copy."}}]}`, `[DONE]`))
			rec := httptest.NewRecorder()

			if err := chatWithStyle(ProviderCustom, connection{baseURL: url}, tc.model, nil, tc.style, rec); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			body := up.requests()[0]
			if body["max_tokens"] != tc.wantMax || body["reasoning_effort"] != tc.wantEffort {
				t.Fatalf("got max_tokens %v reasoning_effort %v, want %v %v", body["max_tokens"], body["reasoning_effort"], tc.wantMax, tc.wantEffort)
			}
		})
	}
}

func TestStreamOpenAI_QuickAnswerAndToolsBothRejected(t *testing.T) {
	up, url := startUpstream(t,
		errorReply(http.StatusBadRequest, `{"error":{"message":"unsupported parameter: max_tokens","type":"api_error"}}`),
		errorReply(http.StatusBadRequest, `{"error":{"message":"registry.ollama.ai/library/llama3:latest does not support tools","type":"api_error"}}`),
		sseReply(`{"choices":[{"delta":{"content":"Copy."}}]}`, `[DONE]`),
	)
	rec := httptest.NewRecorder()

	if err := chatWithStyle(ProviderCustom, connection{baseURL: url}, "llama3", &fakeTools{}, radioAnswerStyle, rec); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reqs := up.requests()
	if len(reqs) != 3 {
		t.Fatalf("expected the quick request, one without quick settings and one without tools, got %d", len(reqs))
	}
	_, quickTools := reqs[0]["tools"]
	_, retryTools := reqs[1]["tools"]
	_, lastTools := reqs[2]["tools"]
	if reqs[0]["max_tokens"] == nil || !quickTools || reqs[1]["max_tokens"] != nil || !retryTools || reqs[2]["max_tokens"] != nil || lastTools {
		t.Fatalf("unexpected retry order: %v", reqs)
	}
	if text, done := clientText(t, rec); text != "Copy." || done != 1 {
		t.Fatalf("expected the answer and one [DONE], got %q with %d [DONE]", text, done)
	}
}

func TestCheckChannel(t *testing.T) {
	live := &ChatContextRequest{ContextMode: ContextModeLive}
	cases := []struct {
		name    string
		req     AIChatRequest
		wantErr bool
	}{
		{"no channel", AIChatRequest{}, false},
		{"chat", AIChatRequest{Channel: ChatChannelChat, Context: &ChatContextRequest{ContextMode: ContextModeComparator}}, false},
		{"radio about the live session", AIChatRequest{Channel: ChatChannelRadio, Context: live}, false},
		{"radio without a context", AIChatRequest{Channel: ChatChannelRadio}, true},
		{"radio about a recorded session", AIChatRequest{Channel: ChatChannelRadio, Context: &ChatContextRequest{ContextMode: ContextModeSessionDebrief, SessionID: 1}}, true},
		{"unknown channel", AIChatRequest{Channel: "tv", Context: live}, true},
	}
	for _, tc := range cases {
		err := tc.req.CheckChannel()
		if (err != nil) != tc.wantErr || (err != nil && !errors.Is(err, ErrInvalidChatContext)) {
			t.Errorf("%s: got %v, want error %v", tc.name, err, tc.wantErr)
		}
	}
}

func TestResolveRadioModel(t *testing.T) {
	cases := []struct{ provider, model, want string }{
		{ProviderClaude, "", DefaultClaudeRadioModel},
		{ProviderGemini, " ", DefaultGeminiRadioModel},
		{ProviderOpenAI, "", DefaultOpenAIRadioModel},
		{ProviderCustom, "", DefaultModel(ProviderCustom)},
		{ProviderClaude, "claude-sonnet-5-5", "claude-sonnet-5-5"},
	}
	for _, tc := range cases {
		if got := ResolveRadioModel(tc.provider, tc.model); got != tc.want {
			t.Errorf("ResolveRadioModel(%q, %q) = %q, want %q", tc.provider, tc.model, got, tc.want)
		}
	}
}
