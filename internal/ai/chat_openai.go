package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
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
	lower := strings.ToLower(strings.TrimSpace(model))
	for _, prefix := range openAIReasoningModelPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
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

func openAITools(tools ToolExecutor) []openAITool {
	defs := tools.Definitions()
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

// StreamOpenAI streams a chat answer from OpenAI or a compatible API as SSE. When tools is not
// nil the model may call them first; their results are sent back until it answers in text.
func StreamOpenAI(ctx context.Context, baseURL, apiKey, model, systemPrompt string, messages []AIChatMessage, tools ToolExecutor, w http.ResponseWriter, flusher http.Flusher) error {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"
	out := sseWriter{w: w, flusher: flusher}

	isReasoningModel := IsOpenAIReasoningModel(model)
	systemRole := openAIRoleSystem
	if isReasoningModel {
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
	if apiKey != "" {
		headers["Authorization"] = "Bearer " + apiKey
	}
	send := func(round int) (*http.Response, error) {
		reqMap := map[string]any{
			"model":    model,
			"messages": history,
			"stream":   true,
		}
		if !isReasoningModel {
			reqMap["temperature"] = openAITemperature
		}
		if tools != nil {
			reqMap["tools"] = openAITools(tools)
			if round >= MaxToolRounds {
				reqMap["tool_choice"] = openAIToolChoiceNone
			}
		}
		return postStream(ctx, "OpenAI", endpoint, headers, reqMap, func(status int, b []byte) error { return ParseOpenAIError(status, b, "openai") })
	}

	for round := 0; ; round++ {
		resp, err := send(round)
		if err != nil && round == 0 && tools != nil && toolsRejected(err) {
			slog.Warn("OpenAI-compatible model rejected tools, retrying without them", "model", model, "error", err)
			tools = nil
			resp, err = send(round)
		}
		if err != nil {
			return err
		}

		text, calls, err := readOpenAITurn(ctx, resp, out)
		if err != nil {
			return err
		}
		if len(calls) == 0 || tools == nil || round >= MaxToolRounds {
			break
		}

		assistant := openAIMessage{Role: openAIRoleAssistant, ToolCalls: calls}
		if text != "" {
			assistant.Content = text
		}
		history = append(history, assistant)
		requested := make([]toolCall, 0, len(calls))
		for _, c := range calls {
			requested = append(requested, toolCall{ID: c.ID, Name: c.Function.Name, Args: json.RawMessage(c.Function.Arguments)})
		}
		for _, o := range runToolCalls(ctx, tools, requested) {
			history = append(history, openAIMessage{Role: openAIRoleTool, ToolCallID: o.call.ID, Content: o.responseJSON()})
		}
	}

	out.done()
	return nil
}

// readOpenAITurn streams the text of one answer to the client and rebuilds its tool calls.
func readOpenAITurn(ctx context.Context, resp *http.Response, out sseWriter) (string, []openAIToolCall, error) {
	defer resp.Body.Close()
	var text strings.Builder
	var acc openAIToolCallAccumulator
	err := readSSEData(ctx, resp.Body, func(payload string) {
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
	return text.String(), acc.result(), err
}
