package storage

import (
	"context"
	"testing"
)

func setupTestRepo(t *testing.T) *Repository {
	t.Helper()
	repo, err := NewRepository("file::memory:?cache=shared&_busy_timeout=5000")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	t.Cleanup(func() { repo.Close() })
	return repo
}

func createTestSession(t *testing.T, repo *Repository) *Session {
	t.Helper()
	ctx := context.Background()
	s := &Session{
		SessionUID:   123456789,
		TrackID:      11,
		TrackName:    "Monza",
		SessionType:  "Race",
		Weather:      "Clear",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, s); err != nil {
		t.Fatalf("failed to create test session: %v", err)
	}
	return s
}

func TestSaveParticipants(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	tests := []struct {
		name         string
		participants []Participant
		wantErr      bool
		wantCount    int
	}{
		{
			name:         "empty slice is no-op",
			participants: []Participant{},
			wantErr:      false,
			wantCount:    0,
		},
		{
			name: "insert two participants",
			participants: []Participant{
				{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 1, RaceNumber: 1, AIControlled: false, Nationality: 5},
				{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, AIControlled: false, Nationality: 12},
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "upsert updates existing participants",
			participants: []Participant{
				{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, AIControlled: false, Nationality: 5},
				{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 3, RaceNumber: 44, AIControlled: true, Nationality: 12},
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "add more participants",
			participants: []Participant{
				{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 2, RaceNumber: 1, AIControlled: false, Nationality: 5},
				{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 3, RaceNumber: 44, AIControlled: true, Nationality: 12},
				{CarIndex: 2, Name: "Charles Leclerc", DriverID: 3, TeamID: 4, RaceNumber: 16, AIControlled: true, Nationality: 18},
			},
			wantErr:   false,
			wantCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := repo.SaveParticipants(ctx, session.ID, tt.participants)
			if (err != nil) != tt.wantErr {
				t.Errorf("SaveParticipants() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				got, err := repo.GetParticipantsBySession(ctx, session.ID)
				if err != nil {
					t.Fatalf("GetParticipantsBySession() error = %v", err)
				}
				if len(got) != tt.wantCount {
					t.Errorf("expected %d participants, got %d", tt.wantCount, len(got))
				}
			}
		})
	}
}

func TestGetParticipantsBySession(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// Insert participants out of order to verify ordering
	participants := []Participant{
		{CarIndex: 2, Name: "Charles Leclerc", DriverID: 3, TeamID: 4, RaceNumber: 16, AIControlled: true, Nationality: 18},
		{CarIndex: 0, Name: "Max Verstappen", DriverID: 1, TeamID: 1, RaceNumber: 1, AIControlled: false, Nationality: 5},
		{CarIndex: 1, Name: "Lewis Hamilton", DriverID: 2, TeamID: 0, RaceNumber: 44, AIControlled: false, Nationality: 12},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("SaveParticipants() error = %v", err)
	}

	got, err := repo.GetParticipantsBySession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetParticipantsBySession() error = %v", err)
	}

	// Verify count
	if len(got) != 3 {
		t.Fatalf("expected 3 participants, got %d", len(got))
	}

	// Verify ordering by car_index
	expectedOrder := []int{0, 1, 2}
	for i, p := range got {
		if p.CarIndex != expectedOrder[i] {
			t.Errorf("participant[%d] car_index = %d, want %d", i, p.CarIndex, expectedOrder[i])
		}
	}

	// Verify field mapping
	if got[0].Name != "Max Verstappen" {
		t.Errorf("participant[0] name = %q, want %q", got[0].Name, "Max Verstappen")
	}
	if got[0].RaceNumber != 1 {
		t.Errorf("participant[0] race_number = %d, want 1", got[0].RaceNumber)
	}
	if got[0].AIControlled != false {
		t.Errorf("participant[0] ai_controlled = %v, want false", got[0].AIControlled)
	}
	if got[2].AIControlled != true {
		t.Errorf("participant[2] ai_controlled = %v, want true", got[2].AIControlled)
	}

	// Verify empty result for non-existent session
	empty, err := repo.GetParticipantsBySession(ctx, 9999)
	if err != nil {
		t.Fatalf("GetParticipantsBySession() error for empty = %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected 0 participants for non-existent session, got %d", len(empty))
	}
}

func TestSaveLapWithCarIndex(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	tests := []struct {
		name    string
		lap     *Lap
		wantErr bool
	}{
		{
			name: "lap with car_index 0",
			lap: &Lap{
				SessionID: session.ID,
				CarIndex:  0,
				LapNumber: 1,
				LapTimeMS: 85000,
				Sector1MS: 28000,
				Sector2MS: 27000,
				Sector3MS: 30000,
				IsValid:   true,
			},
			wantErr: false,
		},
		{
			name: "same lap number different car_index",
			lap: &Lap{
				SessionID: session.ID,
				CarIndex:  1,
				LapNumber: 1,
				LapTimeMS: 86000,
				Sector1MS: 29000,
				Sector2MS: 27500,
				Sector3MS: 29500,
				IsValid:   true,
			},
			wantErr: false,
		},
		{
			name: "upsert same car_index and lap_number",
			lap: &Lap{
				SessionID: session.ID,
				CarIndex:  0,
				LapNumber: 1,
				LapTimeMS: 84000,
				Sector1MS: 27000,
				Sector2MS: 27000,
				Sector3MS: 30000,
				IsValid:   true,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := repo.SaveLap(ctx, tt.lap)
			if (err != nil) != tt.wantErr {
				t.Errorf("SaveLap() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && tt.lap.ID == 0 {
				t.Error("expected lap ID to be set")
			}
		})
	}

	// Verify both laps exist (different car_index, same lap_number)
	laps, err := repo.GetLapsBySession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetLapsBySession() error = %v", err)
	}
	if len(laps) != 2 {
		t.Errorf("expected 2 laps (different car indices), got %d", len(laps))
	}
}

func TestSaveAndGetTelemetryWithERS(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	lap := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 80000,
	}
	if err := repo.SaveLap(ctx, lap); err != nil {
		t.Fatalf("SaveLap() error = %v", err)
	}

	samples := []TelemetrySample{
		{
			LapID:          lap.ID,
			LapDistance:    100.5,
			SessionTime:    12.34,
			Speed:          250,
			Throttle:       1.0,
			Brake:          0.0,
			Steer:          -0.1,
			Gear:           6,
			EngineRPM:      11500,
			DRS:            true,
			ERSDeploy:      150000.0,
			ERSStoreEnergy: 85.5,
			ERSDeployMode:  2, // Hotlap
			WorldPosX:      10.0,
			WorldPosY:      2.0,
			WorldPosZ:      15.0,
		},
	}

	if err := repo.SaveTelemetryBatch(ctx, samples); err != nil {
		t.Fatalf("SaveTelemetryBatch() error = %v", err)
	}

	retrieved, err := repo.GetTelemetryByLap(ctx, lap.ID)
	if err != nil {
		t.Fatalf("GetTelemetryByLap() error = %v", err)
	}

	if len(retrieved) != 1 {
		t.Fatalf("expected 1 telemetry sample, got %d", len(retrieved))
	}

	if retrieved[0].ERSStoreEnergy != 85.5 {
		t.Errorf("expected ERSStoreEnergy 85.5, got %f", retrieved[0].ERSStoreEnergy)
	}

	if retrieved[0].ERSDeployMode != 2 {
		t.Errorf("expected ERSDeployMode 2, got %d", retrieved[0].ERSDeployMode)
	}
}
