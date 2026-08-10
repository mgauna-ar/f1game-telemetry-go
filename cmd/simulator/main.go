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

func main() {
	sessionFlag := flag.String("session", getEnv("F1T_SESSION_TYPE", "race"), "Session type to simulate: race, quali, q1, q2, q3, practice, timetrial")
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
				PacketFormat:            2025,
				GameYear:                25,
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
				Header:           header,
				TrackId:          0, // Melbourne
				SessionType:      sessionType,
				TotalLaps:        totalLaps,
				SessionTimeLeft:  sessionTimeLeft,
				TrackTemperature: 32,
				AirTemperature:   24,
				Weather:          0, // Clear
				SafetyCarStatus:  0, // Green Flag
			}
			sessionPkt.Header.PacketId = packets.PacketIDSession
			sendPacket(conn, &sessionPkt)

			// 1c. Participants Data Packet (ID: 4)
			if frameID == 1 || frameID%100 == 0 {
				participantsPkt := packets.PacketParticipantsData{
					Header:        header,
					NumActiveCars: 4,
				}
				participantsPkt.Header.PacketId = packets.PacketIDParticipants

				drivers := []struct {
					name         string
					driverID     uint8
					teamID       uint8
					raceNumber   uint8
					aiControlled uint8
					nationality  uint8
				}{
					{"Max Verstappen", 1, 0, 1, 0, 5},
					{"Lewis Hamilton", 2, 4, 44, 1, 12},
					{"Charles Leclerc", 3, 4, 16, 1, 18},
					{"Lando Norris", 4, 2, 4, 1, 12},
				}

				for i, d := range drivers {
					participantsPkt.Participants[i] = packets.ParticipantData{
						AIControlled: d.aiControlled,
						DriverId:     d.driverID,
						TeamId:       d.teamID,
						RaceNumber:   d.raceNumber,
						Nationality:  d.nationality,
					}
					copy(participantsPkt.Participants[i].Name[:], d.name)
				}

				sendPacket(conn, &participantsPkt)
			}

			// 2. Motion Packet (ID: 0)
			motionPkt := packets.PacketMotionData{
				Header: header,
			}
			motionPkt.Header.PacketId = packets.PacketIDMotion

			offsets := []float64{0.0, -0.15, -0.32, -0.50}
			for i, off := range offsets {
				a := angle + off
				motionPkt.CarMotionData[i] = packets.CarMotionData{
					WorldPositionX: float32(300.0 * math.Sin(a)),
					WorldPositionY: posY,
					WorldPositionZ: float32(150.0 * math.Cos(2*a)),
					WorldVelocityX: float32(math.Cos(a) * 30),
					WorldVelocityZ: float32(-math.Sin(a) * 30),
				}
			}
			sendPacket(conn, &motionPkt)

			// 3. Car Telemetry Packet (ID: 6)
			telemetryPkt := packets.PacketCarTelemetryData{
				Header: header,
			}
			telemetryPkt.Header.PacketId = packets.PacketIDCarTelemetry
			for i := 0; i < 4; i++ {
				factor := 1.0 - float64(i)*0.03
				a := angle - float64(i)*0.15
				telemetryPkt.CarTelemetryData[i] = packets.CarTelemetryData{
					Speed:     uint16(float64(speedKmh) * factor),
					Throttle:  float32(float64(throttle) * factor),
					Steer:     float32(math.Sin(a)),
					Brake:     float32(float64(brake) * (1.0 + float64(i)*0.05)),
					Gear:      gear,
					EngineRPM: uint16(float64(rpm) * factor),
					DRS:       uint8(i % 2),
				}
			}
			sendPacket(conn, &telemetryPkt)

			// 4. Lap Data Packet (ID: 2)
			lapPkt := packets.PacketLapData{
				Header: header,
			}
			lapPkt.Header.PacketId = packets.PacketIDLapData
			for i := 0; i < 4; i++ {
				gapMs := uint32(i * 450)
				var pitStatus uint8 = 0
				if i == 3 {
					pitStatus = 1
				}
				lapPkt.LapData[i] = packets.LapData{
					CurrentLapTimeInMS:      lapTimeMs + gapMs,
					LastLapTimeInMS:         uint32(85432 + i*320),
					Sector1TimeMSPart:       uint16(28120 + i*150),
					Sector2TimeMSPart:       uint16(31450 + i*120),
					CurrentLapNum:           lapNum,
					LapDistance:             lapDist,
					TotalDistance:           totalDistance - float32(i*15),
					CarPosition:             uint8(i + 1),
					DeltaToRaceLeaderMSPart: uint16(gapMs),
					DeltaToCarInFrontMSPart: uint16(450),
					PitStatus:               pitStatus,
				}
			}
			sendPacket(conn, &lapPkt)

			// 5. Car Status Packet (ID: 7)
			if frameID == 1 || frameID%20 == 0 {
				statusPkt := packets.PacketCarStatusData{
					Header: header,
				}
				statusPkt.Header.PacketId = packets.PacketIDCarStatus
				compounds := []uint8{16, 17, 18, 16} // Soft, Medium, Hard, Soft
				for i := 0; i < 4; i++ {
					statusPkt.CarStatusData[i] = packets.CarStatusData{
						FuelInTank:         float32(48.0 - float64(i)*1.5),
						FuelCapacity:       110.0,
						VisualTyreCompound: compounds[i],
						TyresAgeLaps:       uint8(5 + i*3),
						ERSStoreEnergy:     float32(4000000.0 * (1.0 - float64(i)*0.15)),
						ERSDeployMode:      uint8(i % 4),
					}
				}
				sendPacket(conn, &statusPkt)
			}
		}
	}
}

func sendPacket(conn *net.UDPConn, pkt interface{}) {
	var buf bytes.Buffer
	if err := binary.Write(&buf, binary.LittleEndian, pkt); err != nil {
		log.Printf("Error encoding packet: %v", err)
		return
	}
	_, _ = conn.Write(buf.Bytes())
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
