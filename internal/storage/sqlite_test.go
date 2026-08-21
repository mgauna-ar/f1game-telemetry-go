package storage

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"
)

func setupTestRepo(t *testing.T) *Repository {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_%d.db", time.Now().UnixNano()))
	repo, err := NewRepository(dbPath)
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
		SessionUID:   FormatSessionUID(123456789),
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
			err := repo.SaveLap(ctx, tt.lap, false)
			if (err != nil) != tt.wantErr {
				t.Errorf("SaveLap() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && tt.lap.ID == 0 {
				t.Error("expected lap ID to be set")
			}
		})
	}

	// Verify both laps exist (different car_index, same lap_number)
	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
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
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("SaveLap() error = %v", err)
	}

	samples := []TelemetrySample{
		{
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

	if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
		t.Fatalf("SaveLapTelemetryBlob() error = %v", err)
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

func TestDeleteSession(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// 1. Add participants
	participants := []Participant{
		{CarIndex: 0, Name: "Driver 1", DriverID: 1, TeamID: 1, RaceNumber: 1, AIControlled: false},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("SaveParticipants error: %v", err)
	}

	// 2. Add lap
	lap := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 90000,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("SaveLap error: %v", err)
	}

	// 3. Add telemetry samples
	samples := []TelemetrySample{
		{LapDistance: 100.0, SessionTime: 10.0, Speed: 250},
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
		t.Fatalf("SaveLapTelemetryBlob error: %v", err)
	}

	// Delete existing session
	if err := repo.DeleteSession(ctx, session.ID); err != nil {
		t.Fatalf("DeleteSession() failed: %v", err)
	}

	// Verify session is deleted
	sessions, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions() error: %v", err)
	}
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(sessions))
	}

	// Verify participants are deleted
	parts, err := repo.GetParticipantsBySession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetParticipantsBySession() error: %v", err)
	}
	if len(parts) != 0 {
		t.Errorf("expected 0 participants, got %d", len(parts))
	}

	// Verify laps are deleted
	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("GetLapsBySession() error: %v", err)
	}
	if len(laps) != 0 {
		t.Errorf("expected 0 laps, got %d", len(laps))
	}

	// Verify telemetry samples are deleted
	telemetry, err := repo.GetTelemetryByLap(ctx, lap.ID)
	if err != nil {
		t.Fatalf("GetTelemetryByLap() error: %v", err)
	}
	if len(telemetry) != 0 {
		t.Errorf("expected 0 telemetry samples, got %d", len(telemetry))
	}

	// Deleting a non-existent session should return error
	if err := repo.DeleteSession(ctx, 99999); err == nil {
		t.Errorf("expected error deleting non-existent session, got nil")
	}
}

