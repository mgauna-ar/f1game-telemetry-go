package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestComputeSessionClassification_Race(t *testing.T) {
	session := &storage.Session{
		ID:          1,
		TrackName:   "Silverstone",
		SessionType: "Race",
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, GridPosition: 2, Position: 1, TotalRaceTime: 5400.0, Points: 25},
		{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, GridPosition: 1, Position: 2, TotalRaceTime: 5405.5, Points: 18},
		{CarIndex: 2, Name: "Charles Leclerc", DriverID: 3, TeamID: 1, RaceNumber: 16, GridPosition: 3, Position: 3, TotalRaceTime: 5410.0, Points: 15},
		{CarIndex: 3, Name: "Lando Norris", DriverID: 4, TeamID: 8, RaceNumber: 4, GridPosition: 4, ResultReason: int(packets.ResultReasonTerminalDamage)}, // DNF
		{CarIndex: 4, Name: "Sergio Perez", DriverID: 5, TeamID: 2, RaceNumber: 11, GridPosition: 5, ResultReason: int(packets.ResultReasonBlackFlagged)},  // DSQ
	}

	laps := []storage.Lap{
		// Verstappen laps (P1)
		{SessionID: 1, CarIndex: 0, LapNumber: 1, LapTimeMS: 90000, Sector1MS: 28000, Sector2MS: 34000, Sector3MS: 28000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 325.5, TyreCompound: "MEDIUM", Stint: 1},
		{SessionID: 1, CarIndex: 0, LapNumber: 2, LapTimeMS: 88000, Sector1MS: 27500, Sector2MS: 33500, Sector3MS: 27000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 330.0, TyreCompound: "HARD", Stint: 2},
		// Hamilton laps (P2, with 5s penalty)
		{SessionID: 1, CarIndex: 1, LapNumber: 1, LapTimeMS: 90200, Sector1MS: 28100, Sector2MS: 34100, Sector3MS: 28000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 322.0, TyreCompound: "MEDIUM", Stint: 1, PenaltiesSeconds: 5},
		{SessionID: 1, CarIndex: 1, LapNumber: 2, LapTimeMS: 87800, Sector1MS: 27300, Sector2MS: 33500, Sector3MS: 27000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 328.0, TyreCompound: "HARD", Stint: 2, PenaltiesSeconds: 5},
		// Leclerc laps (P3)
		{SessionID: 1, CarIndex: 2, LapNumber: 1, LapTimeMS: 90500, Sector1MS: 28200, Sector2MS: 34200, Sector3MS: 28100, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 320.0, TyreCompound: "SOFT", Stint: 1},
		{SessionID: 1, CarIndex: 2, LapNumber: 2, LapTimeMS: 88500, Sector1MS: 27600, Sector2MS: 33600, Sector3MS: 27300, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 324.0, TyreCompound: "HARD", Stint: 2},
		// Norris laps (DNF on lap 2)
		{SessionID: 1, CarIndex: 3, LapNumber: 1, LapTimeMS: 91000, Sector1MS: 28500, Sector2MS: 34500, Sector3MS: 28000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 318.0, TyreCompound: "SOFT", Stint: 1},
		{SessionID: 1, CarIndex: 3, LapNumber: 2, LapTimeMS: 0, ResultStatus: int(packets.ResultStatusDNF), TyreCompound: "SOFT", Stint: 1},
		// Perez laps (DSQ on lap 2)
		{SessionID: 1, CarIndex: 4, LapNumber: 1, LapTimeMS: 91500, Sector1MS: 28700, Sector2MS: 34700, Sector3MS: 28100, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, MaxSpeedKMH: 315.0, TyreCompound: "SOFT", Stint: 1},
		{SessionID: 1, CarIndex: 4, LapNumber: 2, LapTimeMS: 0, ResultStatus: int(packets.ResultStatusDSQ), TyreCompound: "SOFT", Stint: 1},
	}

	resp := computeSessionClassification(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if len(resp.Standings) != 5 {
		t.Fatalf("expected 5 standings, got %d", len(resp.Standings))
	}

	// P1: Max Verstappen
	p1 := resp.Standings[0]
	if p1.DriverName != "Max Verstappen" || p1.Position != 1 {
		t.Errorf("expected P1 Max Verstappen, got P%d %s", p1.Position, p1.DriverName)
	}
	if p1.PositionsGained == nil || *p1.PositionsGained != 1 {
		t.Errorf("expected Grid 2 -> Finish 1 (+1 gained), got %v", p1.PositionsGained)
	}

	// P2: Lewis Hamilton
	p2 := resp.Standings[1]
	if p2.DriverName != "Lewis Hamilton" || p2.Position != 2 {
		t.Errorf("expected P2 Lewis Hamilton, got P%d %s", p2.Position, p2.DriverName)
	}
	if p2.PenaltySeconds != 5 {
		t.Errorf("expected 5s penalty for Hamilton, got %d", p2.PenaltySeconds)
	}

	// Norris should be DNF
	var norris *DriverStanding
	for i := range resp.Standings {
		if resp.Standings[i].DriverName == "Lando Norris" {
			norris = &resp.Standings[i]
		}
	}
	if norris == nil || !norris.IsDNF {
		t.Errorf("expected Norris to be marked DNF, got %+v", norris)
	}

	// Perez should be DSQ and ranked last
	p5 := resp.Standings[4]
	if p5.DriverName != "Sergio Perez" || !p5.IsDSQ {
		t.Errorf("expected Perez to be DSQ and last, got P%d %s (isDSQ: %v)", p5.Position, p5.DriverName, p5.IsDSQ)
	}

	// Sector Records
	if resp.SessionBestS1MS != 27300 {
		t.Errorf("expected session best S1 27300, got %d", resp.SessionBestS1MS)
	}
	if resp.SessionBestS2MS != 33500 {
		t.Errorf("expected session best S2 33500, got %d", resp.SessionBestS2MS)
	}
	if resp.SessionBestS3MS != 27000 {
		t.Errorf("expected session best S3 27000, got %d", resp.SessionBestS3MS)
	}
	if resp.UltimateTheoreticalMS != 27300+33500+27000 {
		t.Errorf("expected ultimate theoretical %d, got %d", 27300+33500+27000, resp.UltimateTheoreticalMS)
	}

	// Actual Best Lap
	if resp.ActualBestLapMS != 87800 || resp.ActualBestLapDriver != "Lewis Hamilton" {
		t.Errorf("expected actual best lap 87800 (Lewis Hamilton), got %d (%s)", resp.ActualBestLapMS, resp.ActualBestLapDriver)
	}

	// Speed rankings
	if len(resp.SpeedRankings) != 5 {
		t.Fatalf("expected 5 speed rankings, got %d", len(resp.SpeedRankings))
	}
	if resp.SpeedRankings[0].DriverName != "Max Verstappen" || resp.SpeedRankings[0].MaxSpeed != 330.0 {
		t.Errorf("expected top speed 330.0 (Max Verstappen), got %.1f (%s)", resp.SpeedRankings[0].MaxSpeed, resp.SpeedRankings[0].DriverName)
	}
}

