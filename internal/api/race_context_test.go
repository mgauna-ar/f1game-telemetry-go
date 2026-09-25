package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func getRaceContext(t *testing.T, server *Server) engineer.RaceContextSnapshot {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/ai/engineer/race-context", http.NoBody)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
	var snap engineer.RaceContextSnapshot
	if err := json.Unmarshal(rec.Body.Bytes(), &snap); err != nil {
		t.Fatalf("decode race context: %v", err)
	}
	return snap
}

func TestHandleRaceContext(t *testing.T) {
	t.Run("unavailable without an engineer engine", func(t *testing.T) {
		server, _ := setupTestServer(t)
		if snap := getRaceContext(t, server); snap.Available {
			t.Fatalf("expected no race context, got %+v", snap)
		}
	})

	t.Run("unavailable before telemetry arrives", func(t *testing.T) {
		server, _ := setupTestServer(t)
		server.SetEngineerEngine(engineer.NewEngineerEngine(nil))
		if snap := getRaceContext(t, server); snap.Available {
			t.Fatalf("expected no race context, got %+v", snap)
		}
	})

	t.Run("live race picture", func(t *testing.T) {
		server, _ := setupTestServer(t)
		engine := engineer.NewEngineerEngine(nil)
		server.SetEngineerEngine(engine)

		header := packets.PacketHeader{PacketFormat: packets.PacketFormat2025, SessionUID: 99, PlayerCarIndex: 0}
		ctx := context.Background()
		engine.ProcessPacket(ctx, &packets.PacketSessionData{
			Header:      header,
			SessionType: packets.SessionRace,
			TrackId:     7,
			TotalLaps:   30,
		})
		laps := &packets.PacketLapData{Header: header}
		laps.LapData[0] = packets.LapData{CarPosition: 2, CurrentLapNum: 3, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive}
		laps.LapData[1] = packets.LapData{CarPosition: 1, CurrentLapNum: 3, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive}
		engine.ProcessPacket(ctx, laps)

		snap := getRaceContext(t, server)
		if !snap.Available || snap.You == nil || snap.CarAhead == nil {
			t.Fatalf("expected a live race picture with the car ahead, got %+v", snap)
		}
		if snap.You.Position != 2 || snap.CarAhead.Position != 1 {
			t.Fatalf("expected P2 behind P1, got you=%+v ahead=%+v", snap.You, snap.CarAhead)
		}
		if !strings.Contains(snap.Summary, "Lap 3 of 30") {
			t.Fatalf("expected the lap count in the summary, got:\n%s", snap.Summary)
		}
	})
}
