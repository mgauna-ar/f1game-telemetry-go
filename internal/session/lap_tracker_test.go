package session

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func setupLapTrackerTest(t *testing.T) (*LapTracker, *TelemetryBatchWriter, storage.Repository, *storage.Session, context.Context) {
	t.Helper()
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_lt_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(99887766),
		TrackID:      1,
		TrackName:    "Monza",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save test session: %v", err)
	}

	bw := NewTelemetryBatchWriter(repo)
	bw.Start(ctx)
	t.Cleanup(func() {
		bw.Close(ctx)
		_ = repo.Close()
	})

	lt := NewLapTracker(repo, bw, 0)
	return lt, bw, repo, session, ctx
}

func TestLapTracker_LapTransitions(t *testing.T) {
	lt, _, repo, session, ctx := setupLapTrackerTest(t)

	// 1. Initial Lap 1 start
	p1 := &packets.PacketLapData{}
	p1.LapData[0].CurrentLapNum = 1
	p1.LapData[0].LapDistance = 100.0
	lt.ProcessLapData(ctx, session, p1)

	if lt.currentLapNum != 1 {
		t.Fatalf("expected currentLapNum 1, got %d", lt.currentLapNum)
	}
	if lt.currentLap == nil || lt.currentLap.ID == 0 {
		t.Fatal("expected currentLap to be initialized and saved in database")
	}

	// 2. Feed telemetry for Lap 1
	for i := 0; i < 20; i++ {
		tel := &packets.PacketCarTelemetryData{
			Header: packets.PacketHeader{SessionTime: float32(i) * 0.1},
		}
		tel.CarTelemetryData[0].Speed = 250
		tel.CarTelemetryData[0].Throttle = 1.0
		lt.ProcessTelemetry(ctx, session, tel)
	}

	// 3. Transition Lap 1 -> Lap 2
	p2 := &packets.PacketLapData{}
	p2.LapData[0].CurrentLapNum = 2
	p2.LapData[0].LapDistance = 50.0
	p2.LapData[0].LastLapTimeInMS = 85432
	lt.ProcessLapData(ctx, session, p2)

	if lt.currentLapNum != 2 {
		t.Fatalf("expected currentLapNum 2, got %d", lt.currentLapNum)
	}

	// Verify Lap 1 was saved with correct time
	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("failed to get laps: %v", err)
	}
	if len(laps) < 1 {
		t.Fatalf("expected at least 1 lap saved, got %d", len(laps))
	}
	if laps[0].LapNumber == 1 && laps[0].LapTimeMS != 85432 {
		t.Errorf("expected Lap 1 LapTimeMS 85432, got %d", laps[0].LapTimeMS)
	}

	// 4. Transition Lap 2 -> Lap 3
	p3 := &packets.PacketLapData{}
	p3.LapData[0].CurrentLapNum = 3
	p3.LapData[0].LapDistance = 20.0
	p3.LapData[0].LastLapTimeInMS = 84123
	lt.ProcessLapData(ctx, session, p3)

	if lt.currentLapNum != 3 {
		t.Fatalf("expected currentLapNum 3, got %d", lt.currentLapNum)
	}
}

func TestLapTracker_PitStopDetection(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	// Start Lap 1 with 0 pit stops
	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	p.LapData[0].NumPitStops = 0
	lt.ProcessLapData(ctx, session, p)

	if lt.currentStintNum != 1 {
		t.Fatalf("expected initial stint 1, got %d", lt.currentStintNum)
	}

	// Pit stop occurs on Lap 2
	p.LapData[0].CurrentLapNum = 2
	p.LapData[0].NumPitStops = 1
	lt.ProcessLapData(ctx, session, p)

	if lt.currentStintNum != 2 {
		t.Errorf("expected stint 2 after pit stop on lap 2, got %d", lt.currentStintNum)
	}

	// Second pit stop in Lap 3
	p.LapData[0].CurrentLapNum = 3
	p.LapData[0].NumPitStops = 2
	lt.ProcessLapData(ctx, session, p)

	if lt.currentStintNum != 3 {
		t.Errorf("expected stint 3 after second pit stop on lap 3, got %d", lt.currentStintNum)
	}
}

func TestLapTracker_PitExitAndContinuation(t *testing.T) {
	lt, _, repo, session, ctx := setupLapTrackerTest(t)

	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	p.LapData[0].NumPitStops = 0
	lt.ProcessLapData(ctx, session, p)

	// Update sectors after pit exit during ongoing lap
	p.LapData[0].Sector1TimeMSPart = 25000
	p.LapData[0].Sector2TimeMSPart = 28000
	p.LapData[0].CarPosition = 3
	lt.ProcessLapData(ctx, session, p)

	if lt.currentLap == nil || lt.currentLap.ID == 0 {
		t.Fatal("expected active currentLap with valid ID")
	}

	lap, err := repo.GetLapByID(ctx, lt.currentLap.ID)
	if err != nil {
		t.Fatalf("failed to query lap by ID: %v", err)
	}
	if lap == nil {
		t.Fatal("expected saved lap in database")
	}
	if lap.Sector1MS != 25000 || lap.Sector2MS != 28000 || lap.CarPosition != 3 {
		t.Errorf("unexpected lap fields: %+v", lap)
	}
}

