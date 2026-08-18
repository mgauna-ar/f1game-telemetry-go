package packets

import (
	"encoding/binary"
	"fmt"
	"math"
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

// DecodeMotion decodes a PacketMotionData from raw bytes (supporting both 2025 and 2026 formats).
func DecodeMotion(data []byte) (*PacketMotionData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in motion: %w", err)
	}

	var pkt PacketMotionData
	pkt.Header = header

	payload := data[headerLen:]
	is2026 := header.PacketFormat >= PacketFormat2026
	maxCars := MaxCarsForFormat(header.PacketFormat)
	structSize := CarMotionStructSize2025
	if is2026 {
		structSize = CarMotionStructSize2026
	}

	itemSize := PerCarItemSize(payload, header, structSize, 0)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+structSize > len(payload) {
			break
		}
		carBytes := payload[offset : offset+structSize]
		var cmd CarMotionData

		cmd.WorldPositionX = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[0:4]))
		cmd.WorldPositionY = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[4:8]))
		cmd.WorldPositionZ = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[8:12]))
		cmd.WorldVelocityX = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[12:16]))
		cmd.WorldVelocityY = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[16:20]))
		cmd.WorldVelocityZ = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[20:24]))
		cmd.WorldForwardDirX = int16(binary.LittleEndian.Uint16(carBytes[24:26]))
		cmd.WorldForwardDirY = int16(binary.LittleEndian.Uint16(carBytes[26:28]))
		cmd.WorldForwardDirZ = int16(binary.LittleEndian.Uint16(carBytes[28:30]))
		cmd.WorldRightDirX = int16(binary.LittleEndian.Uint16(carBytes[30:32]))
		cmd.WorldRightDirY = int16(binary.LittleEndian.Uint16(carBytes[32:34]))
		cmd.WorldRightDirZ = int16(binary.LittleEndian.Uint16(carBytes[34:36]))

		if is2026 {
			// In F1 2026: G-forces are int16 (quantised), divide by 1000.0f
			lat := int16(binary.LittleEndian.Uint16(carBytes[36:38]))
			long := int16(binary.LittleEndian.Uint16(carBytes[38:40]))
			vert := int16(binary.LittleEndian.Uint16(carBytes[40:42]))
			cmd.GForceLateral = float32(lat) / 1000.0
			cmd.GForceLongitudinal = float32(long) / 1000.0
			cmd.GForceVertical = float32(vert) / 1000.0

			cmd.Yaw = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[42:46]))
			cmd.Pitch = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[46:50]))
			cmd.Roll = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[50:54]))
		} else {
			// In F1 2025: G-forces are float32
			cmd.GForceLateral = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[36:40]))
			cmd.GForceLongitudinal = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[40:44]))
			cmd.GForceVertical = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[44:48]))

			cmd.Yaw = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[48:52]))
			cmd.Pitch = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[52:56]))
			cmd.Roll = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[56:60]))
		}

		pkt.CarMotionData[i] = cmd
	}

	return &pkt, nil
}
