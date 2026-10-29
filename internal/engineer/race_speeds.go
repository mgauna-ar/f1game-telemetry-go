package engineer

import (
	"cmp"
	"slices"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceSpeeds is how fast the field runs each QuietBinM bin of the lap in this race: the median of
// the last RaceSpeedPasses passes through it, one per car going through. A car braking where the
// field brakes runs these speeds; a crashed, damaged or rejoining car is far under them. One slow
// pass doesn't move a median, while a field slowing down (rain) moves it within half a lap of
// traffic. Kept for the race only, never saved.
type raceSpeeds struct {
	lapM   float32
	passes [][RaceSpeedPasses]float32 // each bin's latest passes, in a ring
	n      []uint8                    // how many passes each bin holds
	next   []uint8                    // where each bin's next pass goes in its ring
	speeds []float32                  // each bin's median, m/s; 0 before its first pass
	known  int                        // bins with RaceSpeedMinPasses passes
	cars   [packets.MaxCars]binPass
}

// binPass is a car's way through its current bin so far: the distance and time it drove in it.
type binPass struct {
	on  bool
	bin int
	m   float64
	ms  int64
}

// reset forgets the race's speeds, for a lap of trackLength.
func (r *raceSpeeds) reset(trackLength float32) {
	bins := quietBins(trackLength)
	*r = raceSpeeds{
		lapM:   trackLength,
		passes: make([][RaceSpeedPasses]float32, bins),
		n:      make([]uint8, bins),
		next:   make([]uint8, bins),
		speeds: make([]float32, bins),
	}
}

// dropPasses forgets the passes each car is part way through (a flashback took it back); the
// speeds learned stay.
func (r *raceSpeeds) dropPasses() {
	r.cars = [packets.MaxCars]binPass{}
}

// learn adds a step car idx drove on a lap of trackLength: step metres from lap distance fromM in
// ms. counts is whether it runs as the field does (racing on track, no Safety Car or yellow
// flag); one that doesn't drops the pass it was on. The step goes to the bin of its middle; once
// the car moves on to another bin, the one it left gets a pass when the car drove
// RaceSpeedMinPassShare of it.
func (r *raceSpeeds) learn(idx int, trackLength, fromM float32, step float64, ms int64, counts bool) {
	if idx < 0 || idx >= packets.MaxCars || trackLength <= 0 {
		return
	}
	if r.lapM != trackLength {
		r.reset(trackLength)
	}
	c := &r.cars[idx]
	if !counts || ms <= 0 {
		*c = binPass{}
		return
	}
	mid := trackGapM(0, fromM+float32(step/2), trackLength)
	bin := min(int(mid/QuietBinM), len(r.speeds)-1)
	if c.on && c.bin == bin {
		c.m += step
		c.ms += ms
		return
	}
	if c.on && c.m >= RaceSpeedMinPassShare*r.binLength(c.bin) {
		r.addPass(c.bin, float32(c.m/(float64(c.ms)/1000)))
	}
	*c = binPass{on: true, bin: bin, m: step, ms: ms}
}

// steps learns the race speeds from the steps of the cars in race session s, on a lap of
// trackLength: a car counts while racing on track, with no Safety Car and no yellow flag where it
// is.
func (r *raceSpeeds) steps(s *packets.PacketSessionData, trackLength float32) motionStep {
	return func(idx int, l *packets.LapData, fromM float32, step float64, ms int64) {
		counts := s.SafetyCarStatus == packets.SafetyCarNone && onTrack(l) && !yellowAt(s, fromM, trackLength)
		r.learn(idx, trackLength, fromM, step, ms, counts)
	}
}

// binLength is how long bin b is: QuietBinM, the last one what is left of the lap.
func (r *raceSpeeds) binLength(b int) float64 {
	if b == len(r.speeds)-1 {
		return float64(r.lapM) - float64(b)*QuietBinM
	}
	return QuietBinM
}

// addPass adds a pass at mps to bin b and works out its median again.
func (r *raceSpeeds) addPass(b int, mps float32) {
	r.passes[b][r.next[b]] = mps
	r.next[b] = (r.next[b] + 1) % RaceSpeedPasses
	if r.n[b] < RaceSpeedPasses {
		r.n[b]++
		if r.n[b] == RaceSpeedMinPasses {
			r.known++
		}
	}
	r.speeds[b] = median(r.passes[b][:r.n[b]])
}

// speedsFor is the field's speeds round a lap of trackLength, a bin without one taking the next
// known bin's; nil until PushMinCoverage of the bins have RaceSpeedMinPasses passes.
func (r *raceSpeeds) speedsFor(trackLength float32) []float32 {
	if r == nil || r.lapM != trackLength || len(r.speeds) == 0 ||
		float64(r.known) < PushMinCoverage*float64(len(r.speeds)) {
		return nil
	}
	filled := slices.Clone(r.speeds)
	for b := range filled {
		for k := 1; filled[b] == 0 && k < len(filled); k++ {
			filled[b] = r.speeds[(b+k)%len(filled)]
		}
	}
	return filled
}

// yellowAt reports whether the marshal zone at lap distance lapM of a lap of trackLength shows a
// yellow flag.
func yellowAt(s *packets.PacketSessionData, lapM, trackLength float32) bool {
	if s == nil || trackLength <= 0 {
		return false
	}
	frac := trackGapM(0, lapM, trackLength) / trackLength
	zones := s.MarshalZones[:min(int(s.NumMarshalZones), len(s.MarshalZones))]
	flag := packets.VehicleFIAFlagNone
	start := float32(-1)
	for _, z := range zones {
		// The zone starting last at or before frac; before the first start, the last zone (it runs
		// over the line).
		if z.ZoneStart <= frac && z.ZoneStart > start {
			flag, start = z.ZoneFlag, z.ZoneStart
		}
	}
	if start < 0 && len(zones) > 0 {
		last := slices.MaxFunc(zones, func(a, b packets.MarshalZone) int { return cmp.Compare(a.ZoneStart, b.ZoneStart) })
		flag = last.ZoneFlag
	}
	return flag == packets.VehicleFIAFlagYellow
}
