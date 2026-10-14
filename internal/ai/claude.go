package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// claudeAPIBaseURL is a variable so tests can point it at a local server.
var claudeAPIBaseURL = "https://api.anthropic.com"

// claudeMaxTokens caps one answer, thinking included. Race engineer answers are a few
// sentences, so this only has to leave the model room to think first.
const claudeMaxTokens = 16000

// claudeQuick is what a Claude model family accepts for a quick answer.
type claudeQuick struct {
	// effort is true when the model takes output_config.effort.
	effort bool
	// thinkingOff is true when the model takes thinking disabled at low effort.
	thinkingOff bool
	// thinks is true when the model still thinks in a quick answer, so its tokens stay uncapped.
	thinks bool
}

// claudeQuickByFamily lists the Claude families by model name prefix, first match wins. Haiku
// 5.5 can stop thinking; Opus 5.5, Sonnet 5.5 and Fable always think, and turning thinking
// off on Opus 5 and Sonnet 5 makes their tool calls less reliable, so newer models only lower
// the effort. The 4.x models only think when asked, and the oldest have no effort setting.
var claudeQuickByFamily = []struct {
	prefix string
	quick  claudeQuick
}{
	{"claude-haiku-5", claudeQuick{effort: true, thinkingOff: true}},
	{"claude-haiku-4", claudeQuick{}},
	{"claude-sonnet-4-6", claudeQuick{effort: true}},
	{"claude-sonnet-4", claudeQuick{}},
	{"claude-opus-4", claudeQuick{effort: true}},
	{"claude-3", claudeQuick{}},
}

// claudeQuickFor returns what the model accepts for a quick answer. Unknown models are taken
// to be newer ones that think and take an effort.
func claudeQuickFor(model string) claudeQuick {
	name := strings.ToLower(strings.TrimSpace(model))
	for _, family := range claudeQuickByFamily {
		if strings.HasPrefix(name, family.prefix) {
			return family.quick
		}
	}
	return claudeQuick{effort: true, thinks: true}
}

// claudeRefusalMessage is shown when Claude declines to answer.
const claudeRefusalMessage = "Claude declined to answer this request. Try rephrasing it or pick another model in Settings."

// newClaudeClient builds an Anthropic API client that uses only the key the app resolved,
// never credentials picked up from the environment or a local profile.
func newClaudeClient(conn connection, httpClient *http.Client) anthropic.Client {
	return anthropic.NewClient(
		option.WithoutEnvironmentDefaults(),
		option.WithBaseURL(claudeAPIBaseURL),
		option.WithAPIKey(conn.apiKey),
		option.WithHTTPClient(httpClient),
	)
}

// claudeMessages converts the chat history, skipping empty messages (which the API rejects)
// and merging consecutive messages of the same role.
func claudeMessages(messages []AIChatMessage) []anthropic.MessageParam {
	out := make([]anthropic.MessageParam, 0, len(messages))
	for _, m := range messages {
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		role := anthropic.MessageParamRoleUser
		if m.Role == "assistant" {
			role = anthropic.MessageParamRoleAssistant
		}
		block := anthropic.NewTextBlock(m.Content)
		if n := len(out); n > 0 && out[n-1].Role == role {
			out[n-1].Content = append(out[n-1].Content, block)
			continue
		}
		out = append(out, anthropic.MessageParam{Role: role, Content: []anthropic.ContentBlockParamUnion{block}})
	}
	return out
}

func claudeTools(defs []ToolDefinition) []anthropic.ToolUnionParam {
	tools := make([]anthropic.ToolUnionParam, 0, len(defs))
	for _, d := range defs {
		schema := anthropic.ToolInputSchemaParam{ExtraFields: map[string]any{}}
		for key, value := range d.objectSchema() {
			switch key {
			case "type":
			case "properties":
				schema.Properties = value
			case "required":
				schema.Required = stringList(value)
			default:
				schema.ExtraFields[key] = value
			}
		}
		tool := anthropic.ToolParam{Name: d.Name, Description: anthropic.String(d.Description), InputSchema: schema}
		tools = append(tools, anthropic.ToolUnionParam{OfTool: &tool})
	}
	return tools
}

