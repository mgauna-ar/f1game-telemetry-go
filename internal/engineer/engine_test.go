package engineer

import (
	"context"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

type mockBroadcaster struct {
	mu         sync.Mutex
	broadcasts [][]byte
}

func (m *mockBroadcaster) Broadcast(data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.broadcasts = append(m.broadcasts, data)
}

func createTestHeader(format uint16, sessionUID uint64, playerCarIndex uint8) packets.PacketHeader {
	return packets.PacketHeader{
		PacketFormat:   format,
		SessionUID:     sessionUID,
		SessionTime:    100.0,
		PlayerCarIndex: playerCarIndex,
	}
}

func TestEngineerEngine_ProcessPackets(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
			{CurrentLapNum: 2, Sector1TimeMSPart: 28000, Sector: 1, CarPosition: 2, TotalDistance: 5000, DriverStatus: packets.DriverStatusOnTrack},
			{CurrentLapNum: 2, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 5050, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPkt1)

	// Lap 2 Sector 1 with delta loss
	lapPkt2 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 2, Sector1TimeMSPart: 28500, Sector: 1, CarPosition: 2, TotalDistance: 5500, DriverStatus: packets.DriverStatusOnTrack},
			{CurrentLapNum: 2, Sector1TimeMSPart: 28200, Sector: 1, CarPosition: 1, TotalDistance: 5550, DriverStatus: packets.DriverStatusOnTrack},
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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

	// In C1 compound: 112°C should NOT trigger because C1 window is 95-115°C (limit is 120°C)
	delete(engine.lastDirectives, "tyre_overheat")
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
	statusPkt4 := &packets.PacketCarStatusData{
		Header: header4,
		CarStatusData: [packets.MaxCars]packets.CarStatusData{
			{ActualTyreCompound: packets.ActualCompoundC1},
		},
	}
	engine.ProcessPacket(ctx, sessionPkt2025)
	engine.ProcessPacket(ctx, lapPkt4)
	engine.ProcessPacket(ctx, statusPkt4)

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
		t.Fatalf("did NOT expect tyre_overheat directive for C1 at 112°C (limit is 120°C)")
	}
}

func TestEngineerEngine_DamageAndMechanicalFaults(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 600, 0)

	// 1. Position player in P16 on out-lap
	lapPktOut := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 3, DriverStatus: packets.DriverStatusOutLap, CarPosition: 16},
		},
	}
	engine.ProcessPacket(ctx, lapPktOut)

	// 2. Session countdown and elimination danger check on out-lap
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
	if _, exists := engine.lastDirectives["qualy_elim"]; !exists {
		t.Fatalf("expected qualy_elim directive for P16 with time < 300s")
	}

	// 2. On flying lap: triggers qualy_invalid when track limits violated
	lapPktFlying := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 3, DriverStatus: packets.DriverStatusFlyingLap, CurrentLapInvalid: 1, CarPosition: 16},
		},
	}
	engine.ProcessPacket(ctx, lapPktFlying)

	if _, exists := engine.lastDirectives["qualy_invalid"]; !exists {
		t.Fatalf("expected qualy_invalid directive")
	}
}

