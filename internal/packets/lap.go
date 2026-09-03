package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// LapData contains lap timing data for a single car.
type LapData struct {
	LastLapTimeInMS              uint32  `json:"LastLapTimeInMS"`
	CurrentLapTimeInMS           uint32  `json:"CurrentLapTimeInMS"`
	Sector1TimeMSPart            uint16  `json:"Sector1TimeMSPart"`
	Sector1TimeMinutesPart       uint8   `json:"Sector1TimeMinutesPart"`
	Sector2TimeMSPart            uint16  `json:"Sector2TimeMSPart"`
	Sector2TimeMinutesPart       uint8   `json:"Sector2TimeMinutesPart"`
	DeltaToCarInFrontMSPart      uint16  `json:"DeltaToCarInFrontMSPart"`
	DeltaToCarInFrontMinutesPart uint8   `json:"DeltaToCarInFrontMinutesPart"`
	DeltaToRaceLeaderMSPart      uint16  `json:"DeltaToRaceLeaderMSPart"`
	DeltaToRaceLeaderMinutesPart uint8   `json:"DeltaToRaceLeaderMinutesPart"`
	LapDistance                  float32 `json:"LapDistance"`
	TotalDistance                float32 `json:"TotalDistance"`
	SafetyCarDelta               float32 `json:"SafetyCarDelta"`
	CarPosition                  uint8   `json:"CarPosition"`
	CurrentLapNum                uint8   `json:"CurrentLapNum"`
	PitStatus                    uint8   `json:"PitStatus"`
	NumPitStops                  uint8   `json:"NumPitStops"`
	Sector                       uint8   `json:"Sector"`
	CurrentLapInvalid            uint8   `json:"CurrentLapInvalid"`
	Penalties                    uint8   `json:"Penalties"`
	TotalWarnings                uint8   `json:"TotalWarnings"`
	CornerCuttingWarnings        uint8   `json:"CornerCuttingWarnings"`
	NumUnservedDriveThroughPens  uint8   `json:"NumUnservedDriveThroughPens"`
	NumUnservedStopGoPens        uint8   `json:"NumUnservedStopGoPens"`
	GridPosition                 uint8   `json:"GridPosition"`
	DriverStatus                 uint8   `json:"DriverStatus"`
	ResultStatus                 uint8   `json:"ResultStatus"`
	PitLaneTimerActive           uint8   `json:"PitLaneTimerActive"`
	PitLaneTimeInLaneInMS        uint16  `json:"PitLaneTimeInLaneInMS"`
	PitStopTimerInMS             uint16  `json:"PitStopTimerInMS"`
	PitStopShouldServePen        uint8   `json:"PitStopShouldServePen"`
	SpeedTrapFastestSpeed        float32 `json:"SpeedTrapFastestSpeed"`
	SpeedTrapFastestLap          uint8   `json:"SpeedTrapFastestLap"`
}

// PacketLapData contains lap data for all cars. Packet ID: 2.
type PacketLapData struct {
	Header               PacketHeader     `json:"Header"`
	LapData              [MaxCars]LapData `json:"LapData"`
	TimeTrialPBCarIdx    uint8            `json:"TimeTrialPBCarIdx"`
	TimeTrialRivalCarIdx uint8            `json:"TimeTrialRivalCarIdx"`
}

func (p PacketLapData) GetHeader() PacketHeader { return p.Header }

const (
	LapDataStructSize  = 57
	LapDataTrailerSize = 2
)

// DecodeLapData decodes a PacketLapData from header and payload bytes.
func DecodeLapData(header PacketHeader, payload []byte) (*PacketLapData, error) {
	if len(payload) < LapDataStructSize {
		return nil, fmt.Errorf("data too short for lap payload: got %d bytes", len(payload))
	}

	cars, err := DecodePerCarBinary[LapData](payload, header, LapDataStructSize, LapDataTrailerSize, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to decode lap data: %w", err)
	}

	pkt := PacketLapData{
		Header:  header,
		LapData: cars,
	}

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := PerCarItemSize(payload, header, LapDataStructSize, LapDataTrailerSize)
	tailOffset := maxCars * itemSize

	if tailOffset < len(payload) {
		rTail := bytes.NewReader(payload[tailOffset:])
		if rTail.Len() >= 1 {
			_ = binary.Read(rTail, binary.LittleEndian, &pkt.TimeTrialPBCarIdx)
		}
		if rTail.Len() >= 1 {
			_ = binary.Read(rTail, binary.LittleEndian, &pkt.TimeTrialRivalCarIdx)
		}
	}

	return &pkt, nil
}
