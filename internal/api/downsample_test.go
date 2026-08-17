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

func TestTrimTelemetryToLastLapAttempt(t *testing.T) {
	// Generate mock samples simulating 2 lap attempts with a distance drop
	samples := make([]storage.TelemetrySample, 0, 50)

	// Attempt 1: 0m -> 4000m (20 samples)
	for i := 0; i < 20; i++ {
		samples = append(samples, storage.TelemetrySample{
			ID:          int64(i + 1),
			LapDistance: float64(i * 200),
			SessionTime: float64(i) * 0.1,
			Speed:       200,
		})
	}

	// Attempt 2 (completed lap): 0.5m -> 4200m (25 samples)
	for i := 0; i < 25; i++ {
		samples = append(samples, storage.TelemetrySample{
			ID:          int64(i + 21),
			LapDistance: float64(i * 170),
			SessionTime: 3.0 + float64(i)*0.1,
			Speed:       250,
		})
	}

	trimmed := TrimTelemetryToLastLapAttempt(samples)
	if len(trimmed) != 25 {
		t.Fatalf("Expected 25 samples after trimming, got %d", len(trimmed))
	}

	if trimmed[0].ID != 21 {
		t.Errorf("Expected first sample ID of last attempt to be 21, got %d", trimmed[0].ID)
	}
	if trimmed[0].LapDistance != 0.0 {
		t.Errorf("Expected start distance of last attempt to be 0.0, got %f", trimmed[0].LapDistance)
	}
}

func TestTrimTelemetryTrailingWrapAround(t *testing.T) {
	// 30 samples: 0m -> 5000m (samples 1 to 26), then 3 wrap-around samples at 1.5m, 3.2m, 5.0m
	samples := make([]storage.TelemetrySample, 0, 30)
	for i := 0; i < 26; i++ {
		samples = append(samples, storage.TelemetrySample{
			ID:          int64(i + 1),
			LapDistance: float64(i * 200),
			SessionTime: float64(i) * 0.1,
			Speed:       250,
		})
	}
	// Trailing wrap-around samples
	samples = append(samples,
		storage.TelemetrySample{ID: 27, LapDistance: 1.5, SessionTime: 2.7, Speed: 250},
		storage.TelemetrySample{ID: 28, LapDistance: 3.2, SessionTime: 2.8, Speed: 250},
		storage.TelemetrySample{ID: 29, LapDistance: 5.0, SessionTime: 2.9, Speed: 250},
	)

	trimmed := TrimTelemetryToLastLapAttempt(samples)
	if len(trimmed) != 26 {
		t.Fatalf("Expected 26 samples after trimming trailing wrap-around, got %d", len(trimmed))
	}
	if trimmed[len(trimmed)-1].ID != 26 {
		t.Errorf("Expected last sample ID to be 26, got %d", trimmed[len(trimmed)-1].ID)
	}
	if trimmed[len(trimmed)-1].LapDistance != 5000.0 {
		t.Errorf("Expected last sample LapDistance to be 5000.0, got %f", trimmed[len(trimmed)-1].LapDistance)
	}
}

func TestVerifyTargetLaps(t *testing.T) {
	repo, err := storage.NewRepository("../../f1telemetry.db")
	if err != nil {
		t.Skip("f1telemetry.db not found, skipping DB integration test")
		return
	}
	defer repo.Close()

	ctx := t.Context()

	// Verify Lap 5696 (Arti Moreno - 83.109s)
	raw5696, err := repo.GetTelemetryByLap(ctx, 5696)
	if err == nil && len(raw5696) > 0 {
		trimmed := TrimTelemetryToLastLapAttempt(raw5696)
		dur := trimmed[len(trimmed)-1].SessionTime - trimmed[0].SessionTime
		if dur < 80.0 || dur > 86.0 {
			t.Errorf("Expected Lap 5696 trimmed duration ~83.1s, got %.3fs", dur)
		}
	}

	// Verify Lap 6437 (Arti Moreno - Lap 1 Losail 97.036s)
	raw6437, err := repo.GetTelemetryByLap(ctx, 6437)
	if err == nil && len(raw6437) > 0 {
		trimmed := TrimTelemetryToLastLapAttempt(raw6437)
		maxD := trimmed[len(trimmed)-1].LapDistance
		dur := trimmed[len(trimmed)-1].SessionTime - trimmed[0].SessionTime
		t.Logf("Lap 6437: maxDist=%.1fm, dur=%.3fs, samples=%d", maxD, dur, len(trimmed))
		if maxD < 5000.0 {
			t.Errorf("Expected Lap 6437 trimmed max distance > 5000m, got %.1fm", maxD)
		}
		if dur < 90.0 || dur > 105.0 {
			t.Errorf("Expected Lap 6437 trimmed duration ~97s, got %.3fs", dur)
		}
	}

	// Verify Lap 6442 (LC-iL.Magno - Lap 1 Losail 102.262s)
	raw6442, err := repo.GetTelemetryByLap(ctx, 6442)
	if err == nil && len(raw6442) > 0 {
		trimmed := TrimTelemetryToLastLapAttempt(raw6442)
		maxD := trimmed[len(trimmed)-1].LapDistance
		dur := trimmed[len(trimmed)-1].SessionTime - trimmed[0].SessionTime
		t.Logf("Lap 6442: maxDist=%.1fm, dur=%.3fs, samples=%d", maxD, dur, len(trimmed))
		if maxD < 5000.0 {
			t.Errorf("Expected Lap 6442 trimmed max distance > 5000m, got %.1fm", maxD)
		}
		if dur < 95.0 || dur > 110.0 {
			t.Errorf("Expected Lap 6442 trimmed duration ~102s, got %.3fs", dur)
		}
	}
}

func TestTrimTelemetryCompletedLapWithTrailingTail(t *testing.T) {
	// Full completed lap from 275m -> 5400m (duration ~95s)
	samples := make([]storage.TelemetrySample, 0, 100)
	for i := 0; i < 60; i++ {
		samples = append(samples, storage.TelemetrySample{
			ID:          int64(i + 1),
			LapDistance: 275.0 + float64(i)*85.0, // 275m to ~5290m
			SessionTime: 0.5 + float64(i)*1.6,
			Speed:       250,
		})
	}
	samples = append(samples, storage.TelemetrySample{
		ID:          61,
		LapDistance: 5417.0,
		SessionTime: 97.0,
		Speed:       270,
	})

	// Trailing stationary tail from 0m to 275m (duration 50s)
	for i := 0; i < 30; i++ {
		samples = append(samples, storage.TelemetrySample{
			ID:          int64(i + 62),
			LapDistance: float64(i * 9), // 0m to 270m
			SessionTime: 98.0 + float64(i)*1.5,
			Speed:       0,
		})
	}

	trimmed := TrimTelemetryToLastLapAttempt(samples)
	if len(trimmed) == 0 {
		t.Fatalf("Expected non-empty trimmed samples")
	}
	maxDist := trimmed[len(trimmed)-1].LapDistance
	if maxDist < 5000.0 {
		t.Errorf("Expected max distance to be the full lap (>5000m), got %.1f", maxDist)
	}
	if trimmed[len(trimmed)-1].ID != 61 {
		t.Errorf("Expected last sample to be ID 61 (finish line), got ID %d", trimmed[len(trimmed)-1].ID)
	}
}