func TestEngineerEngine_FlagsAndPenalties(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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

func TestEngineerEngine_DeduplicationScopesAndOutLapGuard(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
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

func TestEngineerEngine_SectorCoaching_InLapSuppression(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 444, 0)

	// 1. Race Session
	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// Establish PB on racing lap 1 (Sector 1 = 28.000s)
	lapFlying := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, Sector1TimeMSPart: 28000, Sector: 1, CarPosition: 1, TotalDistance: 1000, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapFlying)

	// Racing lap 2: delta loss (+1.5s slower = 29.500s) -> Should trigger coaching_s1
	lapFlying2 := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 2, Sector1TimeMSPart: 29500, Sector: 1, CarPosition: 1, TotalDistance: 6000, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapFlying2) // sets lastLapNumber = 2
	engine.ProcessPacket(ctx, lapFlying2) // second packet triggers delta check

	if _, exists := engine.lastDirectives["coaching_s1"]; !exists {
		t.Fatalf("expected coaching_s1 directive on racing lap with delta loss")
	}
	delete(engine.lastDirectives, "coaching_s1")
	delete(engine.lastDirectives, string(DirectiveCategoryCoaching))

	// In-Lap (Lap 3): Driver slowing down to enter boxes (Sector 1 = 45.000s, DriverStatus = InLap) -> MUST BE SUPPRESSED
	lapInLap := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 3, Sector1TimeMSPart: 45000, Sector: 1, CarPosition: 1, TotalDistance: 11000, DriverStatus: packets.DriverStatusInLap},
		},
	}
	engine.ProcessPacket(ctx, lapInLap)
	engine.ProcessPacket(ctx, lapInLap)

	if _, exists := engine.lastDirectives["coaching_s1"]; exists {
		t.Fatalf("expected coaching_s1 directive to be SUPPRESSED on in-lap, but it fired")
	}

	// Out-Lap (Lap 4): Driver leaving pit lane (Sector 1 = 40.000s, DriverStatus = OutLap) -> MUST BE SUPPRESSED
	lapOutLap := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 4, Sector1TimeMSPart: 40000, Sector: 1, CarPosition: 1, TotalDistance: 16000, DriverStatus: packets.DriverStatusOutLap},
		},
	}
	engine.ProcessPacket(ctx, lapOutLap)
	engine.ProcessPacket(ctx, lapOutLap)

	if _, exists := engine.lastDirectives["coaching_s1"]; exists {
		t.Fatalf("expected coaching_s1 directive to be SUPPRESSED on out-lap, but it fired")
	}
}

func TestEngineerEngine_SafetyCar_PitStrategySuppression(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 555, 0)

	// Race Session under Safety Car
	sessionPkt := &packets.PacketSessionData{
		Header:                header,
		SessionType:           packets.SessionRace,
		SafetyCarStatus:       packets.SafetyCarFull,
		PitStopWindowIdealLap: 5,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// Lap data where car behind pits (normally would trigger undercut_window)
	// and lap is multiple of 5 (normally would trigger clean air pit window)
	// and ideal pit window lap matches currentLap
	lapPkt := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 5, CarPosition: 1, TotalDistance: 10000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			{CurrentLapNum: 5, CarPosition: 2, TotalDistance: 9900, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusPitting},
		},
	}
	engine.ProcessPacket(ctx, lapPkt)

	if _, exists := engine.lastDirectives["undercut"]; exists {
		t.Fatalf("expected undercut directive to be SUPPRESSED under Safety Car, but it fired")
	}
	if _, exists := engine.lastDirectives["pit_clean_air"]; exists {
		t.Fatalf("expected pit_clean_air directive to be SUPPRESSED under Safety Car, but it fired")
	}
	if _, exists := engine.lastDirectives["pit_window"]; exists {
		t.Fatalf("expected pit_window directive to be SUPPRESSED under Safety Car, but it fired")
	}
	if _, exists := engine.lastDirectives["rival_defend"]; exists {
		t.Fatalf("expected rival_defend directive to be SUPPRESSED under Safety Car, but it fired")
	}

	// Now switch Safety Car off (green flag racing)
	sessionPktGreen := &packets.PacketSessionData{
		Header:          header,
		SessionType:     packets.SessionRace,
		SafetyCarStatus: packets.SafetyCarNone,
	}
	engine.ProcessPacket(ctx, sessionPktGreen)

	// Reset cooldowns
	engine.lastDirectives = make(map[string]int64)

	// In green flag race, rival pitting within undercut window should trigger undercut alert with PitStrategy category
	lapPktGreen := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 6, CarPosition: 1, TotalDistance: 12000, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusNone},
			{CurrentLapNum: 6, CarPosition: 2, TotalDistance: 11950, DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusPitting},
		},
	}
	engine.ProcessPacket(ctx, lapPktGreen)

	if _, exists := engine.lastDirectives["undercut"]; !exists {
		t.Fatalf("expected undercut directive to be emitted under green flag racing")
	}
}

