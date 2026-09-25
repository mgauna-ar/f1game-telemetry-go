package engineer

import (
	"bytes"
	"context"
	"encoding/binary"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Car indices used by the race fixture: the player runs P3 between Leclerc and Norris.
const (
	fxPlayer     = 0
	fxLeclerc    = 1
	fxNorris     = 2
	fxVerstappen = 3
	fxCars       = 4
)

type raceFixture struct {
	t      *testing.T
	engine *EngineerEngine
	header packets.PacketHeader
	lap    int
}

func newRaceFixture(t *testing.T) *raceFixture {
	t.Helper()
	f := &raceFixture{
		t:      t,
		engine: newTestEngineerEngine(&mockBroadcaster{}),
		header: createTestHeader(packets.PacketFormat2026, 424242, fxPlayer),
	}
	f.send(f.participants())
	f.send(f.session(packets.SessionRace))
	return f
}

func (f *raceFixture) send(p packets.Packet) {
	f.engine.ProcessPacket(context.Background(), p)
}

func participant(name string, team uint16) packets.ParticipantData {
	p := packets.ParticipantData{TeamId: team, DriverId: packets.InvalidDriverID}
	copy(p.Name[:], name)
	return p
}

func (f *raceFixture) participants() *packets.PacketParticipantsData {
	p := &packets.PacketParticipantsData{Header: f.header, NumActiveCars: fxCars}
	p.Participants[fxPlayer] = participant("Matias Gauna", 5)
	p.Participants[fxLeclerc] = participant("Charles Leclerc", 1)
	p.Participants[fxNorris] = participant("Lando Norris", 4)
	p.Participants[fxVerstappen] = participant("Max Verstappen", 2)
	return p
}

func (f *raceFixture) session(sessionType uint8) *packets.PacketSessionData {
	s := &packets.PacketSessionData{
		Header:                    f.header,
		Weather:                   packets.WeatherOvercast,
		TrackTemperature:          31,
		AirTemperature:            22,
		TotalLaps:                 20,
		TrackLength:               5891,
		SessionType:               sessionType,
		TrackId:                   7,
		SessionTimeLeft:           1200,
		PitStopWindowIdealLap:     8,
		PitStopWindowLatestLap:    12,
		PitStopRejoinPosition:     5,
		NumWeatherForecastSamples: 3,
	}
	s.WeatherForecastSamples[0] = packets.WeatherForecastSample{SessionType: sessionType, TimeOffset: 10, Weather: packets.WeatherHeavyRain, RainPercentage: 70}
	s.WeatherForecastSamples[1] = packets.WeatherForecastSample{SessionType: sessionType, TimeOffset: 5, Weather: packets.WeatherLightRain, RainPercentage: 40}
	s.WeatherForecastSamples[2] = packets.WeatherForecastSample{SessionType: packets.SessionQ1, TimeOffset: 5, Weather: packets.WeatherStorm, RainPercentage: 99}
	return s
}

// endLap finishes lap f.lap: it sends the car state at the line, then lap data for the next lap.
// The player's front-right wears 2%/lap, fuel drops 1.6 kg/lap and the gap to Leclerc shrinks 0.1s/lap.
func (f *raceFixture) endLap(norrisPitStops uint8) {
	f.lap++
	n := float32(f.lap)

	dmg := &packets.PacketCarDamageData{Header: f.header}
	dmg.CarDamageData[fxPlayer].TyresWear = [4]float32{5 + n, 10 + 2*n, 4 + n, 4 + n}
	f.send(dmg)

	status := &packets.PacketCarStatusData{Header: f.header}
	status.CarStatusData[fxPlayer] = packets.CarStatusData{
		VisualTyreCompound: packets.CompoundMedium,
		ActualTyreCompound: packets.ActualCompoundC3,
		TyresAgeLaps:       uint8(f.lap),
		FuelInTank:         40 - 1.6*n,
		FuelRemainingLaps:  0.4,
		ERSStoreEnergy:     packets.MaxERSStoreEnergyJoules / 2,
		ERSDeployMode:      packets.ERSDeployModeMedium,
	}
	status.CarStatusData[fxLeclerc] = packets.CarStatusData{
		VisualTyreCompound: packets.CompoundHard,
		ActualTyreCompound: packets.ActualCompoundC2,
		TyresAgeLaps:       uint8(10 + f.lap),
	}
	f.send(status)

	f.send(f.lapData(uint8(f.lap+1), 91000+100*uint32(f.lap), 1500-100*uint32(f.lap), norrisPitStops))
}

func (f *raceFixture) lapData(currentLap uint8, lastLapMS, gapAheadMS uint32, norrisPitStops uint8) *packets.PacketLapData {
	const playerToLeaderMS = 5000
	p := &packets.PacketLapData{Header: f.header}
	car := func(pos uint8, toFrontMS, toLeaderMS uint32) packets.LapData {
		return packets.LapData{
			CarPosition:             pos,
			CurrentLapNum:           currentLap,
			LastLapTimeInMS:         lastLapMS,
			DeltaToCarInFrontMSPart: uint16(toFrontMS),
			DeltaToRaceLeaderMSPart: uint16(toLeaderMS),
			ResultStatus:            packets.ResultStatusActive,
			DriverStatus:            packets.DriverStatusOnTrack,
			GridPosition:            pos,
			Sector1TimeMSPart:       30000,
			Sector2TimeMSPart:       31000,
		}
	}
	p.LapData[fxVerstappen] = car(1, 0, 0)
	p.LapData[fxLeclerc] = car(2, playerToLeaderMS-gapAheadMS, playerToLeaderMS-gapAheadMS)
	p.LapData[fxPlayer] = car(3, gapAheadMS, playerToLeaderMS)
	p.LapData[fxPlayer].GridPosition = 6
	p.LapData[fxNorris] = car(4, 800, playerToLeaderMS+800)
	p.LapData[fxNorris].NumPitStops = norrisPitStops
	return p
}

func fastestLapEvent(header packets.PacketHeader, carIdx uint8, lapTimeSec float32) *packets.PacketEventData {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, packets.FastestLapEventData{VehicleIdx: carIdx, LapTime: lapTimeSec})
	ev := &packets.PacketEventData{Header: header, EventStringCode: [4]uint8{'F', 'T', 'L', 'P'}}
	copy(ev.EventDetails.Data[:], buf.Bytes())
	return ev
}

