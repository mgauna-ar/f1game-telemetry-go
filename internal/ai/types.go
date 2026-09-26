package ai

import "context"

// AIChatMessage represents a message in the conversation.
type AIChatMessage struct {
	Role    string `json:"role"` // "user", "assistant", or "system"
	Content string `json:"content"`
}

// Chat context modes: what a chat is about.
const (
	ContextModeComparator     = "comparator"
	ContextModeSessionDebrief = "session_debrief"
	ContextModeLive           = "live"
	ContextModeGeneral        = "general"
)

// ChatContextModes lists every chat context mode; it builds the ChatContextMode union for the frontend.
var ChatContextModes = []string{ContextModeComparator, ContextModeSessionDebrief, ContextModeLive, ContextModeGeneral}

// ChatContextRequest names what a chat is about. The client sends only identifiers; the server
// builds the prompt data from them (BuildChatContext).
type ChatContextRequest struct {
	ContextMode string `json:"context_mode" tstype:"ChatContextMode"`
	// SessionID is the recorded session a session_debrief chat is about.
	SessionID int64 `json:"session_id,omitempty"`
	// LapAID is the driver's lap in a comparator chat, and LapBID the benchmark lap.
	LapAID int64 `json:"lap_a_id,omitempty"`
	LapBID int64 `json:"lap_b_id,omitempty"`
	// Zoom is the track segment the comparator charts are zoomed into, if any.
	Zoom *ChatZoomRange `json:"zoom,omitempty"`
}

// ChatZoomRange is a track segment, in meters of lap distance.
type ChatZoomRange struct {
	StartMeters float64 `json:"start_meters"`
	EndMeters   float64 `json:"end_meters"`
}

// AIChatRequest represents the incoming chat request from the frontend.
type AIChatRequest struct {
	Provider string              `json:"provider,omitempty"` // "gemini", "openai", "claude", or "custom"
	APIKey   string              `json:"api_key,omitempty"`
	BaseURL  string              `json:"base_url,omitempty"`
	Model    string              `json:"model,omitempty"`
	Persona  string              `json:"persona,omitempty"`  // "colapinto", "bono", "custom"
	Language string              `json:"language,omitempty"` // "es", "en"
	Messages []AIChatMessage     `json:"messages"`
	Context  *ChatContextRequest `json:"context,omitempty"`
}

// TelemetryAnalysisContext is the prompt data the server built for one chat. At most one of
// Live, Debrief and Comparison is set, matching ContextMode.
type TelemetryAnalysisContext struct {
	ContextMode string
	// CustomPersonaPrompt defines the "custom" persona; DriverCallsign is how the engineer
	// addresses the driver. Both come from the saved voice settings.
	CustomPersonaPrompt string
	DriverCallsign      string

	// Live is the race briefing while the server has fresh telemetry.
	Live *LiveBriefing
	// Debrief is the recorded session's classification summary.
	Debrief *SessionDebrief
	// Comparison is the analysis of two compared laps, when both have telemetry.
	Comparison *LapComparison
}

// SessionDebrief is the prompt data for a recorded session, built from its classification.
type SessionDebrief struct {
	Summary string
}

// LapComparison is the prompt data for a lap (A, the driver's) compared with a benchmark lap (B).
type LapComparison struct {
	TrackName    string
	SessionTypeA string
	SessionTypeB string
	WeatherA     string
	WeatherB     string
	CrossSession bool

	LapAName string
	LapBName string
	LapATime string
	LapBTime string
	// TimeDeltaSeconds is negative when lap A is faster.
	TimeDeltaSeconds float64
	FasterLap        string
	CompoundA        string
	CompoundB        string
	SectorsA         [3]string
	SectorsB         [3]string

	TopSpeedA   float64
	TopSpeedB   float64
	ERSUsedPctA float64
	ERSUsedPctB float64

	BrakingSummary   string
	ApexSpeedSummary string
	ThrottleSummary  string
	ERSDRSSummary    string

	// Zoom describes the segment the driver zoomed into, if any.
	Zoom *ZoomedRangeInfo
}

// ZoomedRangeInfo holds details of the track segment currently focused in the UI.
type ZoomedRangeInfo struct {
	StartDistanceMeters float64
	EndDistanceMeters   float64
	Description         string
	DeltaInSegment      float64
	SpeedDiffAtApex     float64
	// BrakingDiffMeters is where lap A starts braking relative to lap B; positive means later.
	BrakingDiffMeters float64
	HasBrakingDiff    bool
}

// LiveBriefing is live race context built server-side from the telemetry stream.
type LiveBriefing struct {
	Summary        string
	TrackName      string
	SessionType    string
	PacketFormat   uint16
	DrivingPhase   string
	IncidentStatus string
}

// LiveRaceSource supplies server-side live race context for live-mode chats.
type LiveRaceSource interface {
	// LiveBriefing returns the current race briefing, or false when no fresh telemetry is available.
	LiveBriefing() (LiveBriefing, bool)
}

// RecordedRaceSource builds the prompt data for recorded sessions and laps.
type RecordedRaceSource interface {
	// SessionDebrief summarizes a recorded session's classification.
	SessionDebrief(ctx context.Context, sessionID int64) (SessionDebrief, error)
	// LapComparison analyzes lap A against lap B, optionally within a zoomed segment. It returns
	// nil when the laps have no telemetry to compare.
	LapComparison(ctx context.Context, lapAID, lapBID int64, zoom *ChatZoomRange) (*LapComparison, error)
}

// ChatOptions carries server-side extras for a chat request.
type ChatOptions struct {
	// Live provides fresh race context for live-mode chats. Nil means no live briefing.
	Live LiveRaceSource
	// Recorded builds session debrief and lap comparison context. Nil leaves those chats without data.
	Recorded RecordedRaceSource
	// Tools are live race data lookups the model may call in live-mode chats while Live has
	// fresh telemetry. Nil disables tool calling.
	Tools ToolExecutor
	// CustomPersonaPrompt and DriverCallsign come from the saved voice settings.
	CustomPersonaPrompt string
	DriverCallsign      string
}

// AIFetchModelsRequest represents a request to query available models from a provider.
type AIFetchModelsRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key,omitempty"`
	BaseURL  string `json:"base_url,omitempty"`
}

// AIModelItem represents a model in the returned list.
type AIModelItem struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Description string `json:"description,omitempty"`
}

// AIFetchModelsResponse is the list of available models.
type AIFetchModelsResponse struct {
	Models []AIModelItem `json:"models"`
}

// AI error code constants
const (
	AIErrorMissingAPIKey   = "MISSING_API_KEY"
	AIErrorModelOverloaded = "MODEL_OVERLOADED"
	AIErrorQuotaExceeded   = "QUOTA_EXCEEDED"
	AIErrorInvalidAPIKey   = "INVALID_API_KEY"
	AIErrorModelNotFound   = "MODEL_NOT_FOUND"
	AIErrorNetworkError    = "NETWORK_ERROR"
	AIErrorGeneric         = "GENERIC_ERROR"
	AIErrorInvalidRequest  = "INVALID_REQUEST"
)

// AIErrorPayload represents a structured error returned in SSE or JSON responses.
type AIErrorPayload struct {
	Error           string `json:"error"`
	Code            string `json:"code,omitempty"`
	Provider        string `json:"provider,omitempty"`
	Message         string `json:"message,omitempty"`
	SuggestedAction string `json:"suggested_action,omitempty"`
}

// AIStreamError represents a classified upstream AI service error.
type AIStreamError struct {
	StatusCode int
	Code       string
	Message    string
	RawMessage string
	Provider   string
}

func (e *AIStreamError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.RawMessage
}
