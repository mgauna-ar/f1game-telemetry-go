package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

// geminiAPIBaseURL is a variable so tests can point it at a local server.
var geminiAPIBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// geminiAPIKeyHeader carries the API key, which keeps it out of URLs that end up in error messages.
const geminiAPIKeyHeader = "x-goog-api-key"

// geminiTemperature keeps radio answers factual while still sounding natural.
const geminiTemperature = 0.35

// Gemini content roles and function calling modes.
const (
	geminiRoleUser         = "user"
	geminiRoleModel        = "model"
	geminiFunctionModeNone = "NONE"
)

type geminiContent struct {
	Role string `json:"role,omitempty"`
	// Parts are kept raw so the model's function call parts, including their thought
	// signatures, can be sent back exactly as received.
	Parts []json.RawMessage `json:"parts"`
}

type geminiFunctionDeclaration struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters,omitempty"`
}

type geminiTool struct {
	FunctionDeclarations []geminiFunctionDeclaration `json:"functionDeclarations"`
}

type geminiFunctionCallingConfig struct {
	Mode string `json:"mode"`
}

type geminiToolConfig struct {
	FunctionCallingConfig geminiFunctionCallingConfig `json:"functionCallingConfig"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent    `json:"system_instruction,omitempty"`
	Contents          []geminiContent   `json:"contents"`
	Tools             []geminiTool      `json:"tools,omitempty"`
	ToolConfig        *geminiToolConfig `json:"toolConfig,omitempty"`
	GenerationConfig  map[string]any    `json:"generationConfig,omitempty"`
}

// geminiPart is the subset of a response part the chat reads.
type geminiPart struct {
	Text         string `json:"text"`
	Thought      bool   `json:"thought"`
	FunctionCall *struct {
		ID   string          `json:"id"`
		Name string          `json:"name"`
		Args json.RawMessage `json:"args"`
	} `json:"functionCall"`
}

func geminiTextPart(text string) json.RawMessage {
	b, _ := json.Marshal(map[string]string{"text": text})
	return b
}

// geminiContents converts the chat history, merging consecutive messages of the same role
// and skipping empty ones, since Gemini expects alternating turns with non-empty parts.
func geminiContents(messages []AIChatMessage) []geminiContent {
	contents := make([]geminiContent, 0, len(messages))
	for _, m := range messages {
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		role := geminiRoleUser
		if m.Role == "assistant" {
			role = geminiRoleModel
		}
		if n := len(contents); n > 0 && contents[n-1].Role == role {
			contents[n-1].Parts = append(contents[n-1].Parts, geminiTextPart(m.Content))
			continue
		}
		contents = append(contents, geminiContent{Role: role, Parts: []json.RawMessage{geminiTextPart(m.Content)}})
	}
	return contents
}

func geminiTools(defs []ToolDefinition) []geminiTool {
	decls := make([]geminiFunctionDeclaration, 0, len(defs))
	for _, d := range defs {
		decls = append(decls, geminiFunctionDeclaration(d))
	}
	return []geminiTool{{FunctionDeclarations: decls}}
}

// geminiChat is a conversation with the Google Gemini API.
type geminiChat struct {
	url     string
	headers map[string]string
	body    geminiRequest
	// lastTurn is the model's latest answer, replayed before its function responses.
	lastTurn geminiContent
}

func newGeminiChat(conn connection, model, systemPrompt string, messages []AIChatMessage) chatSession {
	modelClean := strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if modelClean == "" {
		modelClean = DefaultGeminiModel
	}
	return &geminiChat{
		url:     fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse", geminiAPIBaseURL, modelClean),
		headers: map[string]string{geminiAPIKeyHeader: conn.apiKey},
		body: geminiRequest{
			SystemInstruction: &geminiContent{Parts: []json.RawMessage{geminiTextPart(systemPrompt)}},
			Contents:          geminiContents(messages),
			GenerationConfig:  map[string]any{"temperature": geminiTemperature},
		},
	}
}

func (c *geminiChat) streamTurn(ctx context.Context, turn chatTurn, out sseWriter) ([]toolCall, error) {
	c.body.Tools, c.body.ToolConfig = nil, nil
	if turn.tools != nil {
		c.body.Tools = geminiTools(turn.tools)
		if turn.final {
			c.body.ToolConfig = &geminiToolConfig{FunctionCallingConfig: geminiFunctionCallingConfig{Mode: geminiFunctionModeNone}}
		}
	}
	resp, err := postStream(ctx, "Gemini", c.url, c.headers, c.body, func(status int, b []byte) error { return ParseGeminiError(status, b) })
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var text strings.Builder
	var callParts []json.RawMessage
	var calls []toolCall
	err = readSSEData(ctx, resp.Body, func(payload string) {
		var chunk struct {
			Candidates []struct {
				Content struct {
					Parts []json.RawMessage `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if json.Unmarshal([]byte(payload), &chunk) != nil || len(chunk.Candidates) == 0 {
			return
		}
		for _, raw := range chunk.Candidates[0].Content.Parts {
			var part geminiPart
			if json.Unmarshal(raw, &part) != nil || part.Thought {
				continue
			}
			if part.FunctionCall != nil {
				callParts = append(callParts, raw)
				calls = append(calls, toolCall{ID: part.FunctionCall.ID, Name: part.FunctionCall.Name, Args: part.FunctionCall.Args})
				continue
			}
			if part.Text != "" {
				text.WriteString(part.Text)
				out.text(part.Text)
			}
		}
	})

	// The model's turn is replayed text first, then its function call parts as received.
	parts := make([]json.RawMessage, 0, len(callParts)+1)
	if text.Len() > 0 {
		parts = append(parts, geminiTextPart(text.String()))
	}
	c.lastTurn = geminiContent{Role: geminiRoleModel, Parts: append(parts, callParts...)}
	return calls, err
}