func TestEngineerEngine_DeriveDrivingPhase(t *testing.T) {
	engine := NewEngineerEngine(&mockBroadcaster{})

	tests := []struct {
		name      string
		session   *packets.PacketSessionData
		lap       *packets.LapData
		telemetry *packets.CarTelemetryData
		expected  DrivingPhase
	}{
		{
			name:     "Red flag",
			session:  &packets.PacketSessionData{NumRedFlagPeriods: 1, SessionType: packets.SessionRace},
			expected: PhaseRedFlag,
		},
		{
			name:     "In garage explicit",
			session:  &packets.PacketSessionData{SessionType: packets.SessionQ1},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusInGarage},
			expected: PhaseInGarage,
		},
		{
			name:      "In pit area stationary",
			session:   &packets.PacketSessionData{SessionType: packets.SessionRace},
			lap:       &packets.LapData{DriverStatus: packets.DriverStatusOnTrack, PitStatus: packets.PitStatusInPitArea},
			telemetry: &packets.CarTelemetryData{Speed: 0},
			expected:  PhaseInGarage,
		},
		{
			name:      "Pit lane active timer",
			session:   &packets.PacketSessionData{SessionType: packets.SessionRace},
			lap:       &packets.LapData{DriverStatus: packets.DriverStatusOnTrack, PitLaneTimerActive: 1},
			telemetry: &packets.CarTelemetryData{Speed: 60},
			expected:  PhasePitLane,
		},
		{
			name:     "Safety Car Virtual",
			session:  &packets.PacketSessionData{SessionType: packets.SessionRace, SafetyCarStatus: packets.SafetyCarVirtual},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOnTrack},
			expected: PhaseSafetyCar,
		},
		{
			name:     "Safety Car Full",
			session:  &packets.PacketSessionData{SessionType: packets.SessionRace, SafetyCarStatus: packets.SafetyCarFull},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOnTrack},
			expected: PhaseSafetyCar,
		},
		{
			name:     "Formation lap",
			session:  &packets.PacketSessionData{SessionType: packets.SessionRace, SafetyCarStatus: packets.SafetyCarFormationLap},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOnTrack},
			expected: PhaseFormationLap,
		},
		{
			name:     "Qualifying Out-Lap",
			session:  &packets.PacketSessionData{SessionType: packets.SessionQ2},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOutLap},
			expected: PhaseOutLap,
		},
		{
			name:     "Qualifying In-Lap",
			session:  &packets.PacketSessionData{SessionType: packets.SessionQ3},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusInLap},
			expected: PhaseInLap,
		},
		{
			name:     "Qualifying Flying-Lap",
			session:  &packets.PacketSessionData{SessionType: packets.SessionQ1},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusFlyingLap},
			expected: PhaseFlyingLap,
		},
		{
			name:     "Race Normal Racing",
			session:  &packets.PacketSessionData{SessionType: packets.SessionRace, SafetyCarStatus: packets.SafetyCarNone},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOnTrack},
			expected: PhaseRacing,
		},
		{
			name:     "Post-Race Finished",
			session:  &packets.PacketSessionData{SessionType: packets.SessionRace},
			lap:      &packets.LapData{DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusFinished},
			expected: PhasePostRace,
		},
		{
			name:      "Race Grid starting lineup",
			session:   &packets.PacketSessionData{SessionType: packets.SessionRace},
			lap:       &packets.LapData{DriverStatus: packets.DriverStatusOnTrack, CurrentLapNum: 1, LapDistance: 50.0, TotalDistance: 50.0},
			telemetry: &packets.CarTelemetryData{Speed: 0},
			expected:  PhaseGrid,
		},
		{
			name:     "Qualifying Unknown DriverStatus",
			session:  &packets.PacketSessionData{SessionType: packets.SessionQ1, SafetyCarStatus: packets.SafetyCarNone},
			lap:      &packets.LapData{DriverStatus: 99},
			expected: PhaseUnknown,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := engine.deriveDrivingPhase(tt.session, tt.lap, tt.telemetry)
			if got != tt.expected {
				t.Errorf("deriveDrivingPhase() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestEngineerEngine_ConcurrentSessionTransitions(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
	ctx := context.Background()

	var wg sync.WaitGroup
	for g := 0; g < 5; g++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				sessionUID := uint64(1000 + (i % 3))
				header := createTestHeader(packets.PacketFormat2026, sessionUID, 0)
				sessionPkt := &packets.PacketSessionData{
					Header:      header,
					SessionType: packets.SessionRace,
				}
				engine.ProcessPacket(ctx, sessionPkt)

				lapPkt := &packets.PacketLapData{
					Header: header,
				}
				engine.ProcessPacket(ctx, lapPkt)
			}
		}(g)
	}

	wg.Wait()
}