func runRaceLaps(t *testing.T) *raceFixture {
	t.Helper()
	f := newRaceFixture(t)
	f.send(f.lapData(1, 0, 1500, 0))
	for i := 0; i < 4; i++ {
		pitStops := uint8(0)
		if i == 3 {
			pitStops = 1
		}
		f.endLap(pitStops)
	}
	return f
}

func TestRaceContext_RecordsCompletedLaps(t *testing.T) {
	f := runRaceLaps(t)

	laps := f.engine.history.playerLaps
	if len(laps) != 4 {
		t.Fatalf("expected 4 completed laps, got %d", len(laps))
	}
	first := laps[0]
	if first.LapNumber != 1 || first.LapTimeMS != 91100 || !first.Valid {
		t.Errorf("unexpected first lap record: %+v", first)
	}
	if first.Sector1MS != 30000 || first.Sector2MS != 31000 || first.Sector3MS != 30100 {
		t.Errorf("unexpected sector split: %+v", first)
	}
	if first.CarAheadIdx != fxLeclerc || first.GapAheadMS != 1400 || first.CarBehindIdx != fxNorris || first.GapBehindMS != 800 {
		t.Errorf("unexpected gaps on first lap: %+v", first)
	}
}

func TestRaceContext_FlashbackForgetsRedrivenLaps(t *testing.T) {
	f := runRaceLaps(t)

	f.send(f.lapData(3, 91200, 1300, 1))

	laps := f.engine.history.playerLaps
	if len(laps) != 2 || laps[len(laps)-1].LapNumber != 2 {
		t.Fatalf("expected laps 1-2 after flashback to lap 3, got %+v", laps)
	}
}

