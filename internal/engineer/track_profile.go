package engineer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"slices"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TrackProfileStore keeps what the engineer learned about each track between runs. The storage
// repository's settings rows satisfy it.
type TrackProfileStore interface {
	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key, value string) error
}

// trackProfileSettingKey is the settings row the learned tracks are saved under. It keeps the
// name it had when it only held pit entries, so those survive. Only the server reads it.
const trackProfileSettingKey = "engineer_pit_lanes"

// trackProfiles learns what the game doesn't send about each track, from how the cars run it:
//   - the pit lane: where it starts (the lap distance at which cars' pit status goes from none to
//     pitting), where it ends (where their pit lane timer stops) and how long a stop keeps a car
//     in it, so what a stop costs is known;
//   - the quiet stretches of a lap: where the player is flat out, off the brakes and straight, so
//     routine calls can be said there;
//   - how fast a push lap goes round each stretch of the lap, from every car on one, so when two
//     cars meet can be worked out wherever they are.
//
// Each value is the median of the latest samples, or an average over laps, so one odd sample
// doesn't move it.
type trackProfiles struct {
	tracks map[int8]*trackProfile
	saves  chan string // JSON snapshots for the saver; nil when nothing is saved

	lane [packets.MaxCars]pitLaneVisit // each car's pit lane visit under way
	lap  quietLap                      // the player's lap being sampled
	// pushSaveLap is the player's lap when push speeds were last saved; pushDirty says some were
	// learned since. They are saved once a lap.
	pushSaveLap int
	pushDirty   bool
}

// trackProfile is what was learned about one track.
type trackProfile struct {
	entryM []float32 // lap distances cars started pitting at, oldest first
	exitM  []float32 // lap distances race stops left the pit lane at
	laneMs []float32 // time race stops spent in the pit lane, ms
	// quiet is, for each QuietBinM stretch of the lap, the share of the player's samples there
	// that were flat out, off the brakes and straight, averaged over laps; speed is the player's
	// speed there in m/s. Both have one value per bin, from quietLaps laps.
	quiet     []float32
	speed     []float32
	quietLaps int
	// push is the speed of the cars on push laps in each QuietBinM bin, m/s (0: none seen there),
	// from pushN samples (counted up to PushSpeedMeanSamples, and not saved).
	push  []float32
	pushN []uint16
}

// pitLaneVisit follows one car through the pit lane, from when its pit lane timer starts.
type pitLaneVisit struct {
	active  bool
	laneMs  uint16 // the timer's latest reading
	stopped bool   // the car stopped in its box
	penalty bool   // it served a penalty at the stop, which makes the stop longer
}

// quietLap gathers the player's samples of one lap, per bin, until the lap ends.
type quietLap struct {
	track   int8
	lapNum  int  // the player's lap being sampled; 0 when none
	spoiled bool // a flashback took the lap back: its samples aren't one lap
	samples []uint16
	quiet   []uint16
	speed   []float32 // sum of the samples' speeds, m/s
}

// savedTrackProfiles is the saved form: a profile per track ID.
type savedTrackProfiles struct {
	Tracks map[string]savedTrackProfile `json:"tracks"`
}

type savedTrackProfile struct {
	EntryM    []float32 `json:"entry_m"`
	ExitM     []float32 `json:"exit_m,omitempty"`
	LaneMs    []float32 `json:"lane_ms,omitempty"`
	Quiet     []float32 `json:"quiet,omitempty"`
	SpeedMps  []float32 `json:"speed_mps,omitempty"`
	QuietLaps int       `json:"quiet_laps,omitempty"`
	PushMps   []float32 `json:"push_mps,omitempty"`
}

func newTrackProfiles() *trackProfiles {
	return &trackProfiles{tracks: make(map[int8]*trackProfile)}
}

// profile is what was learned about track, or nil when nothing was.
func (p *trackProfiles) profile(track int8) *trackProfile {
	return p.tracks[track]
}

// learning returns the profile of track to add to, making it if needed.
func (p *trackProfiles) learning(track int8) *trackProfile {
	t := p.tracks[track]
	if t == nil {
		t = &trackProfile{}
		p.tracks[track] = t
	}
	return t
}

