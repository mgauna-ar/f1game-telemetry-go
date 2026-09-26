package api

import (
	"errors"
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
		if errors.Is(err, storage.ErrSessionNotFound) {
			writeJSONError(w, "session not found", http.StatusNotFound)
		} else {
			slog.Error("Failed to fetch session for "+opName, "sessionID", sessionID, "error", err)
			writeJSONError(w, "failed to fetch session", http.StatusInternalServerError)
		}
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

// handleGetSessionDetail serves GET /api/sessions/{id}/detail: the classification, progression
// and stints of a session plus its participants and laps, loaded from SQLite once.
func (s *Server) handleGetSessionDetail(w http.ResponseWriter, r *http.Request) {
	session, participants, laps, ok := s.fetchSessionAnalyticsData(w, r, "session detail")
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, analytics.ComputeSessionDetail(session, participants, laps))
}
