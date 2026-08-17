package main

import (
	"bytes"
	"encoding/binary"
	"flag"
	"fmt"
	"log"
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
	defaultTargetUDP = "127.0.0.1:20777"
	sendInterval     = 50 * time.Millisecond // 20Hz
)

type driverInfo struct {
	name         string
	driverID     uint8
	teamID       uint8
	raceNumber   uint8
	aiControlled uint8
	nationality  uint8
}

var allDrivers = []driverInfo{
	{"Max Verstappen", 9, 0, 1, 0, 5},
	{"Sergio Perez", 11, 0, 11, 1, 52},
	{"Lewis Hamilton", 7, 4, 44, 1, 12},
	{"Charles Leclerc", 22, 4, 16, 1, 18},
	{"Lando Norris", 10, 2, 4, 1, 12},
	{"Oscar Piastri", 28, 2, 81, 1, 2},
	{"George Russell", 17, 1, 63, 1, 12},
	{"Kimi Antonelli", 34, 1, 12, 1, 18},
	{"Fernando Alonso", 3, 3, 14, 1, 56},
	{"Lance Stroll", 15, 3, 18, 1, 14},
	{"Pierre Gasly", 21, 5, 10, 1, 13},
	{"Jack Doohan", 35, 5, 7, 1, 2},
	{"Alexander Albon", 19, 6, 23, 1, 54},
	{"Carlos Sainz", 0, 6, 55, 1, 56},
	{"Yuki Tsunoda", 26, 7, 22, 1, 19},
	{"Liam Lawson", 29, 7, 30, 1, 46},
	{"Nico Hulkenberg", 13, 8, 27, 1, 15},
	{"Gabriel Bortoleto", 36, 8, 5, 1, 10},
	{"Esteban Ocon", 14, 9, 31, 1, 13},
	{"Oliver Bearman", 33, 9, 87, 1, 12},
	{"Isack Hadjar", 37, 0, 6, 1, 13},
	{"Felipe Drugovich", 31, 3, 31, 1, 10},
	{"Colton Herta", 40, 10, 26, 1, 54},
	{"Alex Palou", 41, 10, 10, 1, 56},
}

