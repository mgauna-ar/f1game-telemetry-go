package main

import (
	"bytes"
	"encoding/binary"
	"flag"
	"fmt"
	"log/slog"
	"math"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

const (
	defaultTargetUDP            = "127.0.0.1:20777"
	sendInterval                = 50 * time.Millisecond // 20Hz
	simBrakingThrottleThreshold = 0.3
	simBrakingForce             = 0.8
)

type driverInfo struct {
	name         string
	driverID     uint16
	teamID       uint16
	raceNumber   uint8
	aiControlled uint8
	nationality  uint8
}

var drivers2025 = []driverInfo{
	// 20 Active Drivers (10 Teams)
	{"Max Verstappen", 9, 2, 1, 0, 22},           // Red Bull Racing
	{"Sergio Pérez", 14, 2, 11, 1, 52},           // Red Bull Racing
	{"Lewis Hamilton", 7, 1, 44, 1, 10},          // Ferrari
	{"Charles Leclerc", 58, 1, 16, 1, 53},        // Ferrari
	{"Lando Norris", 54, 8, 4, 1, 10},            // McLaren
	{"Oscar Piastri", 112, 8, 81, 1, 3},          // McLaren
	{"George Russell", 50, 0, 63, 1, 10},         // Mercedes
	{"Andrea-Kimi Antonelli", 165, 0, 12, 1, 41}, // Mercedes
	{"Fernando Alonso", 3, 4, 14, 1, 77},         // Aston Martin
	{"Lance Stroll", 19, 4, 18, 1, 13},           // Aston Martin
	{"Pierre Gasly", 59, 5, 10, 1, 28},           // Alpine
	{"Jack Doohan", 136, 5, 7, 1, 3},             // Alpine
	{"Alexander Albon", 62, 3, 23, 1, 80},        // Williams
	{"Carlos Sainz", 0, 3, 55, 1, 77},            // Williams
	{"Yuki Tsunoda", 94, 6, 22, 1, 43},           // RB
	{"Liam Lawson", 113, 6, 30, 1, 54},           // RB
	{"Nico Hülkenberg", 10, 9, 27, 1, 29},        // Kick Sauber
	{"Gabriel Bortoleto", 161, 9, 5, 1, 9},       // Kick Sauber
	{"Esteban Ocon", 17, 7, 31, 1, 28},           // Haas
	{"Oliver Bearman", 147, 7, 87, 1, 10},        // Haas
	// 2 Spectators / Observers (Inactive)
	{"Observer 1", 65535, 65535, 0, 1, 0},
	{"Observer 2", 65535, 65535, 0, 1, 0},
}

var drivers2026 = []driverInfo{
	// 22 Active Drivers (11 Teams)
	{"Max Verstappen", 9, 478, 1, 0, 22},           // Red Bull Racing '26
	{"Liam Lawson", 113, 478, 30, 1, 54},           // Red Bull Racing '26
	{"Lewis Hamilton", 7, 477, 44, 1, 10},          // Ferrari '26
	{"Charles Leclerc", 58, 477, 16, 1, 53},        // Ferrari '26
	{"Lando Norris", 54, 484, 4, 1, 10},            // McLaren '26
	{"Oscar Piastri", 112, 484, 81, 1, 3},          // McLaren '26
	{"George Russell", 50, 476, 63, 1, 10},         // Mercedes '26
	{"Andrea-Kimi Antonelli", 165, 476, 12, 1, 41}, // Mercedes '26
	{"Fernando Alonso", 3, 480, 14, 1, 77},         // Aston Martin '26
	{"Lance Stroll", 19, 480, 18, 1, 13},           // Aston Martin '26
	{"Pierre Gasly", 59, 481, 10, 1, 28},           // Alpine '26
	{"Jack Doohan", 136, 481, 7, 1, 3},             // Alpine '26
	{"Alexander Albon", 62, 479, 23, 1, 80},        // Williams '26
	{"Carlos Sainz", 0, 479, 55, 1, 77},            // Williams '26
	{"Yuki Tsunoda", 94, 482, 22, 1, 43},           // RB '26
	{"Isack Hadjar", 149, 482, 6, 1, 28},           // RB '26
	{"Nico Hülkenberg", 10, 485, 27, 1, 29},        // Audi '26
	{"Gabriel Bortoleto", 161, 485, 5, 1, 9},       // Audi '26
	{"Esteban Ocon", 17, 483, 31, 1, 28},           // Haas '26
	{"Oliver Bearman", 147, 483, 87, 1, 10},        // Haas '26
	{"Franco Colapinto", 162, 486, 43, 1, 2},       // Cadillac '26
	{"Sergio Pérez", 14, 486, 11, 1, 52},           // Cadillac '26
	// 2 Spectators / Observers (Inactive)
	{"Observer 1", 65535, 65535, 0, 1, 0},
	{"Observer 2", 65535, 65535, 0, 1, 0},
}

// SimulatorConfig holds the configuration options for the telemetry simulator.
type SimulatorConfig struct {
	TargetAddr      string
	SessionFlag     string
	FormatFlag      string
	Scenario        string
	PacketFormat    uint16
	GameYear        uint8
	NumActiveCars   int
	TotalSlots      int
	ActiveDrivers   []driverInfo
	SessionType     uint8
	SessionModeName string
	IsQualifying    bool
}

// loadSimulatorConfig parses CLI flags and environment variables.
func loadSimulatorConfig() SimulatorConfig {
	sessionFlag := flag.String("session", getEnv("F1T_SESSION_TYPE", "race"), "Session type to simulate: race, quali, q1, q2, q3, practice, timetrial")
	formatFlag := flag.String("format", getEnv("F1T_PACKET_FORMAT", "2026"), "F1 UDP packet format: 2025 (20 active cars + 2 observers) or 2026 (22 active cars + 2 observers, default)")
	scenarioFlag := flag.String("scenario", getEnv("F1T_SCENARIO", "default"), "Simulation scenario: default, wear / tyre-wear, sc / safetycar, vsc, rain, start, pit")
	flag.Parse()

	scenario := strings.ToLower(strings.TrimSpace(*scenarioFlag))
	targetAddr := getEnv("F1T_UDP_ADDR", defaultTargetUDP)

	packetFormat := uint16(packets.PacketFormat2026)
	gameYear := uint8(26)
	numActiveCars := 22
	totalSlots := packets.MaxCars2026
	activeDrivers := drivers2026

	if strings.TrimSpace(*formatFlag) == "2025" || strings.TrimSpace(*formatFlag) == "25" {
		packetFormat = packets.PacketFormat2025
		gameYear = 25
		numActiveCars = 20
		totalSlots = packets.MaxCars2025
		activeDrivers = drivers2025
	}

	var sessionType uint8
	var sessionModeName string
	isQualifying := false

	switch strings.ToLower(*sessionFlag) {
	case "q1":
		sessionType = packets.SessionQ1
		sessionModeName = "Qualifying 1 (Q1)"
		isQualifying = true
	case "q2":
		sessionType = packets.SessionQ2
		sessionModeName = "Qualifying 2 (Q2)"
		isQualifying = true
	case "q3", "quali", "qualifying":
		sessionType = packets.SessionQ3
		sessionModeName = "Qualifying 3 (Q3)"
		isQualifying = true
	case "practice", "p1":
		sessionType = packets.SessionP1
		sessionModeName = "Practice 1"
	case "timetrial", "tt":
		sessionType = packets.SessionTimeTrial
		sessionModeName = "Time Trial"
	default:
		sessionType = packets.SessionRace
		sessionModeName = "Race"
	}

	return SimulatorConfig{
		TargetAddr:      targetAddr,
		SessionFlag:     *sessionFlag,
		FormatFlag:      *formatFlag,
		Scenario:        scenario,
		PacketFormat:    packetFormat,
		GameYear:        gameYear,
		NumActiveCars:   numActiveCars,
		TotalSlots:      totalSlots,
		ActiveDrivers:   activeDrivers,
		SessionType:     sessionType,
		SessionModeName: sessionModeName,
		IsQualifying:    isQualifying,
	}
}

type simState struct {
	frameID         uint32
	sessionUID      uint64
	sessionTime     float32
	angle           float64
	lapTimeMs       uint32
	lapNum          uint8
	totalDistance   float32
	sessionTimeLeft uint16
}

func main() {
	cfg := loadSimulatorConfig()

	udpAddr, err := net.ResolveUDPAddr("udp", cfg.TargetAddr)
	if err != nil {
		slog.Error("Failed to resolve target address", "targetAddr", cfg.TargetAddr, "error", err)
		os.Exit(1)
	}

	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		slog.Error("Failed to dial UDP", "error", err)
		os.Exit(1)
	}
	defer conn.Close()

	fmt.Println("🏎️  F1 Telemetry Packet Simulator")
	fmt.Println("=================================")
	fmt.Printf("Simulating Session Mode: %s (Type ID: %d)\n", cfg.SessionModeName, cfg.SessionType)
	fmt.Printf("Telemetry Packet Format: F1 %d (%d Active Grid Cars + 2 Observers = %d Slots, Year %d)\n", cfg.PacketFormat, cfg.NumActiveCars, cfg.TotalSlots, cfg.GameYear)
	fmt.Printf("Active Scenario:         %s\n", cfg.Scenario)
	fmt.Printf("Sending synthetic UDP telemetry to %s at 20Hz...\n", cfg.TargetAddr)
	fmt.Println("👉 Tip: Press [Space] in browser Live Session to talk to your Race Engineer via Push-to-Talk!")
	fmt.Println("Press Ctrl+C to stop.")

	stopSignal := make(chan os.Signal, 1)
	signal.Notify(stopSignal, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(sendInterval)
	defer ticker.Stop()

	st := &simState{
		sessionUID: 987654321,
		lapNum:     1,
	}
	if cfg.IsQualifying {
		st.sessionTimeLeft = 720 // 12 minutes
	} else {
		st.sessionTimeLeft = 2400
	}

	for {
		select {
		case <-stopSignal:
			fmt.Println("\nStopping simulator...")
			return
		case <-ticker.C:
			st.frameID++
			st.sessionTime += 0.05
			st.lapTimeMs += 50
			if st.frameID%20 == 0 && st.sessionTimeLeft > 0 {
				st.sessionTimeLeft--
			}

			// Simulated motion & track trajectory (ellipse loop)
			st.angle += 0.02
			if st.angle >= 2*math.Pi {
				st.angle -= 2 * math.Pi
				st.lapNum++
				st.lapTimeMs = 0
			}

			posY := float32(5.0 * math.Sin(st.angle*0.5))
			speedKmh := uint16(120.0 + 180.0*(0.5+0.5*math.Sin(st.angle*2)))
			rpm := uint16(6000 + 7500*(0.5+0.5*math.Sin(st.angle*4)))
			gear := int8(1 + int(speedKmh)/40)
			if gear > 8 {
				gear = 8
			}

			throttle := float32(0.5 + 0.5*math.Sin(st.angle*2))
			brake := float32(0.0)
			if throttle < simBrakingThrottleThreshold {
				brake = simBrakingForce
			}

			lapDist := float32((st.angle / (2 * math.Pi)) * 5000.0)
			st.totalDistance += 5.0

			switch cfg.Scenario {
			case "start":
				switch {
				case st.sessionTime < 6.0:
					lapDist = float32(500.0 + st.sessionTime*200.0)
				case st.sessionTime < 10.0:
					lapDist = float32(4900.0 + (st.sessionTime-6.0)*20.0)
				default:
					lapDist = float32(150.0 + (st.sessionTime-10.0)*30.0)
				}
			case "pit":
				switch {
				case st.sessionTime >= 4.0 && st.sessionTime < 7.0:
					speedKmh = 78
					rpm = 7800
					gear = 2
					throttle = 0.4
					brake = 0.0
				case st.sessionTime >= 7.0 && st.sessionTime < 11.0:
					speedKmh = 0
					rpm = 4500
					gear = 0
					throttle = 0.0
					brake = 1.0
				case st.sessionTime >= 11.0 && st.sessionTime < 14.0:
					speedKmh = 75
					rpm = 7500
					gear = 2
					throttle = 0.35
					brake = 0.0
				}
			}

			// Common Header
			header := packets.PacketHeader{
				PacketFormat:            cfg.PacketFormat,
				GameYear:                cfg.GameYear,
				GameMajorVersion:        1,
				GameMinorVersion:        0,
				PacketVersion:           1,
				SessionUID:              st.sessionUID,
				SessionTime:             st.sessionTime,
				FrameIdentifier:         st.frameID,
				OverallFrameIdentifier:  st.frameID,
				PlayerCarIndex:          0,
				SecondaryPlayerCarIndex: 255,
			}

			// 1a. Session Data Packet (ID: 1)
			sessionPkt := buildSessionPacket(cfg, st, header)
			sendSessionPacket(conn, &sessionPkt, cfg.PacketFormat)

			// 1b. Periodic Event Packet (ID: 3)
			if st.frameID%120 == 40 {
				evtPkt := buildEventPacket(header, st.frameID, st.lapNum)
				sendEventPacket(conn, &evtPkt)
			}

			// 1c. Participants Data Packet (ID: 4)
			if st.frameID == 1 || st.frameID%100 == 0 {
				sendParticipantsPacket(conn, header, cfg.NumActiveCars, cfg.TotalSlots, cfg.ActiveDrivers, cfg.PacketFormat)
			}

			// 2. Motion Packet (ID: 0)
			motionCars := buildMotionCars(cfg, st.angle, posY)
			sendMotionPacket(conn, header, cfg.TotalSlots, motionCars, cfg.PacketFormat)

			// 3. Car Telemetry Packet (ID: 6)
			telemetryCars := buildTelemetryCars(cfg, st.angle, speedKmh, rpm, gear, throttle, brake)
			sendTelemetryPacket(conn, header, cfg.TotalSlots, telemetryCars, cfg.PacketFormat)

			// 3b. Car Telemetry 2 Packet (ID: 16) - 2026 Only
			if cfg.PacketFormat >= packets.PacketFormat2026 {
				telemetry2Cars := buildTelemetry2Cars(cfg, speedKmh, st.frameID)
				sendCarTelemetry2Packet(conn, header, cfg.TotalSlots, telemetry2Cars)
			}

			// 4. Lap Data Packet (ID: 2)
			lapCars := buildLapCars(cfg, st, lapDist)
			sendLapDataPacket(conn, header, cfg.TotalSlots, lapCars)

			// 5. Car Status Packet (ID: 7)
			if st.frameID == 1 || st.frameID%5 == 0 {
				statusCars := buildCarStatusCars(cfg, st)
				sendCarStatusPacket(conn, header, cfg.TotalSlots, statusCars, cfg.PacketFormat)
			}

			// 6. Car Damage Packet (ID: 10)
			if st.frameID == 1 || st.frameID%20 == 0 {
				damageCars := buildCarDamageCars(cfg, st)
				sendCarDamagePacket(conn, header, cfg.TotalSlots, damageCars)
			}

			// 7. Session History Packet (ID: 11) - sent every 100 frames (~5s) for active cars
			if st.frameID%100 == 0 {
				for carIdx := 0; carIdx < cfg.NumActiveCars && carIdx < 5; carIdx++ {
					histPkt := buildSessionHistoryPacket(header, carIdx, st.lapNum)
					sendSessionHistoryPacket(conn, histPkt)
				}
			}

			// 8. Tyre Sets Packet (ID: 12) - sent every 100 frames (~5s) for player car
			if st.frameID%100 == 0 {
				tyreSetsPkt := buildTyreSetsPacket(header)
				sendTyreSetsPacket(conn, tyreSetsPkt)
			}
		}
	}
}

func buildSessionPacket(cfg SimulatorConfig, st *simState, header packets.PacketHeader) packets.PacketSessionData {
	var totalLaps uint8 = 58
	if cfg.IsQualifying {
		totalLaps = 0
	}

	scMode := uint8(0)
	var startReactionTime float32 = 0.0
	switch {
	case cfg.Scenario == "start":
		if st.sessionTime < 10.0 {
			scMode = packets.SafetyCarFormationLap
			if st.sessionTime >= 0.0 && st.sessionTime < 0.1 {
				slog.Info("Formation lap started", "scenario", "start")
			}
			if st.sessionTime >= 6.0 && st.sessionTime < 6.1 {
				slog.Info("Approaching grid box on formation lap", "scenario", "start")
			}
		} else {
			scMode = packets.SafetyCarNone
			startReactionTime = 0.21
			if st.sessionTime >= 10.0 && st.sessionTime < 10.1 {
				slog.Info("Lights out! Race start launch debrief", "scenario", "start", "reactionTime", startReactionTime)
			}
		}
	case (cfg.Scenario == "sc" || cfg.Scenario == "safetycar") && st.sessionTime >= 4.0 && st.sessionTime < 60.0:
		if st.sessionTime >= 4.0 && st.sessionTime < 4.1 {
			slog.Info("Full Safety Car deployed", "scenario", "sc")
		}
		scMode = packets.SafetyCarFull
	case cfg.Scenario == "vsc" && st.sessionTime >= 4.0 && st.sessionTime < 60.0:
		if st.sessionTime >= 4.0 && st.sessionTime < 4.1 {
			slog.Info("Virtual Safety Car deployed", "scenario", "vsc")
		}
		scMode = packets.SafetyCarVirtual
	}

	sessionPkt := packets.PacketSessionData{
		Header:                    header,
		TrackId:                   0, // Melbourne
		SessionType:               cfg.SessionType,
		TotalLaps:                 totalLaps,
		TrackLength:               5278,
		SessionTimeLeft:           st.sessionTimeLeft,
		SessionDuration:           3600,
		TrackTemperature:          32,
		AirTemperature:            24,
		Weather:                   0, // Clear
		SafetyCarStatus:           scMode,
		StartReactionTime:         startReactionTime,
		PitStopWindowIdealLap:     16,
		PitStopWindowLatestLap:    22,
		PitStopRejoinPosition:     7,
		NumWeatherForecastSamples: 4,
		Sector2LapDistanceStart:   1750.0,
		Sector3LapDistanceStart:   3500.0,
	}

	rainPctSample1 := uint8(5)
	timeOffsetSample1 := uint8(5)
	if cfg.Scenario == "rain" {
		if st.sessionTime >= 2.0 && st.sessionTime < 2.1 {
			slog.Info("Rain forecast injected", "scenario", "rain", "probability", "85%", "timeToRain", "2m")
		}
		rainPctSample1 = 85
		timeOffsetSample1 = 2
	}

	sessionPkt.WeatherForecastSamples[0] = packets.WeatherForecastSample{
		SessionType:      cfg.SessionType,
		TimeOffset:       0,
		Weather:          0,
		TrackTemperature: 32,
		AirTemperature:   24,
		RainPercentage:   0,
	}
	sessionPkt.WeatherForecastSamples[1] = packets.WeatherForecastSample{
		SessionType:            cfg.SessionType,
		TimeOffset:             timeOffsetSample1,
		Weather:                1,
		TrackTemperature:       31,
		TrackTemperatureChange: -1,
		AirTemperature:         24,
		RainPercentage:         rainPctSample1,
	}
	sessionPkt.WeatherForecastSamples[2] = packets.WeatherForecastSample{
		SessionType:            cfg.SessionType,
		TimeOffset:             15,
		Weather:                2,
		TrackTemperature:       30,
		TrackTemperatureChange: -1,
		AirTemperature:         23,
		AirTemperatureChange:   -1,
		RainPercentage:         20,
	}
	sessionPkt.WeatherForecastSamples[3] = packets.WeatherForecastSample{
		SessionType:            cfg.SessionType,
		TimeOffset:             30,
		Weather:                3,
		TrackTemperature:       28,
		TrackTemperatureChange: -2,
		AirTemperature:         22,
		AirTemperatureChange:   -1,
		RainPercentage:         65,
	}

	if cfg.PacketFormat >= packets.PacketFormat2026 {
		sessionPkt.ActiveAeroTrackStatus = 0 // Full
		sessionPkt.NumActiveAeroZonesFull = 2
		sessionPkt.ActiveAeroZonesFull[0] = packets.ActiveAeroZone{ZoneStart: 0.1, ZoneEnd: 0.25}
		sessionPkt.ActiveAeroZonesFull[1] = packets.ActiveAeroZone{ZoneStart: 0.6, ZoneEnd: 0.8}
		sessionPkt.NumDRSZones = 2
		sessionPkt.DRSZones[0] = packets.DRSZone{ZoneStart: 0.1, ZoneEnd: 0.25}
		sessionPkt.DRSZones[1] = packets.DRSZone{ZoneStart: 0.6, ZoneEnd: 0.8}
	}

	sessionPkt.Header.PacketId = packets.PacketIDSession
	return sessionPkt
}

func buildEventPacket(header packets.PacketHeader, frameID uint32, lapNum uint8) packets.PacketEventData {
	var evtPkt packets.PacketEventData
	evtPkt.Header = header
	evtPkt.Header.PacketId = packets.PacketIDEvent

	switch (frameID / 120) % 5 {
	case 0:
		copy(evtPkt.EventStringCode[:], packets.EventFastestLap)
		var d packets.FastestLapEventData
		d.VehicleIdx = 0
		d.LapTime = 84.821
		var b bytes.Buffer
		_ = binary.Write(&b, binary.LittleEndian, d)
		copy(evtPkt.EventDetails.Data[:], b.Bytes())
	case 1:
		copy(evtPkt.EventStringCode[:], packets.EventOvertake)
		var d packets.OvertakeEventData
		d.OvertakingVehicleIdx = 4
		d.BeingOvertakenVehicleIdx = 2
		var b bytes.Buffer
		_ = binary.Write(&b, binary.LittleEndian, d)
		copy(evtPkt.EventDetails.Data[:], b.Bytes())
	case 2:
		copy(evtPkt.EventStringCode[:], packets.EventPenaltyIssued)
		var d packets.PenaltyEventData
		d.PenaltyType = 0
		d.InfringementType = 0
		d.VehicleIdx = 2
		d.Time = 5
		d.LapNum = lapNum
		var b bytes.Buffer
		_ = binary.Write(&b, binary.LittleEndian, d)
		copy(evtPkt.EventDetails.Data[:], b.Bytes())
	case 3:
		copy(evtPkt.EventStringCode[:], packets.EventSpeedTrapTriggered)
		var d packets.SpeedTrapEventData
		d.VehicleIdx = 0
		d.Speed = 334.8
		d.IsOverallFastestInSession = 1
		var b bytes.Buffer
		_ = binary.Write(&b, binary.LittleEndian, d)
		copy(evtPkt.EventDetails.Data[:], b.Bytes())
	case 4:
		copy(evtPkt.EventStringCode[:], packets.EventTeamMateInPits)
		var d packets.TeamMateInPitsEventData
		d.VehicleIdx = 1
		var b bytes.Buffer
		_ = binary.Write(&b, binary.LittleEndian, d)
		copy(evtPkt.EventDetails.Data[:], b.Bytes())
	}
	return evtPkt
}

func buildMotionCars(cfg SimulatorConfig, angle float64, posY float32) []packets.CarMotionData {
	motionCars := make([]packets.CarMotionData, cfg.TotalSlots)
	for i := 0; i < cfg.TotalSlots; i++ {
		if i < cfg.NumActiveCars {
			off := -float64(i) * 0.08
			a := angle + off
			motionCars[i] = packets.CarMotionData{
				WorldPositionX:     float32(300.0 * math.Sin(a)),
				WorldPositionY:     posY,
				WorldPositionZ:     float32(150.0 * math.Cos(2*a)),
				WorldVelocityX:     float32(math.Cos(a) * 30),
				WorldVelocityZ:     float32(-math.Sin(a) * 30),
				GForceLateral:      float32(1.8 * math.Sin(a)),
				GForceLongitudinal: float32(0.5 * math.Cos(a)),
				GForceVertical:     0.1,
			}
		}
	}
	return motionCars
}

func buildTelemetryCars(cfg SimulatorConfig, angle float64, speedKmh, rpm uint16, gear int8, throttle, brake float32) []packets.CarTelemetryData {
	telemetryCars := make([]packets.CarTelemetryData, cfg.TotalSlots)
	for i := 0; i < cfg.TotalSlots; i++ {
		if i < cfg.NumActiveCars {
			factor := 1.0 - float64(i)*0.02
			if factor < 0.5 {
				factor = 0.5
			}
			a := angle - float64(i)*0.08
			telemetryCars[i] = packets.CarTelemetryData{
				Speed:             uint16(float64(speedKmh) * factor),
				Throttle:          float32(float64(throttle) * factor),
				Steer:             float32(math.Sin(a)),
				Brake:             float32(float64(brake) * (1.0 + float64(i)*0.02)),
				Gear:              gear,
				EngineRPM:         uint16(float64(rpm) * factor),
				DRS:               uint8(i % 2),
				EngineTemperature: uint16(90 + i),
				TyresPressure:     [4]float32{22.5, 22.5, 23.5, 23.5},
			}
		}
	}
	return telemetryCars
}

func buildTelemetry2Cars(cfg SimulatorConfig, speedKmh uint16, frameID uint32) []packets.CarTelemetry2Data {
	telemetry2Cars := make([]packets.CarTelemetry2Data, cfg.TotalSlots)
	for i := 0; i < cfg.TotalSlots; i++ {
		if i < cfg.NumActiveCars {
			var aeroMode uint8 = 0
			if speedKmh > 220 {
				aeroMode = 1 // Straight mode
			}
			telemetry2Cars[i] = packets.CarTelemetry2Data{
				ActiveAeroMode:      aeroMode,
				ActiveAeroAvailable: 1,
				OvertakeAvailable:   1,
				OvertakeActive:      uint8((i + int(frameID/40)) % 2),
				Regulations2026:     1,
			}
		}
	}
	return telemetry2Cars
}

func buildLapCars(cfg SimulatorConfig, st *simState, lapDist float32) []packets.LapData {
	lapCars := make([]packets.LapData, cfg.TotalSlots)
	for i := 0; i < cfg.TotalSlots; i++ {
		if i < cfg.NumActiveCars {
			gapMs := uint32(i * 350)
			pitStatus := uint8(0)
			if i >= cfg.NumActiveCars-4 {
				pitStatus = 1
			}
			var penalties uint8 = 0
			var totalWarnings uint8 = 0
			var driveThrough uint8 = 0
			var pitStopShouldServePen uint8 = 0
			var pitStopTimerInMS uint16 = 0

			switch i {
			case 2:
				penalties = 5
			case 5:
				penalties = 3
			case 7:
				totalWarnings = 2
			case 11:
				driveThrough = 1
			}

			driverStatus := packets.DriverStatusOnTrack
			if cfg.IsQualifying {
				driverStatus = packets.DriverStatusFlyingLap
			}
			if pitStatus == 1 {
				driverStatus = packets.DriverStatusInLap
			}

			if i == 0 && cfg.Scenario == "pit" {
				switch {
				case st.sessionTime >= 4.0 && st.sessionTime < 7.0:
					pitStatus = packets.PitStatusPitting
					driverStatus = packets.DriverStatusInLap
					penalties = 5
					pitStopShouldServePen = 1
					if st.sessionTime >= 4.0 && st.sessionTime < 4.1 {
						slog.Info("Pit entry: limiter engaged, penalty to serve", "scenario", "pit", "penalties", 5)
					}
				case st.sessionTime >= 7.0 && st.sessionTime < 11.0:
					pitStatus = packets.PitStatusInPitArea
					driverStatus = packets.DriverStatusInLap
					pitStopTimerInMS = 2400
					if st.sessionTime >= 7.0 && st.sessionTime < 7.1 {
						slog.Info("Stationary in pit box", "scenario", "pit", "stopTimerMs", 2400)
					}
				case st.sessionTime >= 11.0 && st.sessionTime < 14.0:
					pitStatus = packets.PitStatusPitting
					driverStatus = packets.DriverStatusInLap
					pitStopTimerInMS = 2400
					if st.sessionTime >= 11.0 && st.sessionTime < 11.1 {
						slog.Info("Leaving pit box, rolling down pit lane", "scenario", "pit")
					}
				case st.sessionTime >= 14.0 && st.sessionTime < 16.0:
					pitStatus = packets.PitStatusNone
					driverStatus = packets.DriverStatusOutLap
					if st.sessionTime >= 14.0 && st.sessionTime < 14.1 {
						slog.Info("Pit exit: limiter disengaged, rejoined track", "scenario", "pit")
					}
				}
			}

			gridPos := uint8((i+3)%cfg.NumActiveCars + 1)
			speedTrap := float32(322.5 - float64(i)*1.1)

			numStops := uint8(0)
			if st.lapNum > 1 {
				numStops = uint8(i / 8)
			}

			lapCars[i] = packets.LapData{
				DriverStatus:                driverStatus,
				CurrentLapTimeInMS:          st.lapTimeMs + gapMs,
				LastLapTimeInMS:             uint32(85432 + i*220),
				Sector1TimeMSPart:           uint16(28120 + i*100),
				Sector2TimeMSPart:           uint16(31450 + i*90),
				CurrentLapNum:               st.lapNum,
				LapDistance:                 lapDist,
				TotalDistance:               st.totalDistance - float32(i*15),
				CarPosition:                 uint8(i + 1),
				GridPosition:                gridPos,
				ResultStatus:                packets.ResultStatusActive,
				DeltaToRaceLeaderMSPart:     uint16(gapMs),
				DeltaToCarInFrontMSPart:     uint16(350),
				PitStatus:                   pitStatus,
				PitStopShouldServePen:       pitStopShouldServePen,
				PitStopTimerInMS:            pitStopTimerInMS,
				NumPitStops:                 numStops,
				PitLaneTimeInLaneInMS:       uint16(21500 + i*400),
				SpeedTrapFastestSpeed:       speedTrap,
				SpeedTrapFastestLap:         uint8(1 + (i % 3)),
				Penalties:                   penalties,
				TotalWarnings:               totalWarnings,
				NumUnservedDriveThroughPens: driveThrough,
			}
		} else {
			// Observers / Spectators
			lapCars[i] = packets.LapData{
				DriverStatus: packets.DriverStatusInGarage,
				ResultStatus: packets.ResultStatusInactive,
			}
		}
	}
	return lapCars
}

func buildCarStatusCars(cfg SimulatorConfig, st *simState) []packets.CarStatusData {
	statusCars := make([]packets.CarStatusData, cfg.TotalSlots)
	compounds := []uint8{16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18}
	for i := 0; i < cfg.TotalSlots; i++ {
		if i < cfg.NumActiveCars {
			pitLimiter := uint8(0)
			if i == 0 && cfg.Scenario == "pit" && st.sessionTime >= 4.0 && st.sessionTime < 14.0 {
				pitLimiter = 1
			}
			statusCars[i] = packets.CarStatusData{
				FuelInTank:            float32(48.0 - float64(i)*0.8),
				FuelCapacity:          110.0,
				VisualTyreCompound:    compounds[i%len(compounds)],
				TyresAgeLaps:          uint8(3 + i*2),
				ERSStoreEnergy:        float32(4000000.0 * (1.0 - float64(i)*0.03)),
				ERSDeployMode:         uint8(i % 4),
				ERSHarvestLimitPerLap: 2000000.0,
				PitLimiterStatus:      pitLimiter,
			}
		}
	}
	return statusCars
}

func buildCarDamageCars(cfg SimulatorConfig, st *simState) []packets.CarDamageData {
	damageCars := make([]packets.CarDamageData, cfg.TotalSlots)
	for i := 0; i < cfg.TotalSlots; i++ {
		if i >= cfg.NumActiveCars {
			continue
		}
		baseWear := float32(15.0 + float64(st.lapNum)*2.5 + float64(i)*1.8)
		if i == 0 && (cfg.Scenario == "wear" || cfg.Scenario == "tyre-wear") {
			baseWear = float32(38.5 + float64(st.sessionTime)*0.5)
		}
		if baseWear > 95.0 {
			baseWear = 95.0
		}
		flWear := baseWear + float32((i+1)%3)*1.5
		frWear := baseWear + float32((i+1)%2)*2.5
		rlWear := baseWear * 0.95
		rrWear := baseWear * 0.92

		if i == 0 && (cfg.Scenario == "wear" || cfg.Scenario == "tyre-wear") && st.frameID%100 == 0 {
			slog.Info("Player tyre wear update", "scenario", cfg.Scenario, "flWear", flWear, "frWear", frWear, "sessionTime", st.sessionTime)
		}

		var drsFault, ersFault, blown, seized uint8
		if i == 5 {
			drsFault = 1
		}
		if i == 8 {
			ersFault = 1
		}
		if i == 19 {
			blown = 1
		}

		damageCars[i] = packets.CarDamageData{
			TyresWear:            [4]float32{rlWear, rrWear, flWear, frWear},
			TyresDamage:          [4]uint8{uint8(i % 3), uint8(i % 2), uint8((i * 3) % 15), uint8((i * 2) % 20)},
			BrakesDamage:         [4]uint8{uint8((i * 4) % 30), uint8((i * 4) % 30), uint8((i * 5) % 40), uint8((i * 5) % 40)},
			TyreBlisters:         [4]uint8{0, 0, uint8(i % 5), uint8(i % 5)},
			FrontLeftWingDamage:  uint8((i * 9) % 55),
			FrontRightWingDamage: uint8((i * 13) % 40),
			RearWingDamage:       uint8((i * 5) % 30),
			FloorDamage:          uint8((i * 7) % 35),
			DiffuserDamage:       uint8((i * 4) % 25),
			SidepodDamage:        uint8((i * 6) % 30),
			DRSFault:             drsFault,
			ERSFault:             ersFault,
			GearBoxDamage:        uint8((i * 3) % 25),
			EngineDamage:         uint8((i * 2) % 20),
			EngineMGUHWear:       uint8(10 + i*3),
			EngineESWear:         uint8(8 + i*2),
			EngineCEWear:         uint8(5 + i*2),
			EngineICEWear:        uint8(12 + i*3),
			EngineMGUKWear:       uint8(14 + i*3),
			EngineTCWear:         uint8(11 + i*3),
			EngineBlown:          blown,
			EngineSeized:         seized,
		}
	}
	return damageCars
}

func buildSessionHistoryPacket(header packets.PacketHeader, carIdx int, lapNum uint8) *packets.PacketSessionHistoryData {
	compounds := []uint8{16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18}
	histHeader := header
	histHeader.PacketId = packets.PacketIDSessionHistory
	histPkt := &packets.PacketSessionHistoryData{
		Header:        histHeader,
		CarIdx:        uint8(carIdx),
		NumLaps:       lapNum,
		NumTyreStints: 1,
	}
	histPkt.TyreStintHistoryData[0] = packets.TyreStintHistoryData{
		EndLap:             255,
		TyreVisualCompound: compounds[carIdx%len(compounds)],
	}
	if lapNum > 1 {
		for l := uint8(1); l < lapNum; l++ {
			histPkt.LapHistoryData[l-1] = packets.LapHistoryData{
				LapTimeInMS:       uint32(85432 + carIdx*220),
				Sector1TimeMSPart: uint16(28120 + carIdx*100),
				Sector2TimeMSPart: uint16(31450 + carIdx*90),
				Sector3TimeMSPart: uint16(25862 + carIdx*30),
				LapValidBitFlags:  1,
			}
		}
	}
	return histPkt
}

func sendSessionPacket(conn *net.UDPConn, pkt *packets.PacketSessionData, format uint16) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Header)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Weather)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TrackTemperature)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.AirTemperature)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TotalLaps)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TrackLength)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SessionType)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TrackId)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Formula)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SessionTimeLeft)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SessionDuration)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitSpeedLimit)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.GamePaused)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.IsSpectating)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SpectatorCarIndex)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SliProNativeSupport)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumMarshalZones)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.MarshalZones)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SafetyCarStatus)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NetworkGame)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumWeatherForecastSamples)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.WeatherForecastSamples)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.ForecastAccuracy)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.AIDifficulty)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SeasonLinkIdentifier)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.WeekendLinkIdentifier)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SessionLinkIdentifier)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitStopWindowIdealLap)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitStopWindowLatestLap)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitStopRejoinPosition)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SteeringAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.BrakingAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.GearboxAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitReleaseAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.ERSAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.DRSAssist)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.DynamicRacingLine)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.DynamicRacingLineType)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.GameMode)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.RuleSet)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TimeOfDay)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SessionLength)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SpeedUnitsLeadPlayer)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TemperatureUnitsLeadPlayer)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SpeedUnitsSecondaryPlayer)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TemperatureUnitsSecondaryPlayer)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumSafetyCarPeriods)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumVirtualSafetyCarPeriods)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumRedFlagPeriods)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.EqualCarPerformance)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.RecoveryMode)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.FlashbackLimit)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SurfaceType)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.LowFuelMode)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.RaceStarts)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.TyreTemperature)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitLaneTyreSim)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.CarDamage)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.CarDamageRate)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Collisions)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.CollisionsOffForFirstLapOnly)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.MPUnsafePitRelease)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.MPOffForGriefing)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.CornerCuttingStringency)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.ParcFermeRules)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.PitStopExperience)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SafetyCar)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.SafetyCarExperience)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.FormationLap)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.FormationLapExperience)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.RedFlags)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.AffectsLicenceLevelSolo)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.AffectsLicenceLevelMP)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.NumSessionsInWeekend)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.WeekendStructure)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Sector2LapDistanceStart)
	_ = binary.Write(&buf, binary.LittleEndian, pkt.Sector3LapDistanceStart)

	if format >= packets.PacketFormat2026 {
		_ = binary.Write(&buf, binary.LittleEndian, pkt.ActiveAeroTrackStatus)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.NumActiveAeroZonesFull)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.ActiveAeroZonesFull)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.NumActiveAeroZonesPartial)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.ActiveAeroZonesPartial)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.NumDRSZones)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.DRSZones)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.StartReactionTime)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.AntiLockBrakesAssist)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.TractionControlAssist)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.DynamicRacingLineHiVis)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.DynamicRacingLineColourBlind)
		_ = binary.Write(&buf, binary.LittleEndian, pkt.RecurringRewindPrompt)
	}

	_, _ = conn.Write(buf.Bytes())
}

