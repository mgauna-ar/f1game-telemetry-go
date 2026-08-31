package analytics

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestCalculateDegradationSlope(t *testing.T) {
	t.Run("returns nil for less than 3 points", func(t *testing.T) {
		pts := []DegRegressionPoint{
			{Age: 1, TimeSec: 88.0},
			{Age: 2, TimeSec: 88.5},
		}
		res := CalculateDegradationSlope(pts)
		if res != nil {
			t.Errorf("expected nil for N=2, got %v", *res)
		}
	})

	t.Run("calculates correct positive degradation slope", func(t *testing.T) {
		// Perfect linear degradation: time = 88.0 + 0.2 * (age - 1)
		// Age 1: 88.0s, Age 2: 88.2s, Age 3: 88.4s, Age 4: 88.6s
		pts := []DegRegressionPoint{
			{Age: 1, TimeSec: 88.0},
			{Age: 2, TimeSec: 88.2},
			{Age: 3, TimeSec: 88.4},
			{Age: 4, TimeSec: 88.6},
		}
		res := CalculateDegradationSlope(pts)
		if res == nil {
			t.Fatal("expected non-nil slope")
		}
		if *res != 0.2 {
			t.Errorf("expected slope 0.2, got %f", *res)
		}
	})
}

func TestComputeSessionStints(t *testing.T) {
	session := &storage.Session{
		ID:          30,
		TrackName:   "Monza",
		SessionType: "Race",
		TotalLaps:   5,
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, Position: 1},
		{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, Position: 2},
	}

	laps := []storage.Lap{
		// Verstappen: Stint 1 (Medium, L1-L3), Stint 2 (Hard, L4-L5)
		{SessionID: 30, CarIndex: 0, LapNumber: 1, LapTimeMS: 88500, TyreCompound: "MEDIUM", Stint: 1, IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 2, LapTimeMS: 88200, TyreCompound: "MEDIUM", Stint: 1, IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 3, LapTimeMS: 88400, TyreCompound: "MEDIUM", Stint: 1, IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 4, LapTimeMS: 87500, TyreCompound: "HARD", Stint: 2, IsValid: true},
		{SessionID: 30, CarIndex: 0, LapNumber: 5, LapTimeMS: 87800, TyreCompound: "HARD", Stint: 2, IsValid: true},

		// Hamilton: Stint 1 (Soft, L1-L2), Stint 2 (Hard, L3-L5)
		{SessionID: 30, CarIndex: 1, LapNumber: 1, LapTimeMS: 89000, TyreCompound: "SOFT", Stint: 1, IsValid: true},
		{SessionID: 30, CarIndex: 1, LapNumber: 2, LapTimeMS: 88900, TyreCompound: "SOFT", Stint: 1, IsValid: true},
		{SessionID: 30, CarIndex: 1, LapNumber: 3, LapTimeMS: 87900, TyreCompound: "HARD", Stint: 2, IsValid: true},
		{SessionID: 30, CarIndex: 1, LapNumber: 4, LapTimeMS: 88100, TyreCompound: "HARD", Stint: 2, IsValid: true},
		{SessionID: 30, CarIndex: 1, LapNumber: 5, LapTimeMS: 88300, TyreCompound: "HARD", Stint: 2, IsValid: true},
	}

	resp := ComputeSessionStints(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if len(resp.Drivers) != 2 {
		t.Fatalf("expected 2 drivers, got %d", len(resp.Drivers))
	}

	// 1. Driver Stints Verification
	maxData := resp.Drivers[0]
	if maxData.DriverName != "Max Verstappen" || maxData.TotalStints != 2 || maxData.TotalPits != 1 {
		t.Errorf("expected Max Verstappen with 2 stints & 1 pit, got %+v", maxData)
	}
	if maxData.StrategyString != "M (3L) ➔ H (2L)" {
		t.Errorf("expected strategy 'M (3L) ➔ H (2L)', got %s", maxData.StrategyString)
	}

	stint1 := maxData.Stints[0]
	if stint1.Compound != "MEDIUM" || stint1.TotalLaps != 3 || !stint1.HasPitStopAfter {
		t.Errorf("unexpected stint 1: %+v", stint1)
	}

	stint2 := maxData.Stints[1]
	if stint2.Compound != "HARD" || stint2.TotalLaps != 2 || stint2.HasPitStopAfter {
		t.Errorf("unexpected stint 2: %+v", stint2)
	}

	// 2. Strategy KPIs Verification
	if resp.KPIs.TotalFieldPitStops != 2 {
		t.Errorf("expected 2 total field pit stops, got %d", resp.KPIs.TotalFieldPitStops)
	}
	if resp.KPIs.LongestStint == nil || resp.KPIs.LongestStint.TotalLaps != 3 {
		t.Errorf("expected longest stint of 3 laps, got %+v", resp.KPIs.LongestStint)
	}

	// Best lap by compound
	if resp.KPIs.BestLapsByCompound["HARD"].TimeMS != 87500 || resp.KPIs.BestLapsByCompound["HARD"].DriverName != "Max Verstappen" {
		t.Errorf("expected Hard best lap 87500 by Max Verstappen, got %+v", resp.KPIs.BestLapsByCompound["HARD"])
	}
	if resp.KPIs.BestLapsByCompound["MEDIUM"].TimeMS != 88200 {
		t.Errorf("expected Medium best lap 88200, got %+v", resp.KPIs.BestLapsByCompound["MEDIUM"])
	}
	if resp.KPIs.BestLapsByCompound["SOFT"].TimeMS != 88900 {
		t.Errorf("expected Soft best lap 88900, got %+v", resp.KPIs.BestLapsByCompound["SOFT"])
	}

	// 3. Degradation Matrix
	if resp.MaxTyreAge != 3 {
		t.Errorf("expected max tyre age 3, got %d", resp.MaxTyreAge)
	}
	if len(resp.DegradationData) != 3 {
		t.Fatalf("expected 3 degradation entries, got %d", len(resp.DegradationData))
	}
	// Age 1 for Max Stint 1: 88.5s
	if resp.DegradationData[0]["driver_0_stint_1"] != 88.5 {
		t.Errorf("expected Age 1 driver_0_stint_1 = 88.5, got %v", resp.DegradationData[0]["driver_0_stint_1"])
	}

	// 4. Session Compounds
	if len(resp.SessionCompounds) != 3 {
		t.Errorf("expected 3 compounds (HARD, MEDIUM, SOFT), got %v", resp.SessionCompounds)
	}
}
