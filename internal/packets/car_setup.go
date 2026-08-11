package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
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

// DecodeCarSetup decodes a PacketCarSetupData from raw bytes.
func DecodeCarSetup(data []byte) (*PacketCarSetupData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car setup: %w", err)
	}

	var pkt PacketCarSetupData
	pkt.Header = header

	payload := data[headerLen:]

	const structSize = 49
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := InferredItemSize(payload, header, structSize, 4)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+structSize > len(payload) {
			break
		}
		r := bytes.NewReader(payload[offset : offset+structSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.CarSetupData[i]); err != nil {
			return nil, fmt.Errorf("failed to decode car setup for car %d: %w", i, err)
		}
	}

	tailOffset := maxCars * itemSize
	if tailOffset+4 <= len(payload) {
		rTail := bytes.NewReader(payload[tailOffset:])
		_ = binary.Read(rTail, binary.LittleEndian, &pkt.NextFrontWingValue)
	}

	return &pkt, nil
}