func TestComputeSessionClassification_Qualifying(t *testing.T) {
	session := &storage.Session{
		ID:          2,
		TrackName:   "Monaco",
		SessionType: "Qualifying",
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1},
		{CarIndex: 1, Name: "Charles Leclerc", DriverID: 3, TeamID: 1, RaceNumber: 16},
		{CarIndex: 2, Name: "Lando Norris", DriverID: 4, TeamID: 8, RaceNumber: 4},
	}

	laps := []storage.Lap{
		// Verstappen: best valid lap 72000
		{SessionID: 2, CarIndex: 0, LapNumber: 1, LapTimeMS: 72500, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, Sector1MS: 19000, Sector2MS: 33000, Sector3MS: 20500},
		{SessionID: 2, CarIndex: 0, LapNumber: 2, LapTimeMS: 72000, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, Sector1MS: 18800, Sector2MS: 32800, Sector3MS: 20400},
		// Leclerc: best valid lap 71500 (Pole)
		{SessionID: 2, CarIndex: 1, LapNumber: 1, LapTimeMS: 71500, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, Sector1MS: 18600, Sector2MS: 32700, Sector3MS: 20200},
		{SessionID: 2, CarIndex: 1, LapNumber: 2, LapTimeMS: 71000, IsValid: false, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, Sector1MS: 18400, Sector2MS: 32400, Sector3MS: 20200}, // Track limits
		// Norris: best valid lap 72800
		{SessionID: 2, CarIndex: 2, LapNumber: 1, LapTimeMS: 72800, IsValid: true, Sector1Valid: true, Sector2Valid: true, Sector3Valid: true, Sector1MS: 19200, Sector2MS: 33100, Sector3MS: 20500},
	}

	resp := computeSessionClassification(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	// In qualifying: P1 should be Leclerc (71.5s vs 72.0s vs 72.8s)
	if resp.Standings[0].DriverName != "Charles Leclerc" || resp.Standings[0].Position != 1 {
		t.Errorf("expected P1 Charles Leclerc, got P%d %s", resp.Standings[0].Position, resp.Standings[0].DriverName)
	}
	if resp.Standings[1].DriverName != "Max Verstappen" || resp.Standings[1].Position != 2 {
		t.Errorf("expected P2 Max Verstappen, got P%d %s", resp.Standings[1].Position, resp.Standings[1].DriverName)
	}
	if resp.Standings[2].DriverName != "Lando Norris" || resp.Standings[2].Position != 3 {
		t.Errorf("expected P3 Lando Norris, got P%d %s", resp.Standings[2].Position, resp.Standings[2].DriverName)
	}

	// Gap to Pole: Leclerc 0ms, Verstappen +500ms, Norris +1300ms
	if resp.Standings[1].GapToLeaderMS != 500 {
		t.Errorf("expected Verstappen gap to pole +500ms, got %d", resp.Standings[1].GapToLeaderMS)
	}
	if resp.Standings[2].GapToLeaderMS != 1300 {
		t.Errorf("expected Norris gap to pole +1300ms, got %d", resp.Standings[2].GapToLeaderMS)
	}
}