func TestExportAndImportSession(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// Add tag
	tag := &Tag{Name: "League Race", Color: "#ff0000"}
	if err := repo.CreateTag(ctx, tag); err != nil {
		t.Fatalf("CreateTag error: %v", err)
	}
	if err := repo.AddTagToSession(ctx, session.ID, tag.ID); err != nil {
		t.Fatalf("AddTagToSession error: %v", err)
	}

	// Add participants
	participants := []Participant{
		{CarIndex: 0, Name: "Ayrton Senna", DriverID: 12, TeamID: 5, RaceNumber: 12, AIControlled: false},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("SaveParticipants error: %v", err)
	}

	// Add lap
	lap := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 78500,
		Sector1MS: 26000,
		Sector2MS: 26500,
		Sector3MS: 26000,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("SaveLap error: %v", err)
	}

	// Add telemetry
	samples := []TelemetrySample{
		{LapDistance: 50.0, SessionTime: 5.0, Speed: 290, Throttle: 1.0, Gear: 7},
		{LapDistance: 150.0, SessionTime: 7.0, Speed: 310, Throttle: 1.0, Gear: 8},
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap.ID, samples); err != nil {
		t.Fatalf("SaveLapTelemetryBlob error: %v", err)
	}

	// 1. Export session
	pkg, err := repo.ExportSession(ctx, session.ID)
	if err != nil {
		t.Fatalf("ExportSession failed: %v", err)
	}

	if pkg.Session.TrackName != "Monza" {
		t.Errorf("expected TrackName Monza, got %s", pkg.Session.TrackName)
	}
	if len(pkg.Tags) != 1 || pkg.Tags[0].Name != "League Race" {
		t.Errorf("expected 1 tag League Race, got %v", pkg.Tags)
	}
	if len(pkg.Participants) != 1 || pkg.Participants[0].Name != "Ayrton Senna" {
		t.Errorf("expected participant Ayrton Senna, got %v", pkg.Participants)
	}
	if len(pkg.Laps) != 1 || len(pkg.Laps[0].Telemetry) != 2 {
		t.Errorf("expected 1 lap with 2 telemetry samples, got %v", pkg.Laps)
	}

	// 2. Import session into a fresh repo
	freshRepo := setupTestRepo(t)
	importedID, err := freshRepo.ImportSession(ctx, pkg)
	if err != nil {
		t.Fatalf("ImportSession failed: %v", err)
	}
	if importedID <= 0 {
		t.Fatalf("expected valid imported session ID, got %d", importedID)
	}

	// Verify imported data
	importedSession, err := freshRepo.GetSessionByID(ctx, importedID)
	if err != nil {
		t.Fatalf("GetSessionByID failed: %v", err)
	}
	if importedSession.TrackName != "Monza" {
		t.Errorf("expected imported session track Monza, got %s", importedSession.TrackName)
	}
	if len(importedSession.Tags) != 1 || importedSession.Tags[0].Name != "League Race" {
		t.Errorf("expected imported session tag League Race, got %v", importedSession.Tags)
	}

	importedLaps, err := freshRepo.GetLapsBySession(ctx, importedID, nil)
	if err != nil || len(importedLaps) != 1 {
		t.Fatalf("expected 1 imported lap, got %v (err: %v)", importedLaps, err)
	}

	importedTelemetry, err := freshRepo.GetTelemetryByLap(ctx, importedLaps[0].ID)
	if err != nil || len(importedTelemetry) != 2 {
		t.Fatalf("expected 2 imported telemetry samples, got %v (err: %v)", importedTelemetry, err)
	}
	if importedTelemetry[0].Speed != 290 || importedTelemetry[1].Speed != 310 {
		t.Errorf("expected speeds 290 and 310, got %d and %d", importedTelemetry[0].Speed, importedTelemetry[1].Speed)
	}
}

func TestUpdateSessionMetadataDynamicWeather(t *testing.T) {
	repo := setupTestRepo(t)
	ctx := context.Background()

	// Initial session with unknown info
	uid := FormatSessionUID(99887766)
	s := &Session{
		SessionUID:   uid,
		TrackID:      -1,
		TrackName:    "Unknown",
		SessionType:  "Unknown",
		Weather:      "Unknown",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, s); err != nil {
		t.Fatalf("failed to save initial session: %v", err)
	}

	// 1. Resolve from Unknown to Monza / Race / Heavy Rain with totalLaps 53, difficulty 95, duration 3600
	if err := repo.UpdateSessionMetadata(ctx, uid, 11, "Monza", "Race", "Heavy Rain", "", 53, 95, 3600); err != nil {
		t.Fatalf("UpdateSessionMetadata failed: %v", err)
	}

	sessions, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].TrackName != "Monza" || sessions[0].SessionType != "Race" || sessions[0].Weather != "Heavy Rain" {
		t.Errorf("expected Monza/Race/Heavy Rain, got %s/%s/%s", sessions[0].TrackName, sessions[0].SessionType, sessions[0].Weather)
	}
	if sessions[0].TotalLaps != 53 || sessions[0].AIDifficulty != 95 || sessions[0].SessionDuration != 3600 {
		t.Errorf("expected 53 laps / 95 diff / 3600 duration, got %d/%d/%d", sessions[0].TotalLaps, sessions[0].AIDifficulty, sessions[0].SessionDuration)
	}

	// 2. Weather updates throughout race to "Light Rain" with forecast JSON (initial weather "Heavy Rain" preserved)
	forecastJSON := `[{"TimeOffset":5,"Weather":3,"RainPercentage":60}]`
	if err := repo.UpdateSessionMetadata(ctx, uid, 11, "Monza", "Race", "Light Rain", forecastJSON, 0, 0, 0); err != nil {
		t.Fatalf("UpdateSessionMetadata dynamic weather failed: %v", err)
	}

	sessionsAfter, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	if sessionsAfter[0].Weather != "Heavy Rain" {
		t.Errorf("expected initial weather Heavy Rain to be preserved, got %s", sessionsAfter[0].Weather)
	}
	if sessionsAfter[0].WeatherForecast != forecastJSON {
		t.Errorf("expected weather forecast %s, got %s", forecastJSON, sessionsAfter[0].WeatherForecast)
	}
	if sessionsAfter[0].TrackName != "Monza" {
		t.Errorf("expected track name to remain Monza, got %s", sessionsAfter[0].TrackName)
	}
	if sessionsAfter[0].TotalLaps != 53 || sessionsAfter[0].AIDifficulty != 95 {
		t.Errorf("expected laps and difficulty to be preserved")
	}
}

