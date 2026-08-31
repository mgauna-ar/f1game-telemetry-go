package packets

import (
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

// DecodeCarDamage decodes a PacketCarDamageData from header and payload bytes.
func DecodeCarDamage(header PacketHeader, payload []byte) (*PacketCarDamageData, error) {
	cars, err := DecodePerCarBinary[CarDamageData](payload, header, CarDamageStructSize, 0, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car damage: %w", err)
	}

	return &PacketCarDamageData{
		Header:        header,
		CarDamageData: cars,
	}, nil
}
