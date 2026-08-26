package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func createTestHeader(format uint16, sessionUID uint64, playerCarIndex uint8) packets.PacketHeader {
	return packets.PacketHeader{
		PacketFormat:   format,
		SessionUID:     sessionUID,
		SessionTime:    100.0,
		PlayerCarIndex: playerCarIndex,
	}
}

func TestEngineerEngine_ProcessPackets(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 123456789, 0)

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
		SessionType:               packets.SessionRace,
		NumWeatherForecastSamples: 2,
		WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
			{TimeOffset: 5, RainPercentage: 75},
			{TimeOffset: 10, RainPercentage: 80},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt)

	if _, exists := engine.lastDirectives["flags_rain"]; !exists {
		t.Fatalf("expected weather rain alert directive")
	}

	// 3. Process Lap Data (Sector 1 personal best establishment)
	lapPkt1 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, Sector1TimeMSPart: 28000, Sector: 1, CarPosition: 2, TotalDistance: 1000, DriverStatus: packets.DriverStatusOnTrack},
			{CurrentLapNum: 1, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 1050, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt1)

	// Lap 1 Sector 2 with delta loss
	lapPkt2 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, Sector1TimeMSPart: 28500, Sector: 1, CarPosition: 2, TotalDistance: 1500, DriverStatus: packets.DriverStatusOnTrack},
			{CurrentLapNum: 1, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 1550, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt2)

	if _, exists := engine.lastDirectives["coaching_s1"]; !exists {
		t.Fatalf("expected coaching_s1 directive to be emitted")
	}

	// Reset engine
	engine.Reset(987654321)
	if engine.teammateCarIndex != -1 {
		t.Fatalf("expected teammateCarIndex=-1 after reset, got %d", engine.teammateCarIndex)
	}
}

func TestEngineerEngine_TyreSubsystem(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()

	// 1. Tyre wear warning (42%)
	header1 := createTestHeader(packets.PacketFormat2026, 111, 0)
	sessionPkt1 := &packets.PacketSessionData{
		Header:      header1,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt1)

	lapPkt1 := &packets.PacketLapData{
		Header: header1,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt1)

	damagePkt1 := &packets.PacketCarDamageData{
		Header: header1,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{42.0, 38.0, 30.0, 29.0}},
		},
	}
	engine.ProcessPacket(ctx, damagePkt1)

	if _, exists := engine.lastDirectives["tyre_wear"]; !exists {
		t.Fatalf("expected tyre_wear directive to be emitted")
	}

	// 2. Critical Puncture emergency bypass (>= 95%)
	header2 := createTestHeader(packets.PacketFormat2026, 112, 0)
	sessionPkt2 := &packets.PacketSessionData{
		Header:      header2,
		SessionType: packets.SessionRace,
	}
	lapPkt2 := &packets.PacketLapData{
		Header: header2,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt2)
	engine.ProcessPacket(ctx, lapPkt2)

	puncturePkt := &packets.PacketCarDamageData{
		Header: header2,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{96.0, 30.0, 25.0, 20.0}},
		},
	}
	engine.ProcessPacket(ctx, puncturePkt)

	if _, exists := engine.lastDirectives["tyre_puncture"]; !exists {
		t.Fatalf("expected tyre_puncture directive to be emitted")
	}

	// 3. Thermal Overheating 2026 (112°C triggers 2026 limit 110°C)
	header3 := createTestHeader(packets.PacketFormat2026, 113, 0)
	sessionPkt3 := &packets.PacketSessionData{
		Header:      header3,
		SessionType: packets.SessionRace,
	}
	lapPkt3 := &packets.PacketLapData{
		Header: header3,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt3)
	engine.ProcessPacket(ctx, lapPkt3)

	telemetryPkt2026 := &packets.PacketCarTelemetryData{
		Header: header3,
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				TyresSurfaceTemperature: [4]uint8{100, 100, 112, 111}, // Rear Left/Right at 112°C
				Brake:                   0,
				Steer:                   0,
			},
		},
	}
	engine.ProcessPacket(ctx, telemetryPkt2026)
	if _, exists := engine.lastDirectives["tyre_overheat"]; !exists {
		t.Fatalf("expected tyre_overheat directive to be emitted for 2026 at 112°C")
	}

	// In 2025: 112°C should NOT trigger because 2025 limit is 115°C
	header4 := createTestHeader(packets.PacketFormat2025, 114, 0)
	sessionPkt2025 := &packets.PacketSessionData{
		Header:      header4,
		SessionType: packets.SessionRace,
	}
	lapPkt4 := &packets.PacketLapData{
		Header: header4,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt2025)
	engine.ProcessPacket(ctx, lapPkt4)

	telemetryPkt2025 := &packets.PacketCarTelemetryData{
		Header: header4,
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				TyresSurfaceTemperature: [4]uint8{100, 100, 112, 111},
				Brake:                   0,
				Steer:                   0,
			},
		},
	}
	engine.ProcessPacket(ctx, telemetryPkt2025)
	if _, exists := engine.lastDirectives["tyre_overheat"]; exists {
		t.Fatalf("did NOT expect tyre_overheat directive for 2025 at 112°C (limit is 115°C)")
	}
}

