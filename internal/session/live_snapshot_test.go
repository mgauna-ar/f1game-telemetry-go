package session

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestNewLiveSessionForecastSamples(t *testing.T) {
	tests := []struct {
		name       string
		numSamples uint8
		want       int
	}{
		{name: "no samples", numSamples: 0, want: 0},
		{name: "filled samples only", numSamples: 3, want: 3},
		{name: "count past the array is capped", numSamples: 255, want: packets.MaxWeatherForecastSamples},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &packets.PacketSessionData{NumWeatherForecastSamples: tt.numSamples}
			p.WeatherForecastSamples[0].RainPercentage = 40
			got := newLiveSession(p)
			if len(got.WeatherForecastSamples) != tt.want {
				t.Fatalf("got %d samples, want %d", len(got.WeatherForecastSamples), tt.want)
			}
			if tt.want > 0 && got.WeatherForecastSamples[0].RainPercentage != 40 {
				t.Errorf("sample 0 RainPercentage = %d, want 40", got.WeatherForecastSamples[0].RainPercentage)
			}
		})
	}
	if newLiveSession(nil) != nil {
		t.Error("newLiveSession(nil) should be nil")
	}
}

func TestLiveSnapshotCarsAndFields(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	b := NewLiveBroadcaster(hub)
	header := packets.PacketHeader{PacketFormat: packets.PacketFormat2026, SessionUID: 1, PlayerCarIndex: 0}

	participants := &packets.PacketParticipantsData{Header: header, NumActiveCars: 3}
	for i := 0; i < 3; i++ {
		copy(participants.Participants[i].Name[:], "Driver")
		participants.Participants[i].RaceNumber = uint8(i + 1)
		participants.Participants[i].LiveryColours[0].Red = 255
	}
	laps := &packets.PacketLapData{Header: header}
	laps.LapData[1] = packets.LapData{CarPosition: 2, CurrentLapNum: 4, TotalDistance: 9000}
	status := &packets.PacketCarStatusData{Header: header}
	status.CarStatusData[2] = packets.CarStatusData{VisualTyreCompound: packets.CompoundSoft, FuelMix: 3}
	damage := &packets.PacketCarDamageData{Header: header}
	damage.CarDamageData[0].TyresWear = [4]float32{1, 2, 3, 4}
	session := &packets.PacketSessionData{Header: header, TrackId: 7, NumMarshalZones: 2}

	for _, p := range []packets.Packet{session, participants, laps, status, damage} {
		b.ProcessPacket(p)
	}
	b.BroadcastSnapshot()
	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 snapshot, got %d", hub.MessageCount())
	}
	msg := hub.messages[0]

	var snap LiveSnapshot
	if err := json.Unmarshal(msg, &snap); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if snap.ActiveCarCount != 3 {
		t.Fatalf("ActiveCarCount = %d, want 3", snap.ActiveCarCount)
	}
	for name, got := range map[string]int{
		"Participants": len(snap.Participants),
		"LapData":      len(snap.LapData),
		"CarStatus":    len(snap.CarStatus),
		"CarDamage":    len(snap.CarDamage),
	} {
		if got != 3 {
			t.Errorf("%s has %d cars, want 3", name, got)
		}
	}
	if snap.CarTelemetry != nil || snap.CarTelemetry2 != nil {
		t.Errorf("packets not received yet should be left out, got %v / %v", snap.CarTelemetry, snap.CarTelemetry2)
	}
	if got := snap.Participants[2]; got.Name != "Driver" || got.RaceNumber != 3 {
		t.Errorf("participant 2 = %+v", got)
	}
	if got := snap.LapData[1]; got.CarPosition != 2 || got.CurrentLapNum != 4 {
		t.Errorf("lap 1 = %+v", got)
	}
	if got := snap.CarStatus[2].VisualTyreCompound; got != packets.CompoundSoft {
		t.Errorf("status 2 VisualTyreCompound = %d", got)
	}
	if got := snap.CarDamage[0].TyresWear; got != [4]float32{1, 2, 3, 4} {
		t.Errorf("damage 0 TyresWear = %v", got)
	}
	if snap.Session == nil || snap.Session.TrackId != 7 {
		t.Errorf("session = %+v", snap.Session)
	}

	for _, key := range []string{"MarshalZones", "LiveryColours", "TotalDistance", "FuelMix", "NumActiveCars", "WeekendStructure"} {
		if strings.Contains(string(msg), `"`+key+`"`) {
			t.Errorf("snapshot JSON should not carry %q", key)
		}
	}
}

// A car that retires keeps its slot in the snapshot even when the game's NumActiveCars drops,
// so the leaderboard can still list it.
func TestLiveSnapshotKeepsRetiredCar(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	b := NewLiveBroadcaster(hub)
	header := packets.PacketHeader{PacketFormat: packets.PacketFormat2026, SessionUID: 1, PlayerCarIndex: 0}

	participants := &packets.PacketParticipantsData{Header: header, NumActiveCars: 3}
	for i, name := range []string{"Player", "Driver B", "Driver C", "Retired D"} {
		copy(participants.Participants[i].Name[:], name)
		participants.Participants[i].AIControlled = 1
	}
	laps := &packets.PacketLapData{Header: header}
	for i := 0; i < 3; i++ {
		laps.LapData[i] = packets.LapData{CarPosition: uint8(i + 1), ResultStatus: packets.ResultStatusActive}
	}
	laps.LapData[3] = packets.LapData{CarPosition: 4, ResultStatus: packets.ResultStatusDNF}

	b.ProcessPacket(participants)
	b.ProcessPacket(laps)
	b.BroadcastSnapshot()

	var snap LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snap); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if snap.ActiveCarCount != 4 || len(snap.Participants) != 4 || len(snap.LapData) != 4 {
		t.Fatalf("want 4 cars, got ActiveCarCount %d, %d participants, %d laps",
			snap.ActiveCarCount, len(snap.Participants), len(snap.LapData))
	}
	if got := snap.Participants[3].Name; got != "Retired D" {
		t.Errorf("participant 3 = %q, want Retired D", got)
	}
}
