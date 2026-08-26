package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func TestNormalizeTelemetrySeries(t *testing.T) {
	t.Run("empty slice returns empty", func(t *testing.T) {
		res := normalizeTelemetrySeries(nil, 0, 0)
		if len(res) != 0 {
			t.Fatalf("expected 0 samples, got %d", len(res))
		}
	})

	t.Run("filters NaNs and infs", func(t *testing.T) {
		dirty := []storage.TelemetrySample{
			{LapDistance: math.NaN(), SessionTime: 10.0, Speed: 200},
			{LapDistance: 50.0, SessionTime: math.NaN(), Speed: 200},
			{LapDistance: math.Inf(1), SessionTime: 12.0, Speed: 200},
			{LapDistance: 0.0, SessionTime: 5.0, Speed: 200},
			{LapDistance: 100.0, SessionTime: 6.0, Speed: 220},
		}
		res := normalizeTelemetrySeries(dirty, 0, 0)
		if len(res) == 0 {
			t.Fatal("expected non-empty result after filtering NaNs")
		}
		for _, s := range res {
			if math.IsNaN(s.LapDistance) || math.IsNaN(s.SessionTime) {
				t.Errorf("found NaN in result: %+v", s)
			}
		}
	})

	t.Run("filters isolated distance spikes", func(t *testing.T) {
		samples := []storage.TelemetrySample{
			{LapDistance: 0, SessionTime: 100, Speed: 200},
			{LapDistance: 100, SessionTime: 101, Speed: 220},
			{LapDistance: 200, SessionTime: 102, Speed: 230},
			{LapDistance: 3500, SessionTime: 102.5, Speed: 230}, // Isolated spike
			{LapDistance: 300, SessionTime: 103, Speed: 240},
			{LapDistance: 400, SessionTime: 104, Speed: 250},
		}
		res := normalizeTelemetrySeries(samples, 0, 0)
		for _, s := range res {
			if s.LapDistance == 3500 {
				t.Error("expected spike at 3500 to be filtered out")
			}
		}
		has300 := false
		for _, s := range res {
			if s.LapDistance == 300 {
				has300 = true
				break
			}
		}
		if !has300 {
			t.Error("expected sample at 300 to be preserved")
		}
	})

	t.Run("backward windowing when expectedLapTimeMs > 0", func(t *testing.T) {
		// 100s of out-lap + 85s flying lap
		samples := make([]storage.TelemetrySample, 0, 185)
		for i := 0; i < 100; i++ {
			samples = append(samples, storage.TelemetrySample{
				LapDistance: float64(i * 50),
				SessionTime: float64(i),
				Speed:       200,
			})
		}
		for i := 0; i < 85; i++ {
			samples = append(samples, storage.TelemetrySample{
				LapDistance: float64(i * 60),
				SessionTime: 100.0 + float64(i),
				Speed:       250,
			})
		}

		res := normalizeTelemetrySeries(samples, 85000, 0)
		if len(res) == 0 {
			t.Fatal("expected non-empty normalized samples")
		}
		// First sample should start at 0.0m with speed ~250
		if res[0].LapDistance != 0.0 {
			t.Errorf("expected start distance 0.0, got %f", res[0].LapDistance)
		}
		if res[0].Speed != 250 {
			t.Errorf("expected flying lap start speed 250, got %d", res[0].Speed)
		}
	})

	t.Run("scales to targetTrackLength when difference is >100m", func(t *testing.T) {
		samples := []storage.TelemetrySample{
			{LapDistance: 0, SessionTime: 0, Speed: 200},
			{LapDistance: 2500, SessionTime: 40, Speed: 250},
			{LapDistance: 5000, SessionTime: 80, Speed: 270},
		}
		res := normalizeTelemetrySeries(samples, 0, 5500)
		if len(res) == 0 {
			t.Fatal("expected non-empty result")
		}
		lastDist := res[len(res)-1].LapDistance
		if lastDist != 5500.0 {
			t.Errorf("expected scaled last distance 5500, got %f", lastDist)
		}
	})
}

