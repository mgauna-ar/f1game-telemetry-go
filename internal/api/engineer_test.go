package api

import (
	"context"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestEngineerEngine_ProcessPackets(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)

	ctx := context.Background()
	header := packets.PacketHeader{
		PacketFormat:   packets.PacketFormat2026,
		SessionUID:     123456789,
		SessionTime:    100.5,
		PlayerCarIndex: 0,
	}

	// 1. Process Participants (Player car 0, Teammate car 1 with same TeamId 2)
	partPkt := &packets.PacketParticipantsData{
		Header:        header,
		NumActiveCars: 2,
		Participants: [packets.MaxCars]packets.ParticipantData{
			{DriverId: 9, TeamId: 2, RaceNumber: 1, AIControlled: 0},
			{DriverId: 112, TeamId: 2, RaceNumber: 81, AIControlled: 1},
		},
	}
	engine.ProcessPacket(ctx, partPkt)

	if engine.teammateCarIndex != 1 {
		t.Fatalf("expected teammateCarIndex=1, got %d", engine.teammateCarIndex)
	}

	// 2. Process Session Data (Weather Forecast Rain transition)
	sessionPkt := &packets.PacketSessionData{
		Header:                    header,
		NumWeatherForecastSamples: 2,
		WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
			{TimeOffset: 5, RainPercentage: 75},
			{TimeOffset: 10, RainPercentage: 80},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// 3. Process Lap Data (Sector 1 personal best establishment)
	lapPkt1 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, Sector1TimeMSPart: 28000, Sector: 1, CarPosition: 2, TotalDistance: 1000},
			{CurrentLapNum: 1, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 1050},
		},
	}
	engine.ProcessPacket(ctx, lapPkt1)

	// Lap 1 Sector 2 with delta loss
	lapPkt2 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, Sector1TimeMSPart: 28500, Sector: 1, CarPosition: 2, TotalDistance: 1500},
			{CurrentLapNum: 1, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 1550},
		},
	}
	engine.ProcessPacket(ctx, lapPkt2)

	// Reset engine
	engine.Reset(987654321)
	if engine.teammateCarIndex != -1 {
		t.Fatalf("expected teammateCarIndex=-1 after reset, got %d", engine.teammateCarIndex)
	}

	// 4. Test phase suppression: coaching directives must NOT emit when player is in garage or pit lane
	engine.Reset(111222333)
	engine.bestSector1MS = 28000
	engine.lastLapNumber = 2

	// In garage
	garageLapPkt := &packets.PacketLapData{
		Header: packets.PacketHeader{
			PacketFormat:   packets.PacketFormat2026,
			SessionUID:     111222333,
			SessionTime:    200.0,
			PlayerCarIndex: 0,
		},
		LapData: [packets.MaxCars]packets.LapData{
			{
				CurrentLapNum:     2,
				Sector1TimeMSPart: 29000, // +1.0s loss
				Sector:            1,
				DriverStatus:      packets.DriverStatusInGarage,
				PitStatus:         packets.PitStatusInPitArea,
			},
		},
	}
	engine.ProcessPacket(ctx, garageLapPkt)
	if _, exists := engine.lastDirectives["coaching_s1"]; exists {
		t.Fatalf("expected coaching_s1 directive to be suppressed while in garage")
	}

	// Paused session
	engine.Reset(444555666)
	pausedSessionPkt := &packets.PacketSessionData{
		Header: packets.PacketHeader{
			PacketFormat:   packets.PacketFormat2026,
			SessionUID:     444555666,
			PlayerCarIndex: 0,
		},
		GamePaused:                1,
		NumWeatherForecastSamples: 1,
		WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
			{TimeOffset: 5, RainPercentage: 80},
		},
	}
	engine.ProcessPacket(ctx, pausedSessionPkt)
	if _, exists := engine.lastDirectives["weather_rain_5"]; exists {
		t.Fatalf("expected weather directive to be suppressed when game is paused")
	}
}
