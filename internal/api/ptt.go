package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// PTTConfigResponse returns the current global PTT mapping and active status.
type PTTConfigResponse struct {
	Status   string        `json:"status"`
	Mapping  input.Mapping `json:"mapping"`
	IsActive bool          `json:"is_active"`
}

// PTTSetConfigRequest represents the payload to update global PTT mapping.
type PTTSetConfigRequest struct {
	Mapping input.Mapping `json:"mapping"`
}

func (s *Server) handleGetPTTConfig(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		http.Error(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(PTTConfigResponse{
		Status:   "ok",
		Mapping:  s.inputManager.GetMapping(),
		IsActive: s.inputManager.IsActive(),
	})
}

func (s *Server) handleSetPTTConfig(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		http.Error(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	var req PTTSetConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	s.inputManager.SetMapping(req.Mapping)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(PTTConfigResponse{
		Status:   "ok",
		Mapping:  s.inputManager.GetMapping(),
		IsActive: s.inputManager.IsActive(),
	})
}

func (s *Server) handleStartPTTLearn(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		http.Error(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	ch, err := s.inputManager.StartLearning(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	go func() {
		select {
		case m, ok := <-ch:
			if ok {
				payload, _ := json.Marshal(map[string]any{
					"type":    "ptt_learned",
					"mapping": m,
				})
				if s.engineerHub != nil {
					s.engineerHub.Broadcast(payload)
				}
			}
		case <-time.After(20 * time.Second):
			s.inputManager.CancelLearning()
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "learning_started",
	})
}

func (s *Server) handleCancelPTTLearn(w http.ResponseWriter, r *http.Request) {
	if s.inputManager == nil {
		http.Error(w, "Input manager not available", http.StatusServiceUnavailable)
		return
	}

	s.inputManager.CancelLearning()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "learning_cancelled",
	})
}