func TestLapSector3DerivationAndHistoryEntry(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// 1. Save lap with lap_time, S1, S2 but Sector3MS == 0
	lap := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 85913,
		Sector1MS: 31646,
		Sector2MS: 28724,
		Sector3MS: 0,
		IsValid:   true,
	}

	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("SaveLap failed: %v", err)
	}

	// 2. GetLapByID should derive Sector3MS = 85913 - (31646 + 28724) = 25543
	savedLap, err := repo.GetLapByID(ctx, lap.ID)
	if err != nil {
		t.Fatalf("GetLapByID failed: %v", err)
	}
	expectedS3 := 85913 - (31646 + 28724)
	if savedLap.Sector3MS != expectedS3 {
		t.Errorf("expected derived Sector3MS %d, got %d", expectedS3, savedLap.Sector3MS)
	}

	// 3. GetLapsBySession should also return the derived Sector3MS
	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("GetLapsBySession failed: %v", err)
	}
	if len(laps) != 1 || laps[0].Sector3MS != expectedS3 {
		t.Errorf("expected GetLapsBySession Sector3MS %d, got %d", expectedS3, laps[0].Sector3MS)
	}

	// 4. SaveLap in mergeMode (historyLap) updates/upserts official history
	historyLap := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 2,
		LapTimeMS: 84500,
		Sector1MS: 31000,
		Sector2MS: 28000,
		Sector3MS: 25500,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, historyLap, true); err != nil {
		t.Fatalf("SaveLap with mergeMode failed: %v", err)
	}

	historySaved, err := repo.GetLapByID(ctx, historyLap.ID)
	if err != nil {
		t.Fatalf("GetLapByID for history lap failed: %v", err)
	}
	if historySaved.Sector3MS != 25500 {
		t.Errorf("expected history Sector3MS 25500, got %d", historySaved.Sector3MS)
	}
}