func TestLapTracker_StintBoundaries(t *testing.T) {
	t.Run("Tyre compound change via ProcessCarStatus", func(t *testing.T) {
		lt, _, _, session, ctx := setupLapTrackerTest(t)

		pLap := &packets.PacketLapData{}
		pLap.LapData[0].CurrentLapNum = 1
		lt.ProcessLapData(ctx, session, pLap)

		// Initial compound SOFT (visual 16)
		cs1 := &packets.PacketCarStatusData{}
		cs1.CarStatusData[0].VisualTyreCompound = 16
		cs1.CarStatusData[0].TyresAgeLaps = 5
		lt.ProcessCarStatus(cs1)

		if lt.lastCompound != "SOFT" {
			t.Fatalf("expected lastCompound SOFT, got %s", lt.lastCompound)
		}
		initialStint := lt.currentStintNum

		// Next lap compound change to MEDIUM (visual 17)
		pLap.LapData[0].CurrentLapNum = 2
		lt.ProcessLapData(ctx, session, pLap)

		cs2 := &packets.PacketCarStatusData{}
		cs2.CarStatusData[0].VisualTyreCompound = 17
		cs2.CarStatusData[0].TyresAgeLaps = 0
		lt.ProcessCarStatus(cs2)

		if lt.currentStintNum != initialStint+1 {
			t.Errorf("expected stint to increment to %d, got %d", initialStint+1, lt.currentStintNum)
		}
		if lt.lastCompound != "MEDIUM" {
			t.Errorf("expected lastCompound MEDIUM, got %s", lt.lastCompound)
		}
	})

	t.Run("Tyre set change via ProcessTyreSets", func(t *testing.T) {
		lt, _, _, session, ctx := setupLapTrackerTest(t)

		pLap := &packets.PacketLapData{}
		pLap.LapData[0].CurrentLapNum = 1
		lt.ProcessLapData(ctx, session, pLap)

		// Initial fitted set 0
		ts1 := &packets.PacketTyreSetsData{CarIdx: 0, FittedIdx: 0}
		ts1.TyreSetData[0].VisualTyreCompound = 16
		lt.ProcessTyreSets(ts1)

		initialStint := lt.currentStintNum

		// Fitted set changed to set 1 in lap 2
		pLap.LapData[0].CurrentLapNum = 2
		lt.ProcessLapData(ctx, session, pLap)

		ts2 := &packets.PacketTyreSetsData{CarIdx: 0, FittedIdx: 1}
		ts2.TyreSetData[1].VisualTyreCompound = 18 // HARD
		lt.ProcessTyreSets(ts2)

		if lt.currentStintNum != initialStint+1 {
			t.Errorf("expected stint to increment via tyre sets to %d, got %d", initialStint+1, lt.currentStintNum)
		}
	})
}

func TestLapTracker_DNFMidLap(t *testing.T) {
	lt, _, repo, session, ctx := setupLapTrackerTest(t)

	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	p.LapData[0].LapDistance = 1500.0
	lt.ProcessLapData(ctx, session, p)

	// Add telemetry samples
	for i := 0; i < 15; i++ {
		tel := &packets.PacketCarTelemetryData{
			Header: packets.PacketHeader{SessionTime: float32(i) * 0.1},
		}
		tel.CarTelemetryData[0].Speed = 220
		lt.ProcessTelemetry(ctx, session, tel)
	}

	// Car crashes out DNF
	p.LapData[0].ResultStatus = packets.ResultStatusDNF
	lt.ProcessLapData(ctx, session, p)

	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("failed to query laps: %v", err)
	}
	if len(laps) == 0 {
		t.Fatal("expected lap record to be saved")
	}
	if laps[0].ResultStatus != int(packets.ResultStatusDNF) {
		t.Errorf("expected ResultStatus DNF (%d), got %d", packets.ResultStatusDNF, laps[0].ResultStatus)
	}
}

