package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// PTTLearningTimeout is the maximum duration interactive button learning remains active before auto-canceling.
const PTTLearningTimeout = 20 * time.Second

// Messages about button learning sent to the dashboard on the engineer WebSocket.
const (
	pttLearnedMessageType = "ptt_learned"
	pttLearnTimeoutType   = "ptt_learn_timeout"
)

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
		Status:   "success",
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
				payload, _ := json.Marshal(map[string]any{
					"type":    pttLearnedMessageType,
					"mapping": m,
				})
				if s.engineerHub != nil {
					s.engineerHub.Broadcast(payload)
				}
			}
		case <-timer.C:
			mgr.CancelLearning()
			// Without this the dashboard's learn button would wait for a key forever.
			payload, _ := json.Marshal(map[string]string{"type": pttLearnTimeoutType})
			if s.engineerHub != nil {
				s.engineerHub.Broadcast(payload)
			}
		}
	}()

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "success",
	})
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
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "success",
	})
}
