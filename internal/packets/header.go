package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
)

const (
	HeaderSize2023 = 25
	HeaderSize2024 = 29
	HeaderSize     = 29
	MaxCars        = 22
)

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

// DecodeHeaderWithOffset decodes a PacketHeader and returns the header length (25 for 2023, 29 for 2024+).
func DecodeHeaderWithOffset(data []byte) (PacketHeader, int, error) {
	if len(data) < HeaderSize2023 {
		return PacketHeader{}, 0, fmt.Errorf("data too short for header: got %d bytes, need at least %d", len(data), HeaderSize2023)
	}

	packetFormat := binary.LittleEndian.Uint16(data[0:2])
	if packetFormat == 2023 {
		var h PacketHeader
		h.PacketFormat = packetFormat
		h.GameYear = data[2]
		h.GameMajorVersion = data[3]
		h.GameMinorVersion = data[4]
		h.PacketVersion = data[5]
		h.PacketId = data[6]
		h.SessionUID = binary.LittleEndian.Uint64(data[7:15])
		h.SessionTime = math.Float32frombits(binary.LittleEndian.Uint32(data[15:19]))
		h.FrameIdentifier = binary.LittleEndian.Uint32(data[19:23])
		h.OverallFrameIdentifier = 0
		h.PlayerCarIndex = data[23]
		h.SecondaryPlayerCarIndex = data[24]
		return h, HeaderSize2023, nil
	}

	headerLen := HeaderSize2024
	if len(data) < headerLen {
		return PacketHeader{}, 0, fmt.Errorf("data too short for header: got %d bytes, need %d", len(data), headerLen)
	}

	var h PacketHeader
	err := binary.Read(bytes.NewReader(data[:headerLen]), binary.LittleEndian, &h)
	if err != nil {
		return PacketHeader{}, 0, fmt.Errorf("failed to decode header: %w", err)
	}
	return h, headerLen, nil
}

// DecodeHeader decodes a PacketHeader from raw bytes.
func DecodeHeader(data []byte) (PacketHeader, error) {
	h, _, err := DecodeHeaderWithOffset(data)
	return h, err
}
