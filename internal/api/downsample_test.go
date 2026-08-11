package api

import (
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestDownsampleTelemetry(t *testing.T) {
	// Generate 100 mock samples
	samples := make([]storage.TelemetrySample, 100)
	for i := 0; i < 100; i++ {
		samples[i] = storage.TelemetrySample{
			ID:          int64(i + 1),
			LapDistance: float64(i * 5),
			SessionTime: float64(i) * 0.1,
			Speed:       100 + (i % 20),
		}
	}

	// Downsample to 20 points
	downsampled := DownsampleTelemetry(samples, 20)
	if len(downsampled) != 20 {
		t.Errorf("Expected 20 samples, got %d", len(downsampled))
	}

	// Verify first and last points are preserved
	if downsampled[0].ID != samples[0].ID {
		t.Errorf("Expected first point ID %d, got %d", samples[0].ID, downsampled[0].ID)
	}
	if downsampled[19].ID != samples[99].ID {
		t.Errorf("Expected last point ID %d, got %d", samples[99].ID, downsampled[19].ID)
	}

	// Requesting more or equal points than available should return original slice
	noChange := DownsampleTelemetry(samples, 150)
	if len(noChange) != 100 {
		t.Errorf("Expected 100 samples when threshold > len, got %d", len(noChange))
	}
}