func TestRaceContext_StrategyTrends(t *testing.T) {
	f := runRaceLaps(t)

	snap := f.engine.RaceContext()
	if !snap.Available || snap.Strategy == nil {
		t.Fatalf("expected an available snapshot, got %+v", snap)
	}
	strat := snap.Strategy
	if strat.WorstTyre != "FR" || strat.TyreWearPerLapPct != 2 {
		t.Errorf("expected FR wearing 2%%/lap, got %s at %.2f", strat.WorstTyre, strat.TyreWearPerLapPct)
	}
	// FR is at 18% now: (75 - 18) / 2 = 28.5 laps to the default 75% limit.
	if strat.LapsToWearLimit != 28.5 {
		t.Errorf("expected 28.5 laps to wear limit, got %.1f", strat.LapsToWearLimit)
	}
	if strat.FuelBurnPerLapKg != 1.6 {
		t.Errorf("expected 1.6 kg/lap fuel burn, got %.2f", strat.FuelBurnPerLapKg)
	}
	if strat.GapAheadTrend != "you are closing 0.10s per lap" {
		t.Errorf("unexpected gap ahead trend %q", strat.GapAheadTrend)
	}
	if strat.GapBehindTrend != "gap stable over the last 3 laps" {
		t.Errorf("unexpected gap behind trend %q", strat.GapBehindTrend)
	}
	if strat.RejoinPosition != 5 || strat.PitWindowIdealLap != 8 {
		t.Errorf("expected pit window data from the session packet, got %+v", strat)
	}
}

func TestRaceContext_NeighboursAndSummary(t *testing.T) {
	f := runRaceLaps(t)
	f.send(fastestLapEvent(f.header, fxVerstappen, 90.5))
	f.engine.mu.Lock()
	f.engine.emitDirectiveLocked(f.header, Directive{Message: "Box this lap for hards.", Urgency: UrgencyHigh}, "test_box")
	f.engine.mu.Unlock()

	snap := f.engine.RaceContext()
	if snap.CarAhead == nil || snap.CarAhead.Name != "Charles Leclerc" || snap.CarAhead.RelativeToYou != "1.100s ahead of you" {
		t.Fatalf("unexpected car ahead: %+v", snap.CarAhead)
	}
	if snap.CarBehind == nil || snap.CarBehind.Name != "Lando Norris" || snap.CarBehind.RelativeToYou != "0.800s behind you" {
		t.Fatalf("unexpected car behind: %+v", snap.CarBehind)
	}

	want := []string{
		"Race at Silverstone",
		"Lap 5 of 20",
		"You: P3 (started P6)",
		"Car ahead: P2 Charles Leclerc",
		"you are closing 0.10s per lap",
		"HARD (C2), 14 laps old",
		"Car behind: P4 Lando Norris",
		"| 1 pit stop",
		"no stops yet",
		"Leader: Max Verstappen",
		"MEDIUM (C3), 4 laps old",
		"Worst tyre FR wearing 2.0%/lap, about 28 laps to the 75% wear limit",
		"burning 1.60 kg/lap",
		"pit window ideal lap 8, latest lap 12",
		"pitting now rejoins about P5",
		"Forecast: +5 min Light Rain, 40% rain | +10 min Heavy Rain, 70% rain",
		"Lap 5: Box this lap for hards.",
		"Lando Norris pitted (stop 1)",
		"Fastest lap: Max Verstappen, 1:30.500",
	}
	for _, w := range want {
		if !strings.Contains(snap.Summary, w) {
			t.Errorf("summary missing %q\n%s", w, snap.Summary)
		}
	}
	if strings.Contains(snap.Summary, "1 pit stops") {
		t.Errorf("summary should say 1 pit stop:\n%s", snap.Summary)
	}
	if strings.Contains(snap.Summary, "99% rain") {
		t.Errorf("summary includes a forecast sample from another session:\n%s", snap.Summary)
	}
}

