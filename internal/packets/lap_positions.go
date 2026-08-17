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

const LapPositionsCarDataStructSize = 721

// DecodeLapPositions decodes a PacketLapPositionsData from raw bytes.
func DecodeLapPositions(data []byte) (*PacketLapPositionsData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in lap positions: %w", err)
	}

	var pkt PacketLapPositionsData
	pkt.Header = header

	payload := data[headerLen:]
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, LapPositionsCarDataStructSize, 0)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+LapPositionsCarDataStructSize > len(payload) {
			break
		}
		r := bytes.NewReader(payload[offset : offset+LapPositionsCarDataStructSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.LapPositionsCarData[i]); err != nil {
			return nil, fmt.Errorf("failed to decode lap positions for car %d: %w", i, err)
		}
	}

	return &pkt, nil
}
