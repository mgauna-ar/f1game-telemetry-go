package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
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
		slog.Error("Failed to fetch participants for classification", "sessionID", sessionID, "error", pErr)
		writeJSONError(w, "failed to fetch participants", http.StatusInternalServerError)
		return
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		slog.Error("Failed to fetch laps for classification", "sessionID", sessionID, "error", lErr)
		writeJSONError(w, "failed to fetch laps", http.StatusInternalServerError)
		return
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
		slog.Error("Failed to fetch participants for progression", "sessionID", sessionID, "error", pErr)
		writeJSONError(w, "failed to fetch participants", http.StatusInternalServerError)
		return
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		slog.Error("Failed to fetch laps for progression", "sessionID", sessionID, "error", lErr)
		writeJSONError(w, "failed to fetch laps", http.StatusInternalServerError)
		return
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
		slog.Error("Failed to fetch participants for stints", "sessionID", sessionID, "error", pErr)
		writeJSONError(w, "failed to fetch participants", http.StatusInternalServerError)
		return
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		slog.Error("Failed to fetch laps for stints", "sessionID", sessionID, "error", lErr)
		writeJSONError(w, "failed to fetch laps", http.StatusInternalServerError)
		return
	}

	resp := analytics.ComputeSessionStints(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}