type lockCheckingBroadcaster struct {
	engine      *EngineerEngine
	called      bool
	lockWasHeld bool
}

func (l *lockCheckingBroadcaster) Broadcast(data []byte) {
	l.called = true
	if !l.engine.mu.TryLock() {
		l.lockWasHeld = true
	} else {
		l.engine.mu.Unlock()
	}
}

func TestEngineerEngine_BroadcastOutsideLock(t *testing.T) {
	b := &lockCheckingBroadcaster{}
	engine := NewEngineerEngine(b)
	b.engine = engine

	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 123456789, 0)

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

	if !b.called {
		t.Fatal("expected broadcaster.Broadcast to be called")
	}
	if b.lockWasHeld {
		t.Fatal("expected broadcaster.Broadcast to execute with engine.mu unlocked, but lock was held")
	}
}

func TestEngineerEngine_CategoryIndependence(t *testing.T) {
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 99887766, 0)

	t.Run("disabling flags allows weather rain alert", func(t *testing.T) {
		b := &mockBroadcaster{}
		engine := NewEngineerEngine(b)
		cfg := engine.GetConfig()
		cfg.EnabledCategories = map[string]bool{
			"flags": false,
		}
		engine.SetConfig(cfg)

		// 1. Send Safety Car packet (flags category) -> should NOT emit directive
		sessionSC := &packets.PacketSessionData{
			Header:          header,
			SessionType:     packets.SessionRace,
			SafetyCarStatus: packets.SafetyCarFull,
		}
		engine.ProcessPacket(ctx, sessionSC)

		if _, exists := engine.lastDirectives["flags_sc"]; exists {
			t.Errorf("expected flags_sc to be suppressed when flags category is disabled")
		}

		// 2. Send weather packet (weather category) -> SHOULD emit directive even though flags rule handles it
		sessionWeather := &packets.PacketSessionData{
			Header:                    header,
			SessionType:               packets.SessionRace,
			NumWeatherForecastSamples: 1,
			WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
				{TimeOffset: 5, RainPercentage: 80},
			},
		}
		engine.ProcessPacket(ctx, sessionWeather)

		if _, exists := engine.lastDirectives["flags_rain"]; !exists {
			t.Errorf("expected flags_rain to be emitted when flags is disabled but weather is enabled")
		}
	})

	t.Run("disabling weather suppresses rain alert but allows flags", func(t *testing.T) {
		b := &mockBroadcaster{}
		engine := NewEngineerEngine(b)
		cfg := engine.GetConfig()
		cfg.EnabledCategories = map[string]bool{
			"weather": false,
		}
		engine.SetConfig(cfg)

		// 1. Send weather packet -> should NOT emit
		sessionWeather := &packets.PacketSessionData{
			Header:                    header,
			SessionType:               packets.SessionRace,
			NumWeatherForecastSamples: 1,
			WeatherForecastSamples: [packets.MaxWeatherForecastSamples]packets.WeatherForecastSample{
				{TimeOffset: 5, RainPercentage: 80},
			},
		}
		engine.ProcessPacket(ctx, sessionWeather)

		if _, exists := engine.lastDirectives["flags_rain"]; exists {
			t.Errorf("expected flags_rain to be suppressed when weather category is disabled")
		}

		// 2. Send Safety Car packet -> SHOULD emit
		sessionSC := &packets.PacketSessionData{
			Header:          header,
			SessionType:     packets.SessionRace,
			SafetyCarStatus: packets.SafetyCarFull,
		}
		engine.ProcessPacket(ctx, sessionSC)

		if _, exists := engine.lastDirectives["flags_sc"]; !exists {
			t.Errorf("expected flags_sc to be emitted when weather is disabled but flags is enabled")
		}
	})

	t.Run("disabling fuel allows pit_strategy undercut and pit_window", func(t *testing.T) {
		b := &mockBroadcaster{}
		engine := NewEngineerEngine(b)
		cfg := engine.GetConfig()
		cfg.EnabledCategories = map[string]bool{
			"fuel": false,
		}
		engine.SetConfig(cfg)

		sessionPkt := &packets.PacketSessionData{
			Header:                header,
			SessionType:           packets.SessionRace,
			SafetyCarStatus:       packets.SafetyCarNone,
			PitStopWindowIdealLap: 5,
			PitStopRejoinPosition: 3,
		}
		engine.ProcessPacket(ctx, sessionPkt)

		// Lap packet on lap 5 -> triggers pit_window
		lapPkt := &packets.PacketLapData{
			Header: header,
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, CarPosition: 2, TotalDistance: 10000, DriverStatus: packets.DriverStatusOnTrack},
			},
		}
		engine.ProcessPacket(ctx, lapPkt)

		if _, exists := engine.lastDirectives["pit_window"]; !exists {
			t.Errorf("expected pit_window to be emitted when fuel is disabled but pit_strategy is enabled")
		}

		// CarStatus packet with negative fuel delta -> should NOT emit fuel_delta
		statusPkt := &packets.PacketCarStatusData{
			Header: header,
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{FuelRemainingLaps: -1.5},
			},
		}
		engine.ProcessPacket(ctx, statusPkt)

		if _, exists := engine.lastDirectives["fuel_delta"]; exists {
			t.Errorf("expected fuel_delta to be suppressed when fuel category is disabled")
		}
	})

	t.Run("disabling pit_strategy suppresses pit_window but allows fuel_delta", func(t *testing.T) {
		b := &mockBroadcaster{}
		engine := NewEngineerEngine(b)
		cfg := engine.GetConfig()
		cfg.EnabledCategories = map[string]bool{
			"pit_strategy": false,
		}
		engine.SetConfig(cfg)

		sessionPkt := &packets.PacketSessionData{
			Header:                header,
			SessionType:           packets.SessionRace,
			SafetyCarStatus:       packets.SafetyCarNone,
			PitStopWindowIdealLap: 5,
			PitStopRejoinPosition: 3,
		}
		engine.ProcessPacket(ctx, sessionPkt)

		// Lap packet on lap 5
		lapPkt := &packets.PacketLapData{
			Header: header,
			LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 5, CarPosition: 2, TotalDistance: 10000, DriverStatus: packets.DriverStatusOnTrack},
			},
		}
		engine.ProcessPacket(ctx, lapPkt)

		if _, exists := engine.lastDirectives["pit_window"]; exists {
			t.Errorf("expected pit_window to be suppressed when pit_strategy category is disabled")
		}

		// CarStatus packet with negative fuel delta -> SHOULD emit fuel_delta
		statusPkt := &packets.PacketCarStatusData{
			Header: header,
			CarStatusData: [packets.MaxCars]packets.CarStatusData{
				{FuelRemainingLaps: -1.5},
			},
		}
		engine.ProcessPacket(ctx, statusPkt)

		if _, exists := engine.lastDirectives["fuel_delta"]; !exists {
			t.Errorf("expected fuel_delta to be emitted when pit_strategy is disabled but fuel is enabled")
		}
	})
}