func TestTagOperations(t *testing.T) {
	repo := setupTestRepo(t)
	session1 := createTestSession(t, repo)
	ctx := context.Background()

	// 1. Create a second session
	session2 := &Session{
		SessionUID:   FormatSessionUID(987654321),
		TrackID:      12,
		TrackName:    "Spa",
		SessionType:  "Race",
		Weather:      "Rain",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session2); err != nil {
		t.Fatalf("failed to create session2: %v", err)
	}

	// 2. Create Tags
	tag1 := &Tag{Name: "WOR League", Color: "#ef4444"}
	tag2 := &Tag{Name: "Tier 1", Color: "#06b6d4"}
	tag3 := &Tag{Name: "Setup Test", Color: "#10b981"}

	if err := repo.CreateTag(ctx, tag1); err != nil {
		t.Fatalf("CreateTag tag1 failed: %v", err)
	}
	if err := repo.CreateTag(ctx, tag2); err != nil {
		t.Fatalf("CreateTag tag2 failed: %v", err)
	}
	if err := repo.CreateTag(ctx, tag3); err != nil {
		t.Fatalf("CreateTag tag3 failed: %v", err)
	}

	if tag1.ID == 0 || tag2.ID == 0 || tag3.ID == 0 {
		t.Errorf("expected non-zero IDs for tags, got %d, %d, %d", tag1.ID, tag2.ID, tag3.ID)
	}

	// 3. GetAllTags
	tags, err := repo.GetAllTags(ctx)
	if err != nil {
		t.Fatalf("GetAllTags failed: %v", err)
	}
	if len(tags) != 3 {
		t.Errorf("expected 3 tags, got %d", len(tags))
	}

	// 4. UpdateTag
	tag1.Color = "#f97316"
	tag1.Name = "WOR Championship"
	if err := repo.UpdateTag(ctx, tag1); err != nil {
		t.Fatalf("UpdateTag failed: %v", err)
	}

	// 5. AddTagToSession
	if err := repo.AddTagToSession(ctx, session1.ID, tag1.ID); err != nil {
		t.Fatalf("AddTagToSession tag1 failed: %v", err)
	}
	if err := repo.AddTagToSession(ctx, session1.ID, tag2.ID); err != nil {
		t.Fatalf("AddTagToSession tag2 failed: %v", err)
	}

	// 6. GetTagsBySession
	s1Tags, err := repo.GetTagsBySession(ctx, session1.ID)
	if err != nil {
		t.Fatalf("GetTagsBySession failed: %v", err)
	}
	if len(s1Tags) != 2 {
		t.Fatalf("expected 2 tags for session1, got %d", len(s1Tags))
	}

	// 7. GetSessions should include tags
	allSessions, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	for _, s := range allSessions {
		switch s.ID {
		case session1.ID:
			if len(s.Tags) != 2 {
				t.Errorf("expected session1 to have 2 tags in GetSessions, got %d", len(s.Tags))
			}
		case session2.ID:
			if len(s.Tags) != 0 {
				t.Errorf("expected session2 to have 0 tags, got %d", len(s.Tags))
			}
		}
	}

	// 8. SetSessionTags (sync)
	if err := repo.SetSessionTags(ctx, session2.ID, []int64{tag3.ID}); err != nil {
		t.Fatalf("SetSessionTags failed: %v", err)
	}
	s2Tags, err := repo.GetTagsBySession(ctx, session2.ID)
	if err != nil {
		t.Fatalf("GetTagsBySession s2 failed: %v", err)
	}
	if len(s2Tags) != 1 || s2Tags[0].ID != tag3.ID {
		t.Errorf("expected session2 to have tag3, got %v", s2Tags)
	}

	// 9. RemoveTagFromSession
	if err := repo.RemoveTagFromSession(ctx, session1.ID, tag1.ID); err != nil {
		t.Fatalf("RemoveTagFromSession failed: %v", err)
	}
	s1TagsAfter, err := repo.GetTagsBySession(ctx, session1.ID)
	if err != nil {
		t.Fatalf("GetTagsBySession failed: %v", err)
	}
	if len(s1TagsAfter) != 1 || s1TagsAfter[0].ID != tag2.ID {
		t.Errorf("expected session1 to have only tag2, got %v", s1TagsAfter)
	}

	// 10. DeleteTag
	if err := repo.DeleteTag(ctx, tag2.ID); err != nil {
		t.Fatalf("DeleteTag failed: %v", err)
	}
	tagsAfterDelete, _ := repo.GetAllTags(ctx)
	if len(tagsAfterDelete) != 2 {
		t.Errorf("expected 2 tags after delete, got %d", len(tagsAfterDelete))
	}

	// 11. DeleteSession cascades cleanly
	if err := repo.DeleteSession(ctx, session2.ID); err != nil {
		t.Fatalf("DeleteSession failed: %v", err)
	}
}

