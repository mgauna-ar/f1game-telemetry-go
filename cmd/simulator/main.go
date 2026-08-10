package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

const (
	defaultTargetUDP = "127.0.0.1:20777"
	sendInterval     = 50 * time.Millisecond // 20Hz
)

func main() {
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

	fmt.Println("🏎️  F1 Telemetry Packet Simulator")
	fmt.Println("=================================")
	fmt.Printf("Sending synthetic UDP telemetry to %s at 20Hz...\n", targetAddr)
	fmt.Println("Press Ctrl+C to stop.")

	stopSignal := make(chan os.Signal, 1)
	signal.Notify(stopSignal, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(sendInterval)
	defer ticker.Stop()

	var (
		frameID       uint32
		sessionUID    uint64 = 987654321
		sessionTime   float32
		angle         float64
		lapTimeMs     uint32
		lapNum        uint8 = 1
		totalDistance float32
	)

	for {
		select {
		case <-stopSignal:
			fmt.Println("\nStopping simulator...")
			return
		case <-ticker.C:
			frameID++
			sessionTime += 0.05
			lapTimeMs += 50

			// 1. Calculate simulated motion & track trajectory (ellipse loop)
			angle += 0.02
			if angle >= 2*math.Pi {
				angle -= 2 * math.Pi
				lapNum++
				lapTimeMs = 0
			}

			posX := float32(300.0 * math.Sin(angle))
			posZ := float32(150.0 * math.Cos(2*angle))
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

			// 1b. Session Data Packet (ID: 1)
			sessionPkt := packets.PacketSessionData{
				Header:      header,
				TrackId:     0,                        // Melbourne
				SessionType: packets.SessionTimeTrial, // Time Trial
			}
			sessionPkt.Header.PacketId = packets.PacketIDSession
			sendPacket(conn, &sessionPkt)

			// 2. Motion Packet (ID: 0)
			motionPkt := packets.PacketMotionData{
				Header: header,
			}
			motionPkt.Header.PacketId = packets.PacketIDMotion
			motionPkt.CarMotionData[0] = packets.CarMotionData{
				WorldPositionX: posX,
				WorldPositionY: posY,
				WorldPositionZ: posZ,
				WorldVelocityX: float32(math.Cos(angle) * 30),
				WorldVelocityZ: float32(-math.Sin(angle) * 30),
			}
			sendPacket(conn, &motionPkt)

			// 3. Car Telemetry Packet (ID: 6)
			telemetryPkt := packets.PacketCarTelemetryData{
				Header: header,
			}
			telemetryPkt.Header.PacketId = packets.PacketIDCarTelemetry
			telemetryPkt.CarTelemetryData[0] = packets.CarTelemetryData{
				Speed:     speedKmh,
				Throttle:  throttle,
				Steer:     float32(math.Sin(angle)),
				Brake:     brake,
				Gear:      gear,
				EngineRPM: rpm,
			}
			sendPacket(conn, &telemetryPkt)

			// 4. Lap Data Packet (ID: 2)
			lapPkt := packets.PacketLapData{
				Header: header,
			}
			lapPkt.Header.PacketId = packets.PacketIDLapData
			lapPkt.LapData[0] = packets.LapData{
				CurrentLapTimeInMS: lapTimeMs,
				CurrentLapNum:      lapNum,
				LapDistance:        lapDist,
				TotalDistance:      totalDistance,
				CarPosition:        1,
			}
			sendPacket(conn, &lapPkt)
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