func sendEventPacket(conn *net.UDPConn, pkt *packets.PacketEventData) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, pkt)
	_, _ = conn.Write(buf.Bytes())
}

func sendParticipantsPacket(conn *net.UDPConn, header packets.PacketHeader, numActiveCars, totalSlots int, drivers []driverInfo, format uint16) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDParticipants
	_ = binary.Write(&buf, binary.LittleEndian, header)
	_ = binary.Write(&buf, binary.LittleEndian, uint8(numActiveCars))

	nameLen := packets.ParticipantNameLen

	for i := 0; i < totalSlots; i++ {
		d := drivers[i]
		if format >= packets.PacketFormat2026 {
			_ = binary.Write(&buf, binary.LittleEndian, d.aiControlled)
			_ = binary.Write(&buf, binary.LittleEndian, d.driverID)
			_ = binary.Write(&buf, binary.LittleEndian, uint16(0))
			_ = binary.Write(&buf, binary.LittleEndian, d.teamID)
			_ = binary.Write(&buf, binary.LittleEndian, uint8(0)) // MyTeam
			_ = binary.Write(&buf, binary.LittleEndian, d.raceNumber)
			_ = binary.Write(&buf, binary.LittleEndian, d.nationality)

			nameBytes := make([]byte, nameLen)
			copy(nameBytes, d.name)
			buf.Write(nameBytes)

			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // YourTelemetry
			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // ShowOnlineNames
			_ = binary.Write(&buf, binary.LittleEndian, uint16(1000)) // TechLevel
			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // Platform
			_ = binary.Write(&buf, binary.LittleEndian, uint8(4))     // NumColours
			_ = binary.Write(&buf, binary.LittleEndian, [4]packets.LiveryColour{
				{Red: 255, Green: 0, Blue: 0},
				{Red: 0, Green: 255, Blue: 0},
				{Red: 0, Green: 0, Blue: 255},
				{Red: 255, Green: 255, Blue: 255},
			})
		} else {
			_ = binary.Write(&buf, binary.LittleEndian, d.aiControlled)
			_ = binary.Write(&buf, binary.LittleEndian, uint8(d.driverID))
			_ = binary.Write(&buf, binary.LittleEndian, uint8(0))
			_ = binary.Write(&buf, binary.LittleEndian, uint8(d.teamID))
			_ = binary.Write(&buf, binary.LittleEndian, uint8(0)) // MyTeam
			_ = binary.Write(&buf, binary.LittleEndian, d.raceNumber)
			_ = binary.Write(&buf, binary.LittleEndian, d.nationality)

			nameBytes := make([]byte, nameLen)
			copy(nameBytes, d.name)
			buf.Write(nameBytes)

			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // YourTelemetry
			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // ShowOnlineNames
			_ = binary.Write(&buf, binary.LittleEndian, uint16(1000)) // TechLevel
			_ = binary.Write(&buf, binary.LittleEndian, uint8(1))     // Platform
			_ = binary.Write(&buf, binary.LittleEndian, uint8(4))     // NumColours
			_ = binary.Write(&buf, binary.LittleEndian, [4]packets.LiveryColour{
				{Red: 255, Green: 0, Blue: 0},
				{Red: 0, Green: 255, Blue: 0},
				{Red: 0, Green: 0, Blue: 255},
				{Red: 255, Green: 255, Blue: 255},
			})
		}
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendMotionPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, cars []packets.CarMotionData, format uint16) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDMotion
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		c := cars[i]
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldPositionX)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldPositionY)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldPositionZ)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldVelocityX)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldVelocityY)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldVelocityZ)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldForwardDirX)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldForwardDirY)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldForwardDirZ)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldRightDirX)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldRightDirY)
		_ = binary.Write(&buf, binary.LittleEndian, c.WorldRightDirZ)

		if format >= packets.PacketFormat2026 {
			_ = binary.Write(&buf, binary.LittleEndian, int16(c.GForceLateral*1000.0))
			_ = binary.Write(&buf, binary.LittleEndian, int16(c.GForceLongitudinal*1000.0))
			_ = binary.Write(&buf, binary.LittleEndian, int16(c.GForceVertical*1000.0))
		} else {
			_ = binary.Write(&buf, binary.LittleEndian, c.GForceLateral)
			_ = binary.Write(&buf, binary.LittleEndian, c.GForceLongitudinal)
			_ = binary.Write(&buf, binary.LittleEndian, c.GForceVertical)
		}

		_ = binary.Write(&buf, binary.LittleEndian, c.Yaw)
		_ = binary.Write(&buf, binary.LittleEndian, c.Pitch)
		_ = binary.Write(&buf, binary.LittleEndian, c.Roll)
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendTelemetryPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, cars []packets.CarTelemetryData, format uint16) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarTelemetry
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		c := cars[i]
		_ = binary.Write(&buf, binary.LittleEndian, c.Speed)
		_ = binary.Write(&buf, binary.LittleEndian, c.Throttle)
		_ = binary.Write(&buf, binary.LittleEndian, c.Steer)
		_ = binary.Write(&buf, binary.LittleEndian, c.Brake)
		_ = binary.Write(&buf, binary.LittleEndian, c.Clutch)
		_ = binary.Write(&buf, binary.LittleEndian, c.Gear)
		_ = binary.Write(&buf, binary.LittleEndian, c.EngineRPM)
		_ = binary.Write(&buf, binary.LittleEndian, c.DRS)
		_ = binary.Write(&buf, binary.LittleEndian, c.RevLightsPercent)
		_ = binary.Write(&buf, binary.LittleEndian, c.RevLightsBitValue)
		_ = binary.Write(&buf, binary.LittleEndian, c.BrakesTemperature)
		_ = binary.Write(&buf, binary.LittleEndian, c.TyresSurfaceTemperature)
		_ = binary.Write(&buf, binary.LittleEndian, c.TyresInnerTemperature)

		if format >= packets.PacketFormat2026 {
			_ = binary.Write(&buf, binary.LittleEndian, uint8(c.EngineTemperature))
		} else {
			_ = binary.Write(&buf, binary.LittleEndian, c.EngineTemperature)
		}

		_ = binary.Write(&buf, binary.LittleEndian, c.TyresPressure)
		_ = binary.Write(&buf, binary.LittleEndian, c.SurfaceType)
	}
	// Trailer: MFDPanelIndex, MFDPanelIndexSecondaryPlayer, SuggestedGear
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_ = binary.Write(&buf, binary.LittleEndian, int8(0))
	_, _ = conn.Write(buf.Bytes())
}

