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
		SessionType: 10, // Race
	}

	manager.ProcessPacket(ctx, sessionPacket)

	if manager.currentSessionUID != 123456789 {
		t.Errorf("expected session UID to be 123456789, got %d", manager.currentSessionUID)
	}
	if manager.currentSession.TrackID != 11 {
		t.Errorf("expected track ID to be 11, got %d", manager.currentSession.TrackID)
	}

	// 3. Simulate Lap Data (Lap 1 starts)
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{
		Header: lapHeader,
	}
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].Sector1TimeMSPart = 0

	manager.ProcessPacket(ctx, lapPacket)

	if manager.lapTracker.currentLapNum != 1 {
		t.Errorf("expected lap num 1, got %d", manager.lapTracker.currentLapNum)
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

	manager.ProcessPacket(ctx, telemetryPacket)

	if len(manager.lapTracker.samples) != 1 {
		t.Errorf("expected 1 telemetry sample, got %d", len(manager.lapTracker.samples))
	}

	// 5. Simulate Lap 2 starting (Lap 1 finishes)
	lapPacket.LapData[0].CurrentLapNum = 2
	lapPacket.LapData[0].LastLapTimeInMS = 85000 // 1:25.000

	manager.ProcessPacket(ctx, lapPacket)

	if manager.lapTracker.currentLapNum != 2 {
		t.Errorf("expected lap num 2, got %d", manager.lapTracker.currentLapNum)
	}

	// Telemetry samples should have been flushed on lap completion
	if len(manager.lapTracker.samples) != 0 {
		t.Errorf("expected 0 telemetry samples after lap flush, got %d", len(manager.lapTracker.samples))
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
		SessionType: 10,
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
