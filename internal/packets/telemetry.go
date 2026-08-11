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
	itemSize := InferredItemSize(payload, header, 59, 3)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+59 > len(payload) {
			break
		}

		carBytes := payload[offset : offset+itemSize]
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

		var pressOffset, surfOffset int
		if itemSize == 59 {
			c.EngineTemperature = uint16(carBytes[38])
			pressOffset = 39
			surfOffset = 55
		} else {
			c.EngineTemperature = binary.LittleEndian.Uint16(carBytes[38:40])
			pressOffset = 40
			surfOffset = 56
		}

		for p := 0; p < 4; p++ {
			if pressOffset+(p+1)*4 <= len(carBytes) {
				c.TyresPressure[p] = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[pressOffset+p*4 : pressOffset+(p+1)*4]))
			}
		}
		if surfOffset+4 <= len(carBytes) {
			copy(c.SurfaceType[:], carBytes[surfOffset:surfOffset+4])
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
