package engineer

import (
	"context"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestTrackProfiles_LearnTheEntryFromCarsThatPit(t *testing.T) {
	session := &packets.PacketSessionData{TrackId: 7, TrackLength: 5000}
	prev, next := &packets.PacketLapData{}, &packets.PacketLapData{}
	set := func(i int, before, after uint8, lapDistance float32, driverStatus uint8) {
		prev.LapData[i] = packets.LapData{PitStatus: before, DriverStatus: driverStatus}
		next.LapData[i] = packets.LapData{PitStatus: after, LapDistance: lapDistance, DriverStatus: driverStatus}
	}
	set(1, packets.PitStatusNone, packets.PitStatusPitting, 4790, packets.DriverStatusInLap)
	set(2, packets.PitStatusNone, packets.PitStatusPitting, 4810, packets.DriverStatusInLap)
	set(3, packets.PitStatusNone, packets.PitStatusPitting, 4805, packets.DriverStatusInLap)
	set(4, packets.PitStatusNone, packets.PitStatusInPitArea, 100, packets.DriverStatusInLap)   // already in the box
	set(5, packets.PitStatusPitting, packets.PitStatusPitting, 200, packets.DriverStatusInLap)  // was already pitting
	set(6, packets.PitStatusNone, packets.PitStatusPitting, -20, packets.DriverStatusInLap)     // before the line on lap 1
	set(7, packets.PitStatusNone, packets.PitStatusPitting, 6000, packets.DriverStatusInLap)    // past the track's length
	set(8, packets.PitStatusNone, packets.PitStatusPitting, 2500, packets.DriverStatusInGarage) // in the garage

	lanes := newTrackProfiles()
	lanes.learnPitLane(session, prev, next)
	if got := lanes.tracks[7].entryM; !slices.Equal(got, []float32{4790, 4810, 4805}) {
		t.Fatalf("samples = %v, want the three cars that started pitting", got)
	}
	if got := lanes.profile(7).entry(); got != 4805 {
		t.Errorf("entry = %v, want the median 4805", got)
	}
	if got := lanes.profile(3).entry(); got != 0 {
		t.Errorf("entry of an unknown track = %v, want 0", got)
	}

	// Only the latest samples are kept.
	for range PitEntryMaxSamples {
		lanes.learnPitLane(session, prev, next)
	}
	if n := len(lanes.tracks[7].entryM); n != PitEntryMaxSamples {
		t.Errorf("kept %d samples, want %d", n, PitEntryMaxSamples)
	}
}

// memSettingsStore is a settings store that reports each save.
type memSettingsStore struct {
	mu     sync.Mutex
	values map[string]string
	saved  chan string
}

func (s *memSettingsStore) GetSetting(_ context.Context, key string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.values[key], nil
}

func (s *memSettingsStore) SetSetting(_ context.Context, key, value string) error {
	s.mu.Lock()
	s.values[key] = value
	s.mu.Unlock()
	s.saved <- value
	return nil
}

func TestEngineerEngine_TrackProfilesSurviveARestart(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	store := &memSettingsStore{
		values: map[string]string{trackProfileSettingKey: `{"tracks":{"3":{"entry_m":[4700,4720,4710]}}}`},
		saved:  make(chan string, 4),
	}
	e := newTestEngineerEngine(&mockBroadcaster{})
	if err := e.UseTrackProfileStore(ctx, store); err != nil {
		t.Fatalf("UseTrackProfileStore: %v", err)
	}
	if got := e.profiles.profile(3).entry(); got != 4710 {
		t.Fatalf("loaded entry = %v, want 4710", got)
	}

	// A car pits at a track not seen before: the new entry is saved.
	h := createTestHeader(packets.PacketFormat2025, 77, 0)
	e.ProcessPacket(ctx, &packets.PacketSessionData{Header: h, SessionType: packets.SessionRace, TrackId: 9, TrackLength: 5000})
	lap := func(pitStatus uint8) *packets.PacketLapData {
		p := &packets.PacketLapData{Header: h}
		p.LapData[0] = packets.LapData{CurrentLapNum: 4, LapDistance: 1000, DriverStatus: packets.DriverStatusOnTrack}
		p.LapData[1] = packets.LapData{CurrentLapNum: 4, LapDistance: 3300, DriverStatus: packets.DriverStatusInLap, PitStatus: pitStatus}
		return p
	}
	e.ProcessPacket(ctx, lap(packets.PitStatusNone))
	e.ProcessPacket(ctx, lap(packets.PitStatusPitting))

	select {
	case raw := <-store.saved:
		restarted := newTrackProfiles()
		if err := restarted.load(raw); err != nil {
			t.Fatalf("load saved track profiles: %v", err)
		}
		if restarted.profile(9).entry() != 3300 || restarted.profile(3).entry() != 4710 {
			t.Errorf("after a restart: entry(9) = %v, entry(3) = %v; want 3300 and 4710", restarted.profile(9).entry(), restarted.profile(3).entry())
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the learned pit entry was never saved")
	}
	if got := e.GetConfig().PitCallLeadM; got != DefaultPitCallLeadM {
		t.Errorf("PitCallLeadM = %v, want the default %v", got, DefaultPitCallLeadM)
	}
}

func TestTrackProfiles_TimeRaceStopsInThePitLane(t *testing.T) {
	race := &packets.PacketSessionData{TrackId: 7, TrackLength: 5000, SessionType: packets.SessionRace}
	lanes := newTrackProfiles()
	prev := &packets.PacketLapData{}
	step := func(session *packets.PacketSessionData, set func(l *packets.LapData)) {
		next := &packets.PacketLapData{}
		*next = *prev
		for i := range next.LapData {
			set(&next.LapData[i])
		}
		lanes.learnPitLane(session, prev, next)
		prev = next
	}
	// Car 1 stops, car 2 drives through, car 3 serves a penalty at its stop, car 4 goes to its
	// garage.
	step(race, func(l *packets.LapData) {
		*l = packets.LapData{PitLaneTimerActive: 1, PitLaneTimeInLaneInMS: 1000, PitStatus: packets.PitStatusPitting, LapDistance: 4850, DriverStatus: packets.DriverStatusInLap}
	})
	step(race, func(l *packets.LapData) { l.PitLaneTimeInLaneInMS = 9000 })
	prev.LapData[1].PitStatus, prev.LapData[3].PitStatus, prev.LapData[4].PitStatus = packets.PitStatusInPitArea, packets.PitStatusInPitArea, packets.PitStatusInPitArea
	prev.LapData[3].PitStopShouldServePen = 1
	prev.LapData[4].DriverStatus = packets.DriverStatusInGarage
	step(race, func(l *packets.LapData) { l.PitLaneTimeInLaneInMS = 21000 })
	step(race, func(l *packets.LapData) { l.PitLaneTimeInLaneInMS = 24000 })
	step(race, func(l *packets.LapData) {
		l.PitLaneTimerActive, l.PitLaneTimeInLaneInMS, l.PitStatus, l.LapDistance = 0, 0, packets.PitStatusNone, 350
	})

	got := lanes.profile(7)
	if got == nil || !slices.Equal(got.laneMs, []float32{24000}) || !slices.Equal(got.exitM, []float32{350}) {
		t.Fatalf("timed stops = %+v, want only car 1: 24 s in the lane, out at 350 m", got)
	}

	// Practice stops aren't timed.
	practice := *race
	practice.SessionType = packets.SessionP1
	practice.TrackId = 8
	step(&practice, func(l *packets.LapData) {
		*l = packets.LapData{PitLaneTimerActive: 1, PitLaneTimeInLaneInMS: 20000, PitStatus: packets.PitStatusInPitArea, LapDistance: 4900, DriverStatus: packets.DriverStatusInLap}
	})
	step(&practice, func(l *packets.LapData) { l.PitLaneTimerActive, l.LapDistance = 0, 300 })
	if p := lanes.profile(8); p != nil && len(p.laneMs) > 0 {
		t.Errorf("practice stops timed: %v", p.laneMs)
	}
}

func TestTrackProfile_PitLossSec(t *testing.T) {
	// 24 s in a lane from 4800 m to 300 m: 500 m of track.
	p := &trackProfile{entryM: []float32{4800}, exitM: []float32{300}, laneMs: []float32{24000}}
	if loss, ok := p.pitLossSec(5000, 50); !ok || loss != 14 {
		t.Errorf("at 50 m/s: loss = %v, %v; want 24 - 10 = 14 s", loss, ok)
	}
	// The learned speeds of the lap, 62.5 m/s there, win over the lap's average pace.
	learned := learnedTrack()
	learned.entryM, learned.exitM, learned.laneMs = p.entryM, p.exitM, p.laneMs
	for b := range learned.speed {
		learned.speed[b] = 62.5
	}
	if loss, ok := learned.pitLossSec(5000, 50); !ok || loss != 16 {
		t.Errorf("with learned speeds: loss = %v, %v; want 24 - 8 = 16 s", loss, ok)
	}
	if _, ok := (&trackProfile{entryM: []float32{4800}}).pitLossSec(5000, 50); ok {
		t.Error("a loss without a timed stop")
	}
	if _, ok := (*trackProfile)(nil).pitLossSec(5000, 50); ok {
		t.Error("a loss for an unknown track")
	}

	ctx := &EvaluationContext{Session: &packets.PacketSessionData{TrackLength: 5000}}
	if got := ctx.PitLossSec(); got != DefaultPitLaneLossSeconds {
		t.Errorf("unknown track: PitLossSec = %v, want the default %v", got, DefaultPitLaneLossSeconds)
	}
}

// driveQuietLap samples a whole lap of 5 km into lanes: flat out from quietFrom to quietTo, braking
// and turning elsewhere.
func driveQuietLap(lanes *trackProfiles, lap int, quietFrom, quietTo float32) {
	for d := float32(0); d < 5000; d += 10 {
		tele := &packets.CarTelemetryData{Speed: 120, Brake: 0.6, Steer: 0.4}
		if d >= quietFrom && d < quietTo {
			tele = &packets.CarTelemetryData{Speed: 288, Throttle: 1}
		}
		lanes.sampleQuiet(3, 5000, lap, d, tele)
	}
	lanes.endQuietLap(lap + 1)
}

func TestTrackProfiles_LearnTheQuietStretches(t *testing.T) {
	lanes := newTrackProfiles()
	for lap := 1; lap < QuietLearnMinLaps; lap++ {
		driveQuietLap(lanes, lap, 1000, 2000)
	}
	if lanes.profile(3).quietLearned() {
		t.Fatalf("learned after %d laps, want %d", QuietLearnMinLaps-1, QuietLearnMinLaps)
	}
	driveQuietLap(lanes, QuietLearnMinLaps, 1000, 2000)
	p := lanes.profile(3)
	if !p.quietLearned() {
		t.Fatal("not learned after the laps it needs")
	}
	if p.quiet[25] != 1 || p.quiet[10] != 0 || p.speed[25] != 80 {
		t.Errorf("bin 25 = %v at %v m/s, bin 10 = %v; want quiet at 80 m/s, and not quiet", p.quiet[25], p.speed[25], p.quiet[10])
	}

	// A lap lifting half way down the straight moves the average by the latest lap's weight.
	lap := QuietLearnMinLaps + 1
	for d := float32(0); d < 5000; d += 10 {
		tele := &packets.CarTelemetryData{Speed: 120, Brake: 0.6, Steer: 0.4}
		if d >= 1000 && d < 2000 {
			tele = &packets.CarTelemetryData{Speed: 288, Throttle: 1}
			if d >= 1500 {
				tele.Throttle = 0.5
			}
		}
		lanes.sampleQuiet(3, 5000, lap, d, tele)
	}
	lanes.endQuietLap(lap + 1)
	if want := float32(1 - QuietLapWeight); p.quiet[35] != want || p.quiet[25] != 1 {
		t.Errorf("after a different lap: bin 35 = %v, bin 25 = %v; want %v and 1", p.quiet[35], p.quiet[25], want)
	}

	// Laps that aren't whole laps at racing pace aren't learned from.
	before := p.quietLaps
	lanes.sampleQuiet(3, 5000, 20, 100, &packets.CarTelemetryData{Speed: 288, Throttle: 1})
	lanes.spoilQuietLap()
	driveQuietLap(lanes, 20, 0, 5000) // a flashback in it
	for d := float32(2500); d < 5000; d += 10 {
		lanes.sampleQuiet(3, 5000, 21, d, &packets.CarTelemetryData{Speed: 288, Throttle: 1})
	}
	lanes.endQuietLap(22) // half a lap
	// A spin: nearly stopped for a moment.
	for d := float32(0); d < 5000; d += 10 {
		tele := &packets.CarTelemetryData{Speed: 288, Throttle: 1}
		if d >= 3000 && d < 3020 {
			tele.Speed = 20
		}
		lanes.sampleQuiet(3, 5000, 23, d, tele)
	}
	lanes.endQuietLap(24)
	// Limping round the straight at half its speed or less.
	for d := float32(0); d < 5000; d += 10 {
		tele := &packets.CarTelemetryData{Speed: 120, Brake: 0.6, Steer: 0.4}
		if d >= 1000 && d < 2000 {
			tele = &packets.CarTelemetryData{Speed: 140, Throttle: 1}
		}
		lanes.sampleQuiet(3, 5000, 25, d, tele)
	}
	lanes.endQuietLap(26)
	driveQuietLap(lanes, 30, 0, 5000)
	lanes.endQuietLap(33)
	if p.quietLaps != before+1 {
		t.Errorf("laps learned = %d, want %d: only the whole lap 30", p.quietLaps, before+1)
	}
}

func TestTrackProfile_QuietRunwayMs(t *testing.T) {
	p := learnedTrack() // quiet from 1000 to 2000 m at 80 m/s
	tests := []struct {
		name        string
		lapDistance float32
		leadMs      int64
		want        int64
	}{
		{"start of the straight", 1000, 0, 12500},
		{"halfway down it", 1500, 0, 6250},
		{"speech starts on it", 960, 1000, 12000},
		{"speech starts before it", 900, 1000, 0},
		{"in a corner", 500, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got, ok := p.quietRunwayMs(tt.lapDistance, tt.leadMs); !ok || got != tt.want {
				t.Errorf("runway = %v, %v; want %v ms", got, ok, tt.want)
			}
		})
	}
	if _, ok := (&trackProfile{quiet: p.quiet, speed: p.speed, quietLaps: 1}).quietRunwayMs(1000, 0); ok {
		t.Error("a runway on a track not learned yet")
	}
}

func TestEngineerEngine_LearnsTheQuietStretchesFromTheRace(t *testing.T) {
	ctx := context.Background()
	e, _, clock, h := raceEngine(t)
	for lap := uint8(11); lap <= 11+QuietLearnMinLaps; lap++ {
		for d := float32(0); d < 5000; d += 25 {
			clock.advance(300 * time.Millisecond)
			e.ProcessPacket(ctx, &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: lap, CarPosition: 5, LapDistance: d, DriverStatus: packets.DriverStatusOnTrack},
			}})
			tele := packets.CarTelemetryData{Speed: 120, Brake: 0.6}
			if d >= 1000 && d < 2000 {
				tele = packets.CarTelemetryData{Speed: 300, Throttle: 1}
			}
			e.ProcessPacket(ctx, &packets.PacketCarTelemetryData{Header: h, CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{tele}})
		}
	}
	p := e.profiles.profile(0)
	if !p.quietLearned() || p.quiet[30] != 1 || p.quiet[50] != 0 {
		t.Fatalf("profile = %+v, want the straight from 1000 to 2000 m learned", p)
	}
}

func TestTrackProfiles_SavedProfilesLoad(t *testing.T) {
	lanes := newTrackProfiles()
	if err := lanes.load(`{"tracks":{"3":{"entry_m":[4700]}}}`); err != nil {
		t.Fatalf("load pit entries saved before track profiles: %v", err)
	}
	if got := lanes.profile(3).entry(); got != 4700 {
		t.Errorf("entry = %v, want 4700", got)
	}

	learned := learnedTrack()
	learned.entryM, learned.exitM, learned.laneMs = []float32{4800}, []float32{300}, []float32{24000}
	learned.speed[0] = 80.04
	lanes.tracks[5] = learned
	restarted := newTrackProfiles()
	if err := restarted.load(lanes.snapshot()); err != nil {
		t.Fatalf("load a snapshot: %v", err)
	}
	got := restarted.profile(5)
	if got == nil || !got.quietLearned() || got.quiet[25] != 1 || got.speed[0] != 80 ||
		!slices.Equal(got.laneMs, []float32{24000}) || !slices.Equal(got.exitM, []float32{300}) || got.entry() != 4800 {
		t.Errorf("after a restart: %+v", got)
	}
}