func TestInterpolateAtDistance(t *testing.T) {
	samples := []storage.TelemetrySample{
		{LapDistance: 0.0, SessionTime: 0.0, Speed: 100, Throttle: 0.5},
		{LapDistance: 100.0, SessionTime: 2.0, Speed: 200, Throttle: 1.0},
		{LapDistance: 200.0, SessionTime: 4.0, Speed: 300, Throttle: 1.0},
	}

	t.Run("clamping at start before first point", func(t *testing.T) {
		v := interpolateAtDistance(samples, "speed", -10.0, 200.0)
		if v == nil || *v != 100.0 {
			t.Errorf("expected 100.0, got %v", v)
		}
		st := interpolateAtDistance(samples, "session_time", -10.0, 200.0)
		if st == nil || *st != 0.0 {
			t.Errorf("expected 0.0 for session_time clamping, got %v", st)
		}
	})

	t.Run("exact point lookup", func(t *testing.T) {
		v := interpolateAtDistance(samples, "speed", 100.0, 200.0)
		if v == nil || *v != 200.0 {
			t.Errorf("expected 200.0, got %v", v)
		}
	})

	t.Run("linear interpolation midpoint", func(t *testing.T) {
		v := interpolateAtDistance(samples, "speed", 50.0, 200.0)
		if v == nil || *v != 150.0 {
			t.Errorf("expected 150.0, got %v", v)
		}
		thr := interpolateAtDistance(samples, "throttle", 50.0, 200.0)
		if thr == nil || *thr != 0.75 {
			t.Errorf("expected 0.75 throttle, got %v", thr)
		}
	})

	t.Run("clamping at finish line when near finish", func(t *testing.T) {
		v := interpolateAtDistance(samples, "speed", 250.0, 200.0)
		if v == nil || *v != 300.0 {
			t.Errorf("expected 300.0 clamped, got %v", v)
		}
	})

	t.Run("returns nil when lap stopped far short of finish", func(t *testing.T) {
		// Lap stopped at 200m on a 5000m track
		v := interpolateAtDistance(samples, "speed", 3000.0, 5000.0)
		if v != nil {
			t.Errorf("expected nil for aborted lap far from finish, got %v", *v)
		}
	})
}

func TestCalculateMergedComparison(t *testing.T) {
	// Lap A: 101 samples, 0 to 5000m, duration 88s
	lapA := make([]storage.TelemetrySample, 101)
	for i := 0; i <= 100; i++ {
		lapA[i] = storage.TelemetrySample{
			LapDistance:    float64(i * 50),
			SessionTime:    float64(i) * 0.88,
			Speed:          200 + (i%10)*10,
			Throttle:       1.0,
			Brake:          0.0,
			Gear:           6,
			ERSStoreEnergy: 80.0,
			WorldPosX:      float64(i * 10),
			WorldPosZ:      float64(i * 5),
		}
	}

	// Lap B: 101 samples, 0 to 5000m, duration 89s (1s slower)
	lapB := make([]storage.TelemetrySample, 101)
	for i := 0; i <= 100; i++ {
		lapB[i] = storage.TelemetrySample{
			LapDistance:    float64(i * 50),
			SessionTime:    float64(i) * 0.89,
			Speed:          195 + (i%10)*10,
			Throttle:       1.0,
			Brake:          0.0,
			Gear:           6,
			ERSStoreEnergy: 75.0,
			WorldPosX:      float64(i * 10),
			WorldPosZ:      float64(i * 5),
		}
	}

	t.Run("calculates merged comparison with accurate deltas", func(t *testing.T) {
		merged := calculateMergedComparison(lapA, lapB, 10.0, 5000.0, 88000, 89000)
		if len(merged) == 0 {
			t.Fatal("expected non-empty merged points")
		}

		// Initial delta at 0m should be 0.0s
		if merged[0].TimeDelta == nil || *merged[0].TimeDelta != 0.0 {
			t.Errorf("expected initial time delta 0.0, got %v", merged[0].TimeDelta)
		}

		// Final point at 5000m
		finalPt := merged[len(merged)-1]
		if finalPt.LapDistance != 5000.0 {
			t.Errorf("expected final distance 5000m, got %f", finalPt.LapDistance)
		}
		if finalPt.TimeDelta == nil || *finalPt.TimeDelta >= 0.0 {
			t.Errorf("expected Lap A to be faster (time_delta < 0), got %v", finalPt.TimeDelta)
		}
		if finalPt.SpeedA == nil || finalPt.SpeedB == nil {
			t.Fatal("expected valid speedA and speedB")
		}
		if finalPt.SpeedDelta == nil {
			t.Fatal("expected valid speed_delta")
		}
	})

	t.Run("handles single slot telemetry", func(t *testing.T) {
		merged := calculateMergedComparison(lapA, nil, 25.0, 0, 88000, 0)
		if len(merged) == 0 {
			t.Fatal("expected non-empty merged points for single lap")
		}
		if merged[0].SpeedA == nil {
			t.Error("expected valid speedA")
		}
		if merged[0].SpeedB != nil {
			t.Error("expected nil speedB when lapB is omitted")
		}
		if merged[0].TimeDelta != nil {
			t.Error("expected nil time_delta when only one lap provided")
		}
	})
}

