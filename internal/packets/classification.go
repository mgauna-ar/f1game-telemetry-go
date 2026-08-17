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

const FinalClassificationStructSize = 45

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
	itemSize := FinalClassificationStructSize
	if maxCars > 0 && len(carsPayload)%maxCars == 0 && len(carsPayload)/maxCars >= FinalClassificationStructSize {
		itemSize = len(carsPayload) / maxCars
	} else if len(carsPayload)%MaxCars == 0 && len(carsPayload)/MaxCars >= FinalClassificationStructSize {
		itemSize = len(carsPayload) / MaxCars
	}

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
