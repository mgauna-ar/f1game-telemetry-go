package engineer

import (
	"log/slog"
	"slices"
	"strings"
)

// directiveIDPrefix starts every call's ID: directive_<unix ms>_<alert key>.
const directiveIDPrefix = "directive_"

// RadioHeard is what a dashboard reports about one proactive call: what became of it in its radio
// (RadioHeardOutcomes in the api package: said, cut, stale, failed) and how long each step took.
type RadioHeard struct {
	DirectiveID string
	// Urgent is whether the dashboard took the call as urgent (critical or high).
	Urgent  bool
	Outcome string
	// WaitMs is how long the call waited behind other speech for its turn.
	WaitMs int
	// StartMs is from the call's arrival to its first word; 0 when it wasn't said.
	StartMs int
	// SynthMs is how long its voice took to make; Cached says it came from the dashboard's cache.
	SynthMs int
	Cached  bool
	// SpeechMs is how long it was spoken for.
	SpeechMs int
	// Visible is whether the page was in front when the call came, not hidden behind the game.
	Visible bool
}

// radioDelivery is what the dashboards reported about delivering the calls. It outlives sessions:
// it is about the device and the network, not the race.
type radioDelivery struct {
	// reported are the latest calls reported, oldest first: with several dashboards speaking, the
	// first report of a call stands.
	reported []string
}

// RecordRadioHeard logs what became of a call in a dashboard's radio ("Radio call heard"), once
// per call.
func (e *EngineerEngine) RecordRadioHeard(h RadioHeard) {
	e.mu.Lock()
	if slices.Contains(e.delivery.reported, h.DirectiveID) {
		e.mu.Unlock()
		return
	}
	e.delivery.reported = appendCapped(e.delivery.reported, h.DirectiveID, RadioHeardKeptCalls)
	key := alertKeyOfDirectiveID(h.DirectiveID)
	if rec := e.radioCallLocked(h.DirectiveID); rec != nil {
		key = rec.subAlert
	}
	e.mu.Unlock()

	slog.Info("Radio call heard",
		"key", key,
		"urgent", h.Urgent,
		"outcome", h.Outcome,
		"wait_ms", h.WaitMs,
		"start_ms", h.StartMs,
		"synth_ms", h.SynthMs,
		"cached", h.Cached,
		"speech_ms", h.SpeechMs,
		"visible", h.Visible,
	)
}

// alertKeyOfDirectiveID is the alert key a call's ID was made for, or "" for an ID the engine
// didn't make.
func alertKeyOfDirectiveID(id string) string {
	rest, ok := strings.CutPrefix(id, directiveIDPrefix)
	if !ok {
		return ""
	}
	_, key, _ := strings.Cut(rest, "_")
	return key
}
