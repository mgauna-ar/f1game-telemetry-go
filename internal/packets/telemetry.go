package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
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

func decodeCarTelemetryCar(carBytes []byte, is2026 bool) (CarTelemetryData, error) {
	var c CarTelemetryData
	c.Speed = binary.LittleEndian.Uint16(carBytes[0:2])
	c.Throttle = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[2:6]))
	c.Steer = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[6:10]))
	c.Brake = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[10:14]))
	c.Clutch = carBytes[14]
	c.Gear = int8(carBytes[15])
	c.EngineRPM = binary.LittleEndian.Uint16(carBytes[16:18])
	c.DRS = carBytes[18]
	c.RevLightsPercent = carBytes[19]
	c.RevLightsBitValue = binary.LittleEndian.Uint16(carBytes[20:22])

	for b := 0; b < 4; b++ {
		c.BrakesTemperature[b] = binary.LittleEndian.Uint16(carBytes[22+b*2 : 24+b*2])
	}
	copy(c.TyresSurfaceTemperature[:], carBytes[30:34])
	copy(c.TyresInnerTemperature[:], carBytes[34:38])

	if is2026 {
		c.EngineTemperature = uint16(carBytes[38])
		for p := 0; p < 4; p++ {
			c.TyresPressure[p] = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[39+p*4 : 43+p*4]))
		}
		copy(c.SurfaceType[:], carBytes[55:59])
	} else {
		c.EngineTemperature = binary.LittleEndian.Uint16(carBytes[38:40])
		for p := 0; p < 4; p++ {
			c.TyresPressure[p] = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[40+p*4 : 44+p*4]))
		}
		copy(c.SurfaceType[:], carBytes[56:60])
	}

	return c, nil
}

// DecodeCarTelemetry decodes a PacketCarTelemetryData from raw bytes (supporting both 2025 and 2026 formats).
func DecodeCarTelemetry(data []byte) (*PacketCarTelemetryData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car telemetry: %w", err)
	}

	payload := data[headerLen:]
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

	if tailOffset < len(payload) {
		rTail := bytes.NewReader(payload[tailOffset:])
		if rTail.Len() >= 1 {
			_ = binary.Read(rTail, binary.LittleEndian, &pkt.MFDPanelIndex)
		}
		if rTail.Len() >= 1 {
			_ = binary.Read(rTail, binary.LittleEndian, &pkt.MFDPanelIndexSecondaryPlayer)
		}
		if rTail.Len() >= 1 {
			_ = binary.Read(rTail, binary.LittleEndian, &pkt.SuggestedGear)
		}
	}

	return &pkt, nil
}