func TestEngineerEngine_DamageAndMechanicalFaults(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 200, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	// Front wing warning (25%)
	dmgPkt := &packets.PacketCarDamageData{
		Header: header,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{FrontLeftWingDamage: 25},
		},
	}
	engine.ProcessPacket(ctx, dmgPkt)
	if _, exists := engine.lastDirectives["damage_wing"]; !exists {
		t.Fatalf("expected damage_wing warning directive")
	}

	// Floor damage (26%) in separate session
	header201 := createTestHeader(packets.PacketFormat2026, 201, 0)
	sessionPkt201 := &packets.PacketSessionData{
		Header:      header201,
		SessionType: packets.SessionRace,
	}
	lapPkt201 := &packets.PacketLapData{
		Header: header201,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt201)
	engine.ProcessPacket(ctx, lapPkt201)

	dmgPktFloor := &packets.PacketCarDamageData{
		Header: header201,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{FloorDamage: 15, DiffuserDamage: 11}, // 26%
		},
	}
	engine.ProcessPacket(ctx, dmgPktFloor)
	if _, exists := engine.lastDirectives["damage_floor"]; !exists {
		t.Fatalf("expected damage_floor directive")
	}

	// Active Aero fault in 2026
	header202 := createTestHeader(packets.PacketFormat2026, 202, 0)
	sessionPkt202 := &packets.PacketSessionData{
		Header:      header202,
		SessionType: packets.SessionRace,
	}
	lapPkt202 := &packets.PacketLapData{
		Header: header202,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt202)
	engine.ProcessPacket(ctx, lapPkt202)

	dmgPktFault := &packets.PacketCarDamageData{
		Header: header202,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{DRSFault: 1},
		},
	}
	engine.ProcessPacket(ctx, dmgPktFault)
	if _, exists := engine.lastDirectives["damage_faults"]; !exists {
		t.Fatalf("expected damage_faults directive")
	}
}

func TestEngineerEngine_ERSAndBrakes(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 300, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	// Low ERS (10%)
	statusPkt := &packets.PacketCarStatusData{
		Header: header,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{ERSStoreEnergy: 400_000.0, FuelRemainingLaps: 1.5}, // 400k / 4M = 10%
		},
	}
	engine.ProcessPacket(ctx, statusPkt)
	if _, exists := engine.lastDirectives["ers_low"]; !exists {
		t.Fatalf("expected ers_low directive")
	}

	// Brake disc overheat (950°C)
	telemetryPkt := &packets.PacketCarTelemetryData{
		Header: header,
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				BrakesTemperature: [4]uint16{950, 940, 800, 810},
				Brake:             0,
				Steer:             0,
			},
		},
	}
	engine.ProcessPacket(ctx, telemetryPkt)
	if _, exists := engine.lastDirectives["brake_hot"]; !exists {
		t.Fatalf("expected brake_hot directive")
	}
}

func TestEngineerEngine_FuelAndStrategy(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 400, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:                header,
		SessionType:           packets.SessionRace,
		PitStopWindowIdealLap: 8,
		PitStopRejoinPosition: 4,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// Fuel deficit (-1.0 laps)
	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 8, CarPosition: 2, DriverStatus: packets.DriverStatusOnTrack, TotalDistance: 6000},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	statusPkt := &packets.PacketCarStatusData{
		Header: header,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{FuelRemainingLaps: -1.0, ERSStoreEnergy: 2_000_000.0},
		},
	}
	engine.ProcessPacket(ctx, statusPkt)

	if _, exists := engine.lastDirectives["fuel_delta"]; !exists {
		t.Fatalf("expected fuel_delta directive")
	}
	if _, exists := engine.lastDirectives["pit_window"]; !exists {
		t.Fatalf("expected pit_window directive on ideal lap 8")
	}

	// Undercut in new session
	header401 := createTestHeader(packets.PacketFormat2026, 401, 0)
	sessionPkt401 := &packets.PacketSessionData{
		Header:      header401,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt401)
	lapPktUndercut := &packets.PacketLapData{
		Header: header401,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 8, CarPosition: 2, DriverStatus: packets.DriverStatusOnTrack, TotalDistance: 6000},
			{CurrentLapNum: 8, CarPosition: 3, DriverStatus: packets.DriverStatusOnTrack, TotalDistance: 5920, PitStatus: packets.PitStatusPitting},
		},
	}
	engine.ProcessPacket(ctx, lapPktUndercut)
	if _, exists := engine.lastDirectives["undercut"]; !exists {
		t.Fatalf("expected undercut directive")
	}
}

