package api

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

	lapsByCar, maxLap := groupLapsByCar(laps)
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
	active := buildEffectiveParticipants(&storage.Session{ID: 100}, nil, lapsByCar, true)
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
	activeProvided := buildEffectiveParticipants(&storage.Session{ID: 100}, existing, lapsByCar, false)
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

	summary := computeStintsSummary(laps)
	expected := "SOFT (2) → MEDIUM (1)"
	if summary != expected {
		t.Fatalf("expected %q, got %q", expected, summary)
	}
}
