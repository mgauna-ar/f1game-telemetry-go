package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarDamageData contains damage data for a single car.
type CarDamageData struct {
	TyresWear            [4]float32 `json:"TyresWear"`
	TyresDamage          [4]uint8   `json:"TyresDamage"`
	BrakesDamage         [4]uint8   `json:"BrakesDamage"`
	TyreBlisters         [4]uint8   `json:"TyreBlisters"`
	FrontLeftWingDamage  uint8      `json:"FrontLeftWingDamage"`
	FrontRightWingDamage uint8      `json:"FrontRightWingDamage"`
	RearWingDamage       uint8      `json:"RearWingDamage"`
	FloorDamage          uint8      `json:"FloorDamage"`
	DiffuserDamage       uint8      `json:"DiffuserDamage"`
	SidepodDamage        uint8      `json:"SidepodDamage"`
	DRSFault             uint8      `json:"DRSFault"`
	ERSFault             uint8      `json:"ERSFault"`
	GearBoxDamage        uint8      `json:"GearBoxDamage"`
	EngineDamage         uint8      `json:"EngineDamage"`
	EngineMGUHWear       uint8      `json:"EngineMGUHWear"`
	EngineESWear         uint8      `json:"EngineESWear"`
	EngineCEWear         uint8      `json:"EngineCEWear"`
	EngineICEWear        uint8      `json:"EngineICEWear"`
	EngineMGUKWear       uint8      `json:"EngineMGUKWear"`
	EngineTCWear         uint8      `json:"EngineTCWear"`
	EngineBlown          uint8      `json:"EngineBlown"`
	EngineSeized         uint8      `json:"EngineSeized"`
}

// PacketCarDamageData contains car damage data for all cars. Packet ID: 10.
type PacketCarDamageData struct {
	Header        PacketHeader           `json:"Header"`
	CarDamageData [MaxCars]CarDamageData `json:"CarDamageData"`
}

func (p PacketCarDamageData) GetHeader() PacketHeader { return p.Header }

const CarDamageStructSize = 46

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
	itemSize := PerCarItemSize(payload, header, CarDamageStructSize, 0)

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