func sendCarTelemetry2Packet(conn *net.UDPConn, header packets.PacketHeader, numCars int, cars []packets.CarTelemetry2Data) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarTelemetry2
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, cars[i])
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendLapDataPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, laps []packets.LapData) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDLapData
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, laps[i])
	}
	// Trailer: TimeTrialPBCarIdx, TimeTrialRivalCarIdx
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_, _ = conn.Write(buf.Bytes())
}

func sendCarStatusPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, status []packets.CarStatusData, format uint16) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarStatus
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		s := status[i]
		_ = binary.Write(&buf, binary.LittleEndian, s.TractionControl)
		_ = binary.Write(&buf, binary.LittleEndian, s.AntiLockBrakes)
		_ = binary.Write(&buf, binary.LittleEndian, s.FuelMix)
		_ = binary.Write(&buf, binary.LittleEndian, s.FrontBrakeBias)
		_ = binary.Write(&buf, binary.LittleEndian, s.PitLimiterStatus)
		_ = binary.Write(&buf, binary.LittleEndian, s.FuelInTank)
		_ = binary.Write(&buf, binary.LittleEndian, s.FuelCapacity)
		_ = binary.Write(&buf, binary.LittleEndian, s.FuelRemainingLaps)
		_ = binary.Write(&buf, binary.LittleEndian, s.MaxRPM)
		_ = binary.Write(&buf, binary.LittleEndian, s.IdleRPM)
		_ = binary.Write(&buf, binary.LittleEndian, s.MaxGears)
		_ = binary.Write(&buf, binary.LittleEndian, s.DRSAllowed)
		_ = binary.Write(&buf, binary.LittleEndian, s.DRSActivationDistance)
		_ = binary.Write(&buf, binary.LittleEndian, s.ActualTyreCompound)
		_ = binary.Write(&buf, binary.LittleEndian, s.VisualTyreCompound)
		_ = binary.Write(&buf, binary.LittleEndian, s.TyresAgeLaps)
		_ = binary.Write(&buf, binary.LittleEndian, s.VehicleFIAFlags)
		_ = binary.Write(&buf, binary.LittleEndian, s.EnginePowerICE)
		_ = binary.Write(&buf, binary.LittleEndian, s.EnginePowerMGUK)
		_ = binary.Write(&buf, binary.LittleEndian, s.ERSStoreEnergy)
		_ = binary.Write(&buf, binary.LittleEndian, s.ERSDeployMode)
		_ = binary.Write(&buf, binary.LittleEndian, s.ERSHarvestedThisLapMGUK)
		_ = binary.Write(&buf, binary.LittleEndian, s.ERSHarvestedThisLapMGUH)

		if format >= packets.PacketFormat2026 {
			_ = binary.Write(&buf, binary.LittleEndian, s.ERSHarvestLimitPerLap)
		}

		_ = binary.Write(&buf, binary.LittleEndian, s.ERSDeployedThisLap)
		_ = binary.Write(&buf, binary.LittleEndian, s.NetworkPaused)
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendCarDamagePacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, damage []packets.CarDamageData) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarDamage
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, damage[i])
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendSessionHistoryPacket(conn *net.UDPConn, pkt *packets.PacketSessionHistoryData) {
	var buf bytes.Buffer
	pkt.Header.PacketId = packets.PacketIDSessionHistory
	_ = binary.Write(&buf, binary.LittleEndian, pkt)
	_, _ = conn.Write(buf.Bytes())
}

