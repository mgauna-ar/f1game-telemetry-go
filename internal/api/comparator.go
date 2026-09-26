package api

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
)

// handleComparatorMerge handles GET /api/comparator/merge?lapA={id}&lapB={id}&stepMeters=5&targetTrackLength=0
func (s *Server) handleComparatorMerge(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	lapAID, ok := parseOptionalLapID(w, q.Get("lapA"), "invalid lapA")
	if !ok {
		return
	}
	lapBID, ok := parseOptionalLapID(w, q.Get("lapB"), "invalid lapB")
	if !ok {
		return
	}

	stepMeters := analytics.DefaultComparatorStepMeters
	if stepStr := q.Get("stepMeters"); stepStr != "" {
		if val, err := strconv.ParseFloat(stepStr, 64); err == nil && val >= analytics.MinComparatorStepMeters && val <= analytics.MaxComparatorStepMeters {
			stepMeters = val
		}
	}

	var targetTrackLength float64
	if lengthStr := q.Get("targetTrackLength"); lengthStr != "" {
		if val, err := strconv.ParseFloat(lengthStr, 64); err == nil && val > 0 {
			targetTrackLength = val
		}
	}

	if lapAID <= 0 && lapBID <= 0 {
		writeJSON(w, http.StatusOK, analytics.ComparatorResponse{
			Points: []analytics.MergedTelemetryPoint{},
			Turns:  []analytics.TrackTurn{},
		})
		return
	}

	response, err := analytics.MergeLapComparisonCached(ctx, s.repo, s.comparatorCache, lapAID, lapBID, stepMeters, targetTrackLength)
	if err != nil {
		var notFoundErr *analytics.LapNotFoundError
		if errors.As(err, &notFoundErr) {
			writeJSONError(w, notFoundErr.Error(), http.StatusNotFound)
			return
		}
		slog.Error("Failed to merge lap comparison", "lapA", lapAID, "lapB", lapBID, "error", err)
		writeJSONError(w, "failed to merge lap comparison", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

// parseOptionalLapID parses an optional lap ID query value; an empty value means no lap.
// It writes a 400 with errMsg and returns ok=false when the value is not an integer.
func parseOptionalLapID(w http.ResponseWriter, value, errMsg string) (int64, bool) {
	if value == "" {
		return 0, true
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		writeJSONError(w, errMsg, http.StatusBadRequest)
		return 0, false
	}
	return id, true
}