func TestDetectTrackTurns(t *testing.T) {
	t.Run("returns empty for small dataset", func(t *testing.T) {
		turns := detectTrackTurns([]MergedTelemetryPoint{})
		if len(turns) != 0 {
			t.Errorf("expected 0 turns, got %d", len(turns))
		}
	})

	t.Run("detects turns on synthetic oval with 2 hairpins", func(t *testing.T) {
		totalPoints := 100
		lapLength := 2000.0
		points := make([]MergedTelemetryPoint, totalPoints)

		for i := 0; i < totalPoints; i++ {
			dist := (float64(i) / float64(totalPoints)) * lapLength
			angle := (float64(i) / float64(totalPoints)) * math.Pi * 2
			worldX := math.Cos(angle) * 300.0
			worldZ := math.Sin(angle) * 100.0
			speed := 100.0 + 100.0*math.Abs(math.Sin(angle))

			spA := speed
			spB := speed
			wX := worldX
			wZ := worldZ

			points[i] = MergedTelemetryPoint{
				LapDistance: dist,
				SpeedA:      &spA,
				SpeedB:      &spB,
				WorldX:      &wX,
				WorldZ:      &wZ,
			}
		}

		turns := detectTrackTurns(points)
		if len(turns) < 2 {
			t.Fatalf("expected at least 2 turns on oval, got %d", len(turns))
		}

		if turns[0].Name != "T1" || turns[1].Name != "T2" {
			t.Errorf("expected T1 and T2 names, got %s and %s", turns[0].Name, turns[1].Name)
		}
		if turns[0].Distance < 0 || turns[0].Distance > lapLength {
			t.Errorf("turn distance out of bounds: %f", turns[0].Distance)
		}
		if math.IsNaN(turns[0].NormalX) || math.IsNaN(turns[0].NormalZ) {
			t.Errorf("invalid normal vector: (%f, %f)", turns[0].NormalX, turns[0].NormalZ)
		}
	})
}

func TestComparatorLRUCache(t *testing.T) {
	cache := NewComparatorLRUCache(2)

	resp1 := &ComparatorResponse{Points: []MergedTelemetryPoint{{LapDistance: 10}}}
	resp2 := &ComparatorResponse{Points: []MergedTelemetryPoint{{LapDistance: 20}}}
	resp3 := &ComparatorResponse{Points: []MergedTelemetryPoint{{LapDistance: 30}}}

	cache.Put("key1", resp1)
	cache.Put("key2", resp2)

	// Verify get
	got1, ok := cache.Get("key1")
	if !ok || len(got1.Points) != 1 || got1.Points[0].LapDistance != 10 {
		t.Error("failed to retrieve key1")
	}

	// Putting key3 should evict key2 (since key1 was accessed more recently)
	cache.Put("key3", resp3)

	if _, ok := cache.Get("key2"); ok {
		t.Error("expected key2 to be evicted")
	}
	if _, ok := cache.Get("key1"); !ok {
		t.Error("expected key1 to still be in cache")
	}
	if _, ok := cache.Get("key3"); !ok {
		t.Error("expected key3 to be in cache")
	}

	// Concurrency test
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			k := fmt.Sprintf("k%d", idx%5)
			cache.Put(k, &ComparatorResponse{})
			_, _ = cache.Get(k)
		}(i)
	}
	wg.Wait()
}