func main() {
	sessionFlag := flag.String("session", getEnv("F1T_SESSION_TYPE", "race"), "Session type to simulate: race, quali, q1, q2, q3, practice, timetrial")
	formatFlag := flag.String("format", getEnv("F1T_PACKET_FORMAT", "2026"), "F1 UDP packet format: 2025 (22 cars) or 2026 (24 cars, default)")
	flag.Parse()

	targetAddr := getEnv("F1T_UDP_ADDR", defaultTargetUDP)

	udpAddr, err := net.ResolveUDPAddr("udp", targetAddr)
	if err != nil {
		log.Fatalf("Failed to resolve target address %s: %v", targetAddr, err)
	}

	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		log.Fatalf("Failed to dial UDP: %v", err)
	}
	defer conn.Close()

	// Parse format mode
	var (
		packetFormat uint16 = packets.PacketFormat2026
		gameYear     uint8  = 26
		numCars      int    = packets.MaxCars2026
	)

	if strings.TrimSpace(*formatFlag) == "2025" || strings.TrimSpace(*formatFlag) == "25" {
		packetFormat = packets.PacketFormat2025
		gameYear = 25
		numCars = packets.MaxCars2025
	}

	// Parse session mode
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

	fmt.Println("🏎️  F1 Telemetry Packet Simulator")
	fmt.Println("=================================")
	fmt.Printf("Simulating Session Mode: %s (Type ID: %d)\n", sessionModeName, sessionType)
	fmt.Printf("Telemetry Packet Format: F1 %d (%d Cars Grid, Year %d)\n", packetFormat, numCars, gameYear)
	fmt.Printf("Sending synthetic UDP telemetry to %s at 20Hz...\n", targetAddr)
	fmt.Println("Press Ctrl+C to stop.")

	stopSignal := make(chan os.Signal, 1)
	signal.Notify(stopSignal, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(sendInterval)
	defer ticker.Stop()

	var (
		frameID         uint32
		sessionUID      uint64 = 987654321
		sessionTime     float32
		angle           float64
		lapTimeMs       uint32
		lapNum          uint8 = 1
		totalDistance   float32
		sessionTimeLeft uint16
	)
	if isQualifying {
		sessionTimeLeft = 720 // 12 minutes
	} else {
		sessionTimeLeft = 2400
	}

	for {
		select {
		case <-stopSignal:
			fmt.Println("\nStopping simulator...")
			return
		case <-ticker.C:
			frameID++
			sessionTime += 0.05
			lapTimeMs += 50
			if frameID%20 == 0 && sessionTimeLeft > 0 {
				sessionTimeLeft--
			}

			// 1. Calculate simulated motion & track trajectory (ellipse loop)
			angle += 0.02
			if angle >= 2*math.Pi {
				angle -= 2 * math.Pi
				lapNum++
				lapTimeMs = 0
			}

			posY := float32(5.0 * math.Sin(angle*0.5))

			speedKmh := uint16(120.0 + 180.0*(0.5+0.5*math.Sin(angle*2)))
			rpm := uint16(6000 + 7500*(0.5+0.5*math.Sin(angle*4)))
			gear := int8(1 + int(speedKmh)/40)
			if gear > 8 {
				gear = 8
			}

			throttle := float32(0.5 + 0.5*math.Sin(angle*2))
			brake := float32(0.0)
			if throttle < 0.3 {
				brake = 0.8
			}

			lapDist := float32((angle / (2 * math.Pi)) * 5000.0)
			totalDistance += 5.0

			// Common Header
			header := packets.PacketHeader{
				PacketFormat:            packetFormat,
				GameYear:                gameYear,
				GameMajorVersion:        1,
				GameMinorVersion:        0,
				PacketVersion:           1,
				SessionUID:              sessionUID,
				SessionTime:             sessionTime,
				FrameIdentifier:         frameID,
				OverallFrameIdentifier:  frameID,
				PlayerCarIndex:          0,
				SecondaryPlayerCarIndex: 255,
			}

			var totalLaps uint8 = 58
			if isQualifying {
				totalLaps = 0
			}

			sessionPkt := packets.PacketSessionData{
				Header:                    header,
				TrackId:                   0, // Melbourne
				SessionType:               sessionType,
				TotalLaps:                 totalLaps,
				SessionTimeLeft:           sessionTimeLeft,
				TrackTemperature:          32,
				AirTemperature:            24,
				Weather:                   0, // Clear
				SafetyCarStatus:           0, // Green Flag
				PitStopWindowIdealLap:     16,
				PitStopWindowLatestLap:    22,
				PitStopRejoinPosition:     7,
				NumWeatherForecastSamples: 4,
			}
			sessionPkt.WeatherForecastSamples[0] = packets.WeatherForecastSample{
				SessionType:            sessionType,
				TimeOffset:             0,
				Weather:                0,
				TrackTemperature:       32,
				TrackTemperatureChange: 0,
				AirTemperature:         24,
				AirTemperatureChange:   0,
				RainPercentage:         0,
			}
			sessionPkt.WeatherForecastSamples[1] = packets.WeatherForecastSample{
				SessionType:            sessionType,
				TimeOffset:             5,
				Weather:                1,
				TrackTemperature:       31,
				TrackTemperatureChange: -1,
				AirTemperature:         24,
				AirTemperatureChange:   0,
				RainPercentage:         5,
			}
			sessionPkt.WeatherForecastSamples[2] = packets.WeatherForecastSample{
				SessionType:            sessionType,
				TimeOffset:             15,
				Weather:                2,
				TrackTemperature:       30,
				TrackTemperatureChange: -1,
				AirTemperature:         23,
				AirTemperatureChange:   -1,
				RainPercentage:         20,
			}
			sessionPkt.WeatherForecastSamples[3] = packets.WeatherForecastSample{
				SessionType:            sessionType,
				TimeOffset:             30,
				Weather:                3,
				TrackTemperature:       28,
				TrackTemperatureChange: -2,
				AirTemperature:         22,
				AirTemperatureChange:   -1,
				RainPercentage:         65,
			}
			sessionPkt.Header.PacketId = packets.PacketIDSession
			sendSessionPacket(conn, &sessionPkt)

			// 1b. Periodic Event Packet (ID: 3)
			if frameID%120 == 40 {
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
				sendEventPacket(conn, &evtPkt)
			}

			// 1c. Participants Data Packet (ID: 4)
			if frameID == 1 || frameID%100 == 0 {
				sendParticipantsPacket(conn, header, numCars, allDrivers)
			}

			// 2. Motion Packet (ID: 0)
			motionCars := make([]packets.CarMotionData, numCars)
			for i := 0; i < numCars; i++ {
				off := -float64(i) * 0.08
				a := angle + off
				motionCars[i] = packets.CarMotionData{
					WorldPositionX: float32(300.0 * math.Sin(a)),
					WorldPositionY: posY,
					WorldPositionZ: float32(150.0 * math.Cos(2*a)),
					WorldVelocityX: float32(math.Cos(a) * 30),
					WorldVelocityZ: float32(-math.Sin(a) * 30),
				}
			}
			sendMotionPacket(conn, header, numCars, motionCars)

			// 3. Car Telemetry Packet (ID: 6)
			telemetryCars := make([]packets.CarTelemetryData, numCars)
			for i := 0; i < numCars; i++ {
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
				}
			}
			sendTelemetryPacket(conn, header, numCars, telemetryCars)

			// 4. Lap Data Packet (ID: 2)
			lapCars := make([]packets.LapData, numCars)
			for i := 0; i < numCars; i++ {
				gapMs := uint32(i * 350)
				var pitStatus uint8 = 0
				if i >= numCars-4 {
					pitStatus = 1
				}
				var penalties uint8 = 0
				var totalWarnings uint8 = 0
				var driveThrough uint8 = 0

				if i == 2 {
					penalties = 5
				} else if i == 5 {
					penalties = 3
				} else if i == 7 {
					totalWarnings = 2
				} else if i == 11 {
					driveThrough = 1
				}

				gridPos := uint8((i+3)%numCars + 1)
				speedTrap := float32(322.5 - float64(i)*1.1)

				lapCars[i] = packets.LapData{
					CurrentLapTimeInMS:          lapTimeMs + gapMs,
					LastLapTimeInMS:             uint32(85432 + i*220),
					Sector1TimeMSPart:           uint16(28120 + i*100),
					Sector2TimeMSPart:           uint16(31450 + i*90),
					CurrentLapNum:               lapNum,
					LapDistance:                 lapDist,
					TotalDistance:               totalDistance - float32(i*15),
					CarPosition:                 uint8(i + 1),
					GridPosition:                gridPos,
					ResultStatus:                2, // Active
					DeltaToRaceLeaderMSPart:     uint16(gapMs),
					DeltaToCarInFrontMSPart:     uint16(350),
					PitStatus:                   pitStatus,
					NumPitStops:                 uint8(i / 8),
					PitLaneTimeInLaneInMS:       uint16(21500 + i*400),
					SpeedTrapFastestSpeed:       speedTrap,
					SpeedTrapFastestLap:         uint8(1 + (i % 3)),
					Penalties:                   penalties,
					TotalWarnings:               totalWarnings,
					NumUnservedDriveThroughPens: driveThrough,
				}
			}
			sendLapDataPacket(conn, header, numCars, lapCars)

			// 5. Car Status Packet (ID: 7)
			if frameID == 1 || frameID%20 == 0 {
				statusCars := make([]packets.CarStatusData, numCars)
				compounds := []uint8{16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18, 16, 17, 18}
				for i := 0; i < numCars; i++ {
					statusCars[i] = packets.CarStatusData{
						FuelInTank:         float32(48.0 - float64(i)*0.8),
						FuelCapacity:       110.0,
						VisualTyreCompound: compounds[i%len(compounds)],
						TyresAgeLaps:       uint8(3 + i*2),
						ERSStoreEnergy:     float32(4000000.0 * (1.0 - float64(i)*0.03)),
						ERSDeployMode:      uint8(i % 4),
					}
				}
				sendCarStatusPacket(conn, header, numCars, statusCars)
			}

			// 7. Car Damage Packet (ID: 10)
			if frameID == 1 || frameID%20 == 0 {
				damageCars := make([]packets.CarDamageData, numCars)
				for i := 0; i < numCars; i++ {
					baseWear := float32(15.0 + float64(lapNum)*2.5 + float64(i)*1.8)
					if baseWear > 95.0 {
						baseWear = 95.0
					}
					flWear := baseWear + float32(i%3)*2.0
					frWear := baseWear + float32(i%2)*3.0
					rlWear := baseWear * 0.95
					rrWear := baseWear * 0.92

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
				sendCarDamagePacket(conn, header, numCars, damageCars)
			}
		}
	}
}

