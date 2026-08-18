package packets

import (
	"encoding/binary"
	"fmt"
	"math"
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

// DecodeCarStatus decodes a PacketCarStatusData from raw bytes (supporting both 2025 and 2026 formats).
func DecodeCarStatus(data []byte) (*PacketCarStatusData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in car status: %w", err)
	}

	var pkt PacketCarStatusData
	pkt.Header = header

	payload := data[headerLen:]
	is2026 := header.PacketFormat >= PacketFormat2026
	maxCars := MaxCarsForFormat(header.PacketFormat)
	structSize := CarStatusStructSize2025
	if is2026 {
		structSize = CarStatusStructSize2026
	}

	itemSize := PerCarItemSize(payload, header, structSize, 0)

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+structSize > len(payload) {
			break
		}

		carBytes := payload[offset : offset+structSize]
		var cs CarStatusData

		cs.TractionControl = carBytes[0]
		cs.AntiLockBrakes = carBytes[1]
		cs.FuelMix = carBytes[2]
		cs.FrontBrakeBias = carBytes[3]
		cs.PitLimiterStatus = carBytes[4]
		cs.FuelInTank = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[5:9]))
		cs.FuelCapacity = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[9:13]))
		cs.FuelRemainingLaps = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[13:17]))
		cs.MaxRPM = binary.LittleEndian.Uint16(carBytes[17:19])
		cs.IdleRPM = binary.LittleEndian.Uint16(carBytes[19:21])
		cs.MaxGears = carBytes[21]
		cs.DRSAllowed = carBytes[22]
		cs.DRSActivationDistance = binary.LittleEndian.Uint16(carBytes[23:25])
		cs.ActualTyreCompound = carBytes[25]
		cs.VisualTyreCompound = carBytes[26]
		cs.TyresAgeLaps = carBytes[27]
		cs.VehicleFIAFlags = int8(carBytes[28])
		cs.EnginePowerICE = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[29:33]))
		cs.EnginePowerMGUK = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[33:37]))
		cs.ERSStoreEnergy = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[37:41]))
		cs.ERSDeployMode = carBytes[41]
		cs.ERSHarvestedThisLapMGUK = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[42:46]))
		cs.ERSHarvestedThisLapMGUH = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[46:50]))

		if is2026 {
			cs.ERSHarvestLimitPerLap = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[50:54]))
			cs.ERSDeployedThisLap = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[54:58]))
			cs.NetworkPaused = carBytes[58]
		} else {
			cs.ERSDeployedThisLap = math.Float32frombits(binary.LittleEndian.Uint32(carBytes[50:54]))
			cs.NetworkPaused = carBytes[54]
		}

		pkt.CarStatusData[i] = cs
	}

	return &pkt, nil
}
