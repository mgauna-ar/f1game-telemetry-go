package api

import (
	"encoding/json"
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
)

// Cache duration constants
const (
	SecondsPerYear = 31536000
)

// ErrorResponse represents a standardized JSON error response body.
type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

// StatusSuccess is the status of a successful write.
const StatusSuccess = "success"

// StatusResponse is the body of a write that returns nothing else.
type StatusResponse struct {
	Status string `json:"status"`
}

// BatchDeleteResponse is the body of POST /api/sessions/batch-delete.
type BatchDeleteResponse struct {
	Status       string `json:"status"`
	DeletedCount int64  `json:"deleted_count"`
}

// EngineerConfigSaveResponse is the body of POST /api/ai/engineer/config: the config now in use.
type EngineerConfigSaveResponse struct {
	Status string                  `json:"status"`
	Config engineer.EngineerConfig `json:"config"`
}

// writeJSONErrorCode writes a JSON error response with the provided message, status code, and structured error code.
func writeJSONErrorCode(w http.ResponseWriter, msg string, code int, errorCode string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: msg, Code: errorCode})
}

// writeJSONError writes a JSON error response with the provided message and HTTP status code.
func writeJSONError(w http.ResponseWriter, msg string, code int) {
	writeJSONErrorCode(w, msg, code, "")
}

// writeJSON writes arbitrary data as a JSON response with the provided HTTP status code.
func writeJSON(w http.ResponseWriter, code int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}
