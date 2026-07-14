package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// LapPosition contains the position data for a single car at a given point.
type LapPosition struct {
	X float32
	Y float32
	Z float32
}

// LapPositionsCarData contains position data for a single car over the lap.
type LapPositionsCarData struct {
	NumPositions uint8
	Positions    [60]LapPosition
}

// PacketLapPositionsData contains lap position data for all cars. Packet ID: 15.
type PacketLapPositionsData struct {
	Header              PacketHeader
	LapPositionsCarData [MaxCars]LapPositionsCarData
}

func (p PacketLapPositionsData) GetHeader() PacketHeader { return p.Header }

// DecodeLapPositions decodes a PacketLapPositionsData from raw bytes.
func DecodeLapPositions(data []byte) (*PacketLapPositionsData, error) {
	var pkt PacketLapPositionsData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode lap positions packet: %w", err)
	}
	return &pkt, nil
}