func TestEngineerEngine_RivalBattles(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 500, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	statusPkt := &packets.PacketCarStatusData{
		Header: header,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{ActualTyreCompound: packets.ActualCompoundC3, TyresAgeLaps: 10},
			{ActualTyreCompound: packets.ActualCompoundC4, TyresAgeLaps: 2},
		},
	}
	engine.ProcessPacket(ctx, statusPkt)

	// Player is P2 (5000m), Rival is P3 (4960m, 40m behind -> <65m defend zone)
	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, CarPosition: 2, DriverStatus: packets.DriverStatusOnTrack, TotalDistance: 5000},
			{CurrentLapNum: 5, CarPosition: 3, DriverStatus: packets.DriverStatusOnTrack, TotalDistance: 4960},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	if _, exists := engine.lastDirectives["rival_defend"]; !exists {
		t.Fatalf("expected rival_defend directive")
	}
}

func TestEngineerEngine_QualifyingIntelligence(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 600, 0)

	// Position player in P16
	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 3, DriverStatus: packets.DriverStatusFlyingLap, CurrentLapInvalid: 1, CarPosition: 16},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	sessionPkt := &packets.PacketSessionData{
		Header:          header,
		SessionType:     packets.SessionQ1,
		TrackLength:     5000,
		SessionTimeLeft: 160, // < 180s warning and < 300s elim danger
	}
	engine.ProcessPacket(ctx, sessionPkt)

	if _, exists := engine.lastDirectives["qualy_time"]; !exists {
		t.Fatalf("expected qualy_time session countdown directive")
	}
	if _, exists := engine.lastDirectives["qualy_invalid"]; !exists {
		t.Fatalf("expected qualy_invalid directive")
	}
	if _, exists := engine.lastDirectives["qualy_elim"]; !exists {
		t.Fatalf("expected qualy_elim directive for P16 with time < 300s")
	}
}

func TestEngineerEngine_FlagsAndPenalties(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 700, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:            header,
		SessionType:       packets.SessionRace,
		SafetyCarStatus:   packets.SafetyCarFull,
		NumRedFlagPeriods: 1,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	if _, exists := engine.lastDirectives["flags_sc"]; !exists {
		t.Fatalf("expected flags_sc directive")
	}
	if _, exists := engine.lastDirectives["flags_red"]; !exists {
		t.Fatalf("expected flags_red directive")
	}

	// Normal racing session for track limits & penalties
	engine.Reset(701)
	racingSessionPkt := &packets.PacketSessionData{
		Header:            createTestHeader(packets.PacketFormat2026, 701, 0),
		SessionType:       packets.SessionRace,
		SafetyCarStatus:   packets.SafetyCarNone,
		NumRedFlagPeriods: 0,
	}
	engine.ProcessPacket(ctx, racingSessionPkt)

	lapPkt := &packets.PacketLapData{
		Header: createTestHeader(packets.PacketFormat2026, 701, 0),
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, DriverStatus: packets.DriverStatusOnTrack, CornerCuttingWarnings: 2, Penalties: 5},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	if _, exists := engine.lastDirectives["track_limits"]; !exists {
		t.Fatalf("expected track_limits warning directive")
	}
	if _, exists := engine.lastDirectives["penalties"]; !exists {
		t.Fatalf("expected penalties incurred directive")
	}
}

func TestEngineerEngine_SmartDiscretionSuppression(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 800, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	// Heavy braking active: Brake > 0.50
	telemetryPkt := &packets.PacketCarTelemetryData{
		Header: header,
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{
				Brake: 0.85,
				Steer: 0.1,
			},
		},
	}
	engine.ProcessPacket(ctx, telemetryPkt)

	// Non-critical tyre wear alert at 45%
	damagePkt := &packets.PacketCarDamageData{
		Header: header,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{45.0, 30.0, 20.0, 20.0}},
		},
	}
	engine.ProcessPacket(ctx, damagePkt)

	// Non-critical alert should be suppressed by discretion
	if _, exists := engine.lastDirectives["tyre_wear"]; exists {
		t.Fatalf("expected tyre_wear to be suppressed during heavy braking")
	}
}

