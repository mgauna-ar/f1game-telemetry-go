package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

const (
	HeaderSize       = 29
	MaxCars          = 24
	MaxCars2025      = 22
	MaxCars2026      = 24
	PacketFormat2026 = 2026
)

// MaxCarsForFormat returns the maximum number of cars for a given packet format.
func MaxCarsForFormat(packetFormat uint16) int {
	if packetFormat >= PacketFormat2026 {
		return MaxCars2026
	}
	return MaxCars2025
}

// InferredItemSize calculates the exact per-car byte stride based on packet payload length.
func InferredItemSize(payload []byte, header PacketHeader, structSize int, trailer int) int {
	maxCars := MaxCarsForFormat(header.PacketFormat)
	if len(payload) <= 0 || maxCars <= 0 {
		return structSize
	}

	if len(payload)%maxCars == 0 {
		size := len(payload) / maxCars
		if size >= structSize {
			return size
		}
	}

	if trailer > 0 && len(payload) > trailer && (len(payload)-trailer)%maxCars == 0 {
		size := (len(payload) - trailer) / maxCars
		if size >= structSize {
			return size
		}
	}

	return structSize
}

// Packet IDs
const (
	PacketIDMotion              uint8 = 0
	PacketIDSession             uint8 = 1
	PacketIDLapData             uint8 = 2
	PacketIDEvent               uint8 = 3
	PacketIDParticipants        uint8 = 4
	PacketIDCarSetup            uint8 = 5
	PacketIDCarTelemetry        uint8 = 6
	PacketIDCarStatus           uint8 = 7
	PacketIDFinalClassification uint8 = 8
	PacketIDLobbyInfo           uint8 = 9
	PacketIDCarDamage           uint8 = 10
	PacketIDSessionHistory      uint8 = 11
	PacketIDTyreSets            uint8 = 12
	PacketIDMotionEx            uint8 = 13
	PacketIDTimeTrial           uint8 = 14
	PacketIDLapPositions        uint8 = 15
)

// PacketHeader is the header present at the start of every UDP packet.
type PacketHeader struct {
	PacketFormat            uint16
	GameYear                uint8
	GameMajorVersion        uint8
	GameMinorVersion        uint8
	PacketVersion           uint8
	PacketId                uint8
	SessionUID              uint64
	SessionTime             float32
	FrameIdentifier         uint32
	OverallFrameIdentifier  uint32
	PlayerCarIndex          uint8
	SecondaryPlayerCarIndex uint8
}

// Packet is the interface implemented by all packet types.
type Packet interface {
	GetHeader() PacketHeader
}

// DecodeHeaderWithOffset decodes a PacketHeader and returns the header length (29 bytes for F1 2025/2026).
func DecodeHeaderWithOffset(data []byte) (PacketHeader, int, error) {
	if len(data) < HeaderSize {
		return PacketHeader{}, 0, fmt.Errorf("data too short for header: got %d bytes, need %d", len(data), HeaderSize)
	}

	var h PacketHeader
	err := binary.Read(bytes.NewReader(data[:HeaderSize]), binary.LittleEndian, &h)
	if err != nil {
		return PacketHeader{}, 0, fmt.Errorf("failed to decode header: %w", err)
	}
	return h, HeaderSize, nil
}

// DecodeHeader decodes a PacketHeader from raw bytes.
func DecodeHeader(data []byte) (PacketHeader, error) {
	h, _, err := DecodeHeaderWithOffset(data)
	return h, err
}