func TestDeriveSector3(t *testing.T) {
	tests := []struct {
		name     string
		lap      *Lap
		expected int
	}{
		{
			name:     "nil lap does not panic",
			lap:      nil,
			expected: 0,
		},
		{
			name: "derives sector 3 when sector3 is 0",
			lap: &Lap{
				LapTimeMS: 85000,
				Sector1MS: 28000,
				Sector2MS: 27000,
				Sector3MS: 0,
			},
			expected: 30000,
		},
		{
			name: "preserves existing sector 3 when > 0",
			lap: &Lap{
				LapTimeMS: 85000,
				Sector1MS: 28000,
				Sector2MS: 27000,
				Sector3MS: 30000,
			},
			expected: 30000,
		},
		{
			name: "no-op when lap time is 0",
			lap: &Lap{
				LapTimeMS: 0,
				Sector1MS: 28000,
				Sector2MS: 27000,
				Sector3MS: 0,
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			DeriveSector3(tt.lap)
			if tt.lap != nil && tt.lap.Sector3MS != tt.expected {
				t.Errorf("expected Sector3MS %d, got %d", tt.expected, tt.lap.Sector3MS)
			}
		})
	}
}

func TestGetLapsBySessionCarIndexFilter(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// Insert laps for Car 0, Car 1, Car 2
	for carIdx := 0; carIdx < 3; carIdx++ {
		for lapNum := 1; lapNum <= 3; lapNum++ {
			lap := &Lap{
				SessionID: session.ID,
				CarIndex:  carIdx,
				LapNumber: lapNum,
				LapTimeMS: 80000 + carIdx*1000 + lapNum*500,
				Sector1MS: 27000,
				Sector2MS: 26000,
				Sector3MS: 27000,
				IsValid:   true,
			}
			if err := repo.SaveLap(ctx, lap, false); err != nil {
				t.Fatalf("failed to save lap for car %d lap %d: %v", carIdx, lapNum, err)
			}
		}
	}

	// 1. Get all laps (nil carIndex) -> 9 laps
	allLaps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("GetLapsBySession(nil) failed: %v", err)
	}
	if len(allLaps) != 9 {
		t.Errorf("expected 9 laps total, got %d", len(allLaps))
	}

	// 2. Filter by Car 1 -> exactly 3 laps for Car 1
	car1 := 1
	car1Laps, err := repo.GetLapsBySession(ctx, session.ID, &car1)
	if err != nil {
		t.Fatalf("GetLapsBySession(&car1) failed: %v", err)
	}
	if len(car1Laps) != 3 {
		t.Fatalf("expected 3 laps for car 1, got %d", len(car1Laps))
	}
	for _, l := range car1Laps {
		if l.CarIndex != 1 {
			t.Errorf("expected car_index 1, got %d", l.CarIndex)
		}
	}

	// 3. Filter by non-existent car -> 0 laps
	car99 := 99
	car99Laps, err := repo.GetLapsBySession(ctx, session.ID, &car99)
	if err != nil {
		t.Fatalf("GetLapsBySession(&car99) failed: %v", err)
	}
	if len(car99Laps) != 0 {
		t.Errorf("expected 0 laps for car 99, got %d", len(car99Laps))
	}
}

func TestVersionedMigrations(t *testing.T) {
	repo := setupTestRepo(t)
	db := repo.DB()

	// Verify schema_version table has recorded latest version (1)
	var maxVersion int
	err := db.Get(&maxVersion, "SELECT MAX(version) FROM schema_version")
	if err != nil {
		t.Fatalf("failed to query schema_version: %v", err)
	}
	if maxVersion != 1 {
		t.Errorf("expected schema_version 1, got %d", maxVersion)
	}

	// Running Migrate again should be idempotent
	if err := Migrate(db); err != nil {
		t.Fatalf("second Migrate call failed: %v", err)
	}
}

