package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarTelemetryData contains telemetry data for a single car.
type CarTelemetryData struct {
	Speed                   uint16
	Throttle                float32
	Steer                   float32
	Brake                   float32
	Clutch                  uint8
	Gear                    int8
	EngineRPM               uint16
	DRS                     uint8
	RevLightsPercent        uint8
	RevLightsBitValue       uint16
	BrakesTemperature       [4]uint16
	TyresSurfaceTemperature [4]uint8
	TyresInnerTemperature   [4]uint8
	EngineTemperature       uint16
	TyresPressure           [4]float32
	SurfaceType             [4]uint8
}

// PacketCarTelemetryData contains telemetry data for all cars. Packet ID: 6.
type PacketCarTelemetryData struct {
	Header                       PacketHeader
	CarTelemetryData             [MaxCars]CarTelemetryData
	MFDPanelIndex                uint8
	MFDPanelIndexSecondaryPlayer uint8
	SuggestedGear                int8
}

func (p PacketCarTelemetryData) GetHeader() PacketHeader { return p.Header }

// DecodeCarTelemetry decodes a PacketCarTelemetryData from raw bytes.
func DecodeCarTelemetry(data []byte) (*PacketCarTelemetryData, error) {
	var pkt PacketCarTelemetryData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car telemetry packet: %w", err)
	}
	return &pkt, nil
}
