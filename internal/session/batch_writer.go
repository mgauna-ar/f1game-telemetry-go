package session

import (
	"context"
	"log/slog"
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
	wg      sync.WaitGroup
}

const (
	// DefaultBatchChannelCapacity is the maximum number of lap payloads buffered for async writing.
	DefaultBatchChannelCapacity = 128
	// DefaultBatchWriteTimeout is the maximum time allowed for writing a single lap blob.
	DefaultBatchWriteTimeout = 5 * time.Second
)

// NewTelemetryBatchWriter creates an unstarted batch writer.
func NewTelemetryBatchWriter(repo storage.Repository) *TelemetryBatchWriter {
	return &TelemetryBatchWriter{
		repo:    repo,
		lapChan: make(chan LapTelemetryPayload, DefaultBatchChannelCapacity),
	}
}

// Start spawns the background worker goroutine.
func (bw *TelemetryBatchWriter) Start(ctx context.Context) {
	bw.mu.Lock()
	if bw.started || bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.started = true
	bw.wg.Add(1)
	bw.mu.Unlock()

	go bw.worker(ctx)
}

// EnqueueLap queues a completed lap's telemetry samples for asynchronous saving.
// If the channel is full (e.g. storage bottleneck), it writes synchronously to avoid data loss.
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
		slog.Warn("Lap telemetry queue full, writing directly", "lapID", lapID)
		writeCtx, cancel := context.WithTimeout(context.Background(), DefaultBatchWriteTimeout)
		_ = bw.repo.SaveLapTelemetryBlob(writeCtx, lapID, samples)
		cancel()
	}
}

// Flush synchronously drains all queued lap payloads to the database.
func (bw *TelemetryBatchWriter) Flush(ctx context.Context) {
	bw.mu.Lock()
	started := bw.started
	stopped := bw.stopped
	bw.mu.Unlock()

	if !started || stopped {
		bw.drainDirect(ctx)
		return
	}

	for len(bw.lapChan) > 0 {
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Millisecond):
		}
	}
}

// Close gracefully flushes all remaining lap telemetry payloads and shuts down the worker.
func (bw *TelemetryBatchWriter) Close(ctx context.Context) {
	bw.mu.Lock()
	if bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.stopped = true
	started := bw.started
	bw.mu.Unlock()

	close(bw.lapChan)

	if started {
		bw.wg.Wait()
	} else {
		bw.drainDirect(ctx)
	}
}

func (bw *TelemetryBatchWriter) drainDirect(ctx context.Context) {
	for {
		select {
		case payload, ok := <-bw.lapChan:
			if !ok {
				return
			}
			writeCtx, cancel := context.WithTimeout(ctx, DefaultBatchWriteTimeout)
			if err := bw.repo.SaveLapTelemetryBlob(writeCtx, payload.LapID, payload.Samples); err != nil {
				slog.Error("Failed to write lap telemetry blob", "lapID", payload.LapID, "error", err)
			}
			cancel()
		default:
			return
		}
	}
}

func (bw *TelemetryBatchWriter) worker(ctx context.Context) {
	defer bw.wg.Done()
	for payload := range bw.lapChan {
		writeCtx, cancel := context.WithTimeout(context.Background(), DefaultBatchWriteTimeout)
		if err := bw.repo.SaveLapTelemetryBlob(writeCtx, payload.LapID, payload.Samples); err != nil {
			slog.Error("Failed to write lap telemetry blob", "lapID", payload.LapID, "error", err)
		}
		cancel()
	}
}
