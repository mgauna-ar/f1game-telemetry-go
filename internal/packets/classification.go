package packets

import (
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

// DecodeFinalClassification decodes a PacketFinalClassificationData from header and payload bytes.
func DecodeFinalClassification(header PacketHeader, payload []byte) (*PacketFinalClassificationData, error) {
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for final classification payload: got %d bytes", len(payload))
	}

	numCars := payload[0]
	cars, err := DecodePerCarBinary[FinalClassificationData](payload, header, FinalClassificationStructSize, 0, 1, int(numCars))
	if err != nil {
		return nil, fmt.Errorf("failed to decode final classification: %w", err)
	}

	return &PacketFinalClassificationData{
		Header:             header,
		NumCars:            numCars,
		ClassificationData: cars,
	}, nil
}
