package analytics

import (
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

	resp := ComputeSessionProgression(session, participants, laps)
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
	if lap1Pace["driver_0_is_outlier"] != false || lap1Pace["driver_0_pace_filtered"] != 88.5 {
		t.Errorf("expected lap 1 Max not outlier, got %v", lap1Pace["driver_0_is_outlier"])
	}

	// Lap 2 Max: in-lap (pit_in) and outlier
	lap2Pace := resp.LapPace[1]
	if lap2Pace["driver_0_is_outlier"] != true || lap2Pace["driver_0_outlier_reason"] != "pit_in" {
		t.Errorf("expected lap 2 Max to be pit_in outlier, got is_outlier=%v reason=%v", lap2Pace["driver_0_is_outlier"], lap2Pace["driver_0_outlier_reason"])
	}
	if lap2Pace["driver_0_pace_filtered"] != nil {
		t.Errorf("expected lap 2 Max pace_filtered to be nil, got %v", lap2Pace["driver_0_pace_filtered"])
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

	resp := ComputeSessionProgression(session, participants, laps)
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

func TestComputeSessionProgression_OutliersAndPits(t *testing.T) {
	session := &storage.Session{
		ID:          30,
		TrackName:   "Monza",
		SessionType: "Race",
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Charles Leclerc", DriverID: 5, TeamID: 1, RaceNumber: 16, GridPosition: 1},
	}

	// 5 Laps:
	// Lap 1: 82.0s (Stint 1, Soft)
	// Lap 2: 82.2s (Stint 1, Soft)
	// Lap 3: 110.0s (Stint 1, Soft -> Pit In)
	// Lap 4: 95.0s (Stint 2, Medium -> Pit Out)
	// Lap 5: 82.5s (Stint 2, Medium)
	// Lap 6: 120.0s (Stint 2, Medium -> Slow / SC lap, no pit change)
	laps := []storage.Lap{
		{SessionID: 30, CarIndex: 0, LapNumber: 1, LapTimeMS: 82000, Stint: 1, TyreCompound: "SOFT", IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 2, LapTimeMS: 82200, Stint: 1, TyreCompound: "SOFT", IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 3, LapTimeMS: 110000, Stint: 1, TyreCompound: "SOFT", IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 4, LapTimeMS: 95000, Stint: 2, TyreCompound: "MEDIUM", IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 5, LapTimeMS: 82500, Stint: 2, TyreCompound: "MEDIUM", IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 6, LapTimeMS: 120000, Stint: 2, TyreCompound: "MEDIUM", IsValid: true},
	}

	resp := ComputeSessionProgression(session, participants, laps)
	if resp == nil || len(resp.LapPace) != 6 {
		t.Fatalf("expected 6 lap pace entries, got %+v", resp)
	}

	// Lap 1: Normal
	if resp.LapPace[0]["driver_0_is_outlier"] != false || resp.LapPace[0]["driver_0_pace_filtered"] != 82.0 {
		t.Errorf("lap 1 expected normal pace, got %+v", resp.LapPace[0])
	}
	// Lap 2: Normal
	if resp.LapPace[1]["driver_0_is_outlier"] != false || resp.LapPace[1]["driver_0_pace_filtered"] != 82.2 {
		t.Errorf("lap 2 expected normal pace, got %+v", resp.LapPace[1])
	}
	// Lap 3: In-lap (pit_in)
	if resp.LapPace[2]["driver_0_is_outlier"] != true || resp.LapPace[2]["driver_0_outlier_reason"] != "pit_in" || resp.LapPace[2]["driver_0_pace_filtered"] != nil {
		t.Errorf("lap 3 expected pit_in outlier, got %+v", resp.LapPace[2])
	}
	// Lap 4: Out-lap (pit_out)
	if resp.LapPace[3]["driver_0_is_outlier"] != true || resp.LapPace[3]["driver_0_outlier_reason"] != "pit_out" || resp.LapPace[3]["driver_0_pace_filtered"] != nil {
		t.Errorf("lap 4 expected pit_out outlier, got %+v", resp.LapPace[3])
	}
	// Lap 5: Normal
	if resp.LapPace[4]["driver_0_is_outlier"] != false || resp.LapPace[4]["driver_0_pace_filtered"] != 82.5 {
		t.Errorf("lap 5 expected normal pace, got %+v", resp.LapPace[4])
	}
	// Lap 6: Slow / SC (no stint change, but > 107% of 82.2s ~ 87.9s)
	if resp.LapPace[5]["driver_0_is_outlier"] != true || resp.LapPace[5]["driver_0_outlier_reason"] != "slow" || resp.LapPace[5]["driver_0_pace_filtered"] != nil {
		t.Errorf("lap 6 expected slow outlier, got %+v", resp.LapPace[5])
	}
}
