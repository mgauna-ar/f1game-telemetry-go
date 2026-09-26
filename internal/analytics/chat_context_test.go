package analytics

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func ptr(v float64) *float64 { return &v }

func TestBuildSessionDebrief(t *testing.T) {
	standing := func(pos int, name string, number int, edit func(*DriverStanding)) DriverStanding {
		d := DriverStanding{
			Position: pos, DriverName: name, RaceNumber: number,
			BestLapTimeMS: 90_000 + pos*100, BestS1MS: 30_000, BestS2MS: 30_500, BestS3MS: 29_600,
			MaxSpeed: 320.46, StintsSummary: "SOFT (10) → MEDIUM (20)", LapsCompleted: 30,
		}
		if edit != nil {
			edit(&d)
		}
		return d
	}
	session := &storage.Session{TrackName: "Monza", SessionType: "Race", Weather: "Overcast", Tags: []storage.Tag{{Name: "League"}, {Name: "Round 3"}}}

	tests := []struct {
		name     string
		session  *storage.Session
		cls      *ClassificationResponse
		want     []string
		dontWant []string
	}{
		{
			name:    "race classification",
			session: session,
			cls: &ClassificationResponse{
				Standings: []DriverStanding{
					standing(1, "Max Verstappen", 1, nil),
					standing(2, "Lando Norris", 4, func(d *DriverStanding) { d.GapToLeaderMS = 2_345; d.AIControlled = true }),
					standing(3, "Oscar Piastri", 81, func(d *DriverStanding) { d.IsDNF = true; d.StintsSummary = "" }),
					standing(4, "Pierre Gasly", 10, func(d *DriverStanding) { d.IsDSQ = true; d.IsDNF = true }),
				},
				SessionBestS1MS: 29_901, SessionBestS2MS: 30_002, SessionBestS3MS: 29_003,
				UltimateTheoreticalMS: 88_906, ActualBestLapMS: 89_123, ActualBestLapDriver: "Lando Norris",
			},
			want: []string{
				"- Circuit: Monza",
				"- Session Type: Race",
				"- League / Category Tags: League, Round 3",
				"- Weather: Overcast",
				"- Total Drivers in Session: 4",
				"- Session Winner / P1: Max Verstappen (#1)",
				"- Fastest Lap of Session: Lando Norris (1:29.123)",
				"- Session Record Sectors: S1: 29.901s | S2: 30.002s | S3: 29.003s",
				"- Theoretical Best Lap of Session: 1:28.906",
				"- P1: Max Verstappen (#1) (HUMAN PLAYER) | Total Time/Gap: WINNER / LEADER | Best Lap: 1:30.100 | S1: 30.000s, S2: 30.500s, S3: 29.600s | Max Speed: 320.5 km/h | Stints: SOFT (10) → MEDIUM (20) | Laps: 30 | Status: Finished",
				"- P2: Lando Norris (#4) (AI) | Total Time/Gap: +2.345s",
				"Stints: No stint data | Laps: 30 | Status: DNF",
				"- P4: Pierre Gasly (#10) (HUMAN PLAYER) | Total Time/Gap: - |",
				"Status: DSQ",
			},
		},
		{
			name:    "empty session",
			session: &storage.Session{TrackName: "Spa", SessionType: "Practice 1"},
			cls:     &ClassificationResponse{},
			want: []string{
				"- League / Category Tags: None",
				"- Weather: Clear",
				"- Total Drivers in Session: 0",
				"- Session Winner / P1: N/A",
				"- Fastest Lap of Session: N/A",
				"- Session Record Sectors: S1: - | S2: - | S3: -",
				"- Theoretical Best Lap of Session: N/A",
			},
			dontWant: []string{"- P1:"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := BuildSessionDebrief(tt.session, tt.cls).Summary
			for _, want := range tt.want {
				if !strings.Contains(summary, want) {
					t.Errorf("expected %q in summary:\n%s", want, summary)
				}
			}
			for _, dontWant := range tt.dontWant {
				if strings.Contains(summary, dontWant) {
					t.Errorf("did not expect %q in summary:\n%s", dontWant, summary)
				}
			}
		})
	}

	t.Run("lists at most the top drivers", func(t *testing.T) {
		cls := &ClassificationResponse{}
		for i := 1; i <= DebriefMaxDrivers+2; i++ {
			cls.Standings = append(cls.Standings, standing(i, "Driver", i, nil))
		}
		summary := BuildSessionDebrief(session, cls).Summary
		if got := strings.Count(summary, "\n- P"); got != DebriefMaxDrivers {
			t.Errorf("expected %d classified drivers, got %d:\n%s", DebriefMaxDrivers, got, summary)
		}
		if !strings.Contains(summary, "Total Drivers in Session: 12") {
			t.Errorf("expected the full driver count, got:\n%s", summary)
		}
	})
}

