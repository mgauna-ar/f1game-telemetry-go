package analytics

import (
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestComputeTrackProgress(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 9, d, 18, 0, 0, 0, time.UTC) }
	lap := func(session int64, car, number, ms int) storage.Lap {
		return storage.Lap{
			SessionID: session, CarIndex: car, LapNumber: number, LapTimeMS: ms, IsValid: true,
			Sector1MS: ms / 3, Sector2MS: ms / 3, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true,
		}
	}
	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", RaceNumber: 1, Position: 1, TotalRaceTime: 400},
		{CarIndex: 1, Name: "Lewis Hamilton", RaceNumber: 44, Position: 2, TotalRaceTime: 401},
	}
	// Listed newest first, as GetSessions returns them.
	sessions := []storage.Session{
		{ID: 3, TrackName: "Monza", SessionType: "Race", CreatedAt: day(3)},                         // no player car until one is picked
		{ID: 2, TrackName: "Monza", SessionType: "Race", CreatedAt: day(2), PlayerCarIndex: new(1)}, // the player sets the fastest lap
		{ID: 1, TrackName: "Monza", SessionType: "Race", CreatedAt: day(1), PlayerCarIndex: new(1)},
	}
	participantsBy := map[int64][]storage.Participant{1: participants, 2: participants, 3: participants}
	lapsBy := map[int64][]storage.Lap{
		// Lap 1 starts from the grid; lap 5 is an invalid lap: neither counts for consistency.
		1: {
			lap(1, 1, 1, 95_000), lap(1, 1, 2, 90_000), lap(1, 1, 3, 91_000), lap(1, 1, 4, 92_000),
			{SessionID: 1, CarIndex: 1, LapNumber: 5, LapTimeMS: 89_000},
			lap(1, 0, 1, 94_000), lap(1, 0, 2, 89_500),
		},
		2: {lap(2, 1, 1, 94_000), lap(2, 1, 2, 88_000), lap(2, 0, 1, 94_500), lap(2, 0, 2, 88_900)},
		3: {lap(3, 1, 1, 94_000), lap(3, 1, 2, 88_500), lap(3, 0, 1, 94_500), lap(3, 0, 2, 88_200)},
	}

	points, unmatched := ComputeTrackProgress(sessions, participantsBy, lapsBy)
	if unmatched != 1 || len(points) != 2 {
		t.Fatalf("got %d points, %d unmatched; want 2 and 1", len(points), unmatched)
	}
	first, second := points[0], points[1]
	if first.SessionID != 1 || second.SessionID != 2 {
		t.Fatalf("sessions %d, %d; want oldest first (1, 2)", first.SessionID, second.SessionID)
	}
	if first.Source != PlayerSourceRecorded || first.Position != 2 || first.ClassifiedCars != 2 || first.LapsCompleted != 5 {
		t.Errorf("first = %+v", first)
	}
	if first.BestLapTimeMS != 90_000 || first.BestLapNumber != 2 || first.BestSector1MS != 30_000 || first.BestSector3MS != 30_000 {
		t.Errorf("best lap %d (lap %d), sectors %d/%d/%d; want the valid 90000 on lap 2",
			first.BestLapTimeMS, first.BestLapNumber, first.BestSector1MS, first.BestSector2MS, first.BestSector3MS)
	}
	if first.GapToFastestMS == nil || *first.GapToFastestMS != 500 || first.FastestDriverName != "Max Verstappen" || first.FastestLapTimeMS != 89_500 {
		t.Errorf("gap %v to %s %d, want 500 to Verstappen's 89500", first.GapToFastestMS, first.FastestDriverName, first.FastestLapTimeMS)
	}
	// Laps 2-4: 90.0, 91.0, 92.0 s
	if first.CleanLaps != 3 || first.ConsistencyMS == nil || *first.ConsistencyMS != 816 {
		t.Errorf("clean laps %d, consistency %v; want 3 and 816", first.CleanLaps, first.ConsistencyMS)
	}
	if second.GapToFastestMS == nil || *second.GapToFastestMS != 0 || second.FastestDriverName != "Lewis Hamilton" {
		t.Errorf("second: gap %v, fastest %s; want 0, the player", second.GapToFastestMS, second.FastestDriverName)
	}
	if second.ConsistencyMS != nil || second.CleanLaps != 1 {
		t.Errorf("second: consistency %v from %d clean laps; want null below %d", second.ConsistencyMS, second.CleanLaps, MinConsistencyLaps)
	}

	// Picking Hamilton in session 3 brings it in.
	user := storage.PlayerCarSourceUser
	sessions[0].PlayerCarIndex, sessions[0].PlayerCarSource = new(1), &user
	points, unmatched = ComputeTrackProgress(sessions, participantsBy, lapsBy)
	if unmatched != 0 || len(points) != 3 || points[2].Source != PlayerSourceChosen || *points[2].GapToFastestMS != 300 {
		t.Errorf("with a picked car: %d points, %d unmatched, last %+v", len(points), unmatched, points[len(points)-1])
	}
}

func TestProgressTracks(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 9, d, 18, 0, 0, 0, time.UTC) }
	tracks := ProgressTracks([]storage.Session{
		{TrackName: "Spa", CreatedAt: day(5)},
		{TrackName: "Monza", CreatedAt: day(4)},
		{TrackName: "Spa", CreatedAt: day(1)},
	})
	if len(tracks) != 2 || tracks[0].TrackName != "Spa" || tracks[0].Sessions != 2 || !tracks[0].LastSessionAt.Equal(day(5)) || tracks[1].TrackName != "Monza" {
		t.Errorf("tracks = %+v, want Spa (2, latest day 5) then Monza", tracks)
	}
}
