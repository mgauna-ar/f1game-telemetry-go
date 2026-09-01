package analytics

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestGroupLapsByCar(t *testing.T) {
	laps := []storage.Lap{
		{CarIndex: 1, LapNumber: 2, LapTimeMS: 90000},
		{CarIndex: 0, LapNumber: 1, LapTimeMS: 88000},
		{CarIndex: 1, LapNumber: 1, LapTimeMS: 91000},
	}

	lapsByCar, maxLap := GroupLapsByCar(laps)
	if maxLap != 2 {
		t.Fatalf("expected maxLap 2, got %d", maxLap)
	}
	if len(lapsByCar[1]) != 2 {
		t.Fatalf("expected 2 laps for car 1, got %d", len(lapsByCar[1]))
	}
	if lapsByCar[1][0].LapNumber != 1 || lapsByCar[1][1].LapNumber != 2 {
		t.Fatalf("expected laps to be sorted chronologically")
	}
}

func TestBuildEffectiveParticipants(t *testing.T) {
	lapsByCar := map[int][]storage.Lap{
		0: {{CarIndex: 0, LapNumber: 1, LapTimeMS: 90000}},
		1: {{CarIndex: 1, LapNumber: 1, LapTimeMS: 92000}},
	}

	// Case 1: Empty participants -> should create synthetic participants
	active := BuildEffectiveParticipants(&storage.Session{ID: 100}, nil, lapsByCar, true)
	if len(active) != 2 {
		t.Fatalf("expected 2 synthetic active participants, got %d", len(active))
	}
	if active[0].CarIndex != 0 || active[1].CarIndex != 1 {
		t.Fatalf("expected participants sorted by car index")
	}

	// Case 2: Provided participants with human name
	existing := []storage.Participant{
		{CarIndex: 0, Name: "Player", AIControlled: false},
		{CarIndex: 1, Name: "", AIControlled: false, DriverID: 0},
	}
	activeProvided := BuildEffectiveParticipants(&storage.Session{ID: 100}, existing, lapsByCar, false)
	if len(activeProvided) != 2 {
		t.Fatalf("expected 2 active participants, got %d", len(activeProvided))
	}
}

func TestComputeStintsSummary(t *testing.T) {
	laps := []storage.Lap{
		{TyreCompound: "SOFT", Stint: 1},
		{TyreCompound: "SOFT", Stint: 1},
		{TyreCompound: "MEDIUM", Stint: 2},
	}

	summary := ComputeStintsSummary(laps)
	expected := "SOFT (2) → MEDIUM (1)"
	if summary != expected {
		t.Fatalf("expected %q, got %q", expected, summary)
	}
}

func TestComputeStintsDetailed(t *testing.T) {
	// Case 1: Empty laps
	emptyResult := ComputeStintsDetailed(nil)
	if len(emptyResult) != 0 {
		t.Fatalf("expected empty stints for nil laps, got %d", len(emptyResult))
	}

	// Case 2: Multi-stint with stint IDs and compounds
	laps := []storage.Lap{
		{TyreCompound: "SOFT", Stint: 1},
		{TyreCompound: "SOFT", Stint: 1},
		{TyreCompound: "MEDIUM", Stint: 2},
		{TyreCompound: "HARD", Stint: 3},
		{TyreCompound: "HARD", Stint: 3},
		{TyreCompound: "HARD", Stint: 3},
	}

	stints := ComputeStintsDetailed(laps)
	if len(stints) != 3 {
		t.Fatalf("expected 3 stints, got %d", len(stints))
	}

	if stints[0].Compound != "SOFT" || stints[0].LapCount != 2 || stints[0].StintID != 1 {
		t.Errorf("unexpected stint 0: %+v", stints[0])
	}
	if stints[1].Compound != "MEDIUM" || stints[1].LapCount != 1 || stints[1].StintID != 2 {
		t.Errorf("unexpected stint 1: %+v", stints[1])
	}
	if stints[2].Compound != "HARD" || stints[2].LapCount != 3 || stints[2].StintID != 3 {
		t.Errorf("unexpected stint 2: %+v", stints[2])
	}
}
