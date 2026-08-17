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

const (
	CarTelemetryStructSize  = 60
	CarTelemetryTrailerSize = 3

	OffsetTelemetrySpeed             = 0
	OffsetTelemetryThrottle          = 2
	OffsetTelemetrySteer             = 6
	OffsetTelemetryBrake             = 10
	OffsetTelemetryClutch            = 14
	OffsetTelemetryGear              = 15
	OffsetTelemetryEngineRPM         = 16
	OffsetTelemetryDRS               = 18
	OffsetTelemetryRevLightsPercent  = 19
	OffsetTelemetryRevLightsBitValue = 20
	OffsetTelemetryBrakesTemp        = 22
	OffsetTelemetryTyresSurfaceTemp  = 30
	OffsetTelemetryTyresInnerTemp    = 34
	OffsetTelemetryEngineTemp        = 38
	OffsetTelemetryPressures         = 40
	OffsetTelemetrySurfaceType       = 56
)

// DecodeCarTelemetry decodes a PacketCarTelemetryData from raw bytes.
func DecodeCarTelemetry(data []byte) (*PacketCarTelemetryData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car telemetry: %w", err)
	}

	var pkt PacketCarTelemetryData
	pkt.Header = header

	payload := data[headerLen:]
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, CarTelemetryStructSize, CarTelemetryTrailerSize)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+CarTelemetryStructSize > len(payload) {
			break
		}

		carBytes := payload[offset : offset+itemSize]
		var c CarTelemetryData

		c.Speed = binary.LittleEndian.Uint16(carBytes[OffsetTelemetrySpeed : OffsetTelemetrySpeed+2])
		c.Throttle = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[OffsetTelemetryThrottle : OffsetTelemetryThrottle+4]))
		c.Steer = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[OffsetTelemetrySteer : OffsetTelemetrySteer+4]))
		c.Brake = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[OffsetTelemetryBrake : OffsetTelemetryBrake+4]))
		c.Clutch = carBytes[OffsetTelemetryClutch]
		c.Gear = int8(carBytes[OffsetTelemetryGear])
		c.EngineRPM = binary.LittleEndian.Uint16(carBytes[OffsetTelemetryEngineRPM : OffsetTelemetryEngineRPM+2])
		c.DRS = carBytes[OffsetTelemetryDRS]
		c.RevLightsPercent = carBytes[OffsetTelemetryRevLightsPercent]
		c.RevLightsBitValue = binary.LittleEndian.Uint16(carBytes[OffsetTelemetryRevLightsBitValue : OffsetTelemetryRevLightsBitValue+2])

		for b := 0; b < 4; b++ {
			c.BrakesTemperature[b] = binary.LittleEndian.Uint16(carBytes[OffsetTelemetryBrakesTemp+b*2 : OffsetTelemetryBrakesTemp+2+b*2])
		}
		copy(c.TyresSurfaceTemperature[:], carBytes[OffsetTelemetryTyresSurfaceTemp:OffsetTelemetryTyresSurfaceTemp+4])
		copy(c.TyresInnerTemperature[:], carBytes[OffsetTelemetryTyresInnerTemp:OffsetTelemetryTyresInnerTemp+4])

		c.EngineTemperature = binary.LittleEndian.Uint16(carBytes[OffsetTelemetryEngineTemp : OffsetTelemetryEngineTemp+2])
		for p := 0; p < 4; p++ {
			if OffsetTelemetryPressures+(p+1)*4 <= len(carBytes) {
				c.TyresPressure[p] = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[OffsetTelemetryPressures+p*4 : OffsetTelemetryPressures+(p+1)*4]))
			}
		}
		if OffsetTelemetrySurfaceType+4 <= len(carBytes) {
			copy(c.SurfaceType[:], carBytes[OffsetTelemetrySurfaceType:OffsetTelemetrySurfaceType+4])
		}

		pkt.CarTelemetryData[i] = c
	}

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
