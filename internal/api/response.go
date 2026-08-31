package api

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse represents a standardized JSON error response body.
type ErrorResponse struct {
	Error string `json:"error"`
}

// writeJSONError writes a JSON error response with the provided message and HTTP status code.
func writeJSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: msg})
}

// writeJSON writes arbitrary data as a JSON response with the provided HTTP status code.
func writeJSON(w http.ResponseWriter, code int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}
