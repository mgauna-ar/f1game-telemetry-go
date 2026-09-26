package ai

import (
	"context"
	"net/http"
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
// telemetry also get the race data tools.
func StreamChat(ctx context.Context, req AIChatRequest, tc *TelemetryAnalysisContext, keys ServerKeys, opts ChatOptions, w http.ResponseWriter, flusher http.Flusher) error {
	p, conn, err := resolveProvider(req.Provider, req.APIKey, req.BaseURL, keys)
	if err != nil {
		return err
	}

	model := ResolveDefaultModel(conn.provider, req.Model)
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
	return runChat(ctx, conn.provider, model, chat, tools, sseWriter{w: w, flusher: flusher})
}