func TestHandleComparatorMerge(t *testing.T) {
	// Initialize in-memory SQLite repo
	repo, err := storage.NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	defer repo.Close()

	ctx := context.Background()

	// Seed session
	session := &storage.Session{
		SessionUID:      "0x1234567890ABCDEF",
		TrackID:         1,
		TrackName:       "Silverstone",
		SessionType:     "Race",
		Weather:         "Clear",
		WeatherForecast: "[]",
		PacketFormat:    2026,
	}
	if err := repo.SaveSession(ctx, session); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	// Seed participants
	participants := []storage.Participant{
		{SessionID: session.ID, CarIndex: 0, Name: "Verstappen", RaceNumber: 1},
		{SessionID: session.ID, CarIndex: 1, Name: "Norris", RaceNumber: 4},
	}
	if err := repo.SaveParticipants(ctx, session.ID, participants); err != nil {
		t.Fatalf("failed to save participants: %v", err)
	}

	// Seed Lap 1
	lap1 := &storage.Lap{
		SessionID:    session.ID,
		CarIndex:     0,
		LapNumber:    1,
		LapTimeMS:    88000,
		IsValid:      true,
		TyreCompound: "SOFT",
		Stint:        1,
	}
	if err := repo.SaveLap(ctx, lap1, false); err != nil {
		t.Fatalf("failed to save lap1: %v", err)
	}

	telemetry1 := make([]storage.TelemetrySample, 50)
	for i := 0; i < 50; i++ {
		telemetry1[i] = storage.TelemetrySample{
			LapDistance:    float64(i * 100),
			SessionTime:    float64(i) * 1.76,
			Speed:          250,
			Throttle:       1.0,
			Brake:          0.0,
			Gear:           7,
			ERSStoreEnergy: 90.0,
			WorldPosX:      float64(i * 10),
			WorldPosZ:      float64(i * 5),
		}
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap1.ID, telemetry1); err != nil {
		t.Fatalf("failed to save telemetry1: %v", err)
	}

	// Seed Lap 2
	lap2 := &storage.Lap{
		SessionID:    session.ID,
		CarIndex:     1,
		LapNumber:    1,
		LapTimeMS:    89000,
		IsValid:      true,
		TyreCompound: "MEDIUM",
		Stint:        1,
	}
	if err := repo.SaveLap(ctx, lap2, false); err != nil {
		t.Fatalf("failed to save lap2: %v", err)
	}

	telemetry2 := make([]storage.TelemetrySample, 50)
	for i := 0; i < 50; i++ {
		telemetry2[i] = storage.TelemetrySample{
			LapDistance:    float64(i * 100),
			SessionTime:    float64(i) * 1.78,
			Speed:          245,
			Throttle:       1.0,
			Brake:          0.0,
			Gear:           7,
			ERSStoreEnergy: 85.0,
			WorldPosX:      float64(i * 10),
			WorldPosZ:      float64(i * 5),
		}
	}
	if err := repo.SaveLapTelemetryBlob(ctx, lap2.ID, telemetry2); err != nil {
		t.Fatalf("failed to save telemetry2: %v", err)
	}

	server := NewServer(repo, nil, nil)

	t.Run("merges both laps via HTTP endpoint", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/comparator/merge?lapA=%d&lapB=%d&stepMeters=50", lap1.ID, lap2.ID), http.NoBody)
		rec := httptest.NewRecorder()

		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp ComparatorResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}

		if len(resp.Points) == 0 {
			t.Fatal("expected non-empty points array")
		}
		if resp.LapA == nil || resp.LapA.Driver != "#1 Verstappen" {
			t.Errorf("unexpected LapA metadata: %+v", resp.LapA)
		}
		if resp.LapB == nil || resp.LapB.Driver != "#4 Norris" {
			t.Errorf("unexpected LapB metadata: %+v", resp.LapB)
		}
	})

	t.Run("empty query returns empty points without error", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/comparator/merge", http.NoBody)
		rec := httptest.NewRecorder()

		server.Router().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp ComparatorResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		if len(resp.Points) != 0 {
			t.Errorf("expected 0 points, got %d", len(resp.Points))
		}
	})
}
