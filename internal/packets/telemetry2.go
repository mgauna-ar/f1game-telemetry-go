package packets

import (
	"bytes"
	"encoding/binary"
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

// DecodeCarTelemetry2 decodes a PacketCarTelemetry2Data from raw bytes.
func DecodeCarTelemetry2(data []byte) (*PacketCarTelemetry2Data, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car telemetry 2: %w", err)
	}

	var pkt PacketCarTelemetry2Data
	pkt.Header = header

	payload := data[headerLen:]
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, CarTelemetry2StructSize, 0)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+CarTelemetry2StructSize > len(payload) {
			break
		}
		r := bytes.NewReader(payload[offset : offset+CarTelemetry2StructSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.CarTelemetry2Data[i]); err != nil {
			return nil, fmt.Errorf("failed to decode car telemetry 2 data for car %d: %w", i, err)
		}
	}

	return &pkt, nil
}
