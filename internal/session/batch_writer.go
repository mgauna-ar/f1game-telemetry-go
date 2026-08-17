package session

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

const (
	defaultBatchBufferSize = 4096
	defaultBatchThreshold  = 300
	defaultFlushInterval   = 500 * time.Millisecond
)

// TelemetryBatchWriter handles asynchronous batching and writing of telemetry samples to the database.
type TelemetryBatchWriter struct {
	repo           *storage.Repository
	sampleChan     chan storage.TelemetrySample
	flushChan      chan chan struct{}
	batchThreshold int
	flushInterval  time.Duration

	mu      sync.Mutex
	started bool
	stopped bool
	done    chan struct{}
}

// NewTelemetryBatchWriter creates and initializes a new TelemetryBatchWriter.
func NewTelemetryBatchWriter(repo *storage.Repository) *TelemetryBatchWriter {
	return &TelemetryBatchWriter{
		repo:           repo,
		sampleChan:     make(chan storage.TelemetrySample, defaultBatchBufferSize),
		flushChan:      make(chan chan struct{}),
		batchThreshold: defaultBatchThreshold,
		flushInterval:  defaultFlushInterval,
		done:           make(chan struct{}),
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

// Enqueue adds a telemetry sample to the write queue without blocking the caller.
func (bw *TelemetryBatchWriter) Enqueue(sample storage.TelemetrySample) {
	bw.mu.Lock()
	if bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.mu.Unlock()

	select {
	case bw.sampleChan <- sample:
	default:
		log.Println("[BatchWriter] WARNING: Telemetry write queue full, dropping sample")
	}
}

// EnqueueBatch adds multiple telemetry samples to the write queue.
func (bw *TelemetryBatchWriter) EnqueueBatch(samples []storage.TelemetrySample) {
	for _, s := range samples {
		bw.Enqueue(s)
	}
}

// Flush synchronously flushes all queued samples to the database.
func (bw *TelemetryBatchWriter) Flush(ctx context.Context) {
	bw.mu.Lock()
	if !bw.started || bw.stopped {
		bw.mu.Unlock()
		bw.drainDirect(ctx)
		return
	}
	bw.mu.Unlock()

	ack := make(chan struct{})
	select {
	case bw.flushChan <- ack:
		select {
		case <-ack:
		case <-ctx.Done():
		}
	case <-ctx.Done():
	case <-bw.done:
		bw.drainDirect(ctx)
	}
}

// Close gracefully flushes all remaining samples and shuts down the worker.
func (bw *TelemetryBatchWriter) Close(ctx context.Context) {
	bw.mu.Lock()
	if bw.stopped {
		bw.mu.Unlock()
		return
	}
	bw.stopped = true
	wasStarted := bw.started
	bw.mu.Unlock()

	if wasStarted {
		ack := make(chan struct{})
		select {
		case bw.flushChan <- ack:
			select {
			case <-ack:
			case <-ctx.Done():
			}
		case <-ctx.Done():
		case <-time.After(2 * time.Second):
		}
		close(bw.done)
	} else {
		bw.drainDirect(ctx)
	}
}

func (bw *TelemetryBatchWriter) drainDirect(ctx context.Context) {
	var buffer []storage.TelemetrySample
	for {
		select {
		case s := <-bw.sampleChan:
			buffer = append(buffer, s)
		default:
			if len(buffer) > 0 {
				_ = bw.repo.SaveTelemetryBatch(ctx, buffer)
			}
			return
		}
	}
}

func (bw *TelemetryBatchWriter) worker(ctx context.Context) {
	ticker := time.NewTicker(bw.flushInterval)
	defer ticker.Stop()

	buffer := make([]storage.TelemetrySample, 0, bw.batchThreshold*2)

	flush := func() {
		if len(buffer) == 0 {
			return
		}
		writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := bw.repo.SaveTelemetryBatch(writeCtx, buffer)
		cancel()
		if err != nil {
			log.Printf("[BatchWriter] Error writing %d telemetry samples: %v", len(buffer), err)
		}
		buffer = buffer[:0]
	}

	for {
		select {
		case <-ctx.Done():
			// Flush any remaining items before exiting
			for {
				select {
				case s := <-bw.sampleChan:
					buffer = append(buffer, s)
				default:
					flush()
					return
				}
			}

		case s := <-bw.sampleChan:
			buffer = append(buffer, s)
			if len(buffer) >= bw.batchThreshold {
				flush()
			}

		case <-ticker.C:
			flush()

		case ack := <-bw.flushChan:
			// Drain all currently available samples in channel
			for {
				select {
				case s := <-bw.sampleChan:
					buffer = append(buffer, s)
				default:
					flush()
					close(ack)
					goto flushed
				}
			}
		flushed:
		}
	}
}
