package api

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

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
		contentType string
		body        string
		queryURL    string
		expectCode  int
		expectZip   bool
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
			name:        "Export via query parameter ids",
			contentType: "",
			body:        "",
			queryURL:    fmt.Sprintf("/api/sessions/export-batch?ids=%d,%d", sess1.ID, sess2.ID),
			expectCode:  http.StatusOK,
			expectZip:   true,
		},
		{
			name:        "No session IDs provided (empty body)",
			contentType: "application/json",
			body:        `{}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusBadRequest,
			expectZip:   false,
		},
		{
			name:        "Invalid JSON body",
			contentType: "application/json",
			body:        `{not valid json}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusBadRequest,
			expectZip:   false,
		},
		{
			name:        "Non-existent session IDs",
			contentType: "application/json",
			body:        `{"session_ids":[99998, 99999]}`,
			queryURL:    "/api/sessions/export-batch",
			expectCode:  http.StatusNotFound,
			expectZip:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != "" {
				req = httptest.NewRequest(http.MethodPost, tt.queryURL, bytes.NewBufferString(tt.body))
			} else {
				req = httptest.NewRequest(http.MethodPost, tt.queryURL, http.NoBody)
			}
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}

			rec := httptest.NewRecorder()
			server.router.ServeHTTP(rec, req)

			if rec.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d (body: %s)", tt.expectCode, rec.Code, rec.Body.String())
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
