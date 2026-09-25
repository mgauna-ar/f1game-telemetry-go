package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// openAITemperature keeps radio answers factual while still sounding natural.
const openAITemperature = 0.4

// OpenAI chat roles and tool settings.
const (
	openAIRoleSystem     = "system"
	openAIRoleDeveloper  = "developer"
	openAIRoleUser       = "user"
	openAIRoleAssistant  = "assistant"
	openAIRoleTool       = "tool"
	openAIToolType       = "function"
	openAIToolChoiceNone = "none"
)

// openAIReasoningModelPrefixes lists OpenAI model families that reject a custom temperature
// and take their instructions through the "developer" role.
var openAIReasoningModelPrefixes = []string{"o1", "o3", "o4", "gpt-5"}

// IsOpenAIReasoningModel reports whether the OpenAI model belongs to a reasoning family.
func IsOpenAIReasoningModel(model string) bool {
	return hasAnyPrefix(strings.ToLower(strings.TrimSpace(model)), openAIReasoningModelPrefixes)
}

type openAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openAIToolCall struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function openAIFunctionCall `json:"function"`
}

type openAIMessage struct {
	Role string `json:"role"`
	// Content is a string, or nil for an assistant turn that only calls tools.
	Content    any              `json:"content"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
}

type openAIFunctionDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type openAITool struct {
	Type     string                   `json:"type"`
	Function openAIFunctionDefinition `json:"function"`
}

func openAITools(defs []ToolDefinition) []openAITool {
	out := make([]openAITool, 0, len(defs))
	for _, d := range defs {
		out = append(out, openAITool{
			Type:     openAIToolType,
			Function: openAIFunctionDefinition{Name: d.Name, Description: d.Description, Parameters: d.objectSchema()},
		})
	}
	return out
}

// openAIToolCallDelta is one streamed fragment of a tool call.
type openAIToolCallDelta struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// openAIToolCallAccumulator rebuilds tool calls from their streamed fragments.
type openAIToolCallAccumulator struct {
	calls   []*openAIToolCall
	byIndex map[int]*openAIToolCall
}

func (a *openAIToolCallAccumulator) add(d openAIToolCallDelta) {
	if a.byIndex == nil {
		a.byIndex = make(map[int]*openAIToolCall)
	}
	call, ok := a.byIndex[d.Index]
	// Some OpenAI-compatible servers send every call whole with the same index; a new id
	// on a known index is then a new call.
	if !ok || (d.ID != "" && call.ID != "" && d.ID != call.ID) {
		call = &openAIToolCall{Type: openAIToolType}
		a.calls = append(a.calls, call)
		a.byIndex[d.Index] = call
	}
	if d.ID != "" {
		call.ID = d.ID
	}
	if call.Function.Name == "" {
		call.Function.Name = d.Function.Name
	}
	call.Function.Arguments += d.Function.Arguments
}

func (a *openAIToolCallAccumulator) result() []openAIToolCall {
	out := make([]openAIToolCall, 0, len(a.calls))
	for i, c := range a.calls {
		if c.ID == "" {
			c.ID = fmt.Sprintf("call_%d", i)
		}
		out = append(out, *c)
	}
	return out
}

// openAIChat is a conversation with OpenAI or an OpenAI-compatible server.
type openAIChat struct {
	provider    string
	endpoint    string
	headers     map[string]string
	model       string
	isReasoning bool
	history     []openAIMessage
	// lastText and lastCalls are the model's latest answer, replayed before the tool results.
	lastText  string
	lastCalls []openAIToolCall
}

func newOpenAIChat(conn connection, model, systemPrompt string, messages []AIChatMessage) chatSession {
	baseURL := conn.baseURL
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}
	isReasoning := IsOpenAIReasoningModel(model)
	systemRole := openAIRoleSystem
	if isReasoning {
		systemRole = openAIRoleDeveloper
	}

	history := make([]openAIMessage, 0, 1+len(messages))
	history = append(history, openAIMessage{Role: systemRole, Content: systemPrompt})
	for _, m := range messages {
		role := m.Role
		if role == "" {
			role = openAIRoleUser
		}
		history = append(history, openAIMessage{Role: role, Content: m.Content})
	}

	headers := map[string]string{}
	if conn.apiKey != "" {
		headers["Authorization"] = "Bearer " + conn.apiKey
	}
	return &openAIChat{
		provider:    conn.provider,
		endpoint:    strings.TrimRight(baseURL, "/") + "/chat/completions",
		headers:     headers,
		model:       model,
		isReasoning: isReasoning,
		history:     history,
	}
}

func (c *openAIChat) streamTurn(ctx context.Context, turn chatTurn, out sseWriter) ([]toolCall, error) {
	reqMap := map[string]any{
		"model":    c.model,
		"messages": c.history,
		"stream":   true,
	}
	if !c.isReasoning {
		reqMap["temperature"] = openAITemperature
	}
	if turn.tools != nil {
		reqMap["tools"] = openAITools(turn.tools)
		if turn.final {
			reqMap["tool_choice"] = openAIToolChoiceNone
		}
	}
	resp, err := postStream(ctx, "OpenAI", c.endpoint, c.headers, reqMap, func(status int, b []byte) error { return ParseOpenAIError(status, b, c.provider) })
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var text strings.Builder
	var acc openAIToolCallAccumulator
	err = readSSEData(ctx, resp.Body, func(payload string) {
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   string                `json:"content"`
					ToolCalls []openAIToolCallDelta `json:"tool_calls"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(payload), &chunk) != nil || len(chunk.Choices) == 0 {
			return
		}
		delta := chunk.Choices[0].Delta
		if delta.Content != "" {
			text.WriteString(delta.Content)
			out.text(delta.Content)
		}
		for _, d := range delta.ToolCalls {
			acc.add(d)
		}
	})

	c.lastText, c.lastCalls = text.String(), acc.result()
	calls := make([]toolCall, 0, len(c.lastCalls))
	for _, tc := range c.lastCalls {
		calls = append(calls, toolCall{ID: tc.ID, Name: tc.Function.Name, Args: json.RawMessage(tc.Function.Arguments)})
	}
	return calls, err
}

