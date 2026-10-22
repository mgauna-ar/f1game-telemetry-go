package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
)

// RadioHeardOutcomes lists what became of a proactive call in the dashboard's radio
// (RadioHeardRequest.Outcome): said, cut off by a more urgent call, stale before its turn came, or
// failed (no voice). It builds the union for the frontend.
var RadioHeardOutcomes = []string{"said", "cut", "stale", "failed"}

// radioHeardMaxID caps the directive ID a report carries into the log.
const radioHeardMaxID = 120

// RadioHeardRequest is what the dashboard reports about one proactive radio call: how long it
// waited for its turn, how long its voice took, when the driver started hearing it and for how
// long, or why they didn't. It goes to the app log, so how long calls take to reach the driver can
// be checked on the gaming PC.
type RadioHeardRequest struct {
	DirectiveID string `json:"directive_id"`
	// Urgent is whether the dashboard took the call as urgent (critical or high).
	Urgent  bool   `json:"urgent"`
	Outcome string `json:"outcome" tstype:"RadioHeardOutcome"`
	// WaitMs is how long the call waited behind other speech for its turn.
	WaitMs int `json:"wait_ms"`
	// StartMs is from the call's arrival to its first word; 0 when it wasn't said.
	StartMs int `json:"start_ms"`
	// SynthMs is how long its voice took to make; Cached says it came from the dashboard's cache.
	SynthMs int  `json:"synth_ms"`
	Cached  bool `json:"cached"`
	// SpeechMs is how long it was spoken for.
	SpeechMs int `json:"speech_ms"`
	// Visible is whether the page was in front when the call came, not hidden behind the game.
	Visible bool `json:"visible"`
}

func (s *Server) handleRadioHeard(w http.ResponseWriter, r *http.Request) {
	var req RadioHeardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid request payload: %v", err), http.StatusBadRequest)
		return
	}
	if req.DirectiveID == "" {
		writeJSONError(w, "directive_id is required", http.StatusBadRequest)
		return
	}
	if !slices.Contains(RadioHeardOutcomes, req.Outcome) {
		writeJSONError(w, fmt.Sprintf("unknown radio call outcome %q", req.Outcome), http.StatusBadRequest)
		return
	}

	if s.engineerEngine != nil {
		s.engineerEngine.RecordRadioHeard(engineer.RadioHeard{
			DirectiveID: clip(req.DirectiveID, radioHeardMaxID),
			Urgent:      req.Urgent,
			Outcome:     req.Outcome,
			WaitMs:      req.WaitMs,
			StartMs:     req.StartMs,
			SynthMs:     req.SynthMs,
			Cached:      req.Cached,
			SpeechMs:    req.SpeechMs,
			Visible:     req.Visible,
		})
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: StatusSuccess})
}
