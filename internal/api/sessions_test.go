package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	sessionSvc "github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestHandleExportSessionBatch(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	// Seed two sessions
	sess1 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(111222333),
		TrackID:      1,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2026,
	}
	if err := repo.SaveSession(ctx, sess1); err != nil {
		t.Fatalf("failed to save sess1: %v", err)
	}

	sess2 := &storage.Session{
		SessionUID:   storage.FormatSessionUID(444555666),
		TrackID:      2,
		TrackName:    "Bahrain",
		SessionType:  "Qualifying",
		Weather:      "Clear",
		PacketFormat: 2026,
	}
	if err := repo.SaveSession(ctx, sess2); err != nil {
		t.Fatalf("failed to save sess2: %v", err)
	}

	tests := []struct {
		name        string
		method      string
		contentType string
		body        string
		queryURL    string
		expectCode  int
		expectZip   bool
		expectError string
	}{
		{
			name:        "Standard application/json Content-Type",
			contentType: "application/json",
			body:        fmt.Sprintf(`{"session_ids":[%d, %d]}`, sess1.ID, sess2.ID),
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusOK,
			expectZip:   true,
		},
		{
			name:        "application/json with charset=utf-8",
			contentType: "application/json; charset=utf-8",
			body:        fmt.Sprintf(`{"session_ids":[%d]}`, sess1.ID),
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusOK,
			expectZip:   true,
		},
		{
			name:       "GET with ids query is no longer routed",
			method:     http.MethodGet,
			queryURL:   fmt.Sprintf("/api/sessions/export-batch?ids=%d,%d", sess1.ID, sess2.ID),
			expectCode: http.StatusMethodNotAllowed,
			expectZip:  false,
		},
		{
			name:        "POST ids query without body is ignored",
			queryURL:    fmt.Sprintf("/api/sessions/export-batch?ids=%d,%d", sess1.ID, sess2.ID),
			expectCode:  http.StatusBadRequest,
			expectZip:   false,
			expectError: "invalid request payload",
		},
		{
			name:        "No session IDs provided (empty body)",
			contentType: "application/json",
			body:        `{}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusBadRequest,
			expectZip:   false,
			expectError: "no session IDs provided for export",
		},
		{
			name:        "Invalid JSON body",
			contentType: "application/json",
			body:        `{not valid json}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusBadRequest,
			expectZip:   false,
			expectError: "invalid request payload",
		},
		{
			name:        "Non-existent session IDs",
			contentType: "application/json",
			body:        `{"session_ids":[99998, 99999]}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusNotFound,
			expectZip:   false,
			expectError: "no valid sessions found to export",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			method := tt.method
			if method == "" {
				method = http.MethodPost
			}
			var req *http.Request
			if tt.body != "" {
				req = httptest.NewRequest(method, tt.queryURL, bytes.NewBufferString(tt.body))
			} else {
				req = httptest.NewRequest(method, tt.queryURL, http.NoBody)
			}
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}

			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, req)

			if rec.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d (body: %s)", tt.expectCode, rec.Code, rec.Body.String())
			}

			if tt.expectError != "" {
				var errResp ErrorResponse
				if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
					t.Fatalf("failed to decode error body: %v", err)
				}
				if errResp.Error != tt.expectError {
					t.Errorf("expected error %q, got %q", tt.expectError, errResp.Error)
				}
			}

			if tt.expectZip {
				if rec.Header().Get("Content-Type") != "application/zip" {
					t.Errorf("expected Content-Type application/zip, got %s", rec.Header().Get("Content-Type"))
				}
				zipReader, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
				if err != nil {
					t.Fatalf("failed to parse returned zip archive: %v", err)
				}
				if len(zipReader.File) == 0 {
					t.Errorf("expected non-empty zip archive")
				}
			}
		})
	}
}

func TestHandleImportSession_FailureReportsFirstReason(t *testing.T) {
	server, _ := setupTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions/import", bytes.NewBufferString("not a session package"))
	req.Header.Set("Content-Type", "application/octet-stream")
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var resp sessionSvc.ImportBatchResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode import response: %v", err)
	}
	if resp.Failed != 1 || len(resp.Details) != 1 {
		t.Fatalf("expected one failed detail, got %+v", resp)
	}
	if resp.Details[0].Reason == "" {
		t.Fatalf("expected a failure reason in details, got %+v", resp.Details[0])
	}
	if resp.Error != resp.Details[0].Reason {
		t.Errorf("expected error %q (first failure reason), got %q", resp.Details[0].Reason, resp.Error)
	}
}

func TestHandleImportSession_SuccessHasNoError(t *testing.T) {
	resp := sessionSvc.ImportBatchResponse{Status: "success", Total: 1, Imported: 1}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	if bytes.Contains(data, []byte(`"error"`)) {
		t.Errorf("expected no error field on success, got %s", data)
	}
}

// Deleting a session must drop cached comparator merges, or its deleted laps keep being served.
func TestDeleteSessionClearsComparatorCache(t *testing.T) {
	tests := []struct {
		name   string
		delete func(sessionID int64) *http.Request
	}{
		{
			name: "single delete",
			delete: func(sessionID int64) *http.Request {
				return httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/sessions/%d", sessionID), http.NoBody)
			},
		},
		{
			name: "batch delete",
			delete: func(sessionID int64) *http.Request {
				body := fmt.Sprintf(`{"session_ids":[%d]}`, sessionID)
				return httptest.NewRequest(http.MethodPost, "/api/sessions/batch-delete", bytes.NewBufferString(body))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server, repo := setupTestServer(t)
			ctx := context.Background()

			sess := &storage.Session{
				SessionUID:   storage.FormatSessionUID(778899),
				TrackID:      1,
				TrackName:    "Monza",
				SessionType:  "Race",
				PacketFormat: 2026,
			}
			if err := repo.SaveSession(ctx, sess); err != nil {
				t.Fatalf("failed to save session: %v", err)
			}
			lap := &storage.Lap{SessionID: sess.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 80000}
			if err := repo.SaveLap(ctx, lap, false); err != nil {
				t.Fatalf("failed to save lap: %v", err)
			}
			samples := []storage.TelemetrySample{
				{LapDistance: 0, SessionTime: 0, Speed: 250},
				{LapDistance: 100, SessionTime: 1.4, Speed: 260},
			}
			if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
				t.Fatalf("failed to save telemetry: %v", err)
			}

			mergeURL := fmt.Sprintf("/api/comparator/merge?lapA=%d", lap.ID)
			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, mergeURL, http.NoBody))
			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200 for first merge, got %d (%s)", rec.Code, rec.Body.String())
			}

			rec = httptest.NewRecorder()
			server.router.ServeHTTP(rec, tt.delete(sess.ID))
			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200 for delete, got %d (%s)", rec.Code, rec.Body.String())
			}

			rec = httptest.NewRecorder()
			server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, mergeURL, http.NoBody))
			if rec.Code != http.StatusNotFound {
				t.Errorf("expected 404 for merge of a deleted lap, got %d (%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestMalformedQueryParamsAreRejected(t *testing.T) {
	server, _ := setupTestServer(t)

	tests := []struct {
		name        string
		url         string
		expectError string
	}{
		{name: "carIndex not a number", url: "/api/sessions/1/laps?carIndex=abc", expectError: "invalid carIndex"},
		{name: "carIndex negative", url: "/api/sessions/1/laps?carIndex=-1", expectError: "invalid carIndex"},
		{name: "maxPoints not a number", url: "/api/laps/1/telemetry?maxPoints=many", expectError: "invalid maxPoints"},
		{name: "maxPoints zero", url: "/api/laps/1/telemetry?maxPoints=0", expectError: "invalid maxPoints"},
		{name: "lapA not a number", url: "/api/comparator/merge?lapA=x", expectError: "invalid lapA"},
		{name: "lapB not a number", url: "/api/comparator/merge?lapA=1&lapB=2.5", expectError: "invalid lapB"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.url, http.NoBody))
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d (%s)", rec.Code, rec.Body.String())
			}
			var errResp ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
				t.Fatalf("failed to decode error body: %v", err)
			}
			if errResp.Error != tt.expectError {
				t.Errorf("expected error %q, got %q", tt.expectError, errResp.Error)
			}
		})
	}
}

func TestTagFromRequest(t *testing.T) {
	tests := []struct {
		name      string
		inName    string
		inColor   string
		wantName  string
		wantColor string
		wantErr   bool
	}{
		{name: "trims name and color", inName: "  WOR League ", inColor: " #ef4444 ", wantName: "WOR League", wantColor: "#ef4444"},
		{name: "defaults empty color", inName: "League", inColor: "   ", wantName: "League", wantColor: DefaultTagColor},
		{name: "rejects blank name", inName: "   ", inColor: "#fff", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tag, err := tagFromRequest(tt.inName, tt.inColor)
			if tt.wantErr {
				if !errors.Is(err, errTagNameRequired) {
					t.Fatalf("expected errTagNameRequired, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tag.Name != tt.wantName || tag.Color != tt.wantColor {
				t.Errorf("expected %q/%q, got %q/%q", tt.wantName, tt.wantColor, tag.Name, tag.Color)
			}
		})
	}
}

func TestTagHandlersRejectBlankNames(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	sess := &storage.Session{SessionUID: storage.FormatSessionUID(424242), TrackName: "Spa", SessionType: "Race", PacketFormat: 2026}
	if err := repo.SaveSession(ctx, sess); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}
	tag := &storage.Tag{Name: "Existing", Color: "#000000"}
	if err := repo.CreateTag(ctx, tag); err != nil {
		t.Fatalf("failed to create tag: %v", err)
	}

	tests := []struct {
		name        string
		method      string
		url         string
		expectError string
	}{
		{name: "create", method: http.MethodPost, url: "/api/tags", expectError: "tag name is required"},
		{name: "update", method: http.MethodPut, url: fmt.Sprintf("/api/tags/%d", tag.ID), expectError: "tag name is required"},
		{name: "add to session", method: http.MethodPost, url: fmt.Sprintf("/api/sessions/%d/tags", sess.ID), expectError: "tag ID or tag name is required"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.url, bytes.NewBufferString(`{"name":"   "}`))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d (%s)", rec.Code, rec.Body.String())
			}
			var errResp ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
				t.Fatalf("failed to decode error body: %v", err)
			}
			if errResp.Error != tt.expectError {
				t.Errorf("expected error %q, got %q", tt.expectError, errResp.Error)
			}
		})
	}
}
