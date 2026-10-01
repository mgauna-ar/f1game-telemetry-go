package analytics

import (
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestBuildDebriefFocus(t *testing.T) {
	player := 1
	session := &storage.Session{ID: 40, TrackName: "Monza", SessionType: "Race", TotalLaps: 4, PlayerCarIndex: &player}
	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", RaceNumber: 1, Position: 1},
		{CarIndex: 1, Name: "Lewis Hamilton", RaceNumber: 44, Position: 2},
		{CarIndex: 2, Name: "Lando Norris", RaceNumber: 4, Position: 3},
	}
	var laps []storage.Lap
	for car, base := range []int{88_000, 88_400, 88_900} {
		for lap := 1; lap <= 4; lap++ {
			compound, stint := "MEDIUM", 1
			if lap >= 3 {
				compound, stint = "HARD", 2
			}
			ms := base + lap*100
			laps = append(laps, storage.Lap{
				SessionID: 40, CarIndex: car, LapNumber: lap, LapTimeMS: ms, CarPosition: car + 1,
				Sector1MS: 29_000 + car*100, Sector2MS: 30_000 + lap*10, Sector3MS: ms - 59_000 - car*100 - lap*10,
				TyreCompound: compound, Stint: stint, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true,
			})
		}
	}
	cls := ComputeSessionClassification(session, participants, laps)

	tests := []struct {
		focus string
		want  []string
	}{
		{ai.DebriefFocusPace, []string{
			"- Cars: YOU Lewis Hamilton (#44) | FINISHED AHEAD Max Verstappen (#1) | FINISHED BEHIND Lando Norris (#4)",
			"- L1: 1:28.500 P2",
		}},
		{ai.DebriefFocusGap, []string{"LAP BY LAP", "- L4: 1:28.800 P2 +"}},
		{ai.DebriefFocusStints, []string{
			"- P2 Lewis Hamilton (#44) (YOU):",
			"  - Stint 1 MEDIUM L1-L2 (2 laps)",
			"  - Stint 2 HARD L3-L4 (2 laps)",
		}},
		{ai.DebriefFocusSectors, []string{
			"BEST SECTORS",
			"- P2 Lewis Hamilton (#44) (YOU): S1 29.100s (+0.100)",
			"SECTORS LAP BY LAP for Lewis Hamilton",
			"- L1 1:28.500: S1 29.100s",
		}},
	}
	for _, tt := range tests {
		t.Run(tt.focus, func(t *testing.T) {
			got := BuildDebriefFocus(tt.focus, session, participants, laps, cls, nil)
			for _, want := range tt.want {
				if !strings.Contains(got, want) {
					t.Errorf("expected %q in:\n%s", want, got)
				}
			}
		})
	}

	t.Run("the story adds nothing", func(t *testing.T) {
		if got := BuildDebriefFocus(ai.DebriefFocusStory, session, participants, laps, cls, nil); got != "" {
			t.Errorf("expected nothing for the story, got:\n%s", got)
		}
	})

	t.Run("without a player it follows the top three", func(t *testing.T) {
		noPlayer := *session
		noPlayer.PlayerCarIndex = nil
		got := BuildDebriefFocus(ai.DebriefFocusPace, &noPlayer, participants, laps, ComputeSessionClassification(&noPlayer, participants, laps), nil)
		if !strings.Contains(got, "- Cars: P1 Max Verstappen (#1) | P2 Lewis Hamilton (#44) | P3 Lando Norris (#4)") {
			t.Errorf("expected the top three, got:\n%s", got)
		}
	})
}
