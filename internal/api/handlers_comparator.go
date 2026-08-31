package api

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
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

	var rawA, rawB []storage.TelemetrySample
	var lapTimeMsA, lapTimeMsB int
	var metaA, metaB *analytics.ComparatorLapMeta

	if lapAID > 0 {
		lapA, err := s.repo.GetLapByID(ctx, lapAID)
		if err == nil && lapA != nil {
			lapTimeMsA = lapA.LapTimeMS
			driverName := fmt.Sprintf("Lap #%d", lapA.LapNumber)
			participants, pErr := s.repo.GetParticipantsBySession(ctx, lapA.SessionID)
			if pErr == nil {
				for _, p := range participants {
					if p.CarIndex == lapA.CarIndex {
						driverName = fmt.Sprintf("#%d %s", p.RaceNumber, p.Name)
						break
					}
				}
			}
			metaA = &analytics.ComparatorLapMeta{
				LapID:     lapA.ID,
				LapTimeMS: lapA.LapTimeMS,
				Driver:    driverName,
				Compound:  lapA.TyreCompound,
				TyreAge:   lapA.Stint,
			}
		}

		samples, sErr := s.repo.GetTelemetryByLap(ctx, lapAID)
		if sErr == nil && len(samples) > 0 {
			rawA = analytics.TrimTelemetryToLastLapAttempt(samples)
		}
	}

	if lapBID > 0 {
		lapB, err := s.repo.GetLapByID(ctx, lapBID)
		if err == nil && lapB != nil {
			lapTimeMsB = lapB.LapTimeMS
			driverName := fmt.Sprintf("Lap #%d", lapB.LapNumber)
			participants, pErr := s.repo.GetParticipantsBySession(ctx, lapB.SessionID)
			if pErr == nil {
				for _, p := range participants {
					if p.CarIndex == lapB.CarIndex {
						driverName = fmt.Sprintf("#%d %s", p.RaceNumber, p.Name)
						break
					}
				}
			}
			metaB = &analytics.ComparatorLapMeta{
				LapID:     lapB.ID,
				LapTimeMS: lapB.LapTimeMS,
				Driver:    driverName,
				Compound:  lapB.TyreCompound,
				TyreAge:   lapB.Stint,
			}
		}

		samples, sErr := s.repo.GetTelemetryByLap(ctx, lapBID)
		if sErr == nil && len(samples) > 0 {
			rawB = analytics.TrimTelemetryToLastLapAttempt(samples)
		}
	}

	points := analytics.CalculateMergedComparison(rawA, rawB, stepMeters, targetTrackLength, lapTimeMsA, lapTimeMsB)
	turns := analytics.DetectTrackTurns(points)

	response := &analytics.ComparatorResponse{
		Points: points,
		Turns:  turns,
		LapA:   metaA,
		LapB:   metaB,
	}

	if s.comparatorCache != nil {
		s.comparatorCache.Put(cacheKey, response)
	}

	writeJSON(w, http.StatusOK, response)
}
