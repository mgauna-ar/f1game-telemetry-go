package packets

import (
	"encoding/binary"
	"fmt"
	"math"
)

// CarSetupData contains setup data for a single car.
type CarSetupData struct {
	FrontWing              uint8   `json:"FrontWing"`
	RearWing               uint8   `json:"RearWing"`
	OnThrottle             uint8   `json:"OnThrottle"`
	OffThrottle            uint8   `json:"OffThrottle"`
	FrontCamber            float32 `json:"FrontCamber"`
	RearCamber             float32 `json:"RearCamber"`
	FrontToe               float32 `json:"FrontToe"`
	RearToe                float32 `json:"RearToe"`
	FrontSuspension        uint8   `json:"FrontSuspension"`
	RearSuspension         uint8   `json:"RearSuspension"`
	FrontAntiRollBar       uint8   `json:"FrontAntiRollBar"`
	RearAntiRollBar        uint8   `json:"RearAntiRollBar"`
	FrontSuspensionHeight  uint8   `json:"FrontSuspensionHeight"`
	RearSuspensionHeight   uint8   `json:"RearSuspensionHeight"`
	BrakePressure          uint8   `json:"BrakePressure"`
	BrakeBias              uint8   `json:"BrakeBias"`
	EngineBraking          uint8   `json:"EngineBraking"`
	RearLeftTyrePressure   float32 `json:"RearLeftTyrePressure"`
	RearRightTyrePressure  float32 `json:"RearRightTyrePressure"`
	FrontLeftTyrePressure  float32 `json:"FrontLeftTyrePressure"`
	FrontRightTyrePressure float32 `json:"FrontRightTyrePressure"`
	Ballast                uint8   `json:"Ballast"`
	FuelLoad               float32 `json:"FuelLoad"`
}

// PacketCarSetupData contains car setup data for all cars. Packet ID: 5.
type PacketCarSetupData struct {
	Header             PacketHeader          `json:"Header"`
	CarSetupData       [MaxCars]CarSetupData `json:"CarSetupData"`
	NextFrontWingValue float32               `json:"NextFrontWingValue"`
}

func (p PacketCarSetupData) GetHeader() PacketHeader { return p.Header }

const (
	CarSetupStructSize  = 50
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
	itemSize := PerCarItemSize(payload, header, CarSetupStructSize, CarSetupTrailerSize)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+CarSetupStructSize > len(payload) {
			break
		}

		carBytes := payload[offset : offset+CarSetupStructSize]
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
		cs.EngineBraking = carBytes[28]
		cs.RearLeftTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[29:33]))
		cs.RearRightTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[33:37]))
		cs.FrontLeftTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[37:41]))
		cs.FrontRightTyrePressure = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[41:45]))
		cs.Ballast = carBytes[45]
		cs.FuelLoad = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[46:50]))

		pkt.CarSetupData[i] = cs
	}

	tailOffset := maxCars * itemSize
	if tailOffset+CarSetupTrailerSize <= len(payload) {
		pkt.NextFrontWingValue = math.Float32frombits(binary.LittleEndian.Uint32(payload[tailOffset : tailOffset+4]))
	}

	return &pkt, nil
}
