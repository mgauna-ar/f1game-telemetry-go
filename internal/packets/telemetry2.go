package packets

import (
	"fmt"
)

// CarTelemetry2Data contains additional 2026 regulations telemetry for a single car.
type CarTelemetry2Data struct {
	ActiveAeroMode               uint8  `json:"ActiveAeroMode"`
	ActiveAeroAvailable          uint8  `json:"ActiveAeroAvailable"`
	ActiveAeroActivationDistance uint16 `json:"ActiveAeroActivationDistance"`
	OvertakeAvailable            uint8  `json:"OvertakeAvailable"`
	OvertakeActive               uint8  `json:"OvertakeActive"`
	OvertakeActivationDistance   uint16 `json:"OvertakeActivationDistance"`
	Regulations2026              uint8  `json:"Regulations2026"`
	DrivingWrongWay              uint8  `json:"DrivingWrongWay"`
}

// PacketCarTelemetry2Data contains additional 2026 regulations telemetry for all cars. Packet ID: 16.
type PacketCarTelemetry2Data struct {
	Header            PacketHeader               `json:"Header"`
	CarTelemetry2Data [MaxCars]CarTelemetry2Data `json:"CarTelemetry2Data"`
}

func (p PacketCarTelemetry2Data) GetHeader() PacketHeader { return p.Header }

const (
	CarTelemetry2StructSize = 10
)

// DecodeCarTelemetry2 decodes a PacketCarTelemetry2Data from header and payload bytes.
func DecodeCarTelemetry2(header PacketHeader, payload []byte) (*PacketCarTelemetry2Data, error) {
	cars, err := DecodePerCarBinary[CarTelemetry2Data](payload, header, CarTelemetry2StructSize, 0, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car telemetry 2 data: %w", err)
	}

	return &PacketCarTelemetry2Data{
		Header:            header,
		CarTelemetry2Data: cars,
	}, nil
}
