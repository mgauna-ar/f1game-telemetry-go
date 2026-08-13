package session

import (
	"context"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestSessionManagerIntegration(t *testing.T) {
	// 1. Setup in-memory DB
	repo, err := storage.NewRepository("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	ctx := context.Background()

	// 2. Simulate new session
	sessionHeader := packets.PacketHeader{
		PacketFormat:   2025,
		PacketId:       packets.PacketIDSession,
		SessionUID:     123456789,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     11, // Monza
		SessionType: packets.SessionRace,
	}

	manager.ProcessPacket(ctx, sessionPacket)

	if manager.currentSessionUID != 123456789 {
		t.Errorf("expected session UID to be 123456789, got %d", manager.currentSessionUID)
	}
	if manager.currentSession.TrackID != 11 {
		t.Errorf("expected track ID to be 11, got %d", manager.currentSession.TrackID)
	}

	// 3. Simulate Lap Data (Lap 1 starts for Car 0 and Car 1)
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{
		Header: lapHeader,
	}
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].Sector1TimeMSPart = 0
	lapPacket.LapData[1].CurrentLapNum = 1
	lapPacket.LapData[1].Sector1TimeMSPart = 0

	manager.ProcessPacket(ctx, lapPacket)

	if manager.lapTrackers[0].currentLapNum != 1 {
		t.Errorf("expected car 0 lap num 1, got %d", manager.lapTrackers[0].currentLapNum)
	}
	if manager.lapTrackers[1].currentLapNum != 1 {
		t.Errorf("expected car 1 lap num 1, got %d", manager.lapTrackers[1].currentLapNum)
	}

	// 4. Simulate Telemetry
	telemetryHeader := sessionHeader
	telemetryHeader.PacketId = packets.PacketIDCarTelemetry
	telemetryHeader.SessionTime = 1.0 // 1 second in

	telemetryPacket := &packets.PacketCarTelemetryData{
		Header: telemetryHeader,
	}
	telemetryPacket.CarTelemetryData[0].Speed = 300
	telemetryPacket.CarTelemetryData[0].Throttle = 1.0
	telemetryPacket.CarTelemetryData[1].Speed = 295
	telemetryPacket.CarTelemetryData[1].Throttle = 0.95

	manager.ProcessPacket(ctx, telemetryPacket)

	if len(manager.lapTrackers[0].samples) != 1 {
		t.Errorf("expected 1 telemetry sample for car 0, got %d", len(manager.lapTrackers[0].samples))
	}
	if len(manager.lapTrackers[1].samples) != 1 {
		t.Errorf("expected 1 telemetry sample for car 1, got %d", len(manager.lapTrackers[1].samples))
	}

	// 5. Simulate Lap 2 starting (Lap 1 finishes)
	lapPacket.LapData[0].CurrentLapNum = 2
	lapPacket.LapData[0].LastLapTimeInMS = 85000 // 1:25.000
	lapPacket.LapData[1].CurrentLapNum = 2
	lapPacket.LapData[1].LastLapTimeInMS = 86200 // 1:26.200

	manager.ProcessPacket(ctx, lapPacket)

	if manager.lapTrackers[0].currentLapNum != 2 {
		t.Errorf("expected car 0 lap num 2, got %d", manager.lapTrackers[0].currentLapNum)
	}
	if manager.lapTrackers[1].currentLapNum != 2 {
		t.Errorf("expected car 1 lap num 2, got %d", manager.lapTrackers[1].currentLapNum)
	}

	// Telemetry samples should have been flushed on lap completion
	if len(manager.lapTrackers[0].samples) != 0 {
		t.Errorf("expected 0 telemetry samples for car 0 after lap flush, got %d", len(manager.lapTrackers[0].samples))
	}
	if len(manager.lapTrackers[1].samples) != 0 {
		t.Errorf("expected 0 telemetry samples for car 1 after lap flush, got %d", len(manager.lapTrackers[1].samples))
	}
}

func TestSessionManagerParticipants(t *testing.T) {
	repo, err := storage.NewRepository("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	ctx := context.Background()

	// 1. First, establish a session
	sessionHeader := packets.PacketHeader{
		PacketFormat:   2025,
		PacketId:       packets.PacketIDSession,
		SessionUID:     987654321,
		PlayerCarIndex: 0,
	}
	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     11,
		SessionType: packets.SessionRace,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	if manager.currentSession == nil {
		t.Fatal("expected current session to be set")
	}

	// 2. Send a participants packet
	participantsHeader := sessionHeader
	participantsHeader.PacketId = packets.PacketIDParticipants

	participantsPacket := &packets.PacketParticipantsData{
		Header:        participantsHeader,
		NumActiveCars: 3,
	}

	// Set participant names (null-terminated [48]byte arrays)
	copy(participantsPacket.Participants[0].Name[:], "Max Verstappen")
	participantsPacket.Participants[0].DriverId = 1
	participantsPacket.Participants[0].TeamId = 1
	participantsPacket.Participants[0].RaceNumber = 1
	participantsPacket.Participants[0].AIControlled = 0

	copy(participantsPacket.Participants[1].Name[:], "Lewis Hamilton")
	participantsPacket.Participants[1].DriverId = 2
	participantsPacket.Participants[1].TeamId = 0
	participantsPacket.Participants[1].RaceNumber = 44
	participantsPacket.Participants[1].AIControlled = 0

	copy(participantsPacket.Participants[2].Name[:], "Charles Leclerc")
	participantsPacket.Participants[2].DriverId = 3
	participantsPacket.Participants[2].TeamId = 4
	participantsPacket.Participants[2].RaceNumber = 16
	participantsPacket.Participants[2].AIControlled = 1

	manager.ProcessPacket(ctx, participantsPacket)

	// 3. Verify participants were saved
	participants, err := repo.GetParticipantsBySession(ctx, manager.currentSession.ID)
	if err != nil {
		t.Fatalf("GetParticipantsBySession() error = %v", err)
	}

	if len(participants) != 3 {
		t.Fatalf("expected 3 participants, got %d", len(participants))
	}

	// Verify ordering and data
	tests := []struct {
		carIndex     int
		name         string
		driverID     int
		teamID       int
		raceNumber   int
		aiControlled bool
	}{
		{0, "Max Verstappen", 1, 1, 1, false},
		{1, "Lewis Hamilton", 2, 0, 44, false},
		{2, "Charles Leclerc", 3, 4, 16, true},
	}

	for i, tt := range tests {
		p := participants[i]
		if p.CarIndex != tt.carIndex {
			t.Errorf("participant[%d] car_index = %d, want %d", i, p.CarIndex, tt.carIndex)
		}
		if p.Name != tt.name {
			t.Errorf("participant[%d] name = %q, want %q", i, p.Name, tt.name)
		}
		if p.DriverID != tt.driverID {
			t.Errorf("participant[%d] driver_id = %d, want %d", i, p.DriverID, tt.driverID)
		}
		if p.TeamID != tt.teamID {
			t.Errorf("participant[%d] team_id = %d, want %d", i, p.TeamID, tt.teamID)
		}
		if p.RaceNumber != tt.raceNumber {
			t.Errorf("participant[%d] race_number = %d, want %d", i, p.RaceNumber, tt.raceNumber)
		}
		if p.AIControlled != tt.aiControlled {
			t.Errorf("participant[%d] ai_controlled = %v, want %v", i, p.AIControlled, tt.aiControlled)
		}
	}
}

func TestSessionManagerHighBitSessionUIDAndLapValidation(t *testing.T) {
	repo, err := storage.NewRepository("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	ctx := context.Background()

	// 1. SessionUID with high bit set (e.g. 17362816241492575144 > MaxInt64)
	highBitUID := uint64(17362816241492575144)
	sessionHeader := packets.PacketHeader{
		PacketFormat:   2025,
		PacketId:       packets.PacketIDSession,
		SessionUID:     highBitUID,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionRace,
	}

	manager.ProcessPacket(ctx, sessionPacket)

	if manager.currentSession == nil || manager.currentSession.ID == 0 {
		t.Fatalf("expected session to be saved cleanly without driver error, got ID %d", manager.currentSession.ID)
	}

	// 2. Send invalid lap numbers for inactive cars (e.g. Lap 253, 254)
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{
		Header: lapHeader,
	}
	// Inactive car with high/invalid lap number
	lapPacket.LapData[5].CurrentLapNum = 253
	lapPacket.LapData[5].ResultStatus = 0

	manager.ProcessPacket(ctx, lapPacket)

	// Car 5 tracker should ignore lap 253
	if manager.lapTrackers[5].currentLapNum != 0 {
		t.Errorf("expected car 5 lap num 0 for invalid lap 253, got %d", manager.lapTrackers[5].currentLapNum)
	}

	// 3. Verify no fake laps were saved to database
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID)
	if err != nil {
		t.Fatalf("failed to query laps: %v", err)
	}
	if len(laps) != 0 {
		t.Errorf("expected 0 laps in database for invalid packet, got %d", len(laps))
	}
}

func TestFinalLapFinalizationOnSessionFinish(t *testing.T) {
	repo, err := storage.NewRepository("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	ctx := context.Background()

	sessionHeader := packets.PacketHeader{
		PacketFormat:   2025,
		PacketId:       packets.PacketIDSession,
		SessionUID:     999888777,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionRace,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// Start Lap 1 for Car 0
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{Header: lapHeader}
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].ResultStatus = 2 // Active

	manager.ProcessPacket(ctx, lapPacket)

	// Car 0 finishes final lap: ResultStatus = 3 (Finished), LastLapTimeInMS = 87500
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].ResultStatus = 3 // Finished
	lapPacket.LapData[0].LastLapTimeInMS = 87500

	manager.ProcessPacket(ctx, lapPacket)

	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID)
	if err != nil {
		t.Fatalf("failed to get laps: %v", err)
	}

	if len(laps) != 1 {
		t.Fatalf("expected 1 lap, got %d", len(laps))
	}

	if laps[0].LapTimeMS != 87500 {
		t.Errorf("expected final lap time 87500 ms, got %d ms", laps[0].LapTimeMS)
	}
}