func TestLapTracker_SafetyCarLaps(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	p.LapData[0].LapDistance = 300.0
	lt.ProcessLapData(ctx, session, p)

	// Under SC speed is low and steady
	for i := 0; i < 25; i++ {
		tel := &packets.PacketCarTelemetryData{
			Header: packets.PacketHeader{SessionTime: float32(i) * 0.1},
		}
		tel.CarTelemetryData[0].Speed = 120
		tel.CarTelemetryData[0].Throttle = 0.4
		lt.ProcessTelemetry(ctx, session, tel)
	}

	lt.mu.Lock()
	sampleCount := len(lt.sampleBuffer)
	lt.mu.Unlock()

	if sampleCount != 25 {
		t.Errorf("expected 25 samples collected under SC, got %d", sampleCount)
	}
}

func TestLapTracker_Reset(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	lt.ProcessLapData(ctx, session, p)

	for i := 0; i < 15; i++ {
		tel := &packets.PacketCarTelemetryData{
			Header: packets.PacketHeader{SessionTime: float32(i) * 0.1},
		}
		tel.CarTelemetryData[0].Speed = 200
		lt.ProcessTelemetry(ctx, session, tel)
	}

	lt.Reset()

	if lt.currentLapNum != 0 {
		t.Errorf("expected currentLapNum 0 after Reset, got %d", lt.currentLapNum)
	}
	if lt.currentLap != nil {
		t.Errorf("expected currentLap nil after Reset, got %+v", lt.currentLap)
	}
	if lt.sampleBuffer != nil {
		t.Errorf("expected sampleBuffer nil after Reset, got len %d", len(lt.sampleBuffer))
	}
}

func TestLapTracker_FormationAndOutLap(t *testing.T) {
	t.Run("Distance rewind / flashback reset", func(t *testing.T) {
		lt, _, _, session, ctx := setupLapTrackerTest(t)

		p := &packets.PacketLapData{}
		p.LapData[0].CurrentLapNum = 1
		p.LapData[0].LapDistance = 600.0
		lt.ProcessLapData(ctx, session, p)

		tel := &packets.PacketCarTelemetryData{}
		tel.CarTelemetryData[0].Speed = 200
		lt.ProcessTelemetry(ctx, session, tel)

		// Flashback to start of lap
		p.LapData[0].LapDistance = 50.0
		lt.ProcessLapData(ctx, session, p)

		lt.mu.Lock()
		count := len(lt.sampleBuffer)
		lt.mu.Unlock()

		if count != 0 {
			t.Errorf("expected buffer reset after distance rewind, got %d samples", count)
		}
	})

	t.Run("Out-lap to flying lap crossing", func(t *testing.T) {
		lt, _, _, session, ctx := setupLapTrackerTest(t)

		p := &packets.PacketLapData{}
		p.LapData[0].CurrentLapNum = 1
		p.LapData[0].LapDistance = -50.0
		lt.ProcessLapData(ctx, session, p)

		tel := &packets.PacketCarTelemetryData{}
		tel.CarTelemetryData[0].Speed = 260
		lt.ProcessTelemetry(ctx, session, tel)

		// Cross start line into flying lap
		p.LapData[0].LapDistance = 10.0
		lt.ProcessLapData(ctx, session, p)

		lt.mu.Lock()
		count := len(lt.sampleBuffer)
		lt.mu.Unlock()

		if count != 0 {
			t.Errorf("expected buffer reset when crossing into flying lap, got %d samples", count)
		}
	})
}

func TestLapTracker_TelemetryBufferAccumulation(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	p := &packets.PacketLapData{}
	p.LapData[0].CurrentLapNum = 1
	p.LapData[0].LapDistance = 100.0
	lt.ProcessLapData(ctx, session, p)

	for i := 0; i < 50; i++ {
		tel := &packets.PacketCarTelemetryData{
			Header: packets.PacketHeader{SessionTime: float32(i) * 0.05},
		}
		tel.CarTelemetryData[0].Speed = uint16(200 + i)
		tel.CarTelemetryData[0].Throttle = 0.8
		tel.CarTelemetryData[0].Brake = 0.1
		tel.CarTelemetryData[0].Gear = 7
		tel.CarTelemetryData[0].EngineRPM = 11500
		tel.CarTelemetryData[0].DRS = 1
		lt.ProcessTelemetry(ctx, session, tel)
	}

	lt.mu.Lock()
	defer lt.mu.Unlock()

	if len(lt.sampleBuffer) != 50 {
		t.Fatalf("expected 50 samples in buffer, got %d", len(lt.sampleBuffer))
	}

	sample := lt.sampleBuffer[10]
	if sample.Speed != 210 || sample.Gear != 7 || sample.EngineRPM != 11500 || !sample.DRS {
		t.Errorf("unexpected sample data: %+v", sample)
	}
}

