package engineer

import (
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Where cars are on track relative to each other. TotalDistance is the distance a car has driven
// in the session, so it only orders cars that left the line together and never stopped (a race);
// in qualifying and practice, where cars run their own laps, track position comes from
// LapDistance.

// trackGapM is how far a car at lap distance from must drive to reach the spot of a car at lap
// distance to, in metres, in [0, trackLen). A lap distance below zero (before a car first crosses
// the line) counts back from the line.
func trackGapM(from, to, trackLen float32) float32 {
	if trackLen <= 0 {
		return 0
	}
	gap := math.Mod(float64(to-from), float64(trackLen))
	if gap < 0 {
		gap += float64(trackLen)
	}
	return float32(gap)
}

// onTrack reports whether a car is out on the circuit: running, out of the garage and not in the
// pit lane.
func onTrack(l *packets.LapData) bool {
	return l.ResultStatus == packets.ResultStatusActive && l.DriverStatus != packets.DriverStatusInGarage &&
		l.PitStatus == packets.PitStatusNone
}

// pushLapGapSec is a gap on track in seconds at push-lap pace paceMps.
func pushLapGapSec(gapM float32, paceMps float64) float64 {
	return float64(gapM) / paceMps
}

// pushPaceMps is car idx's push-lap pace in metres a second: the track length over its best lap.
// A car without a lap yet, or whose best is more than PushPaceMaxOffBest off the session's best
// (an out-lap, a lap with a spin), runs at the session's best; before anyone has set a lap, at
// AverageRaceSpeedMetersPerSec.
func pushPaceMps(ctx *EvaluationContext, idx int) float64 {
	sessionBest := sessionBestLapMS(ctx)
	if sessionBest == 0 {
		return AverageRaceSpeedMetersPerSec
	}
	best := sessionBest
	if idx >= 0 && idx < packets.MaxCars {
		if t := historyBestLapMS(ctx.CarHistory[idx]); t > 0 && float64(t) <= float64(sessionBest)*PushPaceMaxOffBest {
			best = t
		}
	}
	return float64(ctx.TrackLengthM()) / msToSec(best)
}

// sessionBestLapMS is the best lap of any car this session, or 0 while nobody has set one.
func sessionBestLapMS(ctx *EvaluationContext) uint32 {
	if ctx.CarHistory == nil {
		return 0
	}
	var best uint32
	for _, h := range ctx.CarHistory {
		if t := historyBestLapMS(h); t > 0 && (best == 0 || t < best) {
			best = t
		}
	}
	return best
}
