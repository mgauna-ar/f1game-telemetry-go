package session

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// TelemetryBlobWriter abstracts saving compressed lap telemetry samples.
type TelemetryBlobWriter interface {
	SaveLapTelemetryBlob(ctx context.Context, lapID int64, samples []storage.TelemetrySample) error
}

// LapTelemetryPayload represents a completed lap's telemetry samples ready for compressed storage.
type LapTelemetryPayload struct {
	LapID   int64
	Samples []storage.TelemetrySample
}

// TelemetryBatchWriter handles asynchronous compressed writing of lap telemetry blobs.
type TelemetryBatchWriter struct {
	repo    TelemetryBlobWriter
	lapChan chan LapTelemetryPayload
	flushCh chan chan struct{}
	doneCh  chan struct{}

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
func NewTelemetryBatchWriter(repo TelemetryBlobWriter) *TelemetryBatchWriter {
	return &TelemetryBatchWriter{
		repo:    repo,
		lapChan: make(chan LapTelemetryPayload, DefaultBatchChannelCapacity),
		flushCh: make(chan chan struct{}),
		doneCh:  make(chan struct{}),
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
// If the channel is full (e.g. storage bottleneck), samples are dropped to protect the UDP pipeline.
func (bw *TelemetryBatchWriter) EnqueueLap(lapID int64, samples []storage.TelemetrySample) {
	if lapID <= 0 || len(samples) == 0 {
		return
	}

	bw.mu.Lock()
	defer bw.mu.Unlock()
	if bw.stopped {
		return
	}

	payload := LapTelemetryPayload{
		LapID:   lapID,
		Samples: samples,
	}

	select {
	case bw.lapChan <- payload:
	default:
		slog.Error("Lap telemetry queue full, dropping lap samples to preserve UDP pipeline",
			"lapID", lapID, "samplesDropped", len(samples))
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

	ack := make(chan struct{})
	select {
	case bw.flushCh <- ack:
		select {
		case <-ack:
		case <-ctx.Done():
		case <-bw.doneCh:
		}
	case <-ctx.Done():
	case <-bw.doneCh:
		bw.drainDirect(ctx)
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
	close(bw.doneCh)
	close(bw.lapChan)
	bw.mu.Unlock()

	if started {
		bw.wg.Wait()
	} else {
		bw.drainDirect(ctx)
	}
}

func (bw *TelemetryBatchWriter) writePayload(payload LapTelemetryPayload) {
	writeCtx, cancel := context.WithTimeout(context.Background(), DefaultBatchWriteTimeout)
	defer cancel()
	if err := bw.repo.SaveLapTelemetryBlob(writeCtx, payload.LapID, payload.Samples); err != nil {
		slog.Error("Failed to write lap telemetry blob", "lapID", payload.LapID, "error", err)
	}
}

func (bw *TelemetryBatchWriter) drainBuffer() {
	for {
		select {
		case payload, ok := <-bw.lapChan:
			if !ok {
				return
			}
			bw.writePayload(payload)
		default:
			return
		}
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
	for {
		select {
		case payload, ok := <-bw.lapChan:
			if !ok {
				return
			}
			bw.writePayload(payload)
		case ack := <-bw.flushCh:
			bw.drainBuffer()
			close(ack)
		}
	}
}
