package packets

import (
	"fmt"
)

const (
	MaxNumLapsInLapPositions = 50
)

// PacketLapPositionsData contains lap positions history for all cars. Packet ID: 15.
type PacketLapPositionsData struct {
	Header                PacketHeader                             `json:"Header"`
	NumLaps               uint8                                    `json:"NumLaps"`
	LapStart              uint8                                    `json:"LapStart"`
	PositionForVehicleIdx [MaxNumLapsInLapPositions][MaxCars]uint8 `json:"PositionForVehicleIdx"`
}

func (p PacketLapPositionsData) GetHeader() PacketHeader { return p.Header }

// DecodeLapPositions decodes a PacketLapPositionsData from header and payload bytes.
func DecodeLapPositions(header PacketHeader, payload []byte) (*PacketLapPositionsData, error) {
	var pkt PacketLapPositionsData
	pkt.Header = header

	if len(payload) < 2 {
		return nil, fmt.Errorf("data too short for lap positions payload: got %d bytes", len(payload))
	}

	pkt.NumLaps = payload[0]
	pkt.LapStart = payload[1]

	matrixBytes := payload[2:]
	maxCars := MaxCarsForFormat(header.PacketFormat)

	for lap := 0; lap < MaxNumLapsInLapPositions; lap++ {
		lapOffset := lap * maxCars
		if lapOffset+maxCars > len(matrixBytes) {
			break
		}
		for car := 0; car < maxCars && car < MaxCars; car++ {
			pkt.PositionForVehicleIdx[lap][car] = matrixBytes[lapOffset+car]
		}
	}

	return &pkt, nil
}
