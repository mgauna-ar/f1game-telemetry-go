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
// live race engineer. Live-mode chats with fresh telemetry get the server-built race briefing
// and the race data tools.
func StreamChat(ctx context.Context, req AIChatRequest, keys ServerKeys, opts ChatOptions, w http.ResponseWriter, flusher http.Flusher) error {
	p, conn, err := resolveProvider(req.Provider, req.APIKey, req.BaseURL, keys)
	if err != nil {
		return err
	}

	model := ResolveDefaultModel(conn.provider, req.Model)
	// Race data tools are only offered while the server has fresh telemetry to answer them.
	var tools ToolExecutor
	if applyLiveBriefing(req.Context, opts.Live) {
		tools = opts.Tools
	}
	systemPrompt := BuildSystemPrompt(req.Context, req.Persona, req.Language)
	if tools != nil {
		systemPrompt += toolUseDirective(req.Context, req.Persona, req.Language)
	}

	chat := p.newChat(conn, model, systemPrompt, req.Messages)
	return runChat(ctx, conn.provider, model, chat, tools, sseWriter{w: w, flusher: flusher})
}

// applyLiveBriefing swaps the client's live summary for the server-built briefing when the
// server has fresh telemetry. It reports whether the briefing was applied.
func applyLiveBriefing(tc *TelemetryAnalysisContext, live LiveRaceSource) bool {
	if tc == nil || tc.ContextMode != "live" || live == nil {
		return false
	}
	briefing, ok := live.LiveBriefing()
	if !ok {
		return false
	}
	tc.LiveSummary = briefing.Summary
	tc.TrackName = briefing.TrackName
	tc.SessionType = briefing.SessionType
	tc.DrivingPhase = briefing.DrivingPhase
	tc.IncidentStatus = briefing.IncidentStatus
	if briefing.PacketFormat > 0 {
		tc.PacketFormat = briefing.PacketFormat
	}
	return true
}
