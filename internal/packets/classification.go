package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// FinalClassificationData contains final classification data for a single car.
type FinalClassificationData struct {
	Position          uint8
	NumLaps           uint8
	GridPosition      uint8
	Points            uint8
	NumPitStops       uint8
	ResultStatus      uint8
	BestLapTimeInMS   uint32
	TotalRaceTime     float64
	PenaltiesTime     uint8
	NumPenalties      uint8
	NumTyreStints     uint8
	TyreStintsActual  [8]uint8
	TyreStintsVisual  [8]uint8
	TyreStintsEndLaps [8]uint8
}

// PacketFinalClassificationData contains final classification for all cars. Packet ID: 8.
type PacketFinalClassificationData struct {
	Header             PacketHeader
	NumCars            uint8
	ClassificationData [MaxCars]FinalClassificationData
}

func (p PacketFinalClassificationData) GetHeader() PacketHeader { return p.Header }

// DecodeFinalClassification decodes a PacketFinalClassificationData from raw bytes.
func DecodeFinalClassification(data []byte) (*PacketFinalClassificationData, error) {
	var pkt PacketFinalClassificationData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode final classification packet: %w", err)
	}
	return &pkt, nil
}
