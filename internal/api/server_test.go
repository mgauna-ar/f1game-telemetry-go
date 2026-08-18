package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func setupTestServer(t *testing.T) (*Server, *storage.Repository) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewRepository(dbPath)
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
		SessionUID:   storage.FormatSessionUID(123456789),
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
		SessionUID:   storage.FormatSessionUID(987654321),
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
		SessionUID:   storage.FormatSessionUID(555444333),
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
		SessionUID:   storage.FormatSessionUID(99887711),
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
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("failed to save lap: %v", err)
	}

	samples := []storage.TelemetrySample{
		{LapDistance: 100.0, Speed: 320, Throttle: 1.0},
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
		t.Fatalf("failed to save lap telemetry: %v", err)
	}

	// 1. GET /api/sessions/{id}/export
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/export", session.ID), nil)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for export, got %d (%s)", rec.Code, rec.Body.String())
	}

	exportedBytes := rec.Body.Bytes()
	if len(exportedBytes) == 0 {
		t.Fatalf("expected non-empty exported bytes")
	}

	// 2. POST /api/sessions/import on a fresh server
	freshServer, _ := setupTestServer(t)
	importReq := httptest.NewRequest(http.MethodPost, "/api/sessions/import", bytes.NewReader(exportedBytes))
	importReq.Header.Set("Content-Type", "application/octet-stream")
	importRec := httptest.NewRecorder()
	freshServer.router.ServeHTTP(importRec, importReq)

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

func TestHandleGetLapsWithCarIndexFilter(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(555666777),
		TrackID:      11,
		TrackName:    "Monza",
		SessionType:  "Race",
		Weather:      "Clear",
		TotalLaps:    53,
		AIDifficulty: 95,
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Car 0 laps
	lap0_1 := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 82000, Sector1MS: 26000, Sector2MS: 27000, Sector3MS: 29000, IsValid: true}
	lap0_2 := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 2, LapTimeMS: 81500, Sector1MS: 25800, Sector2MS: 26900, Sector3MS: 28800, IsValid: true}
	_ = repo.SaveLap(ctx, lap0_1, false)
	_ = repo.SaveLap(ctx, lap0_2, false)

	// Car 1 lap
	lap1_1 := &storage.Lap{SessionID: session.ID, CarIndex: 1, LapNumber: 1, LapTimeMS: 83000, Sector1MS: 26500, Sector2MS: 27200, Sector3MS: 29300, IsValid: true}
	_ = repo.SaveLap(ctx, lap1_1, false)

	// 1. Get all laps (no filter)
	reqAll := httptest.NewRequest(http.MethodGet, "/api/sessions/1/laps", nil)
	recAll := httptest.NewRecorder()
	server.router.ServeHTTP(recAll, reqAll)
	if recAll.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", recAll.Code)
	}
	var allLaps []storage.Lap
	json.NewDecoder(recAll.Body).Decode(&allLaps)
	if len(allLaps) != 3 {
		t.Fatalf("expected 3 laps in total, got %d", len(allLaps))
	}

	// 2. Filter by carIndex=0
	reqCar0 := httptest.NewRequest(http.MethodGet, "/api/sessions/1/laps?carIndex=0", nil)
	recCar0 := httptest.NewRecorder()
	server.router.ServeHTTP(recCar0, reqCar0)
	if recCar0.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", recCar0.Code)
	}
	var car0Laps []storage.Lap
	json.NewDecoder(recCar0.Body).Decode(&car0Laps)
	if len(car0Laps) != 2 {
		t.Fatalf("expected 2 laps for car 0, got %d", len(car0Laps))
	}

	// 3. Filter by carIndex=1
	reqCar1 := httptest.NewRequest(http.MethodGet, "/api/sessions/1/laps?carIndex=1", nil)
	recCar1 := httptest.NewRecorder()
	server.router.ServeHTTP(recCar1, reqCar1)
	if recCar1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", recCar1.Code)
	}
	var car1Laps []storage.Lap
	json.NewDecoder(recCar1.Body).Decode(&car1Laps)
	if len(car1Laps) != 1 {
		t.Fatalf("expected 1 lap for car 1, got %d", len(car1Laps))
	}
}

