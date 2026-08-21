package api

// AIChatMessage represents a message in the conversation.
type AIChatMessage struct {
	Role    string `json:"role"` // "user", "assistant", or "system"
	Content string `json:"content"`
}

// TelemetryAnalysisContext represents the driving telemetry context sent to the AI.
type TelemetryAnalysisContext struct {
	// Multi-context identifiers
	ContextMode    string `json:"context_mode,omitempty"`    // "comparator", "session_debrief", "live", "general"
	SessionSummary string `json:"session_summary,omitempty"` // Detailed session classification / stints summary
	LiveSummary    string `json:"live_summary,omitempty"`    // Live telemetry / weather / SC / pit strategy summary
	CustomPrompt   string `json:"custom_prompt,omitempty"`   // Extra context notes

	TrackName         string  `json:"track_name,omitempty"`
	SessionType       string  `json:"session_type,omitempty"`
	SessionBType      string  `json:"session_b_type,omitempty"`
	WeatherA          string  `json:"weather_a,omitempty"`
	WeatherB          string  `json:"weather_b,omitempty"`
	CrossSession      bool    `json:"cross_session,omitempty"`
	LapAName          string  `json:"lap_a_name,omitempty"`
	LapBName          string  `json:"lap_b_name,omitempty"`
	LapATimeFormatted string  `json:"lap_a_time_formatted,omitempty"`
	LapBTimeFormatted string  `json:"lap_b_time_formatted,omitempty"`
	TimeDeltaSeconds  float64 `json:"time_delta_seconds,omitempty"` // Negative if A is faster, positive if B is faster
	FasterLap         string  `json:"faster_lap,omitempty"`         // "Lap A" or "Lap B"

	LapACompound string `json:"lap_a_compound,omitempty"`
	LapBCompound string `json:"lap_b_compound,omitempty"`

	LapAS1Formatted string `json:"lap_a_s1_formatted,omitempty"`
	LapBS1Formatted string `json:"lap_b_s1_formatted,omitempty"`
	LapAS2Formatted string `json:"lap_a_s2_formatted,omitempty"`
	LapBS2Formatted string `json:"lap_b_s2_formatted,omitempty"`
	LapAS3Formatted string `json:"lap_a_s3_formatted,omitempty"`
	LapBS3Formatted string `json:"lap_b_s3_formatted,omitempty"`

	TopSpeedA float64 `json:"top_speed_a,omitempty"`
	TopSpeedB float64 `json:"top_speed_b,omitempty"`

	ERSAUsedPercent float64 `json:"ers_a_used_percent,omitempty"`
	ERSBUsedPercent float64 `json:"ers_b_used_percent,omitempty"`

	// Specific telemetry summary insights
	BrakingSummary   string `json:"braking_summary,omitempty"`
	ApexSpeedSummary string `json:"apex_speed_summary,omitempty"`
	ThrottleSummary  string `json:"throttle_summary,omitempty"`
	ERSDRSSummary    string `json:"ers_drs_summary,omitempty"`

	// Custom persona prompt definition if custom persona is selected
	CustomPersonaPrompt string `json:"custom_persona_prompt,omitempty"`
	Language            string `json:"language,omitempty"` // "es", "en", or ""

	// Zoomed section info if user is zoomed in
	ZoomedRange *ZoomedRangeInfo `json:"zoomed_range,omitempty"`
}

// ZoomedRangeInfo holds details of a specific track segment currently focused in the UI.
type ZoomedRangeInfo struct {
	StartDistanceMeters float64 `json:"start_distance_meters"`
	EndDistanceMeters   float64 `json:"end_distance_meters"`
	Description         string  `json:"description,omitempty"`
	DeltaInSegment      float64 `json:"delta_in_segment"`
	SpeedDiffAtApex     float64 `json:"speed_diff_at_apex"`
	BrakingDiffMeters   float64 `json:"braking_diff_meters"`
}

// AIChatRequest represents the incoming chat request from the frontend.
type AIChatRequest struct {
	Provider string                    `json:"provider"` // "gemini", "openai", or "custom"
	APIKey   string                    `json:"api_key,omitempty"`
	BaseURL  string                    `json:"base_url,omitempty"`
	Model    string                    `json:"model,omitempty"`
	Persona  string                    `json:"persona,omitempty"`  // "colapinto", "bono", "custom"
	Language string                    `json:"language,omitempty"` // "es", "en"
	Messages []AIChatMessage           `json:"messages"`
	Context  *TelemetryAnalysisContext `json:"context,omitempty"`
}

// AIConfigStatusResponse informs the frontend about backend default configuration.
type AIConfigStatusResponse struct {
	HasGeminiEnvKey bool   `json:"has_gemini_env_key"`
	HasOpenAIEnvKey bool   `json:"has_openai_env_key"`
	DefaultProvider string `json:"default_provider"`
	DefaultModel    string `json:"default_model"`
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