func buildTyreSetsPacket(header packets.PacketHeader) *packets.PacketTyreSetsData {
	pkt := &packets.PacketTyreSetsData{
		Header:    header,
		CarIdx:    0,
		FittedIdx: 0,
	}
	pkt.Header.PacketId = packets.PacketIDTyreSets

	// Set 0: Fitted Medium
	pkt.TyreSetData[0] = packets.TyreSetData{
		ActualTyreCompound: packets.CompoundMedium,
		VisualTyreCompound: packets.CompoundMedium,
		Wear:               20,
		Available:          1,
		Fitted:             1,
	}
	// Set 1: Fresh Hard (Available, 0 wear)
	pkt.TyreSetData[1] = packets.TyreSetData{
		ActualTyreCompound: packets.CompoundHard,
		VisualTyreCompound: packets.CompoundHard,
		Wear:               0,
		Available:          1,
		Fitted:             0,
	}
	// Set 2: Fresh Soft (Available, 0 wear)
	pkt.TyreSetData[2] = packets.TyreSetData{
		ActualTyreCompound: packets.CompoundSoft,
		VisualTyreCompound: packets.CompoundSoft,
		Wear:               0,
		Available:          1,
		Fitted:             0,
	}
	return pkt
}

func sendTyreSetsPacket(conn *net.UDPConn, pkt *packets.PacketTyreSetsData) {
	var buf bytes.Buffer
	pkt.Header.PacketId = packets.PacketIDTyreSets
	_ = binary.Write(&buf, binary.LittleEndian, pkt)
	_, _ = conn.Write(buf.Bytes())
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
