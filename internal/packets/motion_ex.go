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

type rawMotionExPayload struct {
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
	ChassisYaw             float32
	ChassisPitch           float32
	WheelCamber            [4]float32
	WheelCamberGain        [4]float32
}

// DecodeMotionEx decodes a PacketMotionExData from header and payload bytes.
func DecodeMotionEx(header PacketHeader, payload []byte) (*PacketMotionExData, error) {
	var raw rawMotionExPayload
	err := binary.Read(bytes.NewReader(payload), binary.LittleEndian, &raw)
	if err != nil {
		return nil, fmt.Errorf("failed to decode motion ex packet: %w", err)
	}
	return &PacketMotionExData{
		Header:                 header,
		SuspensionPosition:     raw.SuspensionPosition,
		SuspensionVelocity:     raw.SuspensionVelocity,
		SuspensionAcceleration: raw.SuspensionAcceleration,
		WheelSpeed:             raw.WheelSpeed,
		WheelSlipRatio:         raw.WheelSlipRatio,
		WheelSlipAngle:         raw.WheelSlipAngle,
		WheelLatForce:          raw.WheelLatForce,
		WheelLongForce:         raw.WheelLongForce,
		HeightOfCOGAboveGround: raw.HeightOfCOGAboveGround,
		LocalVelocityX:         raw.LocalVelocityX,
		LocalVelocityY:         raw.LocalVelocityY,
		LocalVelocityZ:         raw.LocalVelocityZ,
		AngularVelocityX:       raw.AngularVelocityX,
		AngularVelocityY:       raw.AngularVelocityY,
		AngularVelocityZ:       raw.AngularVelocityZ,
		AngularAccelerationX:   raw.AngularAccelerationX,
		AngularAccelerationY:   raw.AngularAccelerationY,
		AngularAccelerationZ:   raw.AngularAccelerationZ,
		FrontWheelsAngle:       raw.FrontWheelsAngle,
		WheelVertForce:         raw.WheelVertForce,
		FrontAeroHeight:        raw.FrontAeroHeight,
		RearAeroHeight:         raw.RearAeroHeight,
		FrontRollAngle:         raw.FrontRollAngle,
		RearRollAngle:          raw.RearRollAngle,
		ChassisYaw:             raw.ChassisYaw,
		ChassisPitch:           raw.ChassisPitch,
		WheelCamber:            raw.WheelCamber,
		WheelCamberGain:        raw.WheelCamberGain,
	}, nil
}