func (c *openAIChat) addToolResults(outcomes []toolOutcome) {
	assistant := openAIMessage{Role: openAIRoleAssistant, ToolCalls: c.lastCalls}
	if c.lastText != "" {
		assistant.Content = c.lastText
	}
	c.history = append(c.history, assistant)
	for _, o := range outcomes {
		c.history = append(c.history, openAIMessage{Role: openAIRoleTool, ToolCallID: o.call.ID, Content: o.responseJSON()})
	}
}

// ParseOpenAIError converts a non-200 OpenAI API response into a structured AIStreamError.
func ParseOpenAIError(statusCode int, body []byte, providerName string) *AIStreamError {
	if providerName == "" {
		providerName = ProviderOpenAI
	}
	var oErr struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &oErr)

	rawMsg := oErr.Error.Message
	if rawMsg == "" {
		rawMsg = strings.TrimSpace(string(body))
	}

	return classifyAIError(aiErrorClassifierInput{
		statusCode:   statusCode,
		rawMsg:       rawMsg,
		statusOrType: oErr.Error.Type,
		errCode:      oErr.Error.Code,
		provider:     providerName,
	})
}

// openAIExcludedModelTerms marks models that cannot hold a text chat.
var openAIExcludedModelTerms = []string{
	"audio", "realtime", "tts", "whisper", "dall-e", "embedding", "moderation", "davinci", "babbage", "instruct", "canary",
}

// openAIChatModelPrefixes are the OpenAI model families offered for chat. Custom servers name
// their models freely, so their list is not narrowed down by prefix.
var openAIChatModelPrefixes = []string{"gpt-", "o1", "o3", "o4"}

// fetchOpenAIModels lists the text chat models of OpenAI or an OpenAI-compatible server.
func fetchOpenAIModels(ctx context.Context, conn connection) ([]AIModelItem, error) {
	baseURL := conn.baseURL
	isCustom := baseURL != ""
	if !isCustom {
		baseURL = defaultOpenAIBaseURL
	}
	headers := map[string]string{}
	if conn.apiKey != "" {
		headers["Authorization"] = "Bearer " + conn.apiKey
	}

	var openAIResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	err := getJSON(ctx, "OpenAI", strings.TrimRight(baseURL, "/")+"/models", headers, &openAIResp, func(status int, b []byte) error { return ParseOpenAIError(status, b, conn.provider) })
	if err != nil {
		return nil, err
	}

	var models []AIModelItem
	for _, item := range openAIResp.Data {
		lowerID := strings.ToLower(item.ID)
		if containsAny(lowerID, openAIExcludedModelTerms) {
			continue
		}
		if !isCustom && !hasAnyPrefix(lowerID, openAIChatModelPrefixes) {
			continue
		}
		models = append(models, AIModelItem{ID: item.ID, DisplayName: item.ID})
	}
	return models, nil
}

func hasAnyPrefix(s string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}
