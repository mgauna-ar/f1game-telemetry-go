package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func setupTestServer(t *testing.T) (*Server, *storage.Repository) {
	t.Helper()
	repo, err := storage.NewRepository("file::memory:?cache=shared&_busy_timeout=5000")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	t.Cleanup(func() { repo.Close() })

	hub := NewHub()
	server := NewServer(repo, hub)
	return server, repo
}

func TestHandleGetParticipants(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	// Create a session and add participants
	session := &storage.Session{
		SessionUID:   123456789,
		TrackID:      11,
		TrackName:    "Monza",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 1, RaceNumber: 1, AIControlled: false, Nationality: 5},
		{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, AIControlled: false, Nationality: 12},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	tests := []struct {
		name       string
		url        string
		wantStatus int
		wantCount  int
	}{
		{
			name:       "valid session with participants",
			url:        "/api/sessions/1/participants",
			wantStatus: http.StatusOK,
			wantCount:  2,
		},
		{
			name:       "non-existent session returns empty array",
			url:        "/api/sessions/999/participants",
			wantStatus: http.StatusOK,
			wantCount:  0,
		},
		{
			name:       "invalid session ID",
			url:        "/api/sessions/abc/participants",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.url, nil)
			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d (body: %s)", tt.wantStatus, rec.Code, rec.Body.String())
				return
			}

			if tt.wantStatus == http.StatusOK {
				var result []storage.Participant
				if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if len(result) != tt.wantCount {
					t.Errorf("expected %d participants, got %d", tt.wantCount, len(result))
				}
			}
		})
	}
}