// resetSession forgets what was under way when a session ends: pit lane visits and the lap being
// sampled. What was learned stays.
func (p *trackProfiles) resetSession() {
	p.lane = [packets.MaxCars]pitLaneVisit{}
	p.lap = quietLap{}
}

// entry is the learned pit entry of the track as a lap distance in metres, or 0 when not known yet.
func (t *trackProfile) entry() float32 {
	if t == nil {
		return 0
	}
	return median(t.entryM)
}

// median is the middle of samples (the mean of the middle two for an even count), or 0 for none.
func median(samples []float32) float32 {
	if len(samples) == 0 {
		return 0
	}
	sorted := slices.Clone(samples)
	slices.Sort(sorted)
	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[mid-1] + sorted[mid]) / 2
	}
	return sorted[mid]
}

// addSample appends v to samples, keeping the latest keep.
func addSample(samples []float32, v float32, keep int) []float32 {
	samples = append(samples, v)
	if len(samples) > keep {
		samples = samples[len(samples)-keep:]
	}
	return samples
}

// learnPitLane records the pit lanes of the cars between prev and next: where cars started
// pitting, and in a race, how long a stop kept them in the pit lane and where they left it. A
// stop to serve a penalty, a drive-through and a car going to its garage aren't timed.
func (p *trackProfiles) learnPitLane(session *packets.PacketSessionData, prev, next *packets.PacketLapData) {
	if session == nil || prev == nil || session.TrackId < 0 || session.TrackLength == 0 {
		return
	}
	trackLength := float32(session.TrackLength)
	onLap := func(d float32) bool { return d > 0 && d <= trackLength }
	race := packets.IsRaceSession(session.SessionType)
	learned := false
	for i := range next.LapData {
		after := next.LapData[i]
		if enteredPitLane(prev.LapData[i], after) && after.DriverStatus != packets.DriverStatusInGarage && onLap(after.LapDistance) {
			t := p.learning(session.TrackId)
			t.entryM = addSample(t.entryM, after.LapDistance, PitEntryMaxSamples)
			learned = true
		}
		if !race {
			continue
		}

		v := &p.lane[i]
		if after.PitLaneTimerActive == 1 {
			v.active = true
			v.laneMs = after.PitLaneTimeInLaneInMS
			v.stopped = v.stopped || after.PitStatus == packets.PitStatusInPitArea || after.PitStopTimerInMS > 0
			v.penalty = v.penalty || after.PitStopShouldServePen != 0
			continue
		}
		if !v.active {
			continue
		}
		// The timer stopped: the car crossed the pit exit line.
		visit := *v
		*v = pitLaneVisit{}
		if !visit.stopped || visit.penalty || visit.laneMs < PitLaneMinMs || after.DriverStatus == packets.DriverStatusInGarage || !onLap(after.LapDistance) {
			continue
		}
		t := p.learning(session.TrackId)
		t.laneMs = addSample(t.laneMs, float32(visit.laneMs), PitLaneMaxSamples)
		t.exitM = addSample(t.exitM, after.LapDistance, PitLaneMaxSamples)
		learned = true
	}
	if learned {
		p.queueSave()
	}
}

// pitLossSec is what a stop costs at the track against staying out, in seconds: the median time
// stops spent in the pit lane less the time the same stretch takes at racing speed (the learned
// speeds of the lap where known, else paceMps). ok is false until a stop was timed there.
func (t *trackProfile) pitLossSec(trackLength float32, paceMps float64) (float64, bool) {
	if t == nil || len(t.laneMs) == 0 || len(t.entryM) == 0 || len(t.exitM) == 0 || trackLength <= 0 || paceMps <= 0 {
		return 0, false
	}
	entry, exit := median(t.entryM), median(t.exitM)
	stretch := exit - entry
	if stretch <= 0 {
		stretch += trackLength
	}
	racingSec := float64(stretch) / paceMps
	if t.quietLearned() {
		racingSec = float64(t.stretchMs(trackLength, entry, stretch)) / 1000
	}
	loss := float64(median(t.laneMs))/1000 - racingSec
	if loss < PitLossMinSec || loss > PitLossMaxSec {
		return 0, false
	}
	return loss, true
}