func TestLapTracker_ProcessSessionHistory(t *testing.T) {
	lt, _, repo, session, ctx := setupLapTrackerTest(t)

	history := &packets.PacketSessionHistoryData{
		CarIdx:        0,
		NumLaps:       2,
		NumTyreStints: 2,
	}
	history.LapHistoryData[0].LapTimeInMS = 86000
	history.LapHistoryData[0].Sector1TimeMSPart = 28000
	history.LapHistoryData[0].Sector2TimeMSPart = 29000
	history.LapHistoryData[0].Sector3TimeMSPart = 29000
	history.LapHistoryData[0].LapValidBitFlags = packets.LapValidBitFlag | packets.Sector1ValidBitFlag | packets.Sector2ValidBitFlag | packets.Sector3ValidBitFlag

	history.LapHistoryData[1].LapTimeInMS = 85500
	history.LapHistoryData[1].Sector1TimeMSPart = 27800
	history.LapHistoryData[1].Sector2TimeMSPart = 28900
	history.LapHistoryData[1].Sector3TimeMSPart = 28800
	history.LapHistoryData[1].LapValidBitFlags = packets.LapValidBitFlag | packets.Sector1ValidBitFlag | packets.Sector2ValidBitFlag | packets.Sector3ValidBitFlag

	history.TyreStintHistoryData[0].EndLap = 1
	history.TyreStintHistoryData[0].TyreVisualCompound = 16 // SOFT
	history.TyreStintHistoryData[1].EndLap = 2
	history.TyreStintHistoryData[1].TyreVisualCompound = 17 // MEDIUM

	lt.ProcessSessionHistory(ctx, session, history)

	laps, err := repo.GetLapsBySession(ctx, session.ID, nil)
	if err != nil {
		t.Fatalf("failed to query session laps: %v", err)
	}
	if len(laps) != 2 {
		t.Fatalf("expected 2 history laps saved, got %d", len(laps))
	}

	if laps[0].LapTimeMS != 86000 || laps[0].TyreCompound != "SOFT" || laps[0].Stint != 1 {
		t.Errorf("unexpected lap 1 history: %+v", laps[0])
	}
	if laps[1].LapTimeMS != 85500 || laps[1].TyreCompound != "MEDIUM" || laps[1].Stint != 2 {
		t.Errorf("unexpected lap 2 history: %+v", laps[1])
	}
}

func TestLapTracker_ProcessMotion(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	pLap := &packets.PacketLapData{}
	pLap.LapData[0].CurrentLapNum = 1
	lt.ProcessLapData(ctx, session, pLap)

	motion := &packets.PacketMotionData{}
	motion.CarMotionData[0].WorldPositionX = 350.5
	motion.CarMotionData[0].WorldPositionY = 12.3
	motion.CarMotionData[0].WorldPositionZ = -920.8
	lt.ProcessMotion(motion)

	tel := &packets.PacketCarTelemetryData{}
	tel.CarTelemetryData[0].Speed = 280
	lt.ProcessTelemetry(ctx, session, tel)

	lt.mu.Lock()
	defer lt.mu.Unlock()

	if len(lt.sampleBuffer) != 1 {
		t.Fatalf("expected 1 sample, got %d", len(lt.sampleBuffer))
	}
	s := lt.sampleBuffer[0]
	if float32(s.WorldPosX) != 350.5 || float32(s.WorldPosY) != 12.3 || float32(s.WorldPosZ) != -920.8 {
		t.Errorf("unexpected world positions: X=%f Y=%f Z=%f", s.WorldPosX, s.WorldPosY, s.WorldPosZ)
	}
}

func TestLapTracker_ProcessCarTelemetry2(t *testing.T) {
	lt, _, _, session, ctx := setupLapTrackerTest(t)

	pLap := &packets.PacketLapData{}
	pLap.LapData[0].CurrentLapNum = 1
	lt.ProcessLapData(ctx, session, pLap)

	t2 := &packets.PacketCarTelemetry2Data{}
	t2.CarTelemetry2Data[0].ActiveAeroMode = 1
	t2.CarTelemetry2Data[0].ActiveAeroAvailable = 1
	t2.CarTelemetry2Data[0].OvertakeActive = 1
	lt.ProcessCarTelemetry2(t2)

	tel := &packets.PacketCarTelemetryData{}
	tel.CarTelemetryData[0].Speed = 310
	lt.ProcessTelemetry(ctx, session, tel)

	lt.mu.Lock()
	defer lt.mu.Unlock()

	if len(lt.sampleBuffer) != 1 {
		t.Fatalf("expected 1 sample, got %d", len(lt.sampleBuffer))
	}
	s := lt.sampleBuffer[0]
	if s.ActiveAeroMode != 1 || s.ActiveAeroAvailable != 1 || s.OvertakeActive != 1 {
		t.Errorf("unexpected 2026 telemetry2 fields: Mode=%d Avail=%d Overtake=%d", s.ActiveAeroMode, s.ActiveAeroAvailable, s.OvertakeActive)
	}
}