func TestEngineerEngine_StartSilenceAndPostRaceSuppression(t *testing.T) {
	broadcaster := &mockBroadcaster{}
	engine := NewEngineerEngine(broadcaster)
	ctx := context.Background()
	header := createTestHeader(packets.PacketFormat2026, 7777, 0)

	sessionPkt := &packets.PacketSessionData{
		Header:      header,
		SessionType: packets.SessionRace,
	}
	engine.ProcessPacket(ctx, sessionPkt)

	// 1. Grid phase: STLG event received
	stlgEvent := &packets.PacketEventData{
		Header:          header,
		EventStringCode: [4]uint8{'S', 'T', 'L', 'G'},
	}
	engine.ProcessPacket(ctx, stlgEvent)

	lapPktGrid := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, LapDistance: 10, TotalDistance: 10, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPktGrid)

	if engine.currentPhase != PhaseGrid {
		t.Fatalf("expected PhaseGrid during start lights, got %v", engine.currentPhase)
	}

	// Non-critical tyre wear at 45% should be suppressed during PhaseGrid
	damagePkt := &packets.PacketCarDamageData{
		Header: header,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{45.0, 30.0, 20.0, 20.0}},
		},
	}
	engine.ProcessPacket(ctx, damagePkt)

	if _, exists := engine.lastDirectives["tyre_wear"]; exists {
		t.Errorf("expected tyre_wear to be suppressed during PhaseGrid")
	}

	// Critical puncture (wear >= 95%) SHOULD break through even on Grid
	puncturePkt := &packets.PacketCarDamageData{
		Header: header,
		CarDamageData: [packets.MaxCars]packets.CarDamageData{
			{TyresWear: [4]float32{96.0, 30.0, 20.0, 20.0}},
		},
	}
	engine.ProcessPacket(ctx, puncturePkt)

	if _, exists := engine.lastDirectives["tyre_puncture"]; !exists {
		t.Errorf("expected tyre_puncture emergency to break through during PhaseGrid")
	}

	// 2. Lights out: LGOT event received -> enters PhaseRaceStart
	lgotEvent := &packets.PacketEventData{
		Header:          header,
		EventStringCode: [4]uint8{'L', 'G', 'O', 'T'},
	}
	engine.ProcessPacket(ctx, lgotEvent)

	lapPktStart := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 1, LapDistance: 800, TotalDistance: 800, DriverStatus: packets.DriverStatusOnTrack},
		},
	}
	engine.ProcessPacket(ctx, lapPktStart)

	if engine.currentPhase != PhaseRaceStart {
		t.Fatalf("expected PhaseRaceStart on Lap 1 after lights out, got %v", engine.currentPhase)
	}

	// 3. Post-race: ResultStatusFinished -> enters PhasePostRace and emits race_finish
	lapPktFinished := &packets.PacketLapData{
		Header: header,
		LapData: [packets.MaxCars]packets.LapData{
			{CurrentLapNum: 50, CarPosition: 3, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusFinished},
		},
	}
	engine.ProcessPacket(ctx, lapPktFinished)

	if engine.currentPhase != PhasePostRace {
		t.Fatalf("expected PhasePostRace when ResultStatusFinished, got %v", engine.currentPhase)
	}

	if _, exists := engine.lastDirectives["race_finish"]; !exists {
		t.Errorf("expected race_finish directive to be emitted upon race completion")
	}
}
