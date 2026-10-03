package storage

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

const (
	// recordInterval is the session time, in seconds, between stored lap telemetry samples.
	recordInterval = 1.0 / packets.RecordedTelemetryHz
	// fastFeedStep is the step between samples under which a lap counts as sent faster than
	// RecordedTelemetryHz. A 20 Hz feed's samples follow the game's frames, 38 to 61 ms apart;
	// 30, 35 and 60 Hz feeds send them every 33, 29 and 17 ms.
	fastFeedStep = recordInterval * 3 / 4
	// recordEarlyTolerance is how early a sample of a fast feed may come for its slot and still be
	// kept. A slot takes samples from this early to a slot late, which always holds one of a fast
	// feed's samples, so no slot is left empty.
	recordEarlyTolerance = recordInterval * 2 / 5
)

// ThinSamples stores a lap's telemetry at most packets.RecordedTelemetryHz, so a lap takes the
// same space whatever UDP Send Rate the game uses.
//
// A lap whose samples mostly come less than fastFeedStep apart (the game's 30, 35 and 60 Hz) keeps
// one sample per recordInterval slot of session time: the first one at most recordEarlyTolerance
// early. The slots restart at a sample that comes more than a slot late (a pause). Any other lap
// (10, 15 and 20 Hz) keeps every sample. Either way, repeated session times are dropped, a sample
// that goes back in session time (flashback, restart) is kept and starts again from there, and
// samples without a finite session time are kept.
//
// The kept samples are returned unchanged and in order, and thinning them again changes nothing.
func ThinSamples(samples []TelemetrySample) []TelemetrySample {
	if len(samples) <= 1 {
		return samples
	}

	fast := isFastFeed(samples)
	kept := make([]TelemetrySample, 0, len(samples))
	started := false
	var last, next float64
	for _, s := range samples {
		t := s.SessionTime
		switch {
		case math.IsNaN(t) || math.IsInf(t, 0):
			// Kept without moving the slots
		case !started || t < last:
			started = true
			last, next = t, t+recordInterval
		case t == last:
			continue
		case !fast:
			last = t
		case t >= next+recordInterval:
			last, next = t, t+recordInterval
		case t < next-recordEarlyTolerance:
			continue
		default:
			last, next = t, next+recordInterval
		}
		kept = append(kept, s)
	}
	return kept
}

// isFastFeed reports whether most steps forward in session time between consecutive samples are
// shorter than fastFeedStep.
func isFastFeed(samples []TelemetrySample) bool {
	short, long := 0, 0
	for i := 1; i < len(samples); i++ {
		step := samples[i].SessionTime - samples[i-1].SessionTime
		switch {
		case math.IsNaN(step) || step <= 0:
			// Repeats, rewinds and unknown times say nothing about the rate
		case step < fastFeedStep:
			short++
		default:
			long++
		}
	}
	return short > long
}