// stringList reads a JSON Schema "required" list, which may come typed or decoded from JSON.
func stringList(v any) []string {
	switch list := v.(type) {
	case []string:
		return list
	case []any:
		out := make([]string, 0, len(list))
		for _, item := range list {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

// claudeChat is a conversation with the Anthropic Messages API.
type claudeChat struct {
	client anthropic.Client
	params anthropic.MessageNewParams
	// lastTurn is the model's latest answer, replayed whole (thinking blocks included)
	// before the tool results.
	lastTurn anthropic.MessageParam
}

func newClaudeChat(conn connection, model, systemPrompt string, messages []AIChatMessage) chatSession {
	return &claudeChat{
		client: newClaudeClient(conn, streamingHTTPClient),
		params: anthropic.MessageNewParams{
			Model:     anthropic.Model(model),
			MaxTokens: claudeMaxTokens,
			System:    []anthropic.TextBlockParam{{Text: systemPrompt}},
			Messages:  claudeMessages(messages),
		},
	}
}

// applyStyle sets the thinking, effort and token cap for the turn's answer style.
func (c *claudeChat) applyStyle(style chatStyle) {
	c.params.MaxTokens = claudeMaxTokens
	c.params.Thinking, c.params.OutputConfig = anthropic.ThinkingConfigParamUnion{}, anthropic.OutputConfigParam{}
	if !style.quick {
		return
	}
	quick := claudeQuickFor(c.params.Model)
	if quick.effort {
		c.params.OutputConfig.Effort = anthropic.OutputConfigEffortLow
	}
	if quick.thinkingOff {
		disabled := anthropic.NewThinkingConfigDisabledParam()
		c.params.Thinking = anthropic.ThinkingConfigParamUnion{OfDisabled: &disabled}
	}
	if !quick.thinks && style.maxTokens > 0 {
		c.params.MaxTokens = style.maxTokens
	}
}

func (c *claudeChat) streamTurn(ctx context.Context, turn chatTurn, out textSink) ([]toolCall, error) {
	c.applyStyle(turn.style)
	c.params.Tools, c.params.ToolChoice = nil, anthropic.ToolChoiceUnionParam{}
	if turn.tools != nil {
		c.params.Tools = claudeTools(turn.tools)
		if turn.final {
			c.params.ToolChoice = anthropic.ToolChoiceUnionParam{OfNone: &anthropic.ToolChoiceNoneParam{}}
		}
	}

	stream := c.client.Messages.NewStreaming(ctx, c.params)
	defer stream.Close()
	var msg anthropic.Message
	for stream.Next() {
		event := stream.Current()
		if err := msg.Accumulate(event); err != nil {
			return nil, fmt.Errorf("failed to read Claude stream: %w", err)
		}
		if delta, ok := event.AsAny().(anthropic.ContentBlockDeltaEvent); ok {
			if text, ok := delta.Delta.AsAny().(anthropic.TextDelta); ok {
				out.text(text.Text)
			}
		}
	}
	if err := stream.Err(); err != nil {
		return nil, claudeError(err)
	}
	if msg.StopReason == anthropic.StopReasonRefusal {
		return nil, &AIStreamError{Code: AIErrorGeneric, Message: claudeRefusalMessage, Provider: ProviderClaude}
	}

	c.lastTurn = msg.ToParam()
	if msg.StopReason != anthropic.StopReasonToolUse {
		return nil, nil
	}
	var calls []toolCall
	for _, block := range msg.Content {
		if use, ok := block.AsAny().(anthropic.ToolUseBlock); ok {
			calls = append(calls, toolCall{ID: use.ID, Name: use.Name, Args: use.Input})
		}
	}
	return calls, nil
}

func (c *claudeChat) addToolResults(outcomes []toolOutcome) {
	results := make([]anthropic.ContentBlockParamUnion, 0, len(outcomes))
	for _, o := range outcomes {
		results = append(results, anthropic.NewToolResultBlock(o.call.ID, o.responseJSON(), o.err != nil))
	}
	c.params.Messages = append(c.params.Messages, c.lastTurn, anthropic.NewUserMessage(results...))
}

// claudeError converts an Anthropic API error into a structured AIStreamError.
func claudeError(err error) error {
	var apiErr *anthropic.Error
	if !errors.As(err, &apiErr) {
		return fmt.Errorf("failed to reach Claude API: %w", err)
	}
	var body struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	raw := apiErr.RawJSON()
	_ = json.Unmarshal([]byte(raw), &body)
	msg := body.Error.Message
	if msg == "" {
		msg = strings.TrimSpace(raw)
	}
	return classifyAIError(aiErrorClassifierInput{
		statusCode:   apiErr.StatusCode,
		rawMsg:       msg,
		statusOrType: string(apiErr.Type()),
		provider:     ProviderClaude,
	})
}

// fetchClaudeModels lists the Claude models the key can use, newest first.
func fetchClaudeModels(ctx context.Context, conn connection) ([]AIModelItem, error) {
	client := newClaudeClient(conn, shortHTTPClient)
	pages := client.Models.ListAutoPaging(ctx, anthropic.ModelListParams{})
	var models []AIModelItem
	for pages.Next() {
		m := pages.Current()
		models = append(models, AIModelItem{ID: m.ID, DisplayName: m.DisplayName})
	}
	if err := pages.Err(); err != nil {
		return nil, claudeError(err)
	}
	return models, nil
}
