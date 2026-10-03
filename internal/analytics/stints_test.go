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

	resp := ComputeSessionStints(session, participants, laps, nil)
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

func TestComputeSessionStintsLeavesOutLapsFromTheFit(t *testing.T) {
	session := &storage.Session{ID: 31, SessionType: "Race", TotalLaps: 12}
	participants := []storage.Participant{{CarIndex: 0, Name: "Driver", Position: 1}}

	// Stint 1 (medium, laps 1-5) degrades 0.1s a lap; lap 3 is under the safety car and lap 5 is
	// the in-lap. Stint 2 (hard, laps 6-12) degrades 0.2s a lap: lap 6 is the out-lap, lap 8 a
	// spin (over 107% of the stint's median) and laps 11-12 are under a VSC still out at the end.
	times := map[int]int{
		1: 90000, 2: 90100, 3: 130000, 4: 90300, 5: 110000,
		6: 115000, 7: 89000, 8: 99000, 9: 89400, 10: 89600, 11: 100000, 12: 90000,
	}
	var laps []storage.Lap
	for lap := 1; lap <= 12; lap++ {
		compound, stint := "MEDIUM", 1
		if lap >= 6 {
			compound, stint = "HARD", 2
		}
		laps = append(laps, storage.Lap{CarIndex: 0, LapNumber: lap, LapTimeMS: times[lap], TyreCompound: compound, Stint: stint, IsValid: true})
	}
	periods := []RaceControlPeriod{{Kind: PeriodSafetyCar, StartLap: 3, EndLap: 3}, {Kind: PeriodVirtualSafetyCar, StartLap: 11}}

	resp := ComputeSessionStints(session, participants, laps, periods)
	stints := resp.Drivers[0].Stints
	if len(stints) != 2 {
		t.Fatalf("expected 2 stints, got %d", len(stints))
	}

	check := func(s DriverStint, wantSlope float64, wantFit int, wantExcluded []StintExcludedLap) {
		t.Helper()
		if s.DegSlopeSecPerLap == nil || *s.DegSlopeSecPerLap != wantSlope {
			t.Errorf("stint %d: slope = %v, want %v", s.StintIndex, s.DegSlopeSecPerLap, wantSlope)
		}
		if s.FitLaps != wantFit {
			t.Errorf("stint %d: fit laps = %d, want %d", s.StintIndex, s.FitLaps, wantFit)
		}
		if len(s.ExcludedLaps) != len(wantExcluded) {
			t.Fatalf("stint %d: excluded = %+v, want %+v", s.StintIndex, s.ExcludedLaps, wantExcluded)
		}
		for i := range wantExcluded {
			if s.ExcludedLaps[i] != wantExcluded[i] {
				t.Errorf("stint %d: excluded = %+v, want %+v", s.StintIndex, s.ExcludedLaps, wantExcluded)
			}
		}
	}
	check(stints[0], 0.1, 3, []StintExcludedLap{{3, ExcludedSC}, {5, ExcludedPitIn}})
	check(stints[1], 0.2, 3, []StintExcludedLap{{6, ExcludedPitOut}, {8, ExcludedSlow}, {11, ExcludedVSC}, {12, ExcludedVSC}})

	// The average is the clean pace; the best lap is the best of every lap
	if stints[1].AvgLapTimeMS != 89333 || stints[1].BestLapTimeMS != 89000 {
		t.Errorf("stint 2: avg %d best %d, want 89333 and 89000", stints[1].AvgLapTimeMS, stints[1].BestLapTimeMS)
	}

	// The chart keeps the left-out laps under their own key with the reason
	age3 := resp.DegradationData[2]
	if _, ok := age3["driver_0_stint_1"]; ok || age3["driver_0_stint_1_excluded"] != 130.0 || age3["driver_0_stint_1_reason"] != "sc" {
		t.Errorf("age 3 of stint 1: %+v", age3)
	}
	if resp.DegradationData[1]["driver_0_stint_2"] != 89.0 {
		t.Errorf("age 2 of stint 2: %+v", resp.DegradationData[1])
	}
}

func TestBuildStrategyKPIsMostPopularStrategy(t *testing.T) {
	// driver finishes in position with one stint per compound
	driver := func(position int, compounds ...string) DriverStintData {
		d := DriverStintData{Position: position}
		for _, c := range compounds {
			d.Stints = append(d.Stints, DriverStint{Compound: c})
		}
		return d
	}
	tests := []struct {
		name         string
		drivers      []DriverStintData
		wantStrategy string
		wantDrivers  int
	}{
		{name: "no stints", drivers: []DriverStintData{{Position: 1}}, wantStrategy: "N/A", wantDrivers: 0},
		{
			name:         "most drivers",
			drivers:      []DriverStintData{driver(1, "SOFT", "HARD"), driver(2, "MEDIUM", "HARD"), driver(3, "MEDIUM", "HARD")},
			wantStrategy: "M ➔ H",
			wantDrivers:  2,
		},
		{
			name: "a tie goes to the strategy whose driver finished highest",
			drivers: []DriverStintData{driver(3, "MEDIUM", "HARD"), driver(4, "MEDIUM", "HARD"),
				driver(1, "HARD", "MEDIUM"), driver(5, "HARD", "MEDIUM")},
			wantStrategy: "H ➔ M",
			wantDrivers:  2,
		},
		{
			name: "the same tie in another order",
			drivers: []DriverStintData{driver(5, "HARD", "MEDIUM"), driver(1, "HARD", "MEDIUM"),
				driver(4, "MEDIUM", "HARD"), driver(3, "MEDIUM", "HARD")},
			wantStrategy: "H ➔ M",
			wantDrivers:  2,
		},
		{
			name:         "a tie on position goes to the first by name",
			drivers:      []DriverStintData{driver(2, "MEDIUM", "HARD"), driver(2, "HARD", "MEDIUM")},
			wantStrategy: "H ➔ M",
			wantDrivers:  1,
		},
	}
	// Map order changes from one run to the next
	const runs = 100
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for range runs {
				kpis := buildStrategyKPIs(tt.drivers)
				if kpis.MostPopularStrategy != tt.wantStrategy || kpis.MostPopularCount != tt.wantDrivers {
					t.Fatalf("most popular strategy %q (%d drivers), want %q (%d)",
						kpis.MostPopularStrategy, kpis.MostPopularCount, tt.wantStrategy, tt.wantDrivers)
				}
			}
		})
	}
}