// comparisonPoints builds a lap where both cars brake hard around 500 m: B brakes 10 m earlier,
// A carries 5 km/h more through the corner and gains 0.1 s through the segment.
func comparisonPoints() []MergedTelemetryPoint {
	var points []MergedTelemetryPoint
	for dist := 0.0; dist <= 1000; dist += 10 {
		p := MergedTelemetryPoint{
			LapDistance: dist,
			TimeA:       ptr(dist / 50), TimeB: ptr(dist / 50),
			SpeedA: ptr(300), SpeedB: ptr(298),
			BrakeA: ptr(0), BrakeB: ptr(0),
			ERSDeployModeA: ptr(0), ERSDeployModeB: ptr(1),
		}
		if dist >= 490 && dist <= 540 {
			*p.BrakeB = 0.9
			*p.SpeedA, *p.SpeedB = 120, 115
		}
		if dist >= 500 && dist <= 540 {
			*p.BrakeA = 0.8
		}
		if dist >= 600 {
			*p.TimeA -= 0.1
		}
		if dist >= 800 {
			*p.ERSDeployModeA = 2
			*p.SpeedA = 330
		}
		points = append(points, p)
	}
	return points
}

func TestBuildLapComparison(t *testing.T) {
	lapA := &storage.Lap{LapNumber: 5, LapTimeMS: 87_097, Sector1MS: 27_810, Sector2MS: 34_110, Sector3MS: 25_177, TyreCompound: "Soft"}
	lapB := &storage.Lap{LapNumber: 6, LapTimeMS: 87_340, Sector1MS: 27_950, TyreCompound: ""}
	merged := &ComparatorResponse{
		Points: comparisonPoints(),
		Turns:  []TrackTurn{{Name: "T1", Distance: 560}, {Name: "T2", Distance: 900}},
		LapA:   &ComparatorLapMeta{Driver: "#1 Max Verstappen"},
		LapB:   &ComparatorLapMeta{Driver: "#44 Lewis Hamilton"},
	}
	monza := &storage.Session{TrackName: "Monza", SessionType: "Qualifying", Weather: "Clear"}

	t.Run("no telemetry", func(t *testing.T) {
		empty := &ComparatorResponse{LapA: merged.LapA, LapB: merged.LapB}
		if c := BuildLapComparison(LapComparisonInput{Merged: empty, LapA: lapA, LapB: lapB}); c != nil {
			t.Fatalf("expected nil without merged points, got %+v", c)
		}
	})

	t.Run("full lap", func(t *testing.T) {
		c := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: lapA, LapB: lapB, SessionA: monza, SessionB: monza})
		if c == nil {
			t.Fatal("expected a comparison")
		}
		checks := map[string]bool{
			"track":        c.TrackName == "Monza" && c.SessionTypeA == "Qualifying" && c.SessionTypeB == "Qualifying" && !c.CrossSession,
			"names":        c.LapAName == "#1 Max Verstappen (Lap 5)" && c.LapBName == "#44 Lewis Hamilton (Lap 6)",
			"times":        c.LapATime == "1:27.097" && c.LapBTime == "1:27.340",
			"faster":       c.FasterLap == "Lap A (#1 Max Verstappen)" && c.TimeDeltaSeconds < -0.242 && c.TimeDeltaSeconds > -0.244,
			"compounds":    c.CompoundA == "Soft" && c.CompoundB == "Unknown",
			"sectors":      c.SectorsA == [3]string{"27.810s", "34.110s", "25.177s"} && c.SectorsB == [3]string{"27.950s", "-", "-"},
			"top speed":    c.TopSpeedA == 330 && c.TopSpeedB == 298,
			"ers":          c.ERSUsedPctB == 100 && c.ERSUsedPctA > 19 && c.ERSUsedPctA < 21,
			"no zoom":      c.Zoom == nil,
			"braking zone": c.BrakingSummary == "Detected 1 heavy braking zones. Examples at: T1 (~490m) (Peak: A=80% vs B=90%)",
			"apex speed":   c.ApexSpeedSummary == "At T1 (~490m): min speed A=120 km/h vs B=115 km/h",
			"throttle":     c.ThrottleSummary == "Top speed reached: A=330.0 km/h vs B=298.0 km/h. Top speed delta: 32.0 km/h.",
		}
		for name, ok := range checks {
			if !ok {
				t.Errorf("%s: unexpected comparison %+v", name, c)
			}
		}
	})

	t.Run("zoomed segment", func(t *testing.T) {
		zoom := &ai.ChatZoomRange{StartMeters: 450.4, EndMeters: 650}
		c := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: lapA, LapB: lapB, SessionA: monza, SessionB: monza, Zoom: zoom})
		zr := c.Zoom
		if zr == nil {
			t.Fatal("expected zoom info")
		}
		if zr.StartDistanceMeters != 450 || zr.EndDistanceMeters != 650 || zr.Description != "Sector with T1 (450m to 650m)" {
			t.Errorf("unexpected zoom range %+v", zr)
		}
		if zr.DeltaInSegment > -0.099 || zr.DeltaInSegment < -0.101 {
			t.Errorf("expected A to gain 0.1s in the segment, got %f", zr.DeltaInSegment)
		}
		if zr.SpeedDiffAtApex != 5 || !zr.HasBrakingDiff || zr.BrakingDiffMeters != 10 {
			t.Errorf("expected +5 km/h at the apex and braking 10 m later, got %+v", zr)
		}

		outside := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: lapA, LapB: lapB, Zoom: &ai.ChatZoomRange{StartMeters: 2000, EndMeters: 2100}})
		if outside.Zoom != nil {
			t.Errorf("expected no zoom info past the lap, got %+v", outside.Zoom)
		}
	})

	t.Run("cross session", func(t *testing.T) {
		rain := &storage.Session{TrackName: "Monza", SessionType: "Qualifying", Weather: "Light Rain"}
		c := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: lapA, LapB: lapB, SessionA: monza, SessionB: rain})
		if !c.CrossSession || c.WeatherA != "Clear" || c.WeatherB != "Light Rain" {
			t.Errorf("expected a cross-session comparison by weather, got %+v", c)
		}
		race := &storage.Session{TrackName: "Monza", SessionType: "Race"}
		if c := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: lapA, LapB: lapB, SessionA: monza, SessionB: race}); !c.CrossSession || c.SessionTypeB != "Race" {
			t.Errorf("expected a cross-session comparison by session type, got %+v", c)
		}
	})

	t.Run("benchmark faster", func(t *testing.T) {
		slow := *lapA
		slow.LapTimeMS = 88_000
		c := BuildLapComparison(LapComparisonInput{Merged: merged, LapA: &slow, LapB: lapB})
		if c.FasterLap != "Lap B (#44 Lewis Hamilton)" || c.TrackName != "F1 Circuit" || c.SessionTypeA != "Session" {
			t.Errorf("expected lap B faster with default session names, got %+v", c)
		}
	})
}

