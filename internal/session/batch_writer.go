package session

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// LapTelemetryPayload represents a completed lap's telemetry samples ready for compressed storage.
type LapTelemetryPayload struct {
	LapID   int64
	Samples []storage.TelemetrySample
}

// TelemetryBatchWriter handles asynchronous compressed writing of lap telemetry blobs.
type TelemetryBatchWriter struct {
	repo    storage.Repository
	lapChan chan LapTelemetryPayload

	mu      sync.Mutex
	started bool
	stopped bool
	done    chan struct{}
}

const (
	// DefaultBatchChannelCapacity is the maximum number of lap payloads buffered for async writing.
	DefaultBatchChannelCapacity = 128
	// DefaultBatchWriteTimeout is the timeout for writing a lap telemetry blob to storage.
	DefaultBatchWriteTimeout = 5 * time.Second
)

// NewTelemetryBatchWriter creates and initializes a new TelemetryBatchWriter.
func NewTelemetryBatchWriter(repo storage.Repository) *TelemetryBatchWriter {
	return &TelemetryBatchWriter{
		repo:    repo,
		lapChan: make(chan LapTelemetryPayload, DefaultBatchChannelCapacity),
		done:    make(chan struct{}),
	}
}

// Start launches the background worker goroutine for batch writes.
func (bw *TelemetryBatchWriter) Start(ctx context.Context) {
	bw.mu.Lock()
	if bw.started || bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.started = true
	bw.mu.Unlock()

	go bw.worker(ctx)
}

// EnqueueLap queues a completed lap's telemetry samples for asynchronous compressed writing.
func (bw *TelemetryBatchWriter) EnqueueLap(lapID int64, samples []storage.TelemetrySample) {
	if lapID <= 0 || len(samples) == 0 {
		return
	}

	bw.mu.Lock()
	if bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.mu.Unlock()

	payload := LapTelemetryPayload{
		LapID:   lapID,
		Samples: samples,
	}

	select {
	case bw.lapChan <- payload:
	default:
		log.Printf("[BatchWriter] WARNING: Lap telemetry queue full, writing directly for lap %d", lapID)
		writeCtx, cancel := context.WithTimeout(context.Background(), DefaultBatchWriteTimeout)
		_ = bw.repo.SaveLapTelemetryBlob(writeCtx, lapID, samples)
		cancel()
	}
}

// Flush synchronously drains all queued lap payloads to the database.
func (bw *TelemetryBatchWriter) Flush(ctx context.Context) {
	bw.drainDirect(ctx)
}

// Close gracefully flushes all remaining lap telemetry payloads and shuts down the worker.
func (bw *TelemetryBatchWriter) Close(ctx context.Context) {
	bw.mu.Lock()
	if bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.stopped = true
	bw.mu.Unlock()

	bw.drainDirect(ctx)
	close(bw.done)
}

func (bw *TelemetryBatchWriter) drainDirect(ctx context.Context) {
	for {
		select {
		case payload := <-bw.lapChan:
			writeCtx, cancel := context.WithTimeout(ctx, DefaultBatchWriteTimeout)
			if err := bw.repo.SaveLapTelemetryBlob(writeCtx, payload.LapID, payload.Samples); err != nil {
				log.Printf("[BatchWriter] Error writing lap telemetry blob for lap %d: %v", payload.LapID, err)
			}
			cancel()
		default:
			return
		}
	}
}

func (bw *TelemetryBatchWriter) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			bw.drainDirect(context.Background())
			return
		case payload := <-bw.lapChan:
			writeCtx, cancel := context.WithTimeout(context.Background(), DefaultBatchWriteTimeout)
			if err := bw.repo.SaveLapTelemetryBlob(writeCtx, payload.LapID, payload.Samples); err != nil {
				log.Printf("[BatchWriter] Error writing lap telemetry blob for lap %d: %v", payload.LapID, err)
			}
			cancel()
		}
	}
}
