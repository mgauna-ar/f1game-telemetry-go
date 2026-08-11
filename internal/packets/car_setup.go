package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
)

// CarSetupData contains setup data for a single car.
type CarSetupData struct {
	FrontWing              uint8
	RearWing               uint8
	OnThrottle             uint8
	OffThrottle            uint8
	FrontCamber            float32
	RearCamber             float32
	FrontToe               float32
	RearToe                float32
	FrontSuspension        uint8
	RearSuspension         uint8
	FrontAntiRollBar       uint8
	RearAntiRollBar        uint8
	FrontSuspensionHeight  uint8
	RearSuspensionHeight   uint8
	BrakePressure          uint8
	BrakeBias              uint8
	RearLeftTyrePressure   float32
	RearRightTyrePressure  float32
	FrontLeftTyrePressure  float32
	FrontRightTyrePressure float32
	Ballast                uint8
	FuelLoad               float32
}

// PacketCarSetupData contains car setup data for all cars. Packet ID: 5.
type PacketCarSetupData struct {
	Header             PacketHeader
	CarSetupData       [MaxCars]CarSetupData
	NextFrontWingValue float32
}

func (p PacketCarSetupData) GetHeader() PacketHeader { return p.Header }

const (
	CarSetupStructSize  = 49
	CarSetupTrailerSize = 4
)

// DecodeCarSetup decodes a PacketCarSetupData from raw bytes.
func DecodeCarSetup(data []byte) (*PacketCarSetupData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car setup: %w", err)
	}

	var pkt PacketCarSetupData
	pkt.Header = header

	payload := data[headerLen:]

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := InferredItemSize(payload, header, CarSetupStructSize, CarSetupTrailerSize)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+CarSetupStructSize > len(payload) {
			break
		}

		carBytes := payload[offset : offset+itemSize]
		var cs CarSetupData

		cs.FrontWing = carBytes[0]
		cs.RearWing = carBytes[1]
		cs.OnThrottle = carBytes[2]
		cs.OffThrottle = carBytes[3]
		cs.FrontCamber = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[4:8]))
		cs.RearCamber = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[8:12]))
		cs.FrontToe = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[12:16]))
		cs.RearToe = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[16:20]))
		cs.FrontSuspension = carBytes[20]
		cs.RearSuspension = carBytes[21]
		cs.FrontAntiRollBar = carBytes[22]
		cs.RearAntiRollBar = carBytes[23]
		cs.FrontSuspensionHeight = carBytes[24]
		cs.RearSuspensionHeight = carBytes[25]
		cs.BrakePressure = carBytes[26]
		cs.BrakeBias = carBytes[27]

		if len(carBytes) >= 44 {
			cs.RearLeftTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[28:32]))
			cs.RearRightTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[32:36]))
			cs.FrontLeftTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[36:40]))
			cs.FrontRightTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[40:44]))
		}

		ballastOffset := 44
		fuelOffset := 45
		if itemSize >= 50 && len(carBytes) >= 50 {
			ballastOffset = 45
			fuelOffset = 46
		}

		if ballastOffset < len(carBytes) {
			cs.Ballast = carBytes[ballastOffset]
		}
		if fuelOffset+4 <= len(carBytes) {
			cs.FuelLoad = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[fuelOffset : fuelOffset+4]))
		}

		pkt.CarSetupData[i] = cs
	}

	tailOffset := maxCars * itemSize
	if tailOffset+4 <= len(payload) {
		rTail := bytes.NewReader(payload[tailOffset:])
		_ = binary.Read(rTail, binary.LittleEndian, &pkt.NextFrontWingValue)
	}

	return &pkt, nil
}
