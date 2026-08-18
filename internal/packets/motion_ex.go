package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// PacketMotionExData contains extended motion data for the player's car. Packet ID: 13.
type PacketMotionExData struct {
	Header                 PacketHeader `json:"Header"`
	SuspensionPosition     [4]float32   `json:"SuspensionPosition"`
	SuspensionVelocity     [4]float32   `json:"SuspensionVelocity"`
	SuspensionAcceleration [4]float32   `json:"SuspensionAcceleration"`
	WheelSpeed             [4]float32   `json:"WheelSpeed"`
	WheelSlipRatio         [4]float32   `json:"WheelSlipRatio"`
	WheelSlipAngle         [4]float32   `json:"WheelSlipAngle"`
	WheelLatForce          [4]float32   `json:"WheelLatForce"`
	WheelLongForce         [4]float32   `json:"WheelLongForce"`
	HeightOfCOGAboveGround float32      `json:"HeightOfCOGAboveGround"`
	LocalVelocityX         float32      `json:"LocalVelocityX"`
	LocalVelocityY         float32      `json:"LocalVelocityY"`
	LocalVelocityZ         float32      `json:"LocalVelocityZ"`
	AngularVelocityX       float32      `json:"AngularVelocityX"`
	AngularVelocityY       float32      `json:"AngularVelocityY"`
	AngularVelocityZ       float32      `json:"AngularVelocityZ"`
	AngularAccelerationX   float32      `json:"AngularAccelerationX"`
	AngularAccelerationY   float32      `json:"AngularAccelerationY"`
	AngularAccelerationZ   float32      `json:"AngularAccelerationZ"`
	FrontWheelsAngle       float32      `json:"FrontWheelsAngle"`
	WheelVertForce         [4]float32   `json:"WheelVertForce"`
	FrontAeroHeight        float32      `json:"FrontAeroHeight"`
	RearAeroHeight         float32      `json:"RearAeroHeight"`
	FrontRollAngle         float32      `json:"FrontRollAngle"`
	RearRollAngle          float32      `json:"RearRollAngle"`
	ChassisYaw             float32      `json:"ChassisYaw"`
	ChassisPitch           float32      `json:"ChassisPitch"`
	WheelCamber            [4]float32   `json:"WheelCamber"`
	WheelCamberGain        [4]float32   `json:"WheelCamberGain"`
}

func (p PacketMotionExData) GetHeader() PacketHeader { return p.Header }

const MotionExStructSize = 244

// DecodeMotionEx decodes a PacketMotionExData from raw bytes.
func DecodeMotionEx(data []byte) (*PacketMotionExData, error) {
	var pkt PacketMotionExData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode motion ex packet: %w", err)
	}
	return &pkt, nil
}
