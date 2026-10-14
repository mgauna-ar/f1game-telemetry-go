package ai

import (
	"context"
	"log/slog"
)

// chatStyle is how fast and how long the model answers.
type chatStyle struct {
	// quick asks for a fast answer: no thinking where the model allows it, else the least effort.
	quick bool
	// maxTokens caps a quick answer from a model that doesn't think; 0 keeps the provider's
	// default. A thinking model counts its thinking in the cap, so it is left uncapped.
	maxTokens int64
}

// RadioAnswerMaxTokens caps a spoken radio answer. Answers are a few sentences, so it only
// stops a runaway one.
const RadioAnswerMaxTokens = 1024

// radioAnswerStyle answers the driver's radio questions as fast as the model can.
var radioAnswerStyle = chatStyle{quick: true, maxTokens: RadioAnswerMaxTokens}

// chatTurn is what one request to the model may do.
type chatTurn struct {
	// tools are the functions offered to the model, or nil for none.
	tools []ToolDefinition
	// final keeps the tools declared but tells the model to answer in text.
	final bool
	style chatStyle
}

// textSink receives the answer text as it arrives.
type textSink interface {
	text(text string)
}

// chatSession is one conversation with a provider, kept across tool calling rounds.
type chatSession interface {
	// streamTurn sends the conversation, writes the answer text to out as it arrives, and
	// returns the tool calls the model asked for.
	streamTurn(ctx context.Context, turn chatTurn, out textSink) ([]toolCall, error)
	// addToolResults appends the model's last turn and the results of its tool calls.
	addToolResults(outcomes []toolOutcome)
}

// runChat streams a chat answer to out. When tools is not nil the model may call them first;
// their results are sent back until it answers in text, for at most MaxToolRounds rounds.
// A model or server that rejects the quick answer settings is asked again without them, and
// one that rejects tools is asked again without tools.
func runChat(ctx context.Context, providerID, model string, chat chatSession, tools ToolExecutor, style chatStyle, out textSink) error {
	var defs []ToolDefinition
	if tools != nil {
		defs = tools.Definitions()
	}

	for round := 0; ; round++ {
		turn := chatTurn{tools: defs, final: round >= MaxToolRounds, style: style}
		calls, err := chat.streamTurn(ctx, turn, out)
		if err != nil && round == 0 && style.quick && requestRejected(err) {
			slog.Warn("AI model rejected the quick answer settings, retrying without them", "provider", providerID, "model", model, "error", err)
			style = chatStyle{}
			turn.style = style
			calls, err = chat.streamTurn(ctx, turn, out)
		}
		if err != nil && round == 0 && defs != nil && requestRejected(err) {
			slog.Warn("AI model rejected tools, retrying without them", "provider", providerID, "model", model, "error", err)
			defs = nil
			calls, err = chat.streamTurn(ctx, chatTurn{style: style}, out)
		}
		if err != nil {
			return err
		}
		if len(calls) == 0 || defs == nil || turn.final {
			return nil
		}
		chat.addToolResults(runToolCalls(ctx, tools, calls))
	}
}
