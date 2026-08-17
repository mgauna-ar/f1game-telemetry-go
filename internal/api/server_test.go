package api

import (
	"bytes"
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

func TestHandleDeleteSession(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   987654321,
		TrackID:      1,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	tests := []struct {
		name       string
		url        string
		wantStatus int
	}{
		{
			name:       "delete valid existing session",
			url:        "/api/sessions/1",
			wantStatus: http.StatusOK,
		},
		{
			name:       "delete non-existent session",
			url:        "/api/sessions/999",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "invalid session ID format",
			url:        "/api/sessions/invalid",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodDelete, tt.url, nil)
			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d (body: %s)", tt.wantStatus, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestHandleTagsCRUD(t *testing.T) {
	server, _ := setupTestServer(t)

	// 1. Initially GET /api/tags -> empty array
	req := httptest.NewRequest(http.MethodGet, "/api/tags", nil)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var tags []storage.Tag
	json.NewDecoder(rec.Body).Decode(&tags)
	if len(tags) != 0 {
		t.Fatalf("expected 0 tags initially, got %d", len(tags))
	}

	// 2. POST /api/tags -> Create tag
	body := bytes.NewBufferString(`{"name":"WOR League","color":"#ef4444"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/tags", body)
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d (%s)", rec.Code, rec.Body.String())
	}
	var createdTag storage.Tag
	json.NewDecoder(rec.Body).Decode(&createdTag)
	if createdTag.ID == 0 || createdTag.Name != "WOR League" || createdTag.Color != "#ef4444" {
		t.Errorf("unexpected created tag: %+v", createdTag)
	}

	// 3. PUT /api/tags/{id} -> Update tag
	updateBody := bytes.NewBufferString(`{"name":"WOR Tier 1","color":"#06b6d4"}`)
	req = httptest.NewRequest(http.MethodPut, "/api/tags/1", updateBody)
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (%s)", rec.Code, rec.Body.String())
	}
	var updatedTag storage.Tag
	json.NewDecoder(rec.Body).Decode(&updatedTag)
	if updatedTag.Name != "WOR Tier 1" || updatedTag.Color != "#06b6d4" {
		t.Errorf("unexpected updated tag: %+v", updatedTag)
	}

	// 4. DELETE /api/tags/{id} -> Delete tag
	req = httptest.NewRequest(http.MethodDelete, "/api/tags/1", nil)
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// 5. DELETE non-existent tag -> 404
	req = httptest.NewRequest(http.MethodDelete, "/api/tags/999", nil)
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", rec.Code)
	}
}

func TestHandleSessionTags(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   555444333,
		TrackID:      1,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// 1. Add tag on-demand by name & color to session
	body := bytes.NewBufferString(`{"name":"AOR League","color":"#10b981"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/sessions/1/tags", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (%s)", rec.Code, rec.Body.String())
	}
	var sessionTags []storage.Tag
	json.NewDecoder(rec.Body).Decode(&sessionTags)
	if len(sessionTags) != 1 || sessionTags[0].Name != "AOR League" {
		t.Fatalf("expected 1 tag with name AOR League, got %+v", sessionTags)
	}

	// 2. GET /api/sessions/1/tags
	req = httptest.NewRequest(http.MethodGet, "/api/sessions/1/tags", nil)
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	var getTags []storage.Tag
	json.NewDecoder(rec.Body).Decode(&getTags)
	if len(getTags) != 1 {
		t.Fatalf("expected 1 tag, got %d", len(getTags))
	}

	// 3. Remove tag from session: DELETE /api/sessions/1/tags/{tagId}
	tagID := sessionTags[0].ID
	req = httptest.NewRequest(http.MethodDelete, "/api/sessions/1/tags/"+string(rune('0'+tagID)), nil)
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (%s)", rec.Code, rec.Body.String())
	}
	var tagsAfterRemove []storage.Tag
	json.NewDecoder(rec.Body).Decode(&tagsAfterRemove)
	if len(tagsAfterRemove) != 0 {
		t.Fatalf("expected 0 tags after remove, got %d", len(tagsAfterRemove))
	}

	// 4. PUT /api/sessions/1/tags -> batch set tags
	putBody := bytes.NewBufferString(`{"tag_ids":[` + string(rune('0'+tagID)) + `]}`)
	req = httptest.NewRequest(http.MethodPut, "/api/sessions/1/tags", putBody)
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (%s)", rec.Code, rec.Body.String())
	}
	var tagsAfterPut []storage.Tag
	json.NewDecoder(rec.Body).Decode(&tagsAfterPut)
	if len(tagsAfterPut) != 1 {
		t.Fatalf("expected 1 tag after put, got %d", len(tagsAfterPut))
	}
}

func TestHandleExportAndImportSession(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   99887711,
		TrackID:      11,
		TrackName:    "Monza",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	lap := &storage.Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 81000,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, lap); err != nil {
		t.Fatalf("failed to save lap: %v", err)
	}

	samples := []storage.TelemetrySample{
		{LapID: lap.ID, LapDistance: 100.0, Speed: 320, Throttle: 1.0},
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
		t.Fatalf("failed to save lap telemetry: %v", err)
	}

	// 1. GET /api/sessions/1/export
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/1/export", nil)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for export, got %d (%s)", rec.Code, rec.Body.String())
	}

	exportedBytes := rec.Body.Bytes()
	if len(exportedBytes) == 0 {
		t.Fatalf("expected non-empty exported bytes")
	}

	// 2. POST /api/sessions/import
	importReq := httptest.NewRequest(http.MethodPost, "/api/sessions/import", bytes.NewReader(exportedBytes))
	importReq.Header.Set("Content-Type", "application/octet-stream")
	importRec := httptest.NewRecorder()
	server.router.ServeHTTP(importRec, importReq)

	if importRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for import, got %d (%s)", importRec.Code, importRec.Body.String())
	}

	var importResp map[string]any
	if err := json.NewDecoder(importRec.Body).Decode(&importResp); err != nil {
		t.Fatalf("failed to decode import response: %v", err)
	}

	if importResp["status"] != "success" || importResp["session_id"] == nil {
		t.Errorf("unexpected import response: %+v", importResp)
	}
}
