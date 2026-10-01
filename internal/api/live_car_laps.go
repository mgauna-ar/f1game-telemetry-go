package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// LiveCarLaps is GET /api/live/cars/{carIndex}/laps: a car's completed laps and tyre stints in
// the live session, from the game's session history packets. Laps and stints are empty until
// the game sends the car's history.
type LiveCarLaps struct {
	// SessionUID is the session the history belongs to (hex), or "" when there is none yet.
	SessionUID string `json:"session_uid"`
	CarIndex   int    `json:"car_index"`
	// BestLapNum is the lap number of the car's best lap, 0 when there's none.
	BestLapNum int `json:"best_lap_num"`
	// BestSectorLapNums are the lap numbers of the car's best S1, S2 and S3, 0 when there's none.
	BestSectorLapNums [3]int `json:"best_sector_lap_nums"`
	// Laps are the completed laps, oldest first.
	Laps []LiveCarLap `json:"laps"`
	// Stints are the tyre stints, oldest first; the last one is running when its EndLap is null.
	Stints []LiveCarStint `json:"stints"`
}

// LiveCarLap is one completed lap of a car.
type LiveCarLap struct {
	Lap       int       `json:"lap"`
	LapTimeMS uint32    `json:"lap_time_ms"`
	SectorsMS [3]uint32 `json:"sectors_ms"`
	Valid     bool      `json:"valid"`
}

// LiveCarStint is one tyre stint of a car.
type LiveCarStint struct {
	// EndLap is the stint's last lap, null while the car is still on these tyres.
	EndLap         *int  `json:"end_lap"`
	ActualCompound uint8 `json:"actual_compound"`
	VisualCompound uint8 `json:"visual_compound"`
}

// handleGetLiveCarLaps serves a car's lap history for the live car detail drawer.
func (s *Server) handleGetLiveCarLaps(w http.ResponseWriter, r *http.Request) {
	idx, ok := parseURLID(w, r, "carIndex", "invalid car index")
	if !ok {
		return
	}
	if idx < 0 || idx >= packets.MaxCars {
		writeJSONError(w, "invalid car index", http.StatusBadRequest)
		return
	}
	var h *packets.PacketSessionHistoryData
	if s.liveFeed != nil {
		h = s.liveFeed.CarHistory(int(idx))
	}
	writeJSON(w, http.StatusOK, liveCarLaps(int(idx), h))
}

func liveCarLaps(carIdx int, h *packets.PacketSessionHistoryData) LiveCarLaps {
	out := LiveCarLaps{CarIndex: carIdx, Laps: []LiveCarLap{}, Stints: []LiveCarStint{}}
	if h == nil {
		return out
	}
	out.SessionUID = packets.FormatSessionUID(h.Header.SessionUID)
	out.BestLapNum = int(h.BestLapTimeLapNum)
	out.BestSectorLapNums = [3]int{int(h.BestSector1LapNum), int(h.BestSector2LapNum), int(h.BestSector3LapNum)}
	for n := 1; ; n++ {
		lap, ok := h.Lap(n)
		if !ok {
			break
		}
		if lap.LapTimeInMS == 0 {
			continue // the lap in progress
		}
		out.Laps = append(out.Laps, LiveCarLap{Lap: n, LapTimeMS: lap.LapTimeInMS, SectorsMS: lap.SectorsMS(), Valid: lap.Valid()})
	}
	for i := range min(int(h.NumTyreStints), len(h.TyreStintHistoryData)) {
		st := h.TyreStintHistoryData[i]
		stint := LiveCarStint{ActualCompound: st.TyreActualCompound, VisualCompound: st.TyreVisualCompound}
		if st.EndLap != packets.ActiveStintEndLap {
			end := int(st.EndLap)
			stint.EndLap = &end
		}
		out.Stints = append(out.Stints, stint)
	}
	return out
}

func (s *Server) setupLiveRoutes(r chi.Router) {
	r.Get("/live/cars/{carIndex}/laps", s.handleGetLiveCarLaps)
}
