package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarSetupData contains setup data for a single car.
type CarSetupData struct {
	FrontWing             uint8
	RearWing              uint8
	OnThrottle            uint8
	OffThrottle           uint8
	FrontCamber           float32
	RearCamber            float32
	FrontToe              float32
	RearToe               float32
	FrontSuspension       uint8
	RearSuspension        uint8
	FrontAntiRollBar      uint8
	RearAntiRollBar       uint8
	FrontSuspensionHeight uint8
	RearSuspensionHeight  uint8
	BrakePressure         uint8
	BrakeBias             uint8
	FrontTyrePressure     float32
	RearTyrePressure      float32
	Ballast               uint8
	FuelLoad              float32
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
	var pkt PacketCarSetupData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car setup packet: %w", err)
	}
	return &pkt, nil
}
