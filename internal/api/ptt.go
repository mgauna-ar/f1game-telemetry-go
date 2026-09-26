package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

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