func TestRaceContext_LiveBriefing(t *testing.T) {
	f := runRaceLaps(t)

	b, ok := f.engine.LiveBriefing()
	if !ok {
		t.Fatal("expected a live briefing")
	}
	if b.SessionType != "Race" || b.TrackName != "Silverstone" || b.PacketFormat != packets.PacketFormat2026 {
		t.Errorf("unexpected briefing header: %+v", b)
	}
	if b.DrivingPhase != string(PhaseRacing) || b.IncidentStatus != "clear" {
		t.Errorf("unexpected phase/incident: %s/%s", b.DrivingPhase, b.IncidentStatus)
	}

	sc := f.session(packets.SessionRace)
	sc.SafetyCarStatus = packets.SafetyCarFull
	f.send(sc)
	if b, _ := f.engine.LiveBriefing(); b.IncidentStatus != "safety_car" {
		t.Errorf("expected safety_car incident, got %q", b.IncidentStatus)
	}
}

func TestRaceContext_UnavailableWithoutFreshTelemetry(t *testing.T) {
	engine := newTestEngineerEngine(&mockBroadcaster{})
	if _, ok := engine.LiveBriefing(); ok {
		t.Fatal("expected no briefing before any telemetry")
	}

	f := runRaceLaps(t)
	f.engine.mu.Lock()
	f.engine.lastPacketAt -= LiveRaceContextMaxAgeMs + 1
	f.engine.mu.Unlock()
	if _, ok := f.engine.LiveBriefing(); ok {
		t.Fatal("expected stale telemetry to be ignored")
	}
	if snap := f.engine.RaceContext(); snap.Available {
		t.Fatal("expected snapshot to be unavailable for stale telemetry")
	}
}

func TestRaceContext_QualifyingKnockoutLine(t *testing.T) {
	engine := newTestEngineerEngine(&mockBroadcaster{})
	header := createTestHeader(packets.PacketFormat2026, 777, fxPlayer)
	f := &raceFixture{t: t, engine: engine, header: header}
	f.send(f.session(packets.SessionQ1))

	const cars = QualyQ1EliminationPositionThreshold + 1
	parts := &packets.PacketParticipantsData{Header: header, NumActiveCars: cars}
	laps := &packets.PacketLapData{Header: header}
	for i := 0; i < cars; i++ {
		parts.Participants[i] = participant("Driver "+string(rune('A'+i)), uint16(i))
		laps.LapData[i] = packets.LapData{CarPosition: uint8(i + 1), CurrentLapNum: 3, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
		hist := &packets.PacketSessionHistoryData{Header: header, CarIdx: uint8(i), NumLaps: 2, BestLapTimeLapNum: 2}
		hist.LapHistoryData[1].LapTimeInMS = 88000 + uint32(i)*100
		engine.ProcessPacket(context.Background(), hist)
	}
	// Put the player in P16, just outside the cut.
	laps.LapData[fxPlayer].CarPosition = cars
	laps.LapData[cars-1].CarPosition = 1
	engine.ProcessPacket(context.Background(), parts)
	engine.ProcessPacket(context.Background(), laps)

	snap := engine.RaceContext()
	if !strings.Contains(snap.Summary, "Knockout line: P15 is Driver O on 1:29.400") {
		t.Errorf("expected knockout line in qualifying summary:\n%s", snap.Summary)
	}
	if !strings.Contains(snap.Summary, "best lap 1.400s slower than yours") {
		t.Errorf("expected best-lap comparison in qualifying summary:\n%s", snap.Summary)
	}
	if strings.Contains(snap.Summary, "Strategy:") {
		t.Errorf("did not expect race strategy line in qualifying:\n%s", snap.Summary)
	}
}

func TestFormatLapTimeMS(t *testing.T) {
	tests := map[uint32]string{
		0:      "no time",
		59_999: "59.999",
		90_500: "1:30.500",
		61_005: "1:01.005",
	}
	for in, want := range tests {
		if got := formatLapTimeMS(in); got != want {
			t.Errorf("formatLapTimeMS(%d) = %q; want %q", in, got, want)
		}
	}
}
