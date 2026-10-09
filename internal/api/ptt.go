package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"
	"unicode/utf8"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// PTTLearningTimeout is the maximum duration interactive button learning remains active before auto-canceling.
const PTTLearningTimeout = 20 * time.Second

// Push-to-talk messages sent to the dashboard on the engineer WebSocket, next to the engine's
// radio directives (engineer.EngineerDirective, type "directive").
const (
	pttEventMessageType   = "ptt_event"
	pttLearnedMessageType = "ptt_learned"
	pttLearnTimeoutType   = "ptt_learn_timeout"
)

// PTTEventMessage tells the dashboard the global push-to-talk button went down or up.
type PTTEventMessage struct {
	Type      string        `json:"type" tstype:"'ptt_event'"`
	State     string        `json:"state" tstype:"'down' | 'up'"`
	Mapping   input.Mapping `json:"mapping"`
	Timestamp int64         `json:"timestamp"`
}

// PTTLearnedMessage tells the dashboard which button or key was learned.
type PTTLearnedMessage struct {
	Type    string        `json:"type" tstype:"'ptt_learned'"`
	Mapping input.Mapping `json:"mapping"`
}

// PTTLearnTimeoutMessage tells the dashboard that learning stopped without a button press.
type PTTLearnTimeoutMessage struct {
	Type string `json:"type" tstype:"'ptt_learn_timeout'"`
}

func newPTTEventMessage(evt input.Event) PTTEventMessage {
	return PTTEventMessage{Type: pttEventMessageType, State: evt.State, Mapping: evt.Mapping, Timestamp: evt.Timestamp}
}

func newPTTLearnedMessage(m input.Mapping) PTTLearnedMessage {
	return PTTLearnedMessage{Type: pttLearnedMessageType, Mapping: m}
}

func newPTTLearnTimeoutMessage() PTTLearnTimeoutMessage {
	return PTTLearnTimeoutMessage{Type: pttLearnTimeoutType}
}

// engineerMessage is a message the API layer sends on /ws/engineer. Only the typed messages
// above implement it, so nothing else reaches the hub; the engine sends its directives itself.
type engineerMessage interface {
	engineerMessageType() string
}

func (m PTTEventMessage) engineerMessageType() string        { return m.Type }
func (m PTTLearnedMessage) engineerMessageType() string      { return m.Type }
func (m PTTLearnTimeoutMessage) engineerMessageType() string { return m.Type }

// broadcastEngineer sends msg to every dashboard connected to /ws/engineer.
func (s *Server) broadcastEngineer(msg engineerMessage) {
	if s.engineerHub == nil {
		return
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		slog.Error("Failed to marshal engineer message", "type", msg.engineerMessageType(), "error", err)
		return
	}
	s.engineerHub.Broadcast(payload)
}

// PTTConfigResponse returns the current global PTT mapping and active status.
type PTTConfigResponse struct {
	Status   string        `json:"status"`
	Mapping  input.Mapping `json:"mapping"`
	IsActive bool          `json:"is_active"`
}

func (s *Server) handleGetPTTConfig(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "input manager not available", http.StatusServiceUnavailable)
		return
	}

	writeJSON(w, http.StatusOK, PTTConfigResponse{
		Status:   StatusSuccess,
		Mapping:  s.inputManager.GetMapping(),
		IsActive: s.inputManager.IsActive(),
	})
}

func (s *Server) handleStartPTTLearn(w http.ResponseWriter, r *http.Request) {
	// The learning goroutine keeps using this manager even if another one is attached meanwhile.
	mgr := s.inputManager
	if mgr == nil {
		writeJSONError(w, "input manager not available", http.StatusServiceUnavailable)
		return
	}

	s.pttMu.Lock()
	if s.isLearning {
		s.pttMu.Unlock()
		writeJSONError(w, "ptt learning already in progress", http.StatusConflict)
		return
	}
	s.isLearning = true
	s.pttMu.Unlock()

	// Interactive button learning outlives this HTTP request (which immediately returns 200 OK
	// with "success"). We use context.Background() because net/http cancels r.Context()
	// as soon as the HTTP handler returns.
	ch, err := mgr.StartLearning(context.Background())
	if err != nil {
		s.pttMu.Lock()
		s.isLearning = false
		s.pttMu.Unlock()
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	go func() {
		defer func() {
			s.pttMu.Lock()
			s.isLearning = false
			s.pttMu.Unlock()
		}()

		timer := time.NewTimer(s.pttLearnTimeout)
		defer timer.Stop()

		select {
		case m, ok := <-ch:
			if ok {
				s.broadcastEngineer(newPTTLearnedMessage(m))
			}
		case <-timer.C:
			mgr.CancelLearning()
			// Without this the dashboard's learn button would wait for a key forever.
			s.broadcastEngineer(newPTTLearnTimeoutMessage())
		}
	}()

	writeJSON(w, http.StatusOK, StatusResponse{Status: StatusSuccess})
}

func (s *Server) handleCancelPTTLearn(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		writeJSONError(w, "input manager not available", http.StatusServiceUnavailable)
		return
	}

	s.pttMu.Lock()
	s.isLearning = false
	s.pttMu.Unlock()

	s.inputManager.CancelLearning()
	writeJSON(w, http.StatusOK, StatusResponse{Status: StatusSuccess})
}

