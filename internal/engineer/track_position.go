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

// racingCarAt is the car running in position pos out on the circuit: -1 when there is none, or
// when that car is pitting, in the pits or out of the race, so it isn't racing the player now.
func racingCarAt(ctx *EvaluationContext, pos int) int {
	i := carAtPosition(ctx.LapData, pos)
	if i < 0 || !onTrack(&ctx.LapData.LapData[i]) {
		return -1
	}
	return i
}

// racePaceMps is the player's race pace in metres a second: the track length over their recent
// valid laps (RecentPaceLaps). Laps more than PushPaceMaxOffBest off their best of those (a pit
// stop, a Safety Car) aren't race pace. Before such a lap, their push pace.
func racePaceMps(ctx *EvaluationContext) float64 {
	var recent []uint32
	var best uint32
	for i := len(ctx.PlayerLaps) - 1; i >= 0 && len(recent) < RecentPaceLaps; i-- {
		if rec := ctx.PlayerLaps[i]; rec.Valid && rec.LapTimeMS > 0 {
			recent = append(recent, rec.LapTimeMS)
			if best == 0 || rec.LapTimeMS < best {
				best = rec.LapTimeMS
			}
		}
	}
	var sum, n uint32
	for _, t := range recent {
		if float64(t) <= float64(best)*PushPaceMaxOffBest {
			sum += t
			n++
		}
	}
	if n == 0 {
		return pushPaceMps(ctx, ctx.PlayerCarIndex)
	}
	return float64(ctx.TrackLengthM()) / msToSec(sum/n)
}

// raceGapSec is how many seconds car behind runs behind car ahead in a race, negative when it is
// in fact ahead. It comes from the game's timing where it has it: the delta to the car in front
// when the two run nose to tail, else their deltas to the leader. Without timing, it is the
// distance between them at the player's race pace.
func raceGapSec(ctx *EvaluationContext, ahead, behind int) float64 {
	a, b := ctx.LapData.LapData[ahead], ctx.LapData.LapData[behind]
	if b.CarPosition == a.CarPosition+1 {
		if ms := deltaToCarInFrontMS(b); ms > 0 {
			return msToSec(ms)
		}
	}
	leaderGap := func(l packets.LapData) (uint32, bool) {
		ms := deltaToLeaderMS(l)
		return ms, l.CarPosition == 1 || ms > 0
	}
	aMS, aOK := leaderGap(a)
	bMS, bOK := leaderGap(b)
	if aOK && bOK && a.CarPosition > 0 && b.CarPosition > 0 {
		return msToSec(bMS) - msToSec(aMS)
	}
	return float64(a.TotalDistance-b.TotalDistance) / racePaceMps(ctx)
}
