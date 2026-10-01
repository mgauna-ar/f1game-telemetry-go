package ai

import (
	"context"
	"errors"
	"fmt"
	"slices"
)

// ErrInvalidChatContext reports a chat context the server can't build prompt data for.
var ErrInvalidChatContext = errors.New("invalid chat context")

// BuildChatContext builds the prompt data for a chat from the identifiers the client sent:
// the live race briefing, a recorded session's debrief, or two compared laps. A request with
// no context is a general chat.
func BuildChatContext(ctx context.Context, req *ChatContextRequest, opts ChatOptions) (*TelemetryAnalysisContext, error) {
	mode := ContextModeGeneral
	if req != nil && req.ContextMode != "" {
		mode = req.ContextMode
	}
	tc := &TelemetryAnalysisContext{
		ContextMode:         mode,
		CustomPersonaPrompt: opts.CustomPersonaPrompt,
		DriverCallsign:      opts.DriverCallsign,
	}

	switch mode {
	case ContextModeGeneral:
	case ContextModeLive:
		if opts.Live != nil {
			if briefing, ok := opts.Live.LiveBriefing(); ok {
				tc.Live = &briefing
			}
		}
	case ContextModeSessionDebrief:
		if req.SessionID <= 0 {
			return nil, fmt.Errorf("%w: session_debrief needs a session_id", ErrInvalidChatContext)
		}
		if req.Focus != "" && !slices.Contains(DebriefFocuses, req.Focus) {
			return nil, fmt.Errorf("%w: unknown focus %q", ErrInvalidChatContext, req.Focus)
		}
		if opts.Recorded != nil {
			debrief, err := opts.Recorded.SessionDebrief(ctx, req.SessionID, req.Focus)
			if err != nil {
				return nil, err
			}
			tc.Debrief = &debrief
		}
	case ContextModeComparator:
		if zr := req.Zoom; zr != nil && zr.EndMeters <= zr.StartMeters {
			return nil, fmt.Errorf("%w: zoom must end after it starts", ErrInvalidChatContext)
		}
		// Until both laps are picked the engineer answers without comparison data.
		if opts.Recorded != nil && req.LapAID > 0 && req.LapBID > 0 {
			comparison, err := opts.Recorded.LapComparison(ctx, req.LapAID, req.LapBID, req.Zoom)
			if err != nil {
				return nil, err
			}
			tc.Comparison = comparison
		}
	default:
		return nil, fmt.Errorf("%w: unknown context_mode %q", ErrInvalidChatContext, mode)
	}
	return tc, nil
}
