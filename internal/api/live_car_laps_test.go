package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestHandleGetLiveCarLaps(t *testing.T) {
	h := &packets.PacketSessionHistoryData{
		Header:            packets.PacketHeader{SessionUID: 0xABC},
		CarIdx:            3,
		NumLaps:           3,
		NumTyreStints:     2,
		BestLapTimeLapNum: 2,
		BestSector1LapNum: 1,
		BestSector2LapNum: 2,
		BestSector3LapNum: 2,
	}
	h.LapHistoryData[0] = packets.LapHistoryData{LapTimeInMS: 91_000, Sector1TimeMSPart: 29_000, Sector2TimeMSPart: 32_000, Sector3TimeMSPart: 30_000, LapValidBitFlags: packets.LapValidBitFlag}
	h.LapHistoryData[1] = packets.LapHistoryData{LapTimeInMS: 90_000, Sector1TimeMSPart: 29_500, Sector2TimeMSPart: 31_000, Sector3TimeMSPart: 29_500}
	h.LapHistoryData[2] = packets.LapHistoryData{Sector1TimeMSPart: 29_100} // in progress
	h.TyreStintHistoryData[0] = packets.TyreStintHistoryData{EndLap: 1, TyreActualCompound: 18, TyreVisualCompound: 18}
	h.TyreStintHistoryData[1] = packets.TyreStintHistoryData{EndLap: packets.ActiveStintEndLap, TyreActualCompound: 19, TyreVisualCompound: 17}

	get := func(t *testing.T, server *Server, path string) *httptest.ResponseRecorder {
		t.Helper()
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, http.NoBody))
		return rec
	}

	t.Run("completed laps and stints", func(t *testing.T) {
		server, _ := setupTestServer(t)
		server.SetLiveFeed(fakeLiveFeed{history: map[int]*packets.PacketSessionHistoryData{3: h}})
		rec := get(t, server, "/api/live/cars/3/laps")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
		var resp LiveCarLaps
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.SessionUID != packets.FormatSessionUID(0xABC) || resp.CarIndex != 3 || resp.BestLapNum != 2 {
			t.Errorf("header fields = %q/%d/%d", resp.SessionUID, resp.CarIndex, resp.BestLapNum)
		}
		if resp.BestSectorLapNums != [3]int{1, 2, 2} {
			t.Errorf("best_sector_lap_nums = %v", resp.BestSectorLapNums)
		}
		want := []LiveCarLap{
			{Lap: 1, LapTimeMS: 91_000, SectorsMS: [3]uint32{29_000, 32_000, 30_000}, Valid: true},
			{Lap: 2, LapTimeMS: 90_000, SectorsMS: [3]uint32{29_500, 31_000, 29_500}, Valid: false},
		}
		if len(resp.Laps) != len(want) {
			t.Fatalf("laps = %+v, want the 2 completed laps", resp.Laps)
		}
		for i := range want {
			if resp.Laps[i] != want[i] {
				t.Errorf("laps[%d] = %+v, want %+v", i, resp.Laps[i], want[i])
			}
		}
		if len(resp.Stints) != 2 || resp.Stints[0].EndLap == nil || *resp.Stints[0].EndLap != 1 || resp.Stints[1].EndLap != nil {
			t.Errorf("stints = %+v, want lap 1 then a running stint", resp.Stints)
		}
		if resp.Stints[1].VisualCompound != 17 || resp.Stints[1].ActualCompound != 19 {
			t.Errorf("running stint compounds = %+v", resp.Stints[1])
		}
	})

	t.Run("no history yet", func(t *testing.T) {
		server, _ := setupTestServer(t)
		server.SetLiveFeed(fakeLiveFeed{})
		rec := get(t, server, "/api/live/cars/5/laps")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
		var raw map[string]json.RawMessage
		if err := json.NewDecoder(rec.Body).Decode(&raw); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if string(raw["laps"]) != "[]" || string(raw["stints"]) != "[]" || string(raw["session_uid"]) != `""` {
			t.Errorf("want empty laps and stints and no session, got %s / %s / %s", raw["laps"], raw["stints"], raw["session_uid"])
		}
	})

	t.Run("invalid car index", func(t *testing.T) {
		server, _ := setupTestServer(t)
		tooHigh := fmt.Sprintf("/api/live/cars/%d/laps", packets.MaxCars)
		for _, path := range []string{"/api/live/cars/x/laps", "/api/live/cars/-1/laps", tooHigh} {
			if rec := get(t, server, path); rec.Code != http.StatusBadRequest {
				t.Errorf("%s: expected 400, got %d", path, rec.Code)
			}
		}
	})
}
