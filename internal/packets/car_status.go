package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// CarStatusData contains status data for a single car.
type CarStatusData struct {
	TractionControl         uint8   `json:"TractionControl"`
	AntiLockBrakes          uint8   `json:"AntiLockBrakes"`
	FuelMix                 uint8   `json:"FuelMix"`
	FrontBrakeBias          uint8   `json:"FrontBrakeBias"`
	PitLimiterStatus        uint8   `json:"PitLimiterStatus"`
	FuelInTank              float32 `json:"FuelInTank"`
	FuelCapacity            float32 `json:"FuelCapacity"`
	FuelRemainingLaps       float32 `json:"FuelRemainingLaps"`
	MaxRPM                  uint16  `json:"MaxRPM"`
	IdleRPM                 uint16  `json:"IdleRPM"`
	MaxGears                uint8   `json:"MaxGears"`
	DRSAllowed              uint8   `json:"DRSAllowed"`
	DRSActivationDistance   uint16  `json:"DRSActivationDistance"`
	ActualTyreCompound      uint8   `json:"ActualTyreCompound"`
	VisualTyreCompound      uint8   `json:"VisualTyreCompound"`
	TyresAgeLaps            uint8   `json:"TyresAgeLaps"`
	VehicleFIAFlags         int8    `json:"VehicleFIAFlags"`
	EnginePowerICE          float32 `json:"EnginePowerICE"`
	EnginePowerMGUK         float32 `json:"EnginePowerMGUK"`
	ERSStoreEnergy          float32 `json:"ERSStoreEnergy"`
	ERSDeployMode           uint8   `json:"ERSDeployMode"`
	ERSHarvestedThisLapMGUK float32 `json:"ERSHarvestedThisLapMGUK"`
	ERSHarvestedThisLapMGUH float32 `json:"ERSHarvestedThisLapMGUH"`
	ERSHarvestLimitPerLap   float32 `json:"ERSHarvestLimitPerLap"`
	ERSDeployedThisLap      float32 `json:"ERSDeployedThisLap"`
	NetworkPaused           uint8   `json:"NetworkPaused"`
}

// PacketCarStatusData contains car status data for all cars. Packet ID: 7.
type PacketCarStatusData struct {
	Header        PacketHeader           `json:"Header"`
	CarStatusData [MaxCars]CarStatusData `json:"CarStatusData"`
}

func (p PacketCarStatusData) GetHeader() PacketHeader { return p.Header }

const (
	CarStatusStructSize2025 = 55
	CarStatusStructSize2026 = 59
)

type rawCarStatus2025 struct {
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

type rawCarStatus2026 struct {
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
	ERSHarvestLimitPerLap   float32
	ERSDeployedThisLap      float32
	NetworkPaused           uint8
}

func decodeCarStatusCar(carBytes []byte, is2026 bool) (CarStatusData, error) {
	r := bytes.NewReader(carBytes)
	if is2026 {
		var raw rawCarStatus2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return CarStatusData{}, err
		}
		return CarStatusData(raw), nil
	}

	var raw rawCarStatus2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return CarStatusData{}, err
	}
	return CarStatusData{
		TractionControl:         raw.TractionControl,
		AntiLockBrakes:          raw.AntiLockBrakes,
		FuelMix:                 raw.FuelMix,
		FrontBrakeBias:          raw.FrontBrakeBias,
		PitLimiterStatus:        raw.PitLimiterStatus,
		FuelInTank:              raw.FuelInTank,
		FuelCapacity:            raw.FuelCapacity,
		FuelRemainingLaps:       raw.FuelRemainingLaps,
		MaxRPM:                  raw.MaxRPM,
		IdleRPM:                 raw.IdleRPM,
		MaxGears:                raw.MaxGears,
		DRSAllowed:              raw.DRSAllowed,
		DRSActivationDistance:   raw.DRSActivationDistance,
		ActualTyreCompound:      raw.ActualTyreCompound,
		VisualTyreCompound:      raw.VisualTyreCompound,
		TyresAgeLaps:            raw.TyresAgeLaps,
		VehicleFIAFlags:         raw.VehicleFIAFlags,
		EnginePowerICE:          raw.EnginePowerICE,
		EnginePowerMGUK:         raw.EnginePowerMGUK,
		ERSStoreEnergy:          raw.ERSStoreEnergy,
		ERSDeployMode:           raw.ERSDeployMode,
		ERSHarvestedThisLapMGUK: raw.ERSHarvestedThisLapMGUK,
		ERSHarvestedThisLapMGUH: raw.ERSHarvestedThisLapMGUH,
		ERSDeployedThisLap:      raw.ERSDeployedThisLap,
		NetworkPaused:           raw.NetworkPaused,
	}, nil
}

// DecodeCarStatus decodes a PacketCarStatusData from header and payload bytes (supporting both 2025 and 2026 formats).
func DecodeCarStatus(header PacketHeader, payload []byte) (*PacketCarStatusData, error) {
	structSize := CarStatusStructSize2025
	if header.PacketFormat >= PacketFormat2026 {
		structSize = CarStatusStructSize2026
	}

	cars, err := DecodePerCarCustom[CarStatusData](payload, header, structSize, 0, 0, 0, decodeCarStatusCar)
	if err != nil {
		return nil, fmt.Errorf("failed to decode car status: %w", err)
	}

	return &PacketCarStatusData{
		Header:        header,
		CarStatusData: cars,
	}, nil
}
