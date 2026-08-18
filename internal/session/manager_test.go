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
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	manager.Start(ctx)
	defer manager.Close(ctx)

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

	// Flush async writer
	manager.batchWriter.Flush(ctx)

	// Query telemetry samples for lap 1
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, nil)
	if err != nil {
		t.Fatalf("failed to query laps: %v", err)
	}
	if len(laps) < 2 {
		t.Fatalf("expected at least 2 laps created, got %d", len(laps))
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
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, nil)
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

	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, nil)
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

func TestStintProgressionAndCompoundMapping(t *testing.T) {
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
		SessionUID:     555444333,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionRace,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// Start Lap 1 with SOFT tyres (compound 16)
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{Header: lapHeader}
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].ResultStatus = 2
	lapPacket.LapData[0].NumPitStops = 0
	manager.ProcessPacket(ctx, lapPacket)

	statusHeader := sessionHeader
	statusHeader.PacketId = packets.PacketIDCarStatus
	statusPacket := &packets.PacketCarStatusData{Header: statusHeader}
	statusPacket.CarStatusData[0].VisualTyreCompound = packets.CompoundSoft
	statusPacket.CarStatusData[0].TyresAgeLaps = 5
	manager.ProcessPacket(ctx, statusPacket)

	if manager.lapTrackers[0].currentStintNum != 1 {
		t.Errorf("expected stint 1 at start, got %d", manager.lapTrackers[0].currentStintNum)
	}
	if manager.lapTrackers[0].lastCompound != "SOFT" {
		t.Errorf("expected compound SOFT, got %s", manager.lapTrackers[0].lastCompound)
	}

	// Pit stop at Lap 10: switch to MEDIUM (compound 17) and NumPitStops = 1
	lapPacket.LapData[0].CurrentLapNum = 10
	lapPacket.LapData[0].NumPitStops = 1
	manager.ProcessPacket(ctx, lapPacket)

	statusPacket.CarStatusData[0].VisualTyreCompound = packets.CompoundMedium
	statusPacket.CarStatusData[0].TyresAgeLaps = 0
	manager.ProcessPacket(ctx, statusPacket)

	// Stint should be exactly 2 (not 3 despite both pit stop increment and compound change)
	if manager.lapTrackers[0].currentStintNum != 2 {
		t.Errorf("expected stint 2 after single pit stop, got %d", manager.lapTrackers[0].currentStintNum)
	}
	if manager.lapTrackers[0].lastCompound != "MEDIUM" {
		t.Errorf("expected compound MEDIUM, got %s", manager.lapTrackers[0].lastCompound)
	}
}

func TestSessionManagerDriverRetirement(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewRepository(":memory:")
	if err != nil {
		t.Fatalf("Failed to create memory DB: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	manager.Start(ctx)
	defer manager.Close(ctx)

	sessionUID := uint64(111222333)
	sessionHeader := packets.PacketHeader{
		PacketFormat: 2026,
		SessionUID:   sessionUID,
		PacketId:     packets.PacketIDSession,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: 5, // Q1
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// 1. Initial 3 participants
	partHeader := sessionHeader
	partHeader.PacketId = packets.PacketIDParticipants
	partPacket := &packets.PacketParticipantsData{
		Header:        partHeader,
		NumActiveCars: 3,
	}
	copy(partPacket.Participants[0].Name[:], "Max Verstappen")
	partPacket.Participants[0].DriverId = 1
	partPacket.Participants[0].RaceNumber = 1

	copy(partPacket.Participants[1].Name[:], "Lewis Hamilton")
	partPacket.Participants[1].DriverId = 2
	partPacket.Participants[1].RaceNumber = 44

	copy(partPacket.Participants[2].Name[:], "Charles Leclerc")
	partPacket.Participants[2].DriverId = 3
	partPacket.Participants[2].RaceNumber = 16

	manager.ProcessPacket(ctx, partPacket)

	// 2. Initial LapData for all 3 cars (Active)
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPacket := &packets.PacketLapData{Header: lapHeader}
	for i := 0; i < 3; i++ {
		lapPacket.LapData[i].CurrentLapNum = 1
		lapPacket.LapData[i].ResultStatus = 2 // Active
		lapPacket.LapData[i].CarPosition = uint8(i + 1)
	}
	manager.ProcessPacket(ctx, lapPacket)

	// 3. Driver at index 1 (Hamilton) completes a lap (1:15.000), then retires (ResultStatus = 7)
	// Game decrements NumActiveCars to 2
	partPacket.NumActiveCars = 2
	manager.ProcessPacket(ctx, partPacket)

	// LapData with Hamilton retired and Leclerc completing lap 1
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].ResultStatus = 2
	lapPacket.LapData[0].LastLapTimeInMS = 74000

	lapPacket.LapData[1].CurrentLapNum = 1
	lapPacket.LapData[1].ResultStatus = 7 // Retired
	lapPacket.LapData[1].LastLapTimeInMS = 75000

	lapPacket.LapData[2].CurrentLapNum = 2 // Leclerc on lap 2
	lapPacket.LapData[2].ResultStatus = 2
	lapPacket.LapData[2].LastLapTimeInMS = 76000

	manager.ProcessPacket(ctx, lapPacket)

	// 4. Verify participants table in DB still has 3 participants (Leclerc not cut off)
	participants, err := repo.GetParticipantsBySession(ctx, manager.currentSession.ID)
	if err != nil {
		t.Fatalf("GetParticipantsBySession() error = %v", err)
	}
	if len(participants) != 3 {
		t.Fatalf("expected 3 participants retained after retirement, got %d", len(participants))
	}

	// 5. Verify Hamilton's lap was recorded with ResultStatus = 7
	car1Idx := 1
	lapsCar1, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, &car1Idx)
	if err != nil {
		t.Fatalf("GetLapsBySession() for Car 1 error = %v", err)
	}
	if len(lapsCar1) == 0 {
		t.Fatalf("expected at least 1 lap for Car 1")
	}
	if lapsCar1[0].ResultStatus != 7 {
		t.Errorf("expected Car 1 ResultStatus to be 7 (Retired), got %d", lapsCar1[0].ResultStatus)
	}

	// 6. Verify Leclerc (Car 2) lap 1 was also recorded despite NumActiveCars = 2
	car2Idx := 2
	lapsCar2, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, &car2Idx)
	if err != nil {
		t.Fatalf("GetLapsBySession() for Car 2 error = %v", err)
	}
	if len(lapsCar2) == 0 {
		t.Fatalf("expected at least 1 lap for Car 2 (Leclerc)")
	}
	if lapsCar2[0].LapTimeMS != 76000 {
		t.Errorf("expected Car 2 lap time 76000 ms, got %d", lapsCar2[0].LapTimeMS)
	}
}
