package api

import (
	"log/slog"
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// fetchSessionAnalyticsData parses the session ID from URL and retrieves session, participants, and laps.
// Writes the appropriate HTTP error and returns ok=false if any step fails.
func (s *Server) fetchSessionAnalyticsData(w http.ResponseWriter, r *http.Request, opName string) (*storage.Session, []storage.Participant, []storage.Lap, bool) {
	ctx := r.Context()
	sessionID, ok := parseSessionID(w, r)
	if !ok {
		return nil, nil, nil, false
	}

	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		writeJSONError(w, "session not found", http.StatusNotFound)
		return nil, nil, nil, false
	}

	participants, pErr := s.repo.GetParticipantsBySession(ctx, sessionID)
	if pErr != nil {
		slog.Error("Failed to fetch participants for "+opName, "sessionID", sessionID, "error", pErr)
		writeJSONError(w, "failed to fetch participants", http.StatusInternalServerError)
		return nil, nil, nil, false
	}

	laps, lErr := s.repo.GetLapsBySession(ctx, sessionID, nil)
	if lErr != nil {
		slog.Error("Failed to fetch laps for "+opName, "sessionID", sessionID, "error", lErr)
		writeJSONError(w, "failed to fetch laps", http.StatusInternalServerError)
		return nil, nil, nil, false
	}

	return session, participants, laps, true
}

// handleGetSessionClassification serves GET /api/sessions/{id}/classification
func (s *Server) handleGetSessionClassification(w http.ResponseWriter, r *http.Request) {
	session, participants, laps, ok := s.fetchSessionAnalyticsData(w, r, "classification")
	if !ok {
		return
	}
	resp := analytics.ComputeSessionClassification(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}

// handleGetSessionProgression serves GET /api/sessions/{id}/progression
func (s *Server) handleGetSessionProgression(w http.ResponseWriter, r *http.Request) {
	session, participants, laps, ok := s.fetchSessionAnalyticsData(w, r, "progression")
	if !ok {
		return
	}
	resp := analytics.ComputeSessionProgression(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}

// handleGetSessionStints serves GET /api/sessions/{id}/stints
func (s *Server) handleGetSessionStints(w http.ResponseWriter, r *http.Request) {
	session, participants, laps, ok := s.fetchSessionAnalyticsData(w, r, "stints")
	if !ok {
		return
	}
	resp := analytics.ComputeSessionStints(session, participants, laps)
	writeJSON(w, http.StatusOK, resp)
}