// sampleQuiet adds one telemetry sample of the player, lapDistance into lap lapNum, to the lap
// being sampled.
func (p *trackProfiles) sampleQuiet(track int8, trackLength float32, lapNum int, lapDistance float32, tele *packets.CarTelemetryData) {
	bins := quietBins(trackLength)
	q := &p.lap
	if q.lapNum != lapNum || q.track != track || len(q.samples) != bins {
		*q = quietLap{track: track, lapNum: lapNum, samples: make([]uint16, bins), quiet: make([]uint16, bins), speed: make([]float32, bins)}
	}
	if lapDistance < 0 || lapDistance >= trackLength {
		return
	}
	b := min(int(lapDistance/QuietBinM), bins-1)
	q.samples[b]++
	q.speed[b] += float32(tele.Speed) / 3.6
	if isQuietSample(tele) {
		q.quiet[b]++
	}
}

// isQuietSample reports whether the driver is flat out, off the brakes and straight: a moment a
// call can be said without getting in the way.
func isQuietSample(tele *packets.CarTelemetryData) bool {
	return tele.Throttle >= QuietThrottleMin && tele.Brake <= QuietBrakeMax &&
		math.Abs(float64(tele.Steer)) <= QuietSteerMax && float64(tele.Speed) >= QuietMinSpeedKmh
}

// spoilQuietLap drops the lap being sampled: a flashback took it back.
func (p *trackProfiles) spoilQuietLap() {
	p.lap.spoiled = true
}

// endQuietLap folds the player's lap into the track's quiet stretches once they start lap nextLap:
// only a whole lap, sampled at racing pace (no pit stop, Safety Car or flashback in it).
func (p *trackProfiles) endQuietLap(nextLap int) {
	q := p.lap
	if q.lapNum == 0 || nextLap == q.lapNum {
		return
	}
	p.lap = quietLap{}
	if nextLap != q.lapNum+1 || q.spoiled || len(q.samples) == 0 {
		return
	}
	covered := 0
	for _, n := range q.samples {
		if n > 0 {
			covered++
		}
	}
	if float64(covered) < QuietMinCoverage*float64(len(q.samples)) {
		return
	}
	t := p.learning(q.track)
	if len(t.quiet) != len(q.samples) {
		t.quiet, t.speed, t.quietLaps = make([]float32, len(q.samples)), make([]float32, len(q.samples)), 0
	}
	for b, n := range q.samples {
		if n == 0 {
			continue
		}
		share := float32(q.quiet[b]) / float32(n)
		speed := q.speed[b] / float32(n)
		if t.speed[b] == 0 {
			t.quiet[b], t.speed[b] = share, speed
			continue
		}
		t.quiet[b] += QuietLapWeight * (share - t.quiet[b])
		t.speed[b] += QuietLapWeight * (speed - t.speed[b])
	}
	t.quietLaps++
	p.queueSave()
}

// quietBins is how many QuietBinM bins a lap of trackLength has.
func quietBins(trackLength float32) int {
	return max(int(math.Ceil(float64(trackLength)/QuietBinM)), 1)
}

// quietLearned reports whether enough laps were sampled to know the track's quiet stretches.
func (t *trackProfile) quietLearned() bool {
	return t != nil && t.quietLaps >= QuietLearnMinLaps && len(t.quiet) > 0
}

// binSpeed is the player's learned speed in bin b, in m/s.
func (t *trackProfile) binSpeed(b int) float64 {
	return binSpeedOf(t.speed, b)
}

// binSpeedOf is speeds' value in bin b, or QuietUnknownSpeedMps where it isn't known.
func binSpeedOf(speeds []float32, b int) float64 {
	if s := float64(speeds[b]); s >= 1 {
		return s
	}
	return QuietUnknownSpeedMps
}

