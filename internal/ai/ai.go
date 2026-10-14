package ai

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

// FetchModels queries the requested provider for the chat models it offers. It also returns
// the resolved provider ID.
func FetchModels(ctx context.Context, req AIFetchModelsRequest, keys ServerKeys) ([]AIModelItem, string, error) {
	p, conn, err := resolveProvider(req.Provider, req.APIKey, req.BaseURL, keys)
	if err != nil {
		return nil, conn.provider, err
	}
	models, err := p.listModels(ctx, conn)
	return models, conn.provider, err
}

// StreamChat streams an AI chat answer as SSE for the Lap Comparator, session debriefs or the
// live race engineer, with the prompt data BuildChatContext built. Live chats with fresh
// telemetry also get the race data tools. A radio channel answer uses the provider's radio
// model and asks it to answer fast.
func StreamChat(ctx context.Context, req AIChatRequest, tc *TelemetryAnalysisContext, keys ServerKeys, opts ChatOptions, w http.ResponseWriter, flusher http.Flusher) error {
	p, conn, err := resolveProvider(req.Provider, req.APIKey, req.BaseURL, keys)
	if err != nil {
		return err
	}

	radio := req.Channel == ChatChannelRadio
	model, style := ResolveDefaultModel(conn.provider, req.Model), chatStyle{}
	if radio {
		model, style = ResolveRadioModel(conn.provider, req.Model), radioAnswerStyle
	}
	// Race data tools are only offered while the server has fresh telemetry to answer them.
	var tools ToolExecutor
	if tc != nil && tc.Live != nil {
		tools = opts.Tools
	}
	systemPrompt := BuildSystemPrompt(tc, req.Persona, req.Language)
	if tools != nil {
		systemPrompt += toolUseDirective(req.Persona, req.Language)
	}

	chat := p.newChat(conn, model, systemPrompt, req.Messages)
	out := &answerClock{out: sseWriter{w: w, flusher: flusher}, start: time.Now()}
	err = runChat(ctx, conn.provider, model, chat, tools, style, out)
	if radio {
		slog.Info("Radio answer", "provider", conn.provider, "model", model,
			"first_text_ms", out.firstText.Milliseconds(), "total_ms", time.Since(out.start).Milliseconds(), "error", err)
	}
	if err != nil {
		return err
	}
	out.out.done()
	return nil
}

// answerClock passes the answer on and notes when its first text arrived.
type answerClock struct {
	out       sseWriter
	start     time.Time
	firstText time.Duration
}

func (c *answerClock) text(text string) {
	if text != "" && c.firstText == 0 {
		c.firstText = time.Since(c.start)
	}
	c.out.text(text)
}
