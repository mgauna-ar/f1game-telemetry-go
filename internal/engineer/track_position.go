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

// pushLapGapSec is a gap on track in seconds at push-lap pace.
func pushLapGapSec(gapM float32) float64 {
	return float64(gapM) / AverageRaceSpeedMetersPerSec
}
