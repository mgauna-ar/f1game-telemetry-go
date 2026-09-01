package session

import (
	"context"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestSessionManagerIntegration(t *testing.T) {
	// 1. Setup in-memory DB
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
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
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
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
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
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
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
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
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
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

	if manager.lapTrackers[0].stint.CurrentStintNum != 1 {
		t.Errorf("expected stint 1 at start, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}
	if manager.lapTrackers[0].stint.LastCompound != "SOFT" {
		t.Errorf("expected compound SOFT, got %s", manager.lapTrackers[0].stint.LastCompound)
	}

	// Pit stop at Lap 10: switch to MEDIUM (compound 17) and NumPitStops = 1
	lapPacket.LapData[0].CurrentLapNum = 10
	lapPacket.LapData[0].NumPitStops = 1
	manager.ProcessPacket(ctx, lapPacket)

	statusPacket.CarStatusData[0].VisualTyreCompound = packets.CompoundMedium
	statusPacket.CarStatusData[0].TyresAgeLaps = 0
	manager.ProcessPacket(ctx, statusPacket)

	// Stint should be exactly 2 (not 3 despite both pit stop increment and compound change)
	if manager.lapTrackers[0].stint.CurrentStintNum != 2 {
		t.Errorf("expected stint 2 after single pit stop, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}
	if manager.lapTrackers[0].stint.LastCompound != "MEDIUM" {
		t.Errorf("expected compound MEDIUM, got %s", manager.lapTrackers[0].stint.LastCompound)
	}
}

func TestSessionManagerDriverRetirement(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(":memory:")
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

func TestQualyMultiStintSameCompoundDetection(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	manager.Start(ctx)
	defer manager.Close(ctx)

	sessionHeader := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDSession,
		SessionUID:     888777666,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionQ1,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	statusHeader := sessionHeader
	statusHeader.PacketId = packets.PacketIDCarStatus

	// --- Stint 1 (Softs): Lap 1 (Outlap) & Lap 2 (Flying lap) ---
	lapPkt := &packets.PacketLapData{Header: lapHeader}
	lapPkt.LapData[0].CurrentLapNum = 1
	lapPkt.LapData[0].ResultStatus = packets.ResultStatusActive
	manager.ProcessPacket(ctx, lapPkt)

	statusPkt := &packets.PacketCarStatusData{Header: statusHeader}
	statusPkt.CarStatusData[0].VisualTyreCompound = packets.CompoundSoft
	statusPkt.CarStatusData[0].TyresAgeLaps = 0 // New softs
	manager.ProcessPacket(ctx, statusPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 1 {
		t.Fatalf("expected stint 1 for lap 1, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// Flying lap (Lap 2) with tyre age 1
	lapPkt.LapData[0].CurrentLapNum = 2
	lapPkt.LapData[0].LastLapTimeInMS = 77419
	manager.ProcessPacket(ctx, lapPkt)

	statusPkt.CarStatusData[0].TyresAgeLaps = 1
	manager.ProcessPacket(ctx, statusPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 1 {
		t.Fatalf("expected stint 1 for lap 2, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// --- Stint 2 (Softs): Return to garage, new Soft tyre set (tyreAge drops from 1 to 0) ---
	lapPkt.LapData[0].CurrentLapNum = 3
	lapPkt.LapData[0].LastLapTimeInMS = 77388
	manager.ProcessPacket(ctx, lapPkt)

	statusPkt.CarStatusData[0].TyresAgeLaps = 0 // Fresh soft tyre set fitted
	manager.ProcessPacket(ctx, statusPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 2 {
		t.Fatalf("expected stint 2 after new soft set in garage, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// --- Stint 3 (Softs): Another run on new Soft tyre set ---
	statusPkt.CarStatusData[0].TyresAgeLaps = 1
	manager.ProcessPacket(ctx, statusPkt)

	lapPkt.LapData[0].CurrentLapNum = 4
	lapPkt.LapData[0].LastLapTimeInMS = 98891
	manager.ProcessPacket(ctx, lapPkt)

	statusPkt.CarStatusData[0].TyresAgeLaps = 0 // 3rd fresh soft tyre set fitted
	manager.ProcessPacket(ctx, statusPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 3 {
		t.Fatalf("expected stint 3 after 3rd soft set in garage, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}
}

func TestSessionHistoryStintParsingAndStorage(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	manager.Start(ctx)
	defer manager.Close(ctx)

	sessionHeader := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDSession,
		SessionUID:     999111222,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionQ1,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// Simulate initial lap tracker creation for Car 0
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPkt := &packets.PacketLapData{Header: lapHeader}
	lapPkt.LapData[0].CurrentLapNum = 1
	lapPkt.LapData[0].ResultStatus = packets.ResultStatusActive
	manager.ProcessPacket(ctx, lapPkt)

	// Build PacketSessionHistoryData with 4 laps and 3 tyre stints (all Soft)
	historyHeader := sessionHeader
	historyHeader.PacketId = packets.PacketIDSessionHistory
	historyPkt := &packets.PacketSessionHistoryData{
		Header:        historyHeader,
		CarIdx:        0,
		NumLaps:       4,
		NumTyreStints: 3,
	}

	// Laps 1 and 2 in Stint 1 (EndLap: 2)
	historyPkt.TyreStintHistoryData[0] = packets.TyreStintHistoryData{
		EndLap:             2,
		TyreActualCompound: packets.ActualCompoundC5,
		TyreVisualCompound: packets.CompoundSoft,
	}
	// Lap 3 in Stint 2 (EndLap: 3)
	historyPkt.TyreStintHistoryData[1] = packets.TyreStintHistoryData{
		EndLap:             3,
		TyreActualCompound: packets.ActualCompoundC5,
		TyreVisualCompound: packets.CompoundSoft,
	}
	// Lap 4 in Stint 3 (EndLap: 255)
	historyPkt.TyreStintHistoryData[2] = packets.TyreStintHistoryData{
		EndLap:             255,
		TyreActualCompound: packets.ActualCompoundC5,
		TyreVisualCompound: packets.CompoundSoft,
	}

	// Timing for the 4 laps
	historyPkt.LapHistoryData[0] = packets.LapHistoryData{LapTimeInMS: 77419, Sector1TimeMSPart: 25309, Sector2TimeMSPart: 26774, Sector3TimeMSPart: 25335, LapValidBitFlags: 1}
	historyPkt.LapHistoryData[1] = packets.LapHistoryData{LapTimeInMS: 77388, Sector1TimeMSPart: 24819, Sector2TimeMSPart: 26688, Sector3TimeMSPart: 25879, LapValidBitFlags: 1}
	historyPkt.LapHistoryData[2] = packets.LapHistoryData{LapTimeInMS: 98891, Sector1TimeMSPart: 32021, Sector2TimeMSPart: 37853, Sector3TimeMSPart: 29016, LapValidBitFlags: 1}
	historyPkt.LapHistoryData[3] = packets.LapHistoryData{LapTimeInMS: 98891, Sector1TimeMSPart: 24767, Sector2TimeMSPart: 26678, Sector3TimeMSPart: 47446, LapValidBitFlags: 1}

	manager.ProcessPacket(ctx, historyPkt)

	// Verify all 4 laps in DB have the correct stint and tyre compound
	carIdx := 0
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, &carIdx)
	if err != nil {
		t.Fatalf("GetLapsBySession error: %v", err)
	}
	if len(laps) != 4 {
		t.Fatalf("expected 4 laps in DB, got %d", len(laps))
	}

	expectedStints := []int{1, 1, 2, 3}
	for i, lap := range laps {
		if lap.Stint != expectedStints[i] {
			t.Errorf("Lap %d expected Stint %d, got %d", lap.LapNumber, expectedStints[i], lap.Stint)
		}
		if lap.TyreCompound != "SOFT" {
			t.Errorf("Lap %d expected TyreCompound SOFT, got %s", lap.LapNumber, lap.TyreCompound)
		}
	}
}

func TestFinalClassificationStintConsolidation(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	manager.Start(ctx)
	defer manager.Close(ctx)

	sessionHeader := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDSession,
		SessionUID:     333444555,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionRace,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// Pre-create 3 laps for Car 0 with distinct per-lap positions (e.g. P3 -> P2 -> P1)
	_ = repo.SaveLap(ctx, &storage.Lap{SessionID: manager.currentSession.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 80000, Stint: 1, CarPosition: 3}, false)
	_ = repo.SaveLap(ctx, &storage.Lap{SessionID: manager.currentSession.ID, CarIndex: 0, LapNumber: 2, LapTimeMS: 81000, Stint: 1, CarPosition: 2}, false)
	_ = repo.SaveLap(ctx, &storage.Lap{SessionID: manager.currentSession.ID, CarIndex: 0, LapNumber: 3, LapTimeMS: 82000, Stint: 1, CarPosition: 1}, false)

	clsHeader := sessionHeader
	clsHeader.PacketId = packets.PacketIDFinalClassification
	clsPkt := &packets.PacketFinalClassificationData{
		Header:  clsHeader,
		NumCars: 1,
	}
	clsPkt.ClassificationData[0] = packets.FinalClassificationData{
		Position:          1,
		NumLaps:           3,
		ResultStatus:      packets.ResultStatusFinished,
		NumTyreStints:     2,
		TyreStintsVisual:  [packets.MaxTyreStints]uint8{packets.CompoundSoft, packets.CompoundHard},
		TyreStintsEndLaps: [packets.MaxTyreStints]uint8{2, 3},
	}

	manager.ProcessPacket(ctx, clsPkt)

	carIdx := 0
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, &carIdx)
	if err != nil {
		t.Fatalf("GetLapsBySession error: %v", err)
	}

	if len(laps) != 3 {
		t.Fatalf("expected 3 laps, got %d", len(laps))
	}
	if laps[0].Stint != 1 || laps[0].TyreCompound != "SOFT" {
		t.Errorf("Lap 1 expected Stint 1 SOFT, got %d %s", laps[0].Stint, laps[0].TyreCompound)
	}
	if laps[1].Stint != 1 || laps[1].TyreCompound != "SOFT" {
		t.Errorf("Lap 2 expected Stint 1 SOFT, got %d %s", laps[1].Stint, laps[1].TyreCompound)
	}
	if laps[2].Stint != 2 || laps[2].TyreCompound != "HARD" {
		t.Errorf("Lap 3 expected Stint 2 HARD, got %d %s", laps[2].Stint, laps[2].TyreCompound)
	}
	if laps[2].ResultStatus != int(packets.ResultStatusFinished) {
		t.Errorf("Lap 3 expected ResultStatus Finished, got %d", laps[2].ResultStatus)
	}
	if laps[0].CarPosition != 3 {
		t.Errorf("Lap 1 expected CarPosition 3, got %d", laps[0].CarPosition)
	}
	if laps[1].CarPosition != 2 {
		t.Errorf("Lap 2 expected CarPosition 2, got %d", laps[1].CarPosition)
	}
	if laps[2].CarPosition != 1 {
		t.Errorf("Lap 3 expected CarPosition 1, got %d", laps[2].CarPosition)
	}
}

func TestMultiLapFinishDoesNotCreatePhantomLap(t *testing.T) {
	repo, err := storage.NewSQLiteRepository("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	ctx := context.Background()

	sessionHeader := packets.PacketHeader{
		PacketFormat: 2026,
		PacketId:     packets.PacketIDSession,
		SessionUID:   999777111,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     17,
		SessionType: packets.SessionShortQ,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData

	// Lap 1: Active
	lapPacket := &packets.PacketLapData{Header: lapHeader}
	lapPacket.LapData[0].CurrentLapNum = 1
	lapPacket.LapData[0].ResultStatus = packets.ResultStatusActive
	manager.ProcessPacket(ctx, lapPacket)

	// Lap 2 transition (Lap 1 completed in 65000ms)
	lapPacket.LapData[0].CurrentLapNum = 2
	lapPacket.LapData[0].LastLapTimeInMS = 65000
	manager.ProcessPacket(ctx, lapPacket)

	// Session finishes on Lap 2 (in-lap): ResultStatus = 3 (Finished), LastLapTimeInMS remains 65000 (Lap 1 time)
	lapPacket.LapData[0].CurrentLapNum = 2
	lapPacket.LapData[0].ResultStatus = packets.ResultStatusFinished
	lapPacket.LapData[0].LastLapTimeInMS = 65000
	manager.ProcessPacket(ctx, lapPacket)

	carIdx := 0
	laps, err := repo.GetLapsBySession(ctx, manager.currentSession.ID, &carIdx)
	if err != nil {
		t.Fatalf("GetLapsBySession error: %v", err)
	}

	// Should only have 1 completed lap (Lap 1 with 65000ms). Lap 2 was not completed and should NOT have 65000ms.
	completedLaps := 0
	for _, l := range laps {
		if l.LapTimeMS > 0 {
			completedLaps++
			if l.LapNumber != 1 {
				t.Errorf("expected completed lap to be Lap 1, got Lap %d with time %d", l.LapNumber, l.LapTimeMS)
			}
		}
	}
	if completedLaps != 1 {
		t.Errorf("expected exactly 1 completed lap, got %d", completedLaps)
	}
}

func TestQualyTyreSetsFittedIndexStintDetection(t *testing.T) {
	ctx := context.Background()
	repo, err := storage.NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	manager := NewSessionManager(repo)
	manager.Start(ctx)
	defer manager.Close(ctx)

	sessionHeader := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDSession,
		SessionUID:     1122334455,
		PlayerCarIndex: 0,
	}

	sessionPacket := &packets.PacketSessionData{
		Header:      sessionHeader,
		TrackId:     1,
		SessionType: packets.SessionQ1,
	}
	manager.ProcessPacket(ctx, sessionPacket)

	// Start Lap 1 for Car 0
	lapHeader := sessionHeader
	lapHeader.PacketId = packets.PacketIDLapData
	lapPkt := &packets.PacketLapData{Header: lapHeader}
	lapPkt.LapData[0].CurrentLapNum = 1
	lapPkt.LapData[0].ResultStatus = packets.ResultStatusActive
	manager.ProcessPacket(ctx, lapPkt)

	// 1. Initial Tyre Set mounted (FittedIdx = 0, Soft C5)
	tyreSetsHeader := sessionHeader
	tyreSetsHeader.PacketId = packets.PacketIDTyreSets
	tyreSetsPkt := &packets.PacketTyreSetsData{
		Header:    tyreSetsHeader,
		CarIdx:    0,
		FittedIdx: 0,
	}
	tyreSetsPkt.TyreSetData[0] = packets.TyreSetData{
		ActualTyreCompound: packets.ActualCompoundC5,
		VisualTyreCompound: packets.CompoundSoft,
		Fitted:             1,
	}
	tyreSetsPkt.TyreSetData[1] = packets.TyreSetData{
		ActualTyreCompound: packets.ActualCompoundC5,
		VisualTyreCompound: packets.CompoundSoft,
		Fitted:             0,
	}
	tyreSetsPkt.TyreSetData[2] = packets.TyreSetData{
		ActualTyreCompound: packets.ActualCompoundC5,
		VisualTyreCompound: packets.CompoundSoft,
		Fitted:             0,
	}
	manager.ProcessPacket(ctx, tyreSetsPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 1 {
		t.Fatalf("expected Stint 1 initially, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// Complete Lap 1 (78000ms), start Lap 2
	lapPkt.LapData[0].CurrentLapNum = 2
	lapPkt.LapData[0].LastLapTimeInMS = 78000
	manager.ProcessPacket(ctx, lapPkt)

	// 2. Driver changes to Tyre Set 2 in garage (FittedIdx = 1, Soft C5, both age 0)
	tyreSetsPkt.FittedIdx = 1
	manager.ProcessPacket(ctx, tyreSetsPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 2 {
		t.Fatalf("expected Stint 2 after fitted set changed to index 1 in garage, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// Complete Lap 2 (77500ms), start Lap 3
	lapPkt.LapData[0].CurrentLapNum = 3
	lapPkt.LapData[0].LastLapTimeInMS = 77500
	manager.ProcessPacket(ctx, lapPkt)

	// 3. Driver changes to Tyre Set 3 in garage (FittedIdx = 2, Soft C5)
	tyreSetsPkt.FittedIdx = 2
	manager.ProcessPacket(ctx, tyreSetsPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 3 {
		t.Fatalf("expected Stint 3 after fitted set changed to index 2 in garage, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}

	// Complete Lap 3 (77200ms), start Lap 4 on same set (Stint remains 3)
	lapPkt.LapData[0].CurrentLapNum = 4
	lapPkt.LapData[0].LastLapTimeInMS = 77200
	manager.ProcessPacket(ctx, lapPkt)

	if manager.lapTrackers[0].stint.CurrentStintNum != 3 {
		t.Fatalf("expected Stint 3 to persist on lap 4, got %d", manager.lapTrackers[0].stint.CurrentStintNum)
	}
}