func TestLapHasTelemetry(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// Lap 1 with telemetry
	lap1 := &Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 80000,
		Sector1MS: 26000,
		Sector2MS: 27000,
		Sector3MS: 27000,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, lap1, false); err != nil {
		t.Fatalf("failed to save lap1: %v", err)
	}

	samples := []TelemetrySample{
		{LapDistance: 0, SessionTime: 10, Speed: 200},
		{LapDistance: 50, SessionTime: 11, Speed: 220},
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap1.ID, samples); err != nil {
		t.Fatalf("failed to save telemetry: %v", err)
	}

	// Lap 2 without telemetry (timing only)
	lap2 := &Lap{
		SessionID: session.ID,
		CarIndex:  1,
		LapNumber: 1,
		LapTimeMS: 81000,
		Sector1MS: 26500,
		Sector2MS: 27200,
		Sector3MS: 27300,
		IsValid:   true,
	}
	if err := repo.SaveLap(ctx, lap2, false); err != nil {
		t.Fatalf("failed to save lap2: %v", err)
	}

	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("GetLapsBySession failed: %v", err)
	}
	if len(laps) != 2 {
		t.Fatalf("expected 2 laps, got %d", len(laps))
	}

	for _, l := range laps {
		switch l.ID {
		case lap1.ID:
			if !l.HasTelemetry {
				t.Errorf("expected lap1 HasTelemetry = true, got false")
			}
			if l.SampleCount != 2 {
				t.Errorf("expected lap1 SampleCount = 2, got %d", l.SampleCount)
			}
		case lap2.ID:
			if l.HasTelemetry {
				t.Errorf("expected lap2 HasTelemetry = false, got true")
			}
			if l.SampleCount != 0 {
				t.Errorf("expected lap2 SampleCount = 0, got %d", l.SampleCount)
			}
		}
	}

	// Test GetLapByID
	single1, err := repo.GetLapByID(ctx, lap1.ID)
	if err != nil {
		t.Fatalf("GetLapByID failed: %v", err)
	}
	if !single1.HasTelemetry || single1.SampleCount != 2 {
		t.Errorf("GetLapByID lap1 expected has_telemetry=true sample_count=2, got %v, %d", single1.HasTelemetry, single1.SampleCount)
	}

	single2, err := repo.GetLapByID(ctx, lap2.ID)
	if err != nil {
		t.Fatalf("GetLapByID failed: %v", err)
	}
	if single2.HasTelemetry || single2.SampleCount != 0 {
		t.Errorf("GetLapByID lap2 expected has_telemetry=false sample_count=0, got %v, %d", single2.HasTelemetry, single2.SampleCount)
	}
}

func TestSaveLapMergeModeStintAndCompound(t *testing.T) {
	repo := setupTestRepo(t)
	session := createTestSession(t, repo)
	ctx := context.Background()

	// 1. Initial live lap record (default stint 1, SOFT)
	lap := &Lap{
		SessionID:    session.ID,
		CarIndex:     0,
		LapNumber:    3,
		LapTimeMS:    78000,
		Sector1MS:    25000,
		Sector2MS:    26000,
		Sector3MS:    27000,
		IsValid:      true,
		TyreCompound: "SOFT",
		Stint:        1,
	}
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("SaveLap failed: %v", err)
	}

	// 2. MergeMode update from SessionHistory with Stint 2 (SOFT)
	historyLap := &Lap{
		SessionID:    session.ID,
		CarIndex:     0,
		LapNumber:    3,
		LapTimeMS:    78000,
		Sector1MS:    25000,
		Sector2MS:    26000,
		Sector3MS:    27000,
		IsValid:      true,
		TyreCompound: "SOFT",
		Stint:        2,
	}
	if err := repo.SaveLap(ctx, historyLap, true); err != nil {
		t.Fatalf("SaveLap mergeMode failed: %v", err)
	}

	updated, err := repo.GetLapByID(ctx, lap.ID)
	if err != nil {
		t.Fatalf("GetLapByID failed: %v", err)
	}
	if updated.Stint != 2 {
		t.Errorf("expected Stint 2 after mergeMode update, got %d", updated.Stint)
	}
	if updated.TyreCompound != "SOFT" {
		t.Errorf("expected TyreCompound SOFT, got %s", updated.TyreCompound)
	}
}