func TestHandleGetSessionClassification_Endpoint(t *testing.T) {
	server, repo := setupTestServer(t)
	ctx := context.Background()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(999999),
		TrackID:      3,
		TrackName:    "Bahrain",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	participants := []storage.Participant{
		{CarIndex: 0, Name: "Oscar Piastri", DriverID: 112, TeamID: 8, RaceNumber: 81, AIControlled: false},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	lap := &storage.Lap{
		SessionID:    session.ID,
		CarIndex:     0,
		LapNumber:    1,
		LapTimeMS:    92000,
		Sector1MS:    29000,
		Sector2MS:    35000,
		Sector3MS:    28000,
		IsValid:      true,
		Sector1Valid: true,
		Sector2Valid: true,
		Sector3Valid: true,
		MaxSpeedKMH:  320.0,
		TyreCompound: "SOFT",
	}
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("failed to save lap: %v", err)
	}

	t.Run("valid session classification returns 200 OK", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/sessions/%d/classification", session.ID), http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp ClassificationResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse JSON: %v", err)
		}

		if len(resp.Standings) != 1 {
			t.Fatalf("expected 1 standing, got %d", len(resp.Standings))
		}
		if resp.Standings[0].DriverName != "Oscar Piastri" {
			t.Errorf("expected Oscar Piastri, got %s", resp.Standings[0].DriverName)
		}
	})

	t.Run("non-existent session returns 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/sessions/9999/classification", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})

	t.Run("invalid session ID returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/sessions/abc/classification", http.NoBody)
		rec := httptest.NewRecorder()
		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})
}

