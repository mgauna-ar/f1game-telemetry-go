package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// handleGetSessionClassification serves GET /api/sessions/{id}/classification
func (s *Server) handleGetSessionClassification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSONError(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		writeJSONError(w, "session not found", http.StatusNotFound)
		return
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		participants = []storage.Participant{}
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		laps = []storage.Lap{}
	}

	resp := analytics.ComputeSessionClassification(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}

// handleGetSessionProgression serves GET /api/sessions/{id}/progression
func (s *Server) handleGetSessionProgression(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSONError(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		writeJSONError(w, "session not found", http.StatusNotFound)
		return
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		participants = []storage.Participant{}
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		laps = []storage.Lap{}
	}

	resp := analytics.ComputeSessionProgression(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}

// handleGetSessionStints serves GET /api/sessions/{id}/stints
func (s *Server) handleGetSessionStints(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSONError(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		writeJSONError(w, "session not found", http.StatusNotFound)
		return
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		participants = []storage.Participant{}
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		laps = []storage.Lap{}
	}

	resp := analytics.ComputeSessionStints(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}
