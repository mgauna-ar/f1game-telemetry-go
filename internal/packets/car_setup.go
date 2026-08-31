package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
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

// DecodeCarSetup decodes a PacketCarSetupData from header and payload bytes.
func DecodeCarSetup(header PacketHeader, payload []byte) (*PacketCarSetupData, error) {
	cars, err := DecodePerCarBinary[CarSetupData](payload, header, CarSetupStructSize, CarSetupTrailerSize, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car setup: %w", err)
	}

	pkt := PacketCarSetupData{
		Header:       header,
		CarSetupData: cars,
	}

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, CarSetupStructSize, CarSetupTrailerSize)
	tailOffset := maxCars * itemSize

	if tailOffset+CarSetupTrailerSize <= len(payload) {
		r := bytes.NewReader(payload[tailOffset : tailOffset+CarSetupTrailerSize])
		_ = binary.Read(r, binary.LittleEndian, &pkt.NextFrontWingValue)
	}

	return &pkt, nil
}