func TestComputeSessionClassification_DNFWithResultReasonFinished(t *testing.T) {
	session := &storage.Session{
		ID:          10,
		TrackName:   "Zandvoort",
		SessionType: "Race",
		TotalLaps:   36,
	}

	participants := []storage.Participant{
		// P1 Winner: 36 laps completed, Finished
		{CarIndex: 0, Name: "Winner", DriverID: 1, TeamID: 1, RaceNumber: 1, Position: 1, TotalRaceTime: 3000.0, ResultReason: int(packets.ResultReasonFinished), ResultStatus: int(packets.ResultStatusFinished)},
		// P2 Lapped finisher: 35 laps completed, Finished (+1 lap)
		{CarIndex: 1, Name: "Lapped Finisher", DriverID: 2, TeamID: 2, RaceNumber: 2, Position: 2, TotalRaceTime: 3050.0, ResultReason: int(packets.ResultReasonFinished), ResultStatus: int(packets.ResultStatusFinished)},
		// P3 DNF with ResultStatus DNF and ResultReason Finished (e.g. disconnected or retired without terminal damage)
		{CarIndex: 2, Name: "Disconnect Driver", DriverID: 3, TeamID: 3, RaceNumber: 3, Position: 3, TotalRaceTime: 2000.0, ResultReason: int(packets.ResultReasonFinished), ResultStatus: int(packets.ResultStatusDNF)},
		// P4 Retired with ResultStatus Retired and ResultReason Finished
		{CarIndex: 3, Name: "Box Retire Driver", DriverID: 4, TeamID: 4, RaceNumber: 4, Position: 4, TotalRaceTime: 2500.0, ResultReason: int(packets.ResultReasonFinished), ResultStatus: int(packets.ResultStatusRetired)},
		// P5 Crash DNF with ResultStatus DNF and ResultReason TerminalDamage
		{CarIndex: 4, Name: "Crash Driver", DriverID: 5, TeamID: 5, RaceNumber: 5, Position: 5, TotalRaceTime: 1500.0, ResultReason: int(packets.ResultReasonTerminalDamage), ResultStatus: int(packets.ResultStatusDNF)},
	}

	laps := []storage.Lap{
		// Winner (36 laps)
		{SessionID: 10, CarIndex: 0, LapNumber: 1, LapTimeMS: 80000, IsValid: true, ResultStatus: int(packets.ResultStatusFinished)},
		{SessionID: 10, CarIndex: 0, LapNumber: 36, LapTimeMS: 80000, IsValid: true, ResultStatus: int(packets.ResultStatusFinished)},
		// Lapped Finisher (35 laps)
		{SessionID: 10, CarIndex: 1, LapNumber: 1, LapTimeMS: 81000, IsValid: true, ResultStatus: int(packets.ResultStatusFinished)},
		{SessionID: 10, CarIndex: 1, LapNumber: 35, LapTimeMS: 81000, IsValid: true, ResultStatus: int(packets.ResultStatusFinished)},
		// Disconnect Driver (20 laps completed, lap 21 DNF with 0ms)
		{SessionID: 10, CarIndex: 2, LapNumber: 1, LapTimeMS: 82000, IsValid: true, ResultStatus: int(packets.ResultStatusDNF)},
		{SessionID: 10, CarIndex: 2, LapNumber: 21, LapTimeMS: 0, IsValid: false, ResultStatus: int(packets.ResultStatusDNF)},
		// Box Retire Driver (30 laps completed, lap 31 Retired with 0ms)
		{SessionID: 10, CarIndex: 3, LapNumber: 1, LapTimeMS: 82000, IsValid: true, ResultStatus: int(packets.ResultStatusRetired)},
		{SessionID: 10, CarIndex: 3, LapNumber: 31, LapTimeMS: 0, IsValid: false, ResultStatus: int(packets.ResultStatusRetired)},
		// Crash Driver (10 laps completed, lap 11 DNF with 0ms)
		{SessionID: 10, CarIndex: 4, LapNumber: 1, LapTimeMS: 83000, IsValid: true, ResultStatus: int(packets.ResultStatusDNF)},
		{SessionID: 10, CarIndex: 4, LapNumber: 11, LapTimeMS: 0, IsValid: false, ResultStatus: int(packets.ResultStatusDNF)},
	}

	resp := computeSessionClassification(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if len(resp.Standings) != 5 {
		t.Fatalf("expected 5 standings, got %d", len(resp.Standings))
	}

	// Winner: Finished, not DNF
	if resp.Standings[0].DriverName != "Winner" || resp.Standings[0].IsDNF {
		t.Errorf("Winner should be P1 and not DNF, got P%d (isDNF: %v)", resp.Standings[0].Position, resp.Standings[0].IsDNF)
	}

	// Lapped Finisher: Finished, not DNF
	if resp.Standings[1].DriverName != "Lapped Finisher" || resp.Standings[1].IsDNF {
		t.Errorf("Lapped Finisher should be P2 and not DNF, got P%d (isDNF: %v)", resp.Standings[1].Position, resp.Standings[1].IsDNF)
	}

	// All remaining 3 drivers MUST be marked DNF
	for i := 2; i < 5; i++ {
		if !resp.Standings[i].IsDNF {
			t.Errorf("Standings[%d] %s expected IsDNF=true, got IsDNF=false", i, resp.Standings[i].DriverName)
		}
	}
}

func TestComputeSessionClassification_RealSession28(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository("../../f1telemetry.db")
	if err != nil {
		t.Skip("f1telemetry.db not found or not accessible, skipping real session test")
	}

	session, err := repo.GetSessionByID(ctx, 28)
	if err != nil {
		t.Skip("Session 28 not found in f1telemetry.db")
	}

	participants, err := repo.GetParticipantsBySession(ctx, 28)
	if err != nil {
		t.Fatalf("failed to get participants: %v", err)
	}

	laps, err := repo.GetLapsBySession(ctx, 28, nil)
	if err != nil {
		t.Fatalf("failed to get laps: %v", err)
	}

	resp := computeSessionClassification(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if len(resp.Standings) != 20 {
		t.Fatalf("expected 20 drivers in session 28, got %d", len(resp.Standings))
	}

	// P1 to P10 MUST be NOT DNF (all completed 36 laps)
	for i := 0; i < 10; i++ {
		st := resp.Standings[i]
		if st.IsDNF {
			t.Errorf("P%d (%s) expected IsDNF=false, got true", st.Position, st.DriverName)
		}
	}

	// P11 to P20 MUST be DNF for all non-finishing drivers
	for i := 10; i < 20; i++ {
		st := resp.Standings[i]
		if !st.IsDNF {
			t.Errorf("P%d (%s) expected IsDNF=true, got false", st.Position, st.DriverName)
		}
	}
}

func TestComputeSessionClassification_RealSession30(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository("../../f1telemetry.db")
	if err != nil {
		t.Skip("f1telemetry.db not found or not accessible, skipping real session test")
	}

	session, err := repo.GetSessionByID(ctx, 30)
	if err != nil {
		t.Skip("Session 30 not found in f1telemetry.db")
	}

	participants, err := repo.GetParticipantsBySession(ctx, 30)
	if err != nil {
		t.Fatalf("failed to get participants: %v", err)
	}

	laps, err := repo.GetLapsBySession(ctx, 30, nil)
	if err != nil {
		t.Fatalf("failed to get laps: %v", err)
	}

	resp := computeSessionClassification(session, participants, laps)
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	if len(resp.Standings) != 15 {
		t.Fatalf("expected 15 active drivers in session 30, got %d", len(resp.Standings))
	}

	// P1 to P10 MUST be NOT DNF (including Gaby-Fullmetal at P10 who finished lapped)
	for i := 0; i < 10; i++ {
		st := resp.Standings[i]
		if st.IsDNF {
			t.Errorf("P%d (%s) expected IsDNF=false, got true", st.Position, st.DriverName)
		}
	}

	// P11 to P15 MUST be DNF (ENT Weighted, RLS_Rafuxo666, RLS_EdoPizarro, Griziem, HRL DocBryan)
	for i := 10; i < 15; i++ {
		st := resp.Standings[i]
		if !st.IsDNF {
			t.Errorf("P%d (%s) expected IsDNF=true, got false", st.Position, st.DriverName)
		}
	}
}
