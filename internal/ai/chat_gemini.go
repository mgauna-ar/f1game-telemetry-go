package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
)

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

// geminiPart is the subset of a response part the chat loop reads.
type geminiPart struct {
	Text         string `json:"text"`
	Thought      bool   `json:"thought"`
	FunctionCall *struct {
		ID   string          `json:"id"`
		Name string          `json:"name"`
		Args json.RawMessage `json:"args"`
	} `json:"functionCall"`
}

// geminiTurn is one streamed model answer: the text sent to the driver and any function calls.
type geminiTurn struct {
	text      strings.Builder
	callParts []json.RawMessage
	calls     []toolCall
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

func geminiTools(tools ToolExecutor) []geminiTool {
	defs := tools.Definitions()
	decls := make([]geminiFunctionDeclaration, 0, len(defs))
	for _, d := range defs {
		decls = append(decls, geminiFunctionDeclaration(d))
	}
	return []geminiTool{{FunctionDeclarations: decls}}
}

// StreamGemini streams a chat answer from the Google Gemini API as SSE. When tools is not nil
// the model may call them first; their results are sent back until it answers in text.
func StreamGemini(ctx context.Context, apiKey, model, systemPrompt string, messages []AIChatMessage, tools ToolExecutor, w http.ResponseWriter, flusher http.Flusher) error {
	modelClean := strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if modelClean == "" {
		modelClean = DefaultGeminiModel
	}
	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse&key=%s", geminiAPIBaseURL, modelClean, apiKey)
	out := sseWriter{w: w, flusher: flusher}

	body := geminiRequest{
		SystemInstruction: &geminiContent{Parts: []json.RawMessage{geminiTextPart(systemPrompt)}},
		Contents:          geminiContents(messages),
		GenerationConfig:  map[string]any{"temperature": geminiTemperature},
	}
	send := func(round int) (*http.Response, error) {
		body.Tools, body.ToolConfig = nil, nil
		if tools != nil {
			body.Tools = geminiTools(tools)
			if round >= MaxToolRounds {
				body.ToolConfig = &geminiToolConfig{FunctionCallingConfig: geminiFunctionCallingConfig{Mode: geminiFunctionModeNone}}
			}
		}
		return postStream(ctx, "Gemini", url, nil, body, func(status int, b []byte) error { return ParseGeminiError(status, b) })
	}

	for round := 0; ; round++ {
		resp, err := send(round)
		if err != nil && round == 0 && tools != nil && toolsRejected(err) {
			slog.Warn("Gemini model rejected tools, retrying without them", "model", modelClean, "error", err)
			tools = nil
			resp, err = send(round)
		}
		if err != nil {
			return err
		}

		turn, err := readGeminiTurn(ctx, resp, out)
		if err != nil {
			return err
		}
		if len(turn.calls) == 0 || tools == nil || round >= MaxToolRounds {
			break
		}
		body.Contents = append(body.Contents, turn.modelContent(), geminiFunctionResponses(runToolCalls(ctx, tools, turn.calls)))
	}

	out.done()
	return nil
}

// readGeminiTurn streams the text parts of one answer to the client and collects its function calls.
func readGeminiTurn(ctx context.Context, resp *http.Response, out sseWriter) (*geminiTurn, error) {
	defer resp.Body.Close()
	turn := &geminiTurn{}
	err := readSSEData(ctx, resp.Body, func(payload string) {
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
				turn.callParts = append(turn.callParts, raw)
				turn.calls = append(turn.calls, toolCall{ID: part.FunctionCall.ID, Name: part.FunctionCall.Name, Args: part.FunctionCall.Args})
				continue
			}
			if part.Text != "" {
				turn.text.WriteString(part.Text)
				out.text(part.Text)
			}
		}
	})
	return turn, err
}

// modelContent replays the model's turn, text first, then its function call parts as received.
func (t *geminiTurn) modelContent() geminiContent {
	parts := make([]json.RawMessage, 0, len(t.callParts)+1)
	if t.text.Len() > 0 {
		parts = append(parts, geminiTextPart(t.text.String()))
	}
	parts = append(parts, t.callParts...)
	return geminiContent{Role: geminiRoleModel, Parts: parts}
}

func geminiFunctionResponses(outcomes []toolOutcome) geminiContent {
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
	return geminiContent{Role: geminiRoleUser, Parts: parts}
}
