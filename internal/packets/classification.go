package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// FinalClassificationData contains final classification data for a single car.
type FinalClassificationData struct {
	Position          uint8                `json:"Position"`
	NumLaps           uint8                `json:"NumLaps"`
	GridPosition      uint8                `json:"GridPosition"`
	Points            uint8                `json:"Points"`
	NumPitStops       uint8                `json:"NumPitStops"`
	ResultStatus      uint8                `json:"ResultStatus"`
	ResultReason      uint8                `json:"ResultReason"`
	BestLapTimeInMS   uint32               `json:"BestLapTimeInMS"`
	TotalRaceTime     float64              `json:"TotalRaceTime"`
	PenaltiesTime     uint8                `json:"PenaltiesTime"`
	NumPenalties      uint8                `json:"NumPenalties"`
	NumTyreStints     uint8                `json:"NumTyreStints"`
	TyreStintsActual  [MaxTyreStints]uint8 `json:"TyreStintsActual"`
	TyreStintsVisual  [MaxTyreStints]uint8 `json:"TyreStintsVisual"`
	TyreStintsEndLaps [MaxTyreStints]uint8 `json:"TyreStintsEndLaps"`
}

// PacketFinalClassificationData contains final classification for all cars. Packet ID: 8.
type PacketFinalClassificationData struct {
	Header             PacketHeader                     `json:"Header"`
	NumCars            uint8                            `json:"NumCars"`
	ClassificationData [MaxCars]FinalClassificationData `json:"ClassificationData"`
}

func (p PacketFinalClassificationData) GetHeader() PacketHeader { return p.Header }

const FinalClassificationStructSize = 46

// DecodeFinalClassification decodes a PacketFinalClassificationData from raw bytes.
func DecodeFinalClassification(data []byte) (*PacketFinalClassificationData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in final classification: %w", err)
	}

	var pkt PacketFinalClassificationData
	pkt.Header = header

	payload := data[headerLen:]
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for final classification payload: got %d bytes", len(payload))
	}

	pkt.NumCars = payload[0]
	carsPayload := payload[1:]

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(carsPayload, header, FinalClassificationStructSize, 0)

	numToRead := int(pkt.NumCars)
	if numToRead <= 0 || numToRead > maxCars {
		numToRead = maxCars
	}

	for i := 0; i < numToRead && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+FinalClassificationStructSize > len(carsPayload) {
			break
		}
		r := bytes.NewReader(carsPayload[offset : offset+FinalClassificationStructSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.ClassificationData[i]); err != nil {
			return nil, fmt.Errorf("failed to decode classification data for car %d: %w", i, err)
		}
	}

	return &pkt, nil
}
