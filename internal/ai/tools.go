package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
)

// ToolDefinition describes a function the model may call during a chat.
type ToolDefinition struct {
	Name        string
	Description string
	// Parameters is the JSON Schema object for the arguments, or nil when the tool takes none.
	Parameters map[string]any
}

// ToolExecutor runs the tools offered to the model.
type ToolExecutor interface {
	// Definitions lists the tools the model may call.
	Definitions() []ToolDefinition
	// Execute runs one tool call and returns a JSON-encodable result.
	Execute(ctx context.Context, name string, args json.RawMessage) (any, error)
}

// MaxToolRounds caps how many model turns may call tools before the model must answer in text.
const MaxToolRounds = 4

// toolCall is one function call requested by the model.
type toolCall struct {
	ID   string
	Name string
	Args json.RawMessage
}

// toolOutcome is the result of one tool call, or the error the model should see instead.
type toolOutcome struct {
	call   toolCall
	result any
	err    error
}

func runToolCalls(ctx context.Context, tools ToolExecutor, calls []toolCall) []toolOutcome {
	outcomes := make([]toolOutcome, 0, len(calls))
	for _, call := range calls {
		args := call.Args
		if len(args) == 0 {
			args = json.RawMessage("{}")
		}
		result, err := tools.Execute(ctx, call.Name, args)
		if err != nil {
			slog.Warn("AI tool call failed", "tool", call.Name, "error", err)
		} else {
			slog.Debug("AI tool call", "tool", call.Name, "args", string(args))
		}
		outcomes = append(outcomes, toolOutcome{call: call, result: result, err: err})
	}
	return outcomes
}

// responseObject wraps a tool outcome in the object shape both providers accept.
func (o toolOutcome) responseObject() map[string]any {
	if o.err != nil {
		return map[string]any{"error": o.err.Error()}
	}
	return map[string]any{"result": o.result}
}

func (o toolOutcome) responseJSON() string {
	b, err := json.Marshal(o.responseObject())
	if err != nil {
		return fmt.Sprintf(`{"error":%q}`, err.Error())
	}
	return string(b)
}

// toolsRejected reports whether an upstream error looks like the model or server not
// supporting function calling, in which case the request is retried without tools.
func toolsRejected(err error) bool {
	var streamErr *AIStreamError
	if !errors.As(err, &streamErr) {
		return false
	}
	badRequest := streamErr.StatusCode == http.StatusBadRequest || streamErr.StatusCode == http.StatusUnprocessableEntity
	return badRequest && streamErr.Code == AIErrorGeneric
}

// objectSchema returns the tool's parameter schema, or an empty object schema.
func (d ToolDefinition) objectSchema() map[string]any {
	if d.Parameters != nil {
		return d.Parameters
	}
	return map[string]any{"type": "object", "properties": map[string]any{}}
}