func sendSessionPacket(conn *net.UDPConn, pkt *packets.PacketSessionData) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, pkt)
	_, _ = conn.Write(buf.Bytes())
}

func sendEventPacket(conn *net.UDPConn, pkt *packets.PacketEventData) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, pkt)
	_, _ = conn.Write(buf.Bytes())
}

func sendParticipantsPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, drivers []driverInfo) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDParticipants
	_ = binary.Write(&buf, binary.LittleEndian, header)
	_ = binary.Write(&buf, binary.LittleEndian, uint8(numCars))

	nameLen := packets.ParticipantNameLen2025
	if header.PacketFormat >= packets.PacketFormat2026 {
		nameLen = packets.ParticipantNameLen2026
	}

	for i := 0; i < numCars; i++ {
		d := drivers[i]
		_ = binary.Write(&buf, binary.LittleEndian, d.aiControlled)
		_ = binary.Write(&buf, binary.LittleEndian, d.driverID)
		_ = binary.Write(&buf, binary.LittleEndian, uint8(0)) // NetworkId
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

		if header.PacketFormat >= packets.PacketFormat2026 {
			// 2026 format extra padding (ParticipantStructSize2026 is 57 bytes, 44 written so far)
			extra := make([]byte, packets.ParticipantStructSize2026-44)
			buf.Write(extra)
		}
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendMotionPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, cars []packets.CarMotionData) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDMotion
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, cars[i])
	}
	_, _ = conn.Write(buf.Bytes())
}

func sendTelemetryPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, cars []packets.CarTelemetryData) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarTelemetry
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, cars[i])
	}
	// Trailer: MFDPanelIndex, MFDPanelIndexSecondaryPlayer, SuggestedGear
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))
	_ = binary.Write(&buf, binary.LittleEndian, int8(0))
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

func sendCarStatusPacket(conn *net.UDPConn, header packets.PacketHeader, numCars int, status []packets.CarStatusData) {
	var buf bytes.Buffer
	header.PacketId = packets.PacketIDCarStatus
	_ = binary.Write(&buf, binary.LittleEndian, header)
	for i := 0; i < numCars; i++ {
		_ = binary.Write(&buf, binary.LittleEndian, status[i])
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

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