// learnPushSpeed adds a car on a push lap going mps at lap distance lapM to track's push speeds.
func (p *trackProfiles) learnPushSpeed(track int8, trackLength, lapM float32, mps float64) {
	if track < 0 || trackLength <= 0 || mps <= 0 {
		return
	}
	bins := quietBins(trackLength)
	t := p.learning(track)
	if len(t.push) != bins {
		t.push = make([]float32, bins)
	}
	if len(t.pushN) != bins {
		// Saved speeds count as fully learned.
		t.pushN = make([]uint16, bins)
		for b, v := range t.push {
			if v > 0 {
				t.pushN[b] = PushSpeedMeanSamples
			}
		}
	}
	// The first samples in a bin are averaged, so one odd sample (a step across a braking point)
	// doesn't set it; then each weighs PushSpeedWeight.
	b := min(int(trackGapM(0, lapM, trackLength)/QuietBinM), bins-1)
	t.pushN[b] = min(t.pushN[b]+1, PushSpeedMeanSamples)
	weight := max(1/float32(t.pushN[b]), PushSpeedWeight)
	t.push[b] += weight * (float32(mps) - t.push[b])
	p.pushDirty = true
}

// savePushSpeeds saves the push speeds learned since the last save, once the player is on another
// lap than then.
func (p *trackProfiles) savePushSpeeds(playerLap int) {
	if p.pushDirty && playerLap != p.pushSaveLap {
		p.pushDirty, p.pushSaveLap = false, playerLap
		p.queueSave()
	}
}

// pushSpeeds is the push speeds round a lap of trackLength, a bin without one taking the next
// known bin's; nil until PushMinCoverage of the bins were seen.
func (t *trackProfile) pushSpeeds(trackLength float32) []float32 {
	if t == nil || len(t.push) == 0 || len(t.push) != quietBins(trackLength) {
		return nil
	}
	known := 0
	for _, v := range t.push {
		if v > 0 {
			known++
		}
	}
	if float64(known) < PushMinCoverage*float64(len(t.push)) {
		return nil
	}
	filled := slices.Clone(t.push)
	for b := range filled {
		for k := 1; filled[b] == 0 && k < len(filled); k++ {
			filled[b] = t.push[(b+k)%len(filled)]
		}
	}
	return filled
}

// speedLearned reports whether the player's speeds round a lap of trackLength were learned: a
// whole lap was sampled, with one bin per QuietBinM of it.
func (t *trackProfile) speedLearned(trackLength float32) bool {
	return t != nil && t.quietLaps >= 1 && len(t.speed) > 0 && len(t.speed) == quietBins(trackLength)
}

// stretchMs is how long the player takes over length metres of a lap of trackLength from
// lapDistance, at the learned speeds.
func (t *trackProfile) stretchMs(trackLength, lapDistance, length float32) int64 {
	return stretchMsAt(t.speed, trackLength, lapDistance, length)
}

// stretchMsAt is how long length metres of a lap of trackLength from lapDistance take at speeds,
// one per QuietBinM bin (QuietUnknownSpeedMps where unknown). A lap distance off the lap (below
// zero before the line) wraps round it.
func stretchMsAt(speeds []float32, trackLength, lapDistance, length float32) int64 {
	bins := len(speeds)
	if bins == 0 || trackLength <= 0 || length <= 0 {
		return 0
	}
	pos := float64(trackGapM(0, lapDistance, trackLength))
	lap := float64(trackLength)
	if pos >= lap {
		pos = 0
	}
	left := float64(length)
	var ms float64
	for left > 0 {
		b := min(int(pos/QuietBinM), bins-1)
		end := min(float64(b+1)*QuietBinM, lap)
		if b == bins-1 {
			end = lap
		}
		step := min(end-pos, left)
		ms += step / binSpeedOf(speeds, b) * 1000
		left -= step
		pos += step
		if pos >= lap {
			pos = 0
		}
	}
	return int64(ms)
}

// quietRunwayMs is how long the player stays on a quiet stretch once speech starts leadMs from
// now, at lapDistance: 0 when speech would start off one. ok is false while the track's quiet
// stretches aren't learned.
func (t *trackProfile) quietRunwayMs(lapDistance float32, leadMs int64) (int64, bool) {
	if !t.quietLearned() {
		return 0, false
	}
	bins := len(t.quiet)
	b := int(max(lapDistance, 0)/QuietBinM) % bins
	pos := float64(max(lapDistance, 0)) - float64(b)*QuietBinM

	// Where the player is when speech starts.
	lead := float64(leadMs)
	for range bins {
		binMs := (QuietBinM - pos) / t.binSpeed(b) * 1000
		if binMs > lead {
			pos += lead / 1000 * t.binSpeed(b)
			break
		}
		lead -= binMs
		pos, b = 0, (b+1)%bins
	}

	// How long the quiet stretch lasts from there.
	var runway float64
	for range bins {
		if t.quiet[b] < QuietBinMinShare {
			break
		}
		runway += (QuietBinM - pos) / t.binSpeed(b) * 1000
		pos, b = 0, (b+1)%bins
	}
	return int64(runway), true
}