func (c *geminiChat) addToolResults(outcomes []toolOutcome) {
	parts := make([]json.RawMessage, 0, len(outcomes))
	for _, o := range outcomes {
		response := map[string]any{"name": o.call.Name, "response": o.responseObject()}
		if o.call.ID != "" {
			response["id"] = o.call.ID
		}
		b, err := json.Marshal(map[string]any{"functionResponse": response})
		if err != nil {
			b, _ = json.Marshal(map[string]any{"functionResponse": map[string]any{
				"name": o.call.Name, "response": map[string]string{"error": err.Error()},
			}})
		}
		parts = append(parts, b)
	}
	c.body.Contents = append(c.body.Contents, c.lastTurn, geminiContent{Role: geminiRoleUser, Parts: parts})
}

// ParseGeminiError converts a non-200 Gemini API response into a structured AIStreamError.
func ParseGeminiError(statusCode int, body []byte) *AIStreamError {
	var gErr struct {
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &gErr)

	rawMsg := gErr.Error.Message
	if rawMsg == "" {
		rawMsg = strings.TrimSpace(string(body))
	}

	return classifyAIError(aiErrorClassifierInput{
		statusCode:   statusCode,
		rawMsg:       rawMsg,
		statusOrType: gErr.Error.Status,
		provider:     ProviderGemini,
	})
}

// geminiExcludedModelTerms marks Gemini models that cannot hold a text chat.
var geminiExcludedModelTerms = []string{"banana", "imagen", "image", "embedding", "aqa", "tts", "audio", "robotics", "vision"}

// fetchGeminiModels lists the Gemini models that can hold a text chat.
func fetchGeminiModels(ctx context.Context, conn connection) ([]AIModelItem, error) {
	var geminiResp struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			Description                string   `json:"description"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	headers := map[string]string{geminiAPIKeyHeader: conn.apiKey}
	err := getJSON(ctx, "Gemini", geminiAPIBaseURL+"/models", headers, &geminiResp, func(status int, b []byte) error { return ParseGeminiError(status, b) })
	if err != nil {
		return nil, err
	}

	var models []AIModelItem
	for _, m := range geminiResp.Models {
		if !slices.Contains(m.SupportedGenerationMethods, "generateContent") {
			continue
		}
		cleanID := strings.TrimPrefix(m.Name, "models/")
		lowerID := strings.ToLower(cleanID)
		if !strings.HasPrefix(lowerID, "gemini-") || containsAny(lowerID, geminiExcludedModelTerms) {
			continue
		}
		dispName := m.DisplayName
		if dispName == "" {
			dispName = cleanID
		}
		models = append(models, AIModelItem{ID: cleanID, DisplayName: dispName, Description: m.Description})
	}
	return models, nil
}

func containsAny(s string, terms []string) bool {
	for _, t := range terms {
		if strings.Contains(s, t) {
			return true
		}
	}
	return false
}
