package analytics

import (
	"math"
	"math/rand/v2"
	"reflect"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

const testTrackLength = 5000.0

// gameLap returns a lap of a testTrackLength track at 20 Hz as the game sends it: float32 values,
// session times with frame jitter, and speed, pedals, steering, gears, ERS and positions that vary
// through the lap. pace scales the speed.
func gameLap(seed uint64, pace float64) (samples []storage.TelemetrySample, lapTimeMS int) {
	rng := rand.New(rand.NewPCG(seed, 7))
	f32 := func(v float64) float64 { return float64(float32(v)) }
	clamp := func(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

	const start, step = 1834.25, 0.05
	t, dist, energy, deployed := start, 0.0, 3_000_000.0, 0.0
	for dist < testTrackLength {
		phase := dist / testTrackLength * 2 * math.Pi
		speed := pace * (215 + 95*math.Sin(phase*7))
		throttle := clamp(0.6+0.6*math.Sin(phase*7+0.4)+rng.NormFloat64()*0.02, 0, 1)
		samples = append(samples, storage.TelemetrySample{
			LapDistance:    f32(dist),
			SessionTime:    f32(t + (rng.Float64()*2-1)*0.012),
			Speed:          int(speed),
			Throttle:       f32(throttle),
			Brake:          f32(clamp(-0.9*math.Sin(phase*7+0.4)-0.1, 0, 1)),
			Steer:          f32(clamp(0.5*math.Sin(phase*11)+rng.NormFloat64()*0.01, -1, 1)),
			Gear:           1 + int(speed/45),
			EngineRPM:      9000 + int(speed*37)%3000,
			DRS:            speed > 290,
			ERSDeploy:      f32(deployed),
			ERSStoreEnergy: f32(energy / 4_000_000 * 100),
			ERSDeployMode:  1 + int(phase)%2,
			WorldPosX:      f32(800*math.Cos(phase) + 150*math.Cos(3*phase)),
			WorldPosY:      f32(4 * math.Sin(phase*3)),
			WorldPosZ:      f32(500*math.Sin(phase) + 100*math.Sin(5*phase)),
		})
		dist += speed / 3.6 * step
		t += step
		deployed += throttle * 40_000 * step
		energy = clamp(energy-throttle*30_000*step+(1-throttle)*60_000*step, 0, 4_000_000)
	}
	return samples, int(math.Round((t - start) * 1000))
}

func TestMergedComparisonAfterStorage(t *testing.T) {
	lapA, lapTimeA := gameLap(1, 1)
	lapB, lapTimeB := gameLap(2, 0.985)
	stored := func(samples []storage.TelemetrySample) []storage.TelemetrySample {
		t.Helper()
		decoded, err := storage.DecodeLapTelemetry(storage.EncodeLapTelemetry(samples))
		if err != nil {
			t.Fatalf("DecodeLapTelemetry: %v", err)
		}
		return decoded
	}

	want := CalculateMergedComparison(lapA, lapB, DefaultComparatorStepMeters, testTrackLength, lapTimeA, lapTimeB)
	got := CalculateMergedComparison(stored(lapA), stored(lapB), DefaultComparatorStepMeters, testTrackLength, lapTimeA, lapTimeB)
	if len(got) != len(want) {
		t.Fatalf("%d points after storage, want %d", len(got), len(want))
	}

	// Each value's rounding step in the response, and the most it may move. Storage rounds samples
	// to finer steps, but the comparator then rounds lap distances to 0.1 m: a sample next to a
	// 5 cm boundary can land on the other side, which moves that point's values by what a 0.1 m step
	// is worth (a few ms, up to 10 cm). Most values come out the same.
	type tolerance struct{ step, most float64 }
	times, inputs, discrete := tolerance{0.001, 0.01}, tolerance{0.01, 0.05}, tolerance{1, 1}
	tolerances := map[string]tolerance{
		"TimeDelta": times, "TimeA": times, "TimeB": times,
		"SpeedA": {1, 2}, "SpeedB": {1, 2}, "SpeedDelta": {1, 2},
		"ThrottleA": inputs, "ThrottleB": inputs, "BrakeA": inputs, "BrakeB": inputs, "SteerA": inputs, "SteerB": inputs,
		"GearA": discrete, "GearB": discrete, "ERSDeployModeA": discrete, "ERSDeployModeB": discrete,
		"ActiveAeroA": discrete, "ActiveAeroB": discrete, "BoostActiveA": discrete, "BoostActiveB": discrete,
		"ERSBatteryA": {0.1, 0.3}, "ERSBatteryB": {0.1, 0.3},
		"WorldX": {0.01, 0.15}, "WorldZ": {0.01, 0.15},
	}
	const (
		minSameShare  = 0.90 // share of each value's points within one rounding step
		roundingSlack = 1e-9
	)
	if values := reflect.TypeFor[MergedTelemetryPoint]().NumField() - 1; values != len(tolerances) {
		t.Fatalf("tolerances cover %d values, want all %d besides the distance", len(tolerances), values)
	}
	for i := range want {
		if got[i].LapDistance != want[i].LapDistance {
			t.Fatalf("point %d at %v m, want %v m", i, got[i].LapDistance, want[i].LapDistance)
		}
	}
	value := func(p MergedTelemetryPoint, name string) *float64 {
		v, ok := reflect.ValueOf(p).FieldByName(name).Interface().(*float64)
		if !ok {
			t.Fatalf("MergedTelemetryPoint.%s is not a *float64", name)
		}
		return v
	}
	for name, tol := range tolerances {
		same := 0
		for i := range want {
			g, w := value(got[i], name), value(want[i], name)
			if (g == nil) != (w == nil) {
				t.Fatalf("point %d %s = %v, want %v", i, name, g, w)
			}
			if g == nil {
				same++
				continue
			}
			diff := math.Abs(*g - *w)
			if diff > tol.most+roundingSlack {
				t.Errorf("point %d %s = %v, want %v ± %v", i, name, *g, *w, tol.most)
			}
			if diff <= tol.step+roundingSlack {
				same++
			}
		}
		if share := float64(same) / float64(len(want)); share < minSameShare {
			t.Errorf("%s: %.1f%% of points within %v, want at least %.0f%%", name, 100*share, tol.step, 100*minSameShare)
		}
	}
}
