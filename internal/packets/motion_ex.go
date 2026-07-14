package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// PacketMotionExData contains extended motion data for the player's car. Packet ID: 13.
// This packet does not contain per-car arrays; it has detailed physics data for the player only.
type PacketMotionExData struct {
	Header                 PacketHeader
	SuspensionPosition     [4]float32
	SuspensionVelocity     [4]float32
	SuspensionAcceleration [4]float32
	WheelSpeed             [4]float32
	WheelSlipRatio         [4]float32
	WheelSlipAngle         [4]float32
	WheelLatForce          [4]float32
	WheelLongForce         [4]float32
	HeightOfCOGAboveGround float32
	LocalVelocityX         float32
	LocalVelocityY         float32
	LocalVelocityZ         float32
	AngularVelocityX       float32
	AngularVelocityY       float32
	AngularVelocityZ       float32
	AngularAccelerationX   float32
	AngularAccelerationY   float32
	AngularAccelerationZ   float32
	FrontWheelsAngle       float32
	WheelVertForce         [4]float32
	FrontAeroHeight        float32
	RearAeroHeight         float32
	FrontRollAngle         float32
	RearRollAngle          float32
	ChassisPitch           float32
}

func (p PacketMotionExData) GetHeader() PacketHeader { return p.Header }

// DecodeMotionEx decodes a PacketMotionExData from raw bytes.
func DecodeMotionEx(data []byte) (*PacketMotionExData, error) {
	var pkt PacketMotionExData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode motion ex packet: %w", err)
	}
	return &pkt, nil
}
