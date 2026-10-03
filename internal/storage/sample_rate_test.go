package storage

import (
	"math"
	"math/rand/v2"
	"slices"
	"testing"
)

const (
	// testLapSeconds is how long the generated laps last.
	testLapSeconds = 90.0
	// testSessionStart is where the generated laps start: well into a session, where float32
	// session times are coarse.
	testSessionStart = 1834.25
)

// feedLap returns seconds of samples sent at hz from start, with session times as the game sends
// them (float32). jitter moves each sample by up to that many seconds either way, and fps, when
// set, moves it to the start of the game frame it falls in.
func feedLap(hz, seconds, start, jitter, fps float64) []TelemetrySample {
	rng := rand.New(rand.NewPCG(1, 2))
	samples := make([]TelemetrySample, int(seconds*hz))
	for i := range samples {
		t := start + float64(i)/hz
		if jitter > 0 {
			t += (rng.Float64()*2 - 1) * jitter
		}
		if fps > 0 {
			t = math.Ceil(t*fps) / fps
		}
		samples[i] = TelemetrySample{
			LapDistance: float64(i),
			SessionTime: float64(float32(t)),
			Speed:       200 + i%100,
		}
	}
	return samples
}

// isOrderedSubset reports whether every sample of sub is in all, unchanged and in the same order.
func isOrderedSubset(sub, all []TelemetrySample) bool {
	j := 0
	for _, s := range sub {
		for j < len(all) && all[j] != s {
			j++
		}
		if j == len(all) {
			return false
		}
		j++
	}
	return true
}

func TestThinSamplesRates(t *testing.T) {
	tests := []struct {
		name   string
		hz     float64
		jitter float64
		fps    float64
		wantHz float64
	}{
		{name: "10 Hz keeps every sample", hz: 10, wantHz: 10},
		{name: "15 Hz keeps every sample", hz: 15, wantHz: 15},
		{name: "20 Hz keeps every sample", hz: 20, wantHz: 20},
		{name: "20 Hz with frame jitter keeps every sample", hz: 20, jitter: 0.012, wantHz: 20},
		{name: "30 Hz is stored at 20 Hz", hz: 30, wantHz: 20},
		{name: "35 Hz is stored at 20 Hz", hz: 35, wantHz: 20},
		{name: "60 Hz is stored at 20 Hz", hz: 60, wantHz: 20},
		{name: "60 Hz on 144 fps frames is stored at 20 Hz", hz: 60, fps: 144, wantHz: 20},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			samples := feedLap(tt.hz, testLapSeconds, testSessionStart, tt.jitter, tt.fps)
			got := ThinSamples(samples)

			if tt.wantHz == tt.hz {
				if len(got) != len(samples) {
					t.Fatalf("kept %d of %d samples, want all", len(got), len(samples))
				}
			} else {
				want := tt.wantHz * testLapSeconds
				if math.Abs(float64(len(got))-want) > want/100 {
					t.Fatalf("kept %d samples, want %.0f ± 1%%", len(got), want)
				}
			}
			if !isOrderedSubset(got, samples) {
				t.Fatal("kept samples are not the input's, unchanged and in order")
			}
			if again := ThinSamples(got); !slices.Equal(again, got) {
				t.Fatalf("thinning again kept %d of %d samples", len(again), len(got))
			}
		})
	}
}

func TestThinSamplesFlashback(t *testing.T) {
	// 60 Hz from 100 s to 110 s, then a flashback to 104 s and on to 114 s
	before := feedLap(60, 10, 100, 0, 0)
	after := feedLap(60, 10, 104, 0, 0)
	samples := append(slices.Clone(before), after...)

	got := ThinSamples(samples)
	want := 2 * 10 * 20.0
	if math.Abs(float64(len(got))-want) > want/50 {
		t.Fatalf("kept %d samples, want %.0f ± 2%%", len(got), want)
	}
	if !slices.Contains(got, after[0]) {
		t.Fatal("the first sample after the flashback was dropped")
	}
	if !isOrderedSubset(got, samples) {
		t.Fatal("kept samples are not the input's, unchanged and in order")
	}
}

func TestThinSamplesDropsRepeatedTimes(t *testing.T) {
	// 20 Hz, with the game paused at the 41st sample: the session time stops while packets keep
	// coming
	samples := feedLap(20, 4, 100, 0, 0)
	paused := samples[:41:41]
	for i := range 30 {
		repeat := samples[40]
		repeat.EngineRPM = 4000 + i
		paused = append(paused, repeat)
	}
	paused = append(paused, samples[41:]...)

	if got := ThinSamples(paused); !slices.Equal(got, samples) {
		t.Fatalf("kept %d samples, want the %d without the repeats", len(got), len(samples))
	}
}

func TestThinSamplesKeepsSamplesWithoutSessionTime(t *testing.T) {
	samples := feedLap(20, 2, 100, 0, 0)
	samples[10].SessionTime = math.NaN()
	samples[20].SessionTime = math.Inf(1)

	got := ThinSamples(samples)
	if len(got) != len(samples) {
		t.Fatalf("kept %d of %d samples, want all", len(got), len(samples))
	}
}

func TestThinSamplesShortInput(t *testing.T) {
	one := []TelemetrySample{{LapDistance: 10, SessionTime: 5}}
	for _, samples := range [][]TelemetrySample{nil, {}, one} {
		if got := ThinSamples(samples); !slices.Equal(got, samples) {
			t.Errorf("ThinSamples(%v) = %v, want it unchanged", samples, got)
		}
	}
}
