package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
)

// handleComparatorMerge handles GET /api/comparator/merge?lapA={id}&lapB={id}&stepMeters=5&targetTrackLength=0
func (s *Server) handleComparatorMerge(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	var lapAID, lapBID int64
	if lapAStr := q.Get("lapA"); lapAStr != "" {
		if id, err := strconv.ParseInt(lapAStr, 10, 64); err == nil {
			lapAID = id
		}
	}
	if lapBStr := q.Get("lapB"); lapBStr != "" {
		if id, err := strconv.ParseInt(lapBStr, 10, 64); err == nil {
			lapBID = id
		}
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

	cacheKey := fmt.Sprintf("%d:%d:%.2f:%.2f", lapAID, lapBID, stepMeters, targetTrackLength)
	if s.comparatorCache != nil {
		if cached, found := s.comparatorCache.Get(cacheKey); found {
			writeJSON(w, http.StatusOK, cached)
			return
		}
	}

	response, err := analytics.MergeLapComparison(ctx, s.repo, lapAID, lapBID, stepMeters, targetTrackLength)
	if err != nil {
		var notFoundErr *analytics.LapNotFoundError
		if errors.As(err, &notFoundErr) {
			writeJSONError(w, notFoundErr.Error(), http.StatusNotFound)
			return
		}
		slog.Error("Failed to merge lap comparison", "lapA", lapAID, "lapB", lapBID, "error", err)
		writeJSONError(w, "Failed to merge lap comparison", http.StatusInternalServerError)
		return
	}

	if s.comparatorCache != nil {
		s.comparatorCache.Put(cacheKey, response)
	}

	writeJSON(w, http.StatusOK, response)
}