// load reads the saved track profiles.
func (p *trackProfiles) load(raw string) error {
	if raw == "" {
		return nil
	}
	var saved savedTrackProfiles
	if err := json.Unmarshal([]byte(raw), &saved); err != nil {
		return fmt.Errorf("decode saved track profiles: %w", err)
	}
	keep := func(samples []float32, n int) []float32 {
		if len(samples) > n {
			samples = samples[len(samples)-n:]
		}
		return slices.Clone(samples)
	}
	for key, s := range saved.Tracks {
		track, err := strconv.ParseInt(key, 10, 8)
		if err != nil {
			continue
		}
		t := &trackProfile{
			entryM: keep(s.EntryM, PitEntryMaxSamples),
			exitM:  keep(s.ExitM, PitLaneMaxSamples),
			laneMs: keep(s.LaneMs, PitLaneMaxSamples),
		}
		if len(s.Quiet) > 0 && len(s.Quiet) == len(s.SpeedMps) {
			t.quiet, t.speed, t.quietLaps = slices.Clone(s.Quiet), slices.Clone(s.SpeedMps), s.QuietLaps
		}
		t.push = slices.Clone(s.PushMps)
		if len(t.entryM) == 0 && len(t.laneMs) == 0 && len(t.quiet) == 0 && len(t.push) == 0 {
			continue
		}
		p.tracks[int8(track)] = t
	}
	return nil
}

func (p *trackProfiles) snapshot() string {
	round := func(values []float32, places float64) []float32 {
		if len(values) == 0 {
			return nil
		}
		out := make([]float32, len(values))
		scale := math.Pow(10, places)
		for i, v := range values {
			out[i] = float32(math.Round(float64(v)*scale) / scale)
		}
		return out
	}
	saved := savedTrackProfiles{Tracks: make(map[string]savedTrackProfile, len(p.tracks))}
	for track, t := range p.tracks {
		saved.Tracks[strconv.Itoa(int(track))] = savedTrackProfile{
			EntryM:    slices.Clone(t.entryM),
			ExitM:     slices.Clone(t.exitM),
			LaneMs:    slices.Clone(t.laneMs),
			Quiet:     round(t.quiet, 2),
			SpeedMps:  round(t.speed, 1),
			QuietLaps: t.quietLaps,
			PushMps:   round(t.push, 1),
		}
	}
	raw, _ := json.Marshal(saved)
	return string(raw)
}

// queueSave hands the saver the latest snapshot, replacing one it hasn't written yet.
func (p *trackProfiles) queueSave() {
	if p.saves == nil {
		return
	}
	snap := p.snapshot()
	select {
	case p.saves <- snap:
	default:
		select {
		case <-p.saves:
		default:
		}
		select {
		case p.saves <- snap:
		default:
		}
	}
}

// UseTrackProfileStore loads the track profiles learned in earlier runs from store and saves new
// ones there until ctx ends.
func (e *EngineerEngine) UseTrackProfileStore(ctx context.Context, store TrackProfileStore) error {
	raw, err := store.GetSetting(ctx, trackProfileSettingKey)
	if err != nil {
		return fmt.Errorf("load track profiles: %w", err)
	}
	saves := make(chan string, 1)

	e.mu.Lock()
	err = e.profiles.load(raw)
	e.profiles.saves = saves
	e.mu.Unlock()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case snap := <-saves:
				if err := store.SetSetting(ctx, trackProfileSettingKey, snap); err != nil && ctx.Err() == nil {
					slog.Warn("Could not save the learned track profiles", "error", err)
				}
			}
		}
	}()
	return err
}
