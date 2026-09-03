package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONError(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSONError(rec, "something went wrong", http.StatusBadRequest)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", contentType)
	}

	var body ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Error != "something went wrong" {
		t.Errorf("expected error message %q, got %q", "something went wrong", body.Error)
	}
	if body.Code != "" {
		t.Errorf("expected empty code, got %q", body.Code)
	}
}

func TestWriteJSONErrorCode(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSONErrorCode(rec, "not found", http.StatusNotFound, "NOT_FOUND")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}

	var body ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Error != "not found" {
		t.Errorf("expected error message %q, got %q", "not found", body.Error)
	}
	if body.Code != "NOT_FOUND" {
		t.Errorf("expected error code %q, got %q", "NOT_FOUND", body.Code)
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	payload := map[string]int{"count": 42}
	writeJSON(rec, http.StatusOK, payload)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", contentType)
	}

	var result map[string]int
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if result["count"] != 42 {
		t.Errorf("expected count 42, got %d", result["count"])
	}
}