func TestEngineerEngine_ConfigEndpoints(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	server := NewServer(nil, nil, hub)
	server.SetEngineerEngine(engine)

	// 1. GET /api/ai/engineer/config
	reqGet := httptest.NewRequest(http.MethodGet, "/api/ai/engineer/config", http.NoBody)
	recGet := httptest.NewRecorder()
	server.Router().ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from GET config, got %d", recGet.Code)
	}

	var cfg EngineerConfig
	if err := json.Unmarshal(recGet.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("failed to decode GET config: %v", err)
	}
	if cfg.TyreWearWarnPct != 40.0 {
		t.Fatalf("expected default TyreWearWarnPct=40, got %f", cfg.TyreWearWarnPct)
	}

	// 2. POST /api/ai/engineer/config with updated settings
	cfg.TyreWearWarnPct = 50.0
	cfg.EnabledCategories = map[string]bool{"tyres": false}

	bodyBytes, _ := json.Marshal(cfg)
	reqPost := httptest.NewRequest(http.MethodPost, "/api/ai/engineer/config", bytes.NewReader(bodyBytes))
	reqPost.Header.Set("Content-Type", "application/json")
	recPost := httptest.NewRecorder()
	server.Router().ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from POST config, got %d", recPost.Code)
	}

	if engine.GetConfig().TyreWearWarnPct != 50.0 {
		t.Fatalf("expected engine TyreWearWarnPct to update to 50.0, got %f", engine.GetConfig().TyreWearWarnPct)
	}
	if engine.GetConfig().IsAlertEnabled("tyres", "tyre_wear") {
		t.Fatalf("expected tyres category to be disabled")
	}
}

func TestEngineerEngine_DeduplicationScopesAndOutLapGuard(t *testing.T) {
	hub := NewHub()
	engine := NewEngineerEngine(hub, nil)
	ctx := context.Background()

	// 1. Out-lap distance completion guard: cold tyre alert suppressed when LapDistance < 30% of track length
	header := createTestHeader(packets.PacketFormat2026, 900, 0)
	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionQ1,
		TrackLength: 5000,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// Early in out lap (500m / 5000m = 10% < 30%)
	lapPktEarly := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, DriverStatus: packets.DriverStatusOutLap, LapDistance: 500},
		},
	}
	statusPkt := &packets.PacketCarStatusData{
		Header: header,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{TyresAgeLaps: 0},
		},
	}
	telemetryPkt := &packets.PacketCarTelemetryData{
		Header: header,
		CarTelemetryData: [packets.MaxCars]packets.CarTelemetryData{
			{TyresSurfaceTemperature: [4]uint8{70, 70, 70, 70}}, // Cold tyres
		},
	}
	engine.ProcessPacket(ctx, lapPktEarly)
	engine.ProcessPacket(ctx, statusPkt)
	engine.ProcessPacket(ctx, telemetryPkt)

	if _, exists := engine.lastDirectives["tyre_cold"]; exists {
		t.Fatalf("expected tyre_cold alert to be suppressed when out-lap completion is < 30%%")
	}

	// Later in out lap (2000m / 5000m = 40% >= 30%)
	lapPktLate := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, DriverStatus: packets.DriverStatusOutLap, LapDistance: 2000},
		},
	}
	engine.ProcessPacket(ctx, lapPktLate)
	engine.ProcessPacket(ctx, telemetryPkt)

	if _, exists := engine.lastDirectives["tyre_cold"]; !exists {
		t.Fatalf("expected tyre_cold alert to be emitted when out-lap completion >= 30%%")
	}

	// 2. Stint deduplication reset on pit stop (TyresAgeLaps <= 1 after stint age > 3)
	engine.Reset(901)
	header901 := createTestHeader(packets.PacketFormat2026, 901, 0)
	sessionPkt901 := &packets.PacketSessionData{
		Header:      header901,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt901)

	// In stint (Tyre age 8, wear 42%)
	statusStint := &packets.PacketCarStatusData{
		Header: header901,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{TyresAgeLaps: 8},
		},
	}
	lapStint := &packets.PacketLapData{
		Header: header901,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 8, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	damageStint := &packets.PacketCarDamageData{
		Header: header901,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{42.0, 30.0, 20.0, 20.0}},
		},
	}
	engine.ProcessPacket(ctx, lapStint)
	engine.ProcessPacket(ctx, statusStint)
	engine.ProcessPacket(ctx, damageStint)

	if !engine.stintKeys["tyre_wear"] {
		t.Fatalf("expected stintKeys['tyre_wear'] to be true")
	}

	// After pit stop: tyre age becomes 0
	statusPit := &packets.PacketCarStatusData{
		Header: header901,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{TyresAgeLaps: 0},
		},
	}
	engine.ProcessPacket(ctx, statusPit)

	if engine.stintKeys["tyre_wear"] {
		t.Fatalf("expected stintKeys['tyre_wear'] to be reset to false after pit stop")
	}
}
