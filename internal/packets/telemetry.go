package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
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

// MarshalJSON implements json.Marshaler for CarTelemetryData.
// Go's encoding/json encodes [N]uint8 arrays as base64 strings by default,
// which produces garbled data on the frontend. This custom marshaler converts
// TyresSurfaceTemperature, TyresInnerTemperature, and SurfaceType to integer
// arrays so they serialize as proper JSON number arrays.
func (c CarTelemetryData) MarshalJSON() ([]byte, error) {
	type telemetryAlias CarTelemetryData

	uint8ToInt := func(a [4]uint8) [4]int {
		return [4]int{int(a[0]), int(a[1]), int(a[2]), int(a[3])}
	}

	return json.Marshal(struct {
		telemetryAlias
		TyresSurfaceTemperature [4]int `json:"TyresSurfaceTemperature"`
		TyresInnerTemperature   [4]int `json:"TyresInnerTemperature"`
		SurfaceType             [4]int `json:"SurfaceType"`
	}{
		telemetryAlias:          telemetryAlias(c),
		TyresSurfaceTemperature: uint8ToInt(c.TyresSurfaceTemperature),
		TyresInnerTemperature:   uint8ToInt(c.TyresInnerTemperature),
		SurfaceType:             uint8ToInt(c.SurfaceType),
	})
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
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car telemetry: %w", err)
	}

	var pkt PacketCarTelemetryData
	pkt.Header = header

	payload := data[headerLen:]
	r := bytes.NewReader(payload)

	if err := binary.Read(r, binary.LittleEndian, &pkt.CarTelemetryData); err != nil {
		return nil, fmt.Errorf("failed to decode car telemetry payload: %w", err)
	}

	if r.Len() >= 1 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.MFDPanelIndex)
	}
	if r.Len() >= 1 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.MFDPanelIndexSecondaryPlayer)
	}
	if r.Len() >= 1 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.SuggestedGear)
	}

	return &pkt, nil
}