func TestChatContextSource(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(filepath.Join(t.TempDir(), "chat.db"))
	if err != nil {
		t.Fatalf("failed to create sqlite repo: %v", err)
	}
	defer repo.Close()

	session := &storage.Session{SessionUID: "0xC0FFEE", TrackID: 11, TrackName: "Monza", SessionType: "Qualifying", Weather: "Clear"}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}
	if err := repo.SaveParticipants(ctx, session.ID, []storage.Participant{
		{SessionID: session.ID, CarIndex: 0, RaceNumber: 1, Name: "Max Verstappen"},
		{SessionID: session.ID, CarIndex: 1, RaceNumber: 44, Name: "Lewis Hamilton", AIControlled: true},
	}); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	lapIDs := make([]int64, 0, 2)
	for car, lapTime := range []int{80_000, 80_500} {
		lap := &storage.Lap{SessionID: session.ID, CarIndex: car, LapNumber: 3, LapTimeMS: lapTime, Sector1MS: 26_000, Sector2MS: 27_000, Sector3MS: lapTime - 53_000, IsValid: true, TyreCompound: "Soft", Stint: 1}
		if err := repo.SaveLap(ctx, lap, false); err != nil {
			t.Fatalf("failed to save lap: %v", err)
		}
		var samples []storage.TelemetrySample
		for i := 0; i <= 100; i++ {
			dist := float64(i) * 50
			samples = append(samples, storage.TelemetrySample{LapDistance: dist, SessionTime: float64(lapTime) / 1000 * float64(i) / 100, Speed: 250, Throttle: 1, Gear: 7})
		}
		if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
			t.Fatalf("failed to save telemetry: %v", err)
		}
		lapIDs = append(lapIDs, lap.ID)
	}

	cache := NewComparatorLRUCache(ComparatorCacheCapacity)
	src := NewChatContextSource(repo, cache)
	var _ ai.RecordedRaceSource = src

	t.Run("session debrief", func(t *testing.T) {
		debrief, err := src.SessionDebrief(ctx, session.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, want := range []string{"- Circuit: Monza", "- P1: Max Verstappen (#1) (HUMAN PLAYER)", "- P2: Lewis Hamilton (#44) (AI) | Total Time/Gap: +0.500s"} {
			if !strings.Contains(debrief.Summary, want) {
				t.Errorf("expected %q in debrief:\n%s", want, debrief.Summary)
			}
		}
		if _, err := src.SessionDebrief(ctx, 9999); !errors.Is(err, storage.ErrSessionNotFound) {
			t.Errorf("expected ErrSessionNotFound for an unknown session, got %v", err)
		}
	})

	t.Run("lap comparison", func(t *testing.T) {
		c, err := src.LapComparison(ctx, lapIDs[0], lapIDs[1], nil)
		if err != nil || c == nil {
			t.Fatalf("expected a comparison, got %+v, %v", c, err)
		}
		if c.TrackName != "Monza" || c.LapAName != "#1 Max Verstappen (Lap 3)" || c.LapBName != "#44 Lewis Hamilton (Lap 3)" || c.LapATime != "1:20.000" {
			t.Errorf("unexpected comparison %+v", c)
		}
		if _, found := cache.Get(comparatorCacheKey(lapIDs[0], lapIDs[1], DefaultComparatorStepMeters, 0)); !found {
			t.Errorf("expected the merge to be cached for the comparator charts")
		}

		var notFound *LapNotFoundError
		if _, err := src.LapComparison(ctx, lapIDs[0], 9999, nil); !errors.As(err, &notFound) {
			t.Errorf("expected LapNotFoundError for an unknown lap, got %v", err)
		}
	})
}
