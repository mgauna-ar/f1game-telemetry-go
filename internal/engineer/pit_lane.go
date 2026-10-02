package engineer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strconv"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BoxTiming is when the driver can act on a call to pit, sent with the call (Directive.Box).
type BoxTiming string

const (
	// BoxThisLap: the pit entry is still far enough ahead to take it this lap.
	BoxThisLap BoxTiming = "this_lap"
	// BoxNextLap: the pit entry is too close or already passed; the stop is at the end of next lap.
	BoxNextLap BoxTiming = "next_lap"
	// BoxASAP: the track's pit entry isn't known yet and the lap is past half way.
	BoxASAP BoxTiming = "asap"
)

// BoxTimings lists every BoxTiming, for the generated TypeScript union.
var BoxTimings = []string{string(BoxThisLap), string(BoxNextLap), string(BoxASAP)}

// BoxCall says whether a call asks the driver to pit. The rule that writes the call sets it; the
// engine then sends when the pit entry can be made.
type BoxCall uint8

const (
	BoxCallNone BoxCall = iota
	// BoxCallInstruction tells the driver to pit. An urgent one is said at once with its timing; any
	// other waits for the line when this lap's pit entry is too close, then says "box this lap".
	BoxCallInstruction
	// BoxCallOption offers a stop (Safety Car, pit window open): said at once with its timing.
	BoxCallOption
)

// PitLaneStore keeps what the engineer learned about each track's pit lane between runs. The
// storage repository's settings rows satisfy it.
type PitLaneStore interface {
	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key, value string) error
}

// pitLaneSettingKey is the settings row the learned pit lanes are saved under. Only the server
// reads it.
const pitLaneSettingKey = "engineer_pit_lanes"

// pitLanes learns where each track's pit entry is. The game doesn't send it, so it is the lap
// distance at which cars' pit status goes from none to pitting: the median of the latest samples,
// so one odd sample doesn't move it.
type pitLanes struct {
	entrySamples map[int8][]float32 // track ID -> lap distances, oldest first
	saves        chan string        // JSON snapshots for the saver; nil when nothing is saved
}

// savedPitLanes is the saved form: entry samples per track ID.
type savedPitLanes struct {
	Tracks map[string]savedPitLane `json:"tracks"`
}

type savedPitLane struct {
	EntryM []float32 `json:"entry_m"`
}

func newPitLanes() *pitLanes {
	return &pitLanes{entrySamples: make(map[int8][]float32)}
}

// entry is the learned pit entry of track as a lap distance in metres, or 0 when not known yet.
func (p *pitLanes) entry(track int8) float32 {
	samples := p.entrySamples[track]
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

// learn records the pit entries of the cars that started pitting between prev and next.
func (p *pitLanes) learn(session *packets.PacketSessionData, prev, next *packets.PacketLapData) {
	if session == nil || prev == nil || session.TrackId < 0 || session.TrackLength == 0 {
		return
	}
	trackLength := float32(session.TrackLength)
	learned := false
	for i := range next.LapData {
		before, after := prev.LapData[i], next.LapData[i]
		if before.PitStatus != packets.PitStatusNone || after.PitStatus != packets.PitStatusPitting {
			continue
		}
		if after.DriverStatus == packets.DriverStatusInGarage || after.LapDistance <= 0 || after.LapDistance > trackLength {
			continue
		}
		p.entrySamples[session.TrackId] = append(p.entrySamples[session.TrackId], after.LapDistance)
		if samples := p.entrySamples[session.TrackId]; len(samples) > PitEntryMaxSamples {
			p.entrySamples[session.TrackId] = samples[len(samples)-PitEntryMaxSamples:]
		}
		learned = true
	}
	if learned {
		p.queueSave()
	}
}

// load reads the saved pit lanes.
func (p *pitLanes) load(raw string) error {
	if raw == "" {
		return nil
	}
	var saved savedPitLanes
	if err := json.Unmarshal([]byte(raw), &saved); err != nil {
		return fmt.Errorf("decode saved pit lanes: %w", err)
	}
	for key, lane := range saved.Tracks {
		track, err := strconv.ParseInt(key, 10, 8)
		if err != nil || len(lane.EntryM) == 0 {
			continue
		}
		samples := lane.EntryM
		if len(samples) > PitEntryMaxSamples {
			samples = samples[len(samples)-PitEntryMaxSamples:]
		}
		p.entrySamples[int8(track)] = slices.Clone(samples)
	}
	return nil
}

func (p *pitLanes) snapshot() string {
	saved := savedPitLanes{Tracks: make(map[string]savedPitLane, len(p.entrySamples))}
	for track, samples := range p.entrySamples {
		saved.Tracks[strconv.Itoa(int(track))] = savedPitLane{EntryM: slices.Clone(samples)}
	}
	raw, _ := json.Marshal(saved)
	return string(raw)
}

// queueSave hands the saver the latest snapshot, replacing one it hasn't written yet.
func (p *pitLanes) queueSave() {
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

// UsePitLaneStore loads the pit lanes learned in earlier runs from store and saves new ones there
// until ctx ends.
func (e *EngineerEngine) UsePitLaneStore(ctx context.Context, store PitLaneStore) error {
	raw, err := store.GetSetting(ctx, pitLaneSettingKey)
	if err != nil {
		return fmt.Errorf("load pit lanes: %w", err)
	}
	saves := make(chan string, 1)

	e.mu.Lock()
	err = e.pitLanes.load(raw)
	e.pitLanes.saves = saves
	e.mu.Unlock()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case snap := <-saves:
				if err := store.SetSetting(ctx, pitLaneSettingKey, snap); err != nil && ctx.Err() == nil {
					slog.Warn("Could not save the learned pit lanes", "error", err)
				}
			}
		}
	}()
	return err
}

// boxTimingAt says when a driver lapDistance metres into a lap of trackLength can pit, given the
// track's pit entry (0 while unknown) and how far before it the call must come (leadM).
func boxTimingAt(lapDistance, trackLength, pitEntry, leadM float32) BoxTiming {
	if pitEntry <= 0 || trackLength <= 0 {
		if lapDistance < trackLength/2 {
			return BoxThisLap
		}
		return BoxASAP
	}
	if lapDistance < boxCallPoint(trackLength, pitEntry, leadM) {
		return BoxThisLap
	}
	return BoxNextLap
}

// boxCallPoint is the last lap distance a call to box this lap can come at. A pit entry just after
// the line is reached at the start of the next lap, so it counts a lap length further on.
func boxCallPoint(trackLength, pitEntry, leadM float32) float32 {
	entry := pitEntry
	if entry < trackLength/2 {
		entry += trackLength
	}
	return entry - leadM
}
