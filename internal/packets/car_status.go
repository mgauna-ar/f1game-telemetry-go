package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarStatusData contains status data for a single car.
type CarStatusData struct {
	TractionControl         uint8
	AntiLockBrakes          uint8
	FuelMix                 uint8
	FrontBrakeBias          uint8
	PitLimiterStatus        uint8
	FuelInTank              float32
	FuelCapacity            float32
	FuelRemainingLaps       float32
	MaxRPM                  uint16
	IdleRPM                 uint16
	MaxGears                uint8
	DRSAllowed              uint8
	DRSActivationDistance   uint16
	ActualTyreCompound      uint8
	VisualTyreCompound      uint8
	TyresAgeLaps            uint8
	VehicleFIAFlags         int8
	EnginePowerICE          float32
	EnginePowerMGUK         float32
	ERSStoreEnergy          float32
	ERSDeployMode           uint8
	ERSHarvestedThisLapMGUK float32
	ERSHarvestedThisLapMGUH float32
	ERSDeployedThisLap      float32
	NetworkPaused           uint8
}

// PacketCarStatusData contains car status data for all cars. Packet ID: 7.
type PacketCarStatusData struct {
	Header        PacketHeader
	CarStatusData [MaxCars]CarStatusData
}

func (p PacketCarStatusData) GetHeader() PacketHeader { return p.Header }

// DecodeCarStatus decodes a PacketCarStatusData from raw bytes.
func DecodeCarStatus(data []byte) (*PacketCarStatusData, error) {
	var pkt PacketCarStatusData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car status packet: %w", err)
	}
	return &pkt, nil
}
