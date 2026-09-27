package api

import (
	"log/slog"
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// handleGetProgress returns the player's progress at a track (?track=, the latest session's
// track when left out) and the tracks to pick from. driver is the dashboard's saved driver name,
// as in GET /api/sessions.
func (s *Server) handleGetProgress(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.repo.GetSessions(r.Context())
	if err != nil {
		slog.Error("Failed to get sessions", "error", err)
		writeJSONError(w, "failed to get progress", http.StatusInternalServerError)
		return
	}
	resp := analytics.TrackProgressResponse{
		Track:    r.URL.Query().Get("track"),
		Tracks:   analytics.ProgressTracks(sessions),
		Sessions: []analytics.ProgressSession{},
	}
	if resp.Track == "" && len(resp.Tracks) > 0 {
		resp.Track = resp.Tracks[0].TrackName
	}

	var atTrack []storage.Session
	var ids []int64
	for i := range sessions {
		if sessions[i].TrackName == resp.Track {
			atTrack = append(atTrack, sessions[i])
			ids = append(ids, sessions[i].ID)
		}
	}
	if len(atTrack) == 0 {
		writeJSON(w, http.StatusOK, resp)
		return
	}
	participants, laps, err := s.repo.GetSessionResults(r.Context(), ids)
	if err != nil {
		slog.Error("Failed to get session results", "error", err)
		writeJSONError(w, "failed to get progress", http.StatusInternalServerError)
		return
	}
	resp.Sessions, resp.UnmatchedSessions = analytics.ComputeTrackProgress(atTrack, participants, laps, r.URL.Query().Get("driver"))
	writeJSON(w, http.StatusOK, resp)
}
