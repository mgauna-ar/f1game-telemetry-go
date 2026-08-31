package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
)

// CarTelemetryData contains telemetry data for a single car.
type CarTelemetryData struct {
	Speed                   uint16     `json:"Speed"`
	Throttle                float32    `json:"Throttle"`
	Steer                   float32    `json:"Steer"`
	Brake                   float32    `json:"Brake"`
	Clutch                  uint8      `json:"Clutch"`
	Gear                    int8       `json:"Gear"`
	EngineRPM               uint16     `json:"EngineRPM"`
	DRS                     uint8      `json:"DRS"`
	RevLightsPercent        uint8      `json:"RevLightsPercent"`
	RevLightsBitValue       uint16     `json:"RevLightsBitValue"`
	BrakesTemperature       [4]uint16  `json:"BrakesTemperature"`
	TyresSurfaceTemperature [4]uint8   `json:"TyresSurfaceTemperature"`
	TyresInnerTemperature   [4]uint8   `json:"TyresInnerTemperature"`
	EngineTemperature       uint16     `json:"EngineTemperature"`
	TyresPressure           [4]float32 `json:"TyresPressure"`
	SurfaceType             [4]uint8   `json:"SurfaceType"`
}

// MarshalJSON implements json.Marshaler for CarTelemetryData.
// Converts uint8 arrays to integer arrays so they serialize as JSON number arrays rather than base64.
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
	Header                       PacketHeader              `json:"Header"`
	CarTelemetryData             [MaxCars]CarTelemetryData `json:"CarTelemetryData"`
	MFDPanelIndex                uint8                     `json:"MFDPanelIndex"`
	MFDPanelIndexSecondaryPlayer uint8                     `json:"MFDPanelIndexSecondaryPlayer"`
	SuggestedGear                int8                      `json:"SuggestedGear"`
}

func (p PacketCarTelemetryData) GetHeader() PacketHeader { return p.Header }

const (
	CarTelemetryStructSize2025 = 60
	CarTelemetryStructSize2026 = 59
	CarTelemetryTrailerSize    = 3
)

type rawCarTelemetry2025 struct {
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

type rawCarTelemetry2026 struct {
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
	EngineTemperature       uint8
	TyresPressure           [4]float32
	SurfaceType             [4]uint8
}

type rawCarTelemetryTrailer struct {
	MFDPanelIndex                uint8
	MFDPanelIndexSecondaryPlayer uint8
	SuggestedGear                int8
}

func decodeCarTelemetryCar(carBytes []byte, is2026 bool) (CarTelemetryData, error) {
	r := bytes.NewReader(carBytes)
	if is2026 {
		var raw rawCarTelemetry2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return CarTelemetryData{}, err
		}
		return CarTelemetryData{
			Speed:                   raw.Speed,
			Throttle:                raw.Throttle,
			Steer:                   raw.Steer,
			Brake:                   raw.Brake,
			Clutch:                  raw.Clutch,
			Gear:                    raw.Gear,
			EngineRPM:               raw.EngineRPM,
			DRS:                     raw.DRS,
			RevLightsPercent:        raw.RevLightsPercent,
			RevLightsBitValue:       raw.RevLightsBitValue,
			BrakesTemperature:       raw.BrakesTemperature,
			TyresSurfaceTemperature: raw.TyresSurfaceTemperature,
			TyresInnerTemperature:   raw.TyresInnerTemperature,
			EngineTemperature:       uint16(raw.EngineTemperature),
			TyresPressure:           raw.TyresPressure,
			SurfaceType:             raw.SurfaceType,
		}, nil
	}

	var raw rawCarTelemetry2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return CarTelemetryData{}, err
	}
	return CarTelemetryData(raw), nil
}

// DecodeCarTelemetry decodes a PacketCarTelemetryData from header and payload bytes (supporting both 2025 and 2026 formats).
func DecodeCarTelemetry(header PacketHeader, payload []byte) (*PacketCarTelemetryData, error) {
	structSize := CarTelemetryStructSize2025
	if header.PacketFormat >= PacketFormat2026 {
		structSize = CarTelemetryStructSize2026
	}

	cars, err := DecodePerCarCustom[CarTelemetryData](payload, header, structSize, CarTelemetryTrailerSize, 0, 0, decodeCarTelemetryCar)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car telemetry: %w", err)
	}

	pkt := PacketCarTelemetryData{
		Header:           header,
		CarTelemetryData: cars,
	}

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, structSize, CarTelemetryTrailerSize)
	tailOffset := maxCars * itemSize

	if tailOffset+CarTelemetryTrailerSize <= len(payload) {
		rTail := bytes.NewReader(payload[tailOffset:])
		var trailer rawCarTelemetryTrailer
		if err := binary.Read(rTail, binary.LittleEndian, &trailer); err == nil {
			pkt.MFDPanelIndex = trailer.MFDPanelIndex
			pkt.MFDPanelIndexSecondaryPlayer = trailer.MFDPanelIndexSecondaryPlayer
			pkt.SuggestedGear = trailer.SuggestedGear
		}
	}

	return &pkt, nil
}