func TestGetSessionsActualDuration(t *testing.T) {
	repo := setupTestRepo(t)
	ctx := context.Background()

	// Create session with 7200s default race timeout
	session := &Session{
		SessionUID:      FormatSessionUID(555555555),
		TrackID:         1,
		TrackName:       "Melbourne",
		SessionType:     "Race",
		Weather:         "Clear",
		TotalLaps:       22,
		SessionDuration: 7200,
		PacketFormat:    2026,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("SaveSession failed: %v", err)
	}

	// 1. Before laps or participants, 7200 is treated as rulebook limit -> returns 0
	sessions, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	if len(sessions) == 0 {
		t.Fatalf("expected 1 session, got 0")
	}
	if sessions[0].SessionDuration != 0 {
		t.Errorf("expected 0 for 7200 default limit before completed race, got %d", sessions[0].SessionDuration)
	}

	// 2. Add laps (3 laps of 80s = 240s total)
	for l := 1; l <= 3; l++ {
		lap := &Lap{
			SessionID: session.ID,
			CarIndex:  0,
			LapNumber: l,
			LapTimeMS: 80000,
			IsValid:   true,
		}
		if err := repo.SaveLap(ctx, lap, false); err != nil {
			t.Fatalf("SaveLap failed: %v", err)
		}
	}

	sessionsWithLaps, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	if sessionsWithLaps[0].SessionDuration != 240 {
		t.Errorf("expected 240s from completed laps, got %d", sessionsWithLaps[0].SessionDuration)
	}

	// 3. Add participant with official total race time (e.g. 1950.4s)
	participants := []Participant{
		{
			SessionID:     session.ID,
			CarIndex:      0,
			Name:          "Driver 1",
			TotalRaceTime: 1950.4,
		},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("SaveParticipants failed: %v", err)
	}

	sessionsWithParts, err := repo.GetSessions(ctx)
	if err != nil {
		t.Fatalf("GetSessions failed: %v", err)
	}
	if sessionsWithParts[0].SessionDuration != 1950 {
		t.Errorf("expected 1950s from total_race_time, got %d", sessionsWithParts[0].SessionDuration)
	}

	byID, err := repo.GetSessionByID(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetSessionByID failed: %v", err)
	}
	if byID.SessionDuration != 1950 {
		t.Errorf("expected 1950s in GetSessionByID, got %d", byID.SessionDuration)
	}

	// 4. Test Qualifying / Practice session with scheduled timer (1080s = 18m)
	qualySession := &Session{
		SessionUID:      FormatSessionUID(666666666),
		TrackID:         11,
		TrackName:       "Imola",
		SessionType:     "Short Qualifying",
		Weather:         "Clear",
		TotalLaps:       4,
		SessionDuration: 1080,
		PacketFormat:    2026,
	}
	if err := repo.SaveSession(ctx, qualySession); err != nil {
		t.Fatalf("SaveSession qualy failed: %v", err)
	}

	// Add 4 completed laps for qualy (4 laps of 80s = 320s)
	for l := 1; l <= 4; l++ {
		lap := &Lap{
			SessionID: qualySession.ID,
			CarIndex:  0,
			LapNumber: l,
			LapTimeMS: 80000,
			IsValid:   true,
		}
		if err := repo.SaveLap(ctx, lap, false); err != nil {
			t.Fatalf("SaveLap qualy failed: %v", err)
		}
	}

	qualyByID, err := repo.GetSessionByID(ctx, qualySession.ID)
	if err != nil {
		t.Fatalf("GetSessionByID qualy failed: %v", err)
	}
	// For qualifying, duration must be the scheduled 1080s (18m), not the 320s sum of 4 laps!
	if qualyByID.SessionDuration != 1080 {
		t.Errorf("expected 1080s (18m) for Short Qualifying session, got %d", qualyByID.SessionDuration)
	}
}

