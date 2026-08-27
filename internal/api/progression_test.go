package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestComputeSessionProgression_Race(t *testing.T) {
	session := &storage.Session{
		ID:          10,
		TrackName:   "Spa-Francorchamps",
		SessionType: "Race",
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, GridPosition: 1},
		{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, GridPosition: 2},
	}

	laps := []storage.Lap{
		// Lap 1: Max 88.5s (P1), Lewis 89.0s (P2)
		{SessionID: 10, CarIndex: 0, LapNumber: 1, LapTimeMS: 88500, TyreCompound: "MEDIUM", IsValid: true},
		{SessionID: 10, CarIndex: 1, LapNumber: 1, LapTimeMS: 89000, TyreCompound: "SOFT", IsValid: true},
		// Lap 2: Max 115.0s in-lap (cumulative: 203.5s -> P2), Lewis 88.0s (cumulative: 177.0s -> P1)
		{SessionID: 10, CarIndex: 0, LapNumber: 2, LapTimeMS: 115000, TyreCompound: "MEDIUM", IsValid: true},
		{SessionID: 10, CarIndex: 1, LapNumber: 2, LapTimeMS: 88000, TyreCompound: "SOFT", IsValid: true},
		// Lap 3: Max 87.5s (cumulative: 291.0s -> P2), Lewis 87.9s (cumulative: 264.9s -> P1)
		{SessionID: 10, CarIndex: 0, LapNumber: 3, LapTimeMS: 87500, TyreCompound: "HARD", IsValid: true},
		{SessionID: 10, CarIndex: 1, LapNumber: 3, LapTimeMS: 87900, TyreCompound: "HARD", IsValid: true},
	}

	resp := computeSessionProgression(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if resp.TotalSessionLaps != 3 {
		t.Errorf("expected 3 total laps, got %d", resp.TotalSessionLaps)
	}

	if len(resp.Drivers) != 2 {
		t.Fatalf("expected 2 drivers, got %d", len(resp.Drivers))
	}
	if resp.Drivers[0].DriverName != "Max Verstappen" || resp.Drivers[1].DriverName != "Lewis Hamilton" {
		t.Errorf("unexpected drivers list: %+v", resp.Drivers)
	}

	// 1. Lap Pace Matrix
	if len(resp.LapPace) != 3 {
		t.Fatalf("expected 3 pace entries, got %d", len(resp.LapPace))
	}
	// Lap 1 Max: 88.50s, Lewis: 89.00s
	lap1Pace := resp.LapPace[0]
	if lap1Pace["driver_0"] != 88.5 || lap1Pace["driver_1"] != 89.0 {
		t.Errorf("expected lap 1 pace 88.5 and 89.0, got %v and %v", lap1Pace["driver_0"], lap1Pace["driver_1"])
	}

	// 2. Position Matrix
	if len(resp.Positions) != 3 {
		t.Fatalf("expected 3 position entries, got %d", len(resp.Positions))
	}
	// Lap 1: Max P1, Lewis P2
	if resp.Positions[0]["driver_0"] != 1 || resp.Positions[0]["driver_1"] != 2 {
		t.Errorf("lap 1 expected Max P1, Lewis P2, got %v and %v", resp.Positions[0]["driver_0"], resp.Positions[0]["driver_1"])
	}
	// Lap 2: Max P2 (pit), Lewis P1
	if resp.Positions[1]["driver_0"] != 2 || resp.Positions[1]["driver_1"] != 1 {
		t.Errorf("lap 2 expected Max P2, Lewis P1, got %v and %v", resp.Positions[1]["driver_0"], resp.Positions[1]["driver_1"])
	}

	// 3. Gap To Leader Matrix
	if len(resp.GapToLeader) != 3 {
		t.Fatalf("expected 3 gap entries, got %d", len(resp.GapToLeader))
	}
	// Lap 1: Max 0s, Lewis 0.5s
	if resp.GapToLeader[0]["driver_0"] != 0.0 || resp.GapToLeader[0]["driver_1"] != 0.5 {
		t.Errorf("lap 1 expected gap Max 0.0, Lewis 0.5, got %v and %v", resp.GapToLeader[0]["driver_0"], resp.GapToLeader[0]["driver_1"])
	}
	// Lap 2: Lewis 0s, Max 26.5s
	if resp.GapToLeader[1]["driver_1"] != 0.0 || resp.GapToLeader[1]["driver_0"] != 26.5 {
		t.Errorf("lap 2 expected gap Lewis 0.0, Max 26.5, got %v and %v", resp.GapToLeader[1]["driver_1"], resp.GapToLeader[1]["driver_0"])
	}
}

func TestComputeSessionProgression_Qualifying(t *testing.T) {
	session := &storage.Session{
		ID:          20,
		TrackName:   "Zandvoort",
		SessionType: "Qualifying",
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, GridPosition: 1},
		{CarIndex: 1, Name: "Lando Norris", DriverID: 4, TeamID: 8, RaceNumber: 4, GridPosition: 2},
	}

	laps := []storage.Lap{
		// Lap 1: Max sets 88.5s (takes provisional pole), Lando sets 89.0s (P2)
		{SessionID: 20, CarIndex: 0, LapNumber: 1, LapTimeMS: 88500, IsValid: true},
		{SessionID: 20, CarIndex: 1, LapNumber: 1, LapTimeMS: 89000, IsValid: true},
		// Lap 2: Max does cool lap (110.0s, best remains 88.5s), Lando sets 87.0s (takes provisional pole P1)
		{SessionID: 20, CarIndex: 0, LapNumber: 2, LapTimeMS: 110000, IsValid: true},
		{SessionID: 20, CarIndex: 1, LapNumber: 2, LapTimeMS: 87000, IsValid: true},
		// Lap 3: Max sets 86.5s (takes pole P1), Lando does cool lap (115.0s, drops to P2)
		{SessionID: 20, CarIndex: 0, LapNumber: 3, LapTimeMS: 86500, IsValid: true},
		{SessionID: 20, CarIndex: 1, LapNumber: 3, LapTimeMS: 115000, IsValid: true},
	}

	resp := computeSessionProgression(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	// Positions in Qualy track provisional standing by best valid lap up to that point
	// Lap 1: Max P1 (88.5), Lando P2 (89.0)
	if resp.Positions[0]["driver_0"] != 1 || resp.Positions[0]["driver_1"] != 2 {
		t.Errorf("lap 1 qualy positions expected Max 1, Lando 2, got %v and %v", resp.Positions[0]["driver_0"], resp.Positions[0]["driver_1"])
	}
	// Lap 2: Max P2 (88.5), Lando P1 (87.0)
	if resp.Positions[1]["driver_0"] != 2 || resp.Positions[1]["driver_1"] != 1 {
		t.Errorf("lap 2 qualy positions expected Max 2, Lando 1, got %v and %v", resp.Positions[1]["driver_0"], resp.Positions[1]["driver_1"])
	}
	// Lap 3: Max P1 (86.5), Lando P2 (87.0)
	if resp.Positions[2]["driver_0"] != 1 || resp.Positions[2]["driver_1"] != 2 {
		t.Errorf("lap 3 qualy positions expected Max 1, Lando 2, got %v and %v", resp.Positions[2]["driver_0"], resp.Positions[2]["driver_1"])
	}
}

func TestHandleGetSessionProgression_Endpoint(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(888888),
		TrackID:      5,
		TrackName:    "Interlagos",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	t.Run("valid progression returns 200 OK", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/progression", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp ProgressionResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse JSON: %v", err)
		}
	})

	t.Run("non-existent session returns 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/sessions/9999/progression", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})
}
