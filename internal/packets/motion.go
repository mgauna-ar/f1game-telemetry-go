package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarMotionData contains motion physics data for a single car.
type CarMotionData struct {
	WorldPositionX     float32 `json:"WorldPositionX"`
	WorldPositionY     float32 `json:"WorldPositionY"`
	WorldPositionZ     float32 `json:"WorldPositionZ"`
	WorldVelocityX     float32 `json:"WorldVelocityX"`
	WorldVelocityY     float32 `json:"WorldVelocityY"`
	WorldVelocityZ     float32 `json:"WorldVelocityZ"`
	WorldForwardDirX   int16   `json:"WorldForwardDirX"`
	WorldForwardDirY   int16   `json:"WorldForwardDirY"`
	WorldForwardDirZ   int16   `json:"WorldForwardDirZ"`
	WorldRightDirX     int16   `json:"WorldRightDirX"`
	WorldRightDirY     int16   `json:"WorldRightDirY"`
	WorldRightDirZ     int16   `json:"WorldRightDirZ"`
	GForceLateral      float32 `json:"GForceLateral"`
	GForceLongitudinal float32 `json:"GForceLongitudinal"`
	GForceVertical     float32 `json:"GForceVertical"`
	Yaw                float32 `json:"Yaw"`
	Pitch              float32 `json:"Pitch"`
	Roll               float32 `json:"Roll"`
}

// PacketMotionData contains motion data for all cars. Packet ID: 0.
type PacketMotionData struct {
	Header        PacketHeader           `json:"Header"`
	CarMotionData [MaxCars]CarMotionData `json:"CarMotionData"`
}

func (p PacketMotionData) GetHeader() PacketHeader { return p.Header }

const (
	CarMotionStructSize2025 = 60
	CarMotionStructSize2026 = 54
)

type rawMotionCar2025 struct {
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
	GForceLongitudinal float32
	GForceVertical     float32
	Yaw                float32
	Pitch              float32
	Roll               float32
}

type rawMotionCar2026 struct {
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
	GForceLateral      int16
	GForceLongitudinal int16
	GForceVertical     int16
	Yaw                float32
	Pitch              float32
	Roll               float32
}

func decodeMotionCar(carBytes []byte, is2026 bool) (CarMotionData, error) {
	r := bytes.NewReader(carBytes)
	if is2026 {
		var raw rawMotionCar2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return CarMotionData{}, err
		}
		return CarMotionData{
			WorldPositionX:     raw.WorldPositionX,
			WorldPositionY:     raw.WorldPositionY,
			WorldPositionZ:     raw.WorldPositionZ,
			WorldVelocityX:     raw.WorldVelocityX,
			WorldVelocityY:     raw.WorldVelocityY,
			WorldVelocityZ:     raw.WorldVelocityZ,
			WorldForwardDirX:   raw.WorldForwardDirX,
			WorldForwardDirY:   raw.WorldForwardDirY,
			WorldForwardDirZ:   raw.WorldForwardDirZ,
			WorldRightDirX:     raw.WorldRightDirX,
			WorldRightDirY:     raw.WorldRightDirY,
			WorldRightDirZ:     raw.WorldRightDirZ,
			GForceLateral:      float32(raw.GForceLateral) / 1000.0,
			GForceLongitudinal: float32(raw.GForceLongitudinal) / 1000.0,
			GForceVertical:     float32(raw.GForceVertical) / 1000.0,
			Yaw:                raw.Yaw,
			Pitch:              raw.Pitch,
			Roll:               raw.Roll,
		}, nil
	}

	var raw rawMotionCar2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return CarMotionData{}, err
	}
	return CarMotionData(raw), nil
}

// DecodeMotion decodes a PacketMotionData from header and payload bytes (supporting both 2025 and 2026 formats).
func DecodeMotion(header PacketHeader, payload []byte) (*PacketMotionData, error) {
	structSize := CarMotionStructSize2025
	if header.PacketFormat >= PacketFormat2026 {
		structSize = CarMotionStructSize2026
	}

	cars, err := DecodePerCarCustom[CarMotionData](payload, header, structSize, 0, 0, 0, decodeMotionCar)
	if err != nil {
		return nil, fmt.Errorf("failed to decode motion: %w", err)
	}

	return &PacketMotionData{
		Header:        header,
		CarMotionData: cars,
	}, nil
}