func TestExportSessionBatchAndImportZip(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	s1 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(333111),
		TrackID:      1,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	_ = repo.SaveSession(ctx, s1)

	s2 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(333222),
		TrackID:      2,
		TrackName:    "Monaco",
		SessionType:  "Qualifying",
		PacketFormat: 2026,
	}
	_ = repo.SaveSession(ctx, s2)

	// 1. POST /api/sessions/export-batch
	exportReqBody, _ := json.Marshal(map[string]any{
		"session_ids": []int64{s1.ID, s2.ID},
	})
	exportReq := httptest.NewRequest(http.MethodPost, "/api/sessions/export-batch", bytes.NewReader(exportReqBody))
	exportReq.Header.Set("Content-Type", "application/json")
	exportRec := httptest.NewRecorder()
	server.router.ServeHTTP(exportRec, exportReq)

	if exportRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for export-batch, got %d (%s)", exportRec.Code, exportRec.Body.String())
	}
	if exportRec.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("expected application/zip Content-Type, got %s", exportRec.Header().Get("Content-Type"))
	}

	zipData := exportRec.Body.Bytes()
	if len(zipData) == 0 {
		t.Fatalf("expected non-empty zip data")
	}

	// 2. Import zip on a fresh server
	freshServer, _ := setupTestServer(t)
	importReq := httptest.NewRequest(http.MethodPost, "/api/sessions/import", bytes.NewReader(zipData))
	importReq.Header.Set("Content-Type", "application/zip")
	importRec := httptest.NewRecorder()
	freshServer.router.ServeHTTP(importRec, importReq)

	if importRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for batch import, got %d (%s)", importRec.Code, importRec.Body.String())
	}

	var importResp ImportBatchResponse
	if err := json.NewDecoder(importRec.Body).Decode(&importResp); err != nil {
		t.Fatalf("failed to decode import response: %v", err)
	}

	if importResp.Total != 2 || importResp.Imported != 2 || importResp.Skipped != 0 {
		t.Errorf("unexpected import response: %+v", importResp)
	}

	// 3. Re-importing into the same server should skip both (duplicates)
	dupImportReq := httptest.NewRequest(http.MethodPost, "/api/sessions/import", bytes.NewReader(zipData))
	dupImportRec := httptest.NewRecorder()
	freshServer.router.ServeHTTP(dupImportRec, dupImportReq)

	var dupResp ImportBatchResponse
	_ = json.NewDecoder(dupImportRec.Body).Decode(&dupResp)
	if dupResp.Total != 2 || dupResp.Skipped != 2 || dupResp.Imported != 0 {
		t.Errorf("expected 2 skipped for duplicate import, got %+v", dupResp)
	}
}

func TestBatchDeleteAndAssignTagsAPI(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	s1 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(555111),
		TrackID:      5,
		TrackName:    "Silverstone",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	_ = repo.SaveSession(ctx, s1)

	s2 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(555222),
		TrackID:      6,
		TrackName:    "Spa",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	_ = repo.SaveSession(ctx, s2)

	tag := &storage.Tag{Name: "League Alpha", Color: "#8b5cf6"}
	_ = repo.CreateTag(ctx, tag)

	// 1. Batch Assign Tags
	tagReqBody, _ := json.Marshal(BatchTagsRequest{
		SessionIDs: []int64{s1.ID, s2.ID},
		TagID:      tag.ID,
	})
	tagReq := httptest.NewRequest(http.MethodPost, "/api/sessions/batch-tags", bytes.NewReader(tagReqBody))
	tagReq.Header.Set("Content-Type", "application/json")
	tagRec := httptest.NewRecorder()
	server.router.ServeHTTP(tagRec, tagReq)

	if tagRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for batch-tags, got %d (%s)", tagRec.Code, tagRec.Body.String())
	}

	tagsOnS1, _ := repo.GetTagsBySession(ctx, s1.ID)
	if len(tagsOnS1) != 1 || tagsOnS1[0].Name != "League Alpha" {
		t.Errorf("expected tag assigned to s1, got %v", tagsOnS1)
	}

	// 2. Batch Delete Sessions
	delReqBody, _ := json.Marshal(BatchDeleteRequest{
		SessionIDs: []int64{s1.ID, s2.ID},
	})
	delReq := httptest.NewRequest(http.MethodPost, "/api/sessions/batch-delete", bytes.NewReader(delReqBody))
	delReq.Header.Set("Content-Type", "application/json")
	delRec := httptest.NewRecorder()
	server.router.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for batch-delete, got %d (%s)", delRec.Code, delRec.Body.String())
	}

	var delResp map[string]any
	json.NewDecoder(delRec.Body).Decode(&delResp)
	if delResp["status"] != "success" || delResp["deleted_count"] != float64(2) {
		t.Errorf("unexpected delete response: %+v", delResp)
	}
}

func TestHandleEmbeddedFrontendAndSPAFallback(t *testing.T) {
	server, _ := setupTestServer(t)

	// 1. Request root path "/"
	reqRoot := httptest.NewRequest(http.MethodGet, "/", nil)
	recRoot := httptest.NewRecorder()
	server.router.ServeHTTP(recRoot, reqRoot)

	if recRoot.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for root path, got %d", recRoot.Code)
	}
	if !strings.Contains(recRoot.Header().Get("Content-Type"), "text/html") {
		t.Errorf("expected text/html content type, got %s", recRoot.Header().Get("Content-Type"))
	}

	// 2. Request SPA client route "/comparator" -> should fallback to index.html with 200 OK
	reqSPA := httptest.NewRequest(http.MethodGet, "/comparator", nil)
	recSPA := httptest.NewRecorder()
	server.router.ServeHTTP(recSPA, reqSPA)

	if recSPA.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for SPA fallback route, got %d", recSPA.Code)
	}
	if !strings.Contains(recSPA.Header().Get("Content-Type"), "text/html") {
		t.Errorf("expected text/html content type for SPA fallback, got %s", recSPA.Header().Get("Content-Type"))
	}

	// 3. Request static icon/manifest file e.g. "/favicon.svg"
	reqFavicon := httptest.NewRequest(http.MethodGet, "/favicon.svg", nil)
	recFavicon := httptest.NewRecorder()
	server.router.ServeHTTP(recFavicon, reqFavicon)

	if recFavicon.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for favicon.svg, got %d", recFavicon.Code)
	}
}
