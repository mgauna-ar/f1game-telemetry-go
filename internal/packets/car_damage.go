package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarDamageData contains damage data for a single car.
type CarDamageData struct {
	TyresWear            [4]float32
	TyresDamage          [4]uint8
	BrakesDamage         [4]uint8
	FrontLeftWingDamage  uint8
	FrontRightWingDamage uint8
	RearWingDamage       uint8
	FloorDamage          uint8
	DiffuserDamage       uint8
	SidepodDamage        uint8
	DRSFault             uint8
	ERSFault             uint8
	GearBoxDamage        uint8
	EngineDamage         uint8
	EngineMGUHWear       uint8
	EngineESWear         uint8
	EngineCEWear         uint8
	EngineICEWear        uint8
	EngineMGUKWear       uint8
	EngineTCWear         uint8
	EngineBlown          uint8
	EngineSeized         uint8
}

// PacketCarDamageData contains car damage data for all cars. Packet ID: 10.
type PacketCarDamageData struct {
	Header        PacketHeader
	CarDamageData [MaxCars]CarDamageData
}

func (p PacketCarDamageData) GetHeader() PacketHeader { return p.Header }

const CarDamageStructSize = 42

// DecodeCarDamage decodes a PacketCarDamageData from raw bytes.
func DecodeCarDamage(data []byte) (*PacketCarDamageData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car damage: %w", err)
	}

	var pkt PacketCarDamageData
	pkt.Header = header

	payload := data[headerLen:]
	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := InferredItemSize(payload, header, CarDamageStructSize, 0)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+CarDamageStructSize > len(payload) {
			break
		}
		r := bytes.NewReader(payload[offset : offset+CarDamageStructSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.CarDamageData[i]); err != nil {
			return nil, fmt.Errorf("failed to decode car damage for car %d: %w", i, err)
		}
	}

	return &pkt, nil
}
