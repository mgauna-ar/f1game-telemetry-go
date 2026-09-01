package session

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func setupBatchWriterTest(t *testing.T) (*TelemetryBatchWriter, storage.Repository, *storage.Session, *storage.Lap, context.Context) {
	t.Helper()
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_bw_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(11223344),
		TrackID:      1,
		TrackName:    "Silverstone",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	lap := &storage.Lap{
		SessionID: session.ID,
		CarIndex:  0,
		LapNumber: 1,
		LapTimeMS: 88000,
	}
	if err := repo.SaveLap(ctx, lap, false); err != nil {
		t.Fatalf("failed to save lap: %v", err)
	}

	bw := NewTelemetryBatchWriter(repo)
	t.Cleanup(func() {
		bw.Close(ctx)
		_ = repo.Close()
	})

	return bw, repo, session, lap, ctx
}

func TestBatchWriter_SingleLapWrite(t *testing.T) {
	bw, repo, _, lap, ctx := setupBatchWriterTest(t)

	samples := []storage.TelemetrySample{
		{LapDistance: 0.0, SessionTime: 10.0, Speed: 200, Throttle: 1.0},
		{LapDistance: 50.0, SessionTime: 10.5, Speed: 220, Throttle: 1.0},
		{LapDistance: 100.0, SessionTime: 11.0, Speed: 240, Throttle: 1.0},
	}

	bw.EnqueueLap(lap.ID, samples)
	bw.Flush(ctx)

	savedSamples, err := repo.GetTelemetryByLap(ctx, lap.ID)
	if err != nil {
		t.Fatalf("failed to get telemetry by lap: %v", err)
	}

	if len(savedSamples) != 3 {
		t.Fatalf("expected 3 samples saved, got %d", len(savedSamples))
	}
	if savedSamples[0].Speed != 200 || savedSamples[1].Speed != 220 || savedSamples[2].Speed != 240 {
		t.Errorf("unexpected sample data saved: %+v", savedSamples)
	}
}

func TestBatchWriter_MultipleSequentialWrites(t *testing.T) {
	bw, repo, session, _, ctx := setupBatchWriterTest(t)

	lap2 := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 2, LapTimeMS: 87000}
	lap3 := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 3, LapTimeMS: 86500}
	if err := repo.SaveLap(ctx, lap2, false); err != nil {
		t.Fatalf("failed to save lap 2: %v", err)
	}
	if err := repo.SaveLap(ctx, lap3, false); err != nil {
		t.Fatalf("failed to save lap 3: %v", err)
	}

	samples2 := []storage.TelemetrySample{
		{LapDistance: 10.0, SessionTime: 20.0, Speed: 250},
		{LapDistance: 60.0, SessionTime: 20.5, Speed: 270},
	}
	samples3 := []storage.TelemetrySample{
		{LapDistance: 15.0, SessionTime: 30.0, Speed: 260},
		{LapDistance: 70.0, SessionTime: 30.5, Speed: 280},
		{LapDistance: 120.0, SessionTime: 31.0, Speed: 290},
	}

	bw.EnqueueLap(lap2.ID, samples2)
	bw.EnqueueLap(lap3.ID, samples3)
	bw.Flush(ctx)

	saved2, err := repo.GetTelemetryByLap(ctx, lap2.ID)
	if err != nil || len(saved2) != 2 {
		t.Fatalf("expected 2 samples for lap 2, got %d (err: %v)", len(saved2), err)
	}

	saved3, err := repo.GetTelemetryByLap(ctx, lap3.ID)
	if err != nil || len(saved3) != 3 {
		t.Fatalf("expected 3 samples for lap 3, got %d (err: %v)", len(saved3), err)
	}
}

func TestBatchWriter_EmptySamplesAndInvalidLapID(t *testing.T) {
	bw, _, _, lap, ctx := setupBatchWriterTest(t)
	bw.Start(ctx)

	// Case 1: Nil samples
	bw.EnqueueLap(lap.ID, nil)

	// Case 2: Empty slice
	bw.EnqueueLap(lap.ID, []storage.TelemetrySample{})

	// Case 3: Invalid Lap ID <= 0
	bw.EnqueueLap(0, []storage.TelemetrySample{{Speed: 100}})
	bw.EnqueueLap(-1, []storage.TelemetrySample{{Speed: 100}})

	// Should not block or panic
	bw.Flush(ctx)
}

func TestBatchWriter_ContextCancellation(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_bw_ctx_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	bw := NewTelemetryBatchWriter(repo)
	workerCtx, cancel := context.WithCancel(context.Background())

	bw.Start(workerCtx)

	// Enqueue sample and close
	bw.EnqueueLap(999, []storage.TelemetrySample{{Speed: 150}})
	cancel()
	bw.Close(context.Background())

	// Writing after close should not hang or panic
	bw.EnqueueLap(999, []storage.TelemetrySample{{Speed: 150}})
}

func TestBatchWriter_CleanShutdownViaClose(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_bw_close_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(778899),
		TrackID:      1,
		TrackName:    "Spa",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	ctx := context.Background()
	_ = repo.SaveSession(ctx, session)

	lap := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: 1, LapTimeMS: 105000}
	_ = repo.SaveLap(ctx, lap, false)

	bw := NewTelemetryBatchWriter(repo)
	bw.Start(ctx)

	samples := []storage.TelemetrySample{
		{LapDistance: 50.0, SessionTime: 1.0, Speed: 300},
		{LapDistance: 100.0, SessionTime: 1.5, Speed: 310},
	}

	bw.EnqueueLap(lap.ID, samples)

	// Close should drain the queue and wait for worker to complete
	bw.Close(ctx)

	saved, err := repo.GetTelemetryByLap(ctx, lap.ID)
	if err != nil || len(saved) != 2 {
		t.Fatalf("expected 2 samples drained on close, got %d (err: %v)", len(saved), err)
	}
}

func TestBatchWriter_ConcurrentEnqueueAndClose(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("test_bw_concurrent_%d.db", time.Now().UnixNano()))
	repo, err := storage.NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	session := &storage.Session{
		SessionUID:   storage.FormatSessionUID(556677),
		TrackID:      1,
		TrackName:    "Monza",
		SessionType:  "Race",
		PacketFormat: 2025,
	}
	ctx := context.Background()
	_ = repo.SaveSession(ctx, session)

	bw := NewTelemetryBatchWriter(repo)
	bw.Start(ctx)

	var wg sync.WaitGroup
	for i := 1; i <= 10; i++ {
		lap := &storage.Lap{SessionID: session.ID, CarIndex: 0, LapNumber: i, LapTimeMS: 80000}
		_ = repo.SaveLap(ctx, lap, false)
		wg.Add(1)
		go func(lapID int64) {
			defer wg.Done()
			for s := 0; s < 5; s++ {
				bw.EnqueueLap(lapID, []storage.TelemetrySample{{Speed: 200, SessionTime: float64(s)}})
			}
		}(lap.ID)
	}

	wg.Wait()
	bw.Close(ctx)

	// Multiple Close calls should be safe and idempotent
	bw.Close(ctx)
}
