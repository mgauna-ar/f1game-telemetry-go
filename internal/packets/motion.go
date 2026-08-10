package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarMotionData contains motion data for a single car.
type CarMotionData struct {
	WorldPositionX     float32
	WorldPositionY     float32
	WorldPositionZ     float32
	WorldVelocityX     float32
	WorldVelocityY     float32
	WorldVelocityZ     float32
	WorldForwardDirX   int16
	WorldForwardDirY   int16
	WorldForwardDirZ   int16
	WorldRightDirX     int16
	WorldRightDirY     int16
	WorldRightDirZ     int16
	GForceLateral      float32
	GForceVertical     float32
	GForceLongitudinal float32
	Yaw                float32
	Pitch              float32
	Roll               float32
}

// PacketMotionData contains motion data for all cars. Packet ID: 0.
type PacketMotionData struct {
	Header        PacketHeader
	CarMotionData [MaxCars]CarMotionData
}

func (p PacketMotionData) GetHeader() PacketHeader { return p.Header }

// DecodeMotion decodes a PacketMotionData from raw bytes.
func DecodeMotion(data []byte) (*PacketMotionData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in motion: %w", err)
	}

	var pkt PacketMotionData
	pkt.Header = header

	payload := data[headerLen:]
	r := bytes.NewReader(payload)

	if err := binary.Read(r, binary.LittleEndian, &pkt.CarMotionData); err != nil {
		return nil, fmt.Errorf("failed to decode motion payload: %w", err)
	}

	return &pkt, nil
}