// PTTTraceOutcomes lists how a push-to-talk exchange can end (PTTTraceRequest.Outcome); it builds
// the union for the frontend.
var PTTTraceOutcomes = []string{"answered", "answer_failed", "not_heard", "radio_fault", "tap", "replaced"}

// PTTSources lists where the dashboard heard the push-to-talk button: the app's in-game button
// (global), the browser reading the wheel (gamepad) or a key on the page (keyboard). It builds the
// union for the frontend.
var PTTSources = []string{"global", "gamepad", "keyboard"}

// pttTraceMaxText caps each text a trace carries into the log.
const pttTraceMaxText = 200

// PTTTraceRequest is what the dashboard reports about one push-to-talk exchange, from the button
// going down to the end of the engineer's answer. It goes to the app log, so a question asked from
// inside the game that got no answer can be traced afterwards.
type PTTTraceRequest struct {
	Outcome string `json:"outcome" tstype:"PTTTraceOutcome"`
	// HeldMs is how long the button was down.
	HeldMs int `json:"held_ms"`
	// PressSource and ReleaseSource say where the press and the release came from.
	PressSource   string `json:"press_source,omitempty" tstype:"PTTSource"`
	ReleaseSource string `json:"release_source,omitempty" tstype:"PTTSource"`
	// VisibleAtPress and VisibleAtRelease say whether the page was in front, or hidden behind the game.
	VisibleAtPress   bool `json:"visible_at_press"`
	VisibleAtRelease bool `json:"visible_at_release"`
	// What the browser's speech recognition did: started, received audio, detected speech, sent
	// results, and the error it reported.
	RecognizerStarted bool   `json:"recognizer_started"`
	AudioStarted      bool   `json:"audio_started"`
	SpeechDetected    bool   `json:"speech_detected"`
	Results           int    `json:"results"`
	RecognizerError   string `json:"recognizer_error,omitempty"`
	// Heard is what the recognizer understood.
	Heard string `json:"heard,omitempty"`
	// FirstSentenceMs is from the release to the answer's first sentence; TotalMs to the end of the exchange.
	FirstSentenceMs int    `json:"first_sentence_ms,omitempty"`
	TotalMs         int    `json:"total_ms"`
	AIError         string `json:"ai_error,omitempty"`
	// StandBy is set when the engineer said "stand by" while the answer was on its way.
	StandBy bool `json:"stand_by"`
	// CallsHeld counts the pit wall calls that waited for the exchange to end.
	CallsHeld int `json:"calls_held"`
}

// clip shortens text from the browser to at most n characters for the log.
func clip(text string, n int) string {
	if utf8.RuneCountInString(text) <= n {
		return text
	}
	return string([]rune(text)[:n]) + "…"
}

func (s *Server) handlePTTTrace(w http.ResponseWriter, r *http.Request) {
	var req PTTTraceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, fmt.Sprintf("invalid request payload: %v", err), http.StatusBadRequest)
		return
	}
	if !slices.Contains(PTTTraceOutcomes, req.Outcome) {
		writeJSONError(w, fmt.Sprintf("unknown push-to-talk outcome %q", req.Outcome), http.StatusBadRequest)
		return
	}

	slog.Info("Push-to-talk transmission",
		"outcome", req.Outcome,
		"held_ms", req.HeldMs,
		"press_source", clip(req.PressSource, pttTraceMaxText),
		"release_source", clip(req.ReleaseSource, pttTraceMaxText),
		"visible_at_press", req.VisibleAtPress,
		"visible_at_release", req.VisibleAtRelease,
		"recognizer_started", req.RecognizerStarted,
		"audio_started", req.AudioStarted,
		"speech_detected", req.SpeechDetected,
		"results", req.Results,
		"recognizer_error", clip(req.RecognizerError, pttTraceMaxText),
		"heard", clip(req.Heard, pttTraceMaxText),
		"first_sentence_ms", req.FirstSentenceMs,
		"total_ms", req.TotalMs,
		"ai_error", clip(req.AIError, pttTraceMaxText),
		"stand_by", req.StandBy,
		"calls_held", req.CallsHeld,
		"browser", clip(r.UserAgent(), pttTraceMaxText),
	)
	writeJSON(w, http.StatusOK, StatusResponse{Status: StatusSuccess})
}
