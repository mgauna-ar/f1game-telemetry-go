package ai

import (
	"context"
	"log/slog"
)

// chatTurn is what one request to the model may do.
type chatTurn struct {
	// tools are the functions offered to the model, or nil for none.
	tools []ToolDefinition
	// final keeps the tools declared but tells the model to answer in text.
	final bool
}

// chatSession is one conversation with a provider, kept across tool calling rounds.
type chatSession interface {
	// streamTurn sends the conversation, writes the answer text to out as it arrives, and
	// returns the tool calls the model asked for.
	streamTurn(ctx context.Context, turn chatTurn, out sseWriter) ([]toolCall, error)
	// addToolResults appends the model's last turn and the results of its tool calls.
	addToolResults(outcomes []toolOutcome)
}

// runChat streams a chat answer to out. When tools is not nil the model may call them first;
// their results are sent back until it answers in text, for at most MaxToolRounds rounds.
// A model or server that rejects tools is asked again without them.
func runChat(ctx context.Context, providerID, model string, chat chatSession, tools ToolExecutor, out sseWriter) error {
	var defs []ToolDefinition
	if tools != nil {
		defs = tools.Definitions()
	}

	for round := 0; ; round++ {
		turn := chatTurn{tools: defs, final: round >= MaxToolRounds}
		calls, err := chat.streamTurn(ctx, turn, out)
		if err != nil && round == 0 && defs != nil && toolsRejected(err) {
			slog.Warn("AI model rejected tools, retrying without them", "provider", providerID, "model", model, "error", err)
			defs = nil
			calls, err = chat.streamTurn(ctx, chatTurn{}, out)
		}
		if err != nil {
			return err
		}
		if len(calls) == 0 || defs == nil || turn.final {
			break
		}
		chat.addToolResults(runToolCalls(ctx, tools, calls))
	}

	out.done()
	return nil
}
