package session

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestDeriveStints(t *testing.T) {
	t.Run("nil/empty inputs", func(t *testing.T) {
		stints := DeriveStints(nil)
		if stints != nil {
			t.Errorf("expected nil, got %+v", stints)
		}
	})

	t.Run("single stint with 0 or 255 end lap", func(t *testing.T) {
		inputs := []StintInput{
			{EndLap: 255, VisualCompound: packets.CompoundSoft, ActualCompound: packets.ActualCompoundC3},
		}
		stints := DeriveStints(inputs)
		if len(stints) != 1 {
			t.Fatalf("expected 1 stint, got %d", len(stints))
		}
		if stints[0].StintNumber != 1 {
			t.Errorf("expected stint 1, got %d", stints[0].StintNumber)
		}
		if stints[0].StartLap != 1 {
			t.Errorf("expected start lap 1, got %d", stints[0].StartLap)
		}
		if stints[0].EndLap != packets.MaxSessionLapsSanity {
			t.Errorf("expected end lap %d, got %d", packets.MaxSessionLapsSanity, stints[0].EndLap)
		}
		if stints[0].VisualCompound != packets.CompoundNameSoft {
			t.Errorf("expected visual compound SOFT, got %s", stints[0].VisualCompound)
		}
	})

	t.Run("multiple stints with explicit end laps", func(t *testing.T) {
		inputs := []StintInput{
			{EndLap: 15, VisualCompound: packets.CompoundSoft, ActualCompound: packets.ActualCompoundC4},
			{EndLap: 35, VisualCompound: packets.CompoundMedium, ActualCompound: packets.ActualCompoundC3},
			{EndLap: 0, VisualCompound: packets.CompoundHard, ActualCompound: packets.ActualCompoundC2},
		}
		stints := DeriveStints(inputs)
		if len(stints) != 3 {
			t.Fatalf("expected 3 stints, got %d", len(stints))
		}

		// Stint 1: 1-15
		if stints[0].StartLap != 1 || stints[0].EndLap != 15 || stints[0].VisualCompound != packets.CompoundNameSoft {
			t.Errorf("unexpected stint 1: %+v", stints[0])
		}

		// Stint 2: 16-35
		if stints[1].StartLap != 16 || stints[1].EndLap != 35 || stints[1].VisualCompound != packets.CompoundNameMedium {
			t.Errorf("unexpected stint 2: %+v", stints[1])
		}

		// Stint 3: 36-MaxSessionLapsSanity
		if stints[2].StartLap != 36 || stints[2].EndLap != packets.MaxSessionLapsSanity || stints[2].VisualCompound != packets.CompoundNameHard {
			t.Errorf("unexpected stint 3: %+v", stints[2])
		}
	})
}

func TestFindStintForLap(t *testing.T) {
	stints := []StintInfo{
		{StintNumber: 1, StartLap: 1, EndLap: 10, VisualCompound: "Soft", ActualCompound: "C4"},
		{StintNumber: 2, StartLap: 11, EndLap: 25, VisualCompound: "Medium", ActualCompound: "C3"},
	}

	stintNum, vis, act := FindStintForLap(stints, 5)
	if stintNum != 1 || vis != "Soft" || act != "C4" {
		t.Errorf("expected stint 1 Soft C4, got %d %s %s", stintNum, vis, act)
	}

	stintNum, vis, act = FindStintForLap(stints, 11)
	if stintNum != 2 || vis != "Medium" || act != "C3" {
		t.Errorf("expected stint 2 Medium C3, got %d %s %s", stintNum, vis, act)
	}

	stintNum, vis, act = FindStintForLap(stints, 50)
	if stintNum != 1 || vis != "" || act != "" {
		t.Errorf("expected fallback stint 1 empty, got %d %s %s", stintNum, vis, act)
	}
}
