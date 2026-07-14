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

// DecodeCarDamage decodes a PacketCarDamageData from raw bytes.
func DecodeCarDamage(data []byte) (*PacketCarDamageData, error) {
	var pkt PacketCarDamageData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car damage packet: %w", err)
	}
	return &pkt, nil
}