func TestBatchOperationsAndDuplicateImport(t *testing.T) {
	repo := setupTestRepo(t)
	ctx := context.Background()

	// 1. Create two sessions
	s1 := &Session{
		SessionUID:   FormatSessionUID(111111),
		TrackID:      1,
		TrackName:    "Melbourne",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	if err := repo.SaveSession(ctx, s1); err != nil {
		t.Fatalf("SaveSession s1 failed: %v", err)
	}

	s2 := &Session{
		SessionUID:   FormatSessionUID(222222),
		TrackID:      2,
		TrackName:    "Paul Ricard",
		SessionType:  "Race",
		PacketFormat: 2026,
	}
	if err := repo.SaveSession(ctx, s2); err != nil {
		t.Fatalf("SaveSession s2 failed: %v", err)
	}

	// Test GetSessionByUID
	foundS1, err := repo.GetSessionByUID(ctx, s1.SessionUID)
	if err != nil || foundS1 == nil {
		t.Fatalf("GetSessionByUID s1 failed: %v", err)
	}
	if foundS1.ID != s1.ID {
		t.Errorf("expected ID %d, got %d", s1.ID, foundS1.ID)
	}

	missing, err := repo.GetSessionByUID(ctx, "0x9999999999999999")
	if err != nil || missing != nil {
		t.Errorf("expected nil for missing session, got %v, err: %v", missing, err)
	}

	// Test AddTagToSessions
	tag := &Tag{Name: "Multi Tag", Color: "#10b981"}
	if err := repo.CreateTag(ctx, tag); err != nil {
		t.Fatalf("CreateTag failed: %v", err)
	}

	if err := repo.AddTagToSessions(ctx, []int64{s1.ID, s2.ID}, tag.ID); err != nil {
		t.Fatalf("AddTagToSessions failed: %v", err)
	}

	tags1, _ := repo.GetTagsBySession(ctx, s1.ID)
	tags2, _ := repo.GetTagsBySession(ctx, s2.ID)
	if len(tags1) != 1 || tags1[0].Name != "Multi Tag" {
		t.Errorf("expected Multi Tag on s1, got %v", tags1)
	}
	if len(tags2) != 1 || tags2[0].Name != "Multi Tag" {
		t.Errorf("expected Multi Tag on s2, got %v", tags2)
	}

	// Test Duplicate Import Skip
	pkg, err := repo.ExportSession(ctx, s1.ID)
	if err != nil {
		t.Fatalf("ExportSession failed: %v", err)
	}

	// Attempt importing into the SAME repository (duplicate UID)
	dupID, err := repo.ImportSession(ctx, pkg)
	if !errors.Is(err, ErrSessionAlreadyExists) {
		t.Errorf("expected ErrSessionAlreadyExists, got err: %v, id: %d", err, dupID)
	}

	// Import with allowDuplicateUID = true
	newID, err := repo.ImportSessionWithOptions(ctx, pkg, true)
	if err != nil {
		t.Fatalf("ImportSessionWithOptions(allowDuplicateUID=true) failed: %v", err)
	}
	if newID == s1.ID {
		t.Errorf("expected new session ID for duplicate copy, got %d", newID)
	}

	// Test DeleteSessions
	deletedCount, err := repo.DeleteSessions(ctx, []int64{s1.ID, s2.ID, newID})
	if err != nil {
		t.Fatalf("DeleteSessions failed: %v", err)
	}
	if deletedCount != 3 {
		t.Errorf("expected 3 sessions deleted, got %d", deletedCount)
	}

	sessionsRemaining, _ := repo.GetSessions(ctx)
	if len(sessionsRemaining) != 0 {
		t.Errorf("expected 0 sessions remaining, got %d", len(sessionsRemaining))
	}
}
