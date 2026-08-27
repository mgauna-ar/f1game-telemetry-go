package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// LapData contains lap timing data for a single car.
type LapData struct {
	LastLapTimeInMS              uint32
	CurrentLapTimeInMS           uint32
	Sector1TimeMSPart            uint16
	Sector1TimeMinutesPart       uint8
	Sector2TimeMSPart            uint16
	Sector2TimeMinutesPart       uint8
	DeltaToCarInFrontMSPart      uint16
	DeltaToCarInFrontMinutesPart uint8
	DeltaToRaceLeaderMSPart      uint16
	DeltaToRaceLeaderMinutesPart uint8
	LapDistance                  float32
	TotalDistance                float32
	SafetyCarDelta               float32
	CarPosition                  uint8
	CurrentLapNum                uint8
	PitStatus                    uint8
	NumPitStops                  uint8
	Sector                       uint8
	CurrentLapInvalid            uint8
	Penalties                    uint8
	TotalWarnings                uint8
	CornerCuttingWarnings        uint8
	NumUnservedDriveThroughPens  uint8
	NumUnservedStopGoPens        uint8
	GridPosition                 uint8
	DriverStatus                 uint8
	ResultStatus                 uint8
	PitLaneTimerActive           uint8
	PitLaneTimeInLaneInMS        uint16
	PitStopTimerInMS             uint16
	PitStopShouldServePen        uint8
	SpeedTrapFastestSpeed        float32
	SpeedTrapFastestLap          uint8
}

// PacketLapData contains lap data for all cars. Packet ID: 2.
type PacketLapData struct {
	Header               PacketHeader
	LapData              [MaxCars]LapData
	TimeTrialPBCarIdx    uint8
	TimeTrialRivalCarIdx uint8
}

func (p PacketLapData) GetHeader() PacketHeader { return p.Header }

const (
	LapDataStructSize  = 57
	LapDataTrailerSize = 2
)

// DecodeLapData decodes a PacketLapData from raw bytes.
func DecodeLapData(data []byte) (*PacketLapData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in lap data: %w", err)
	}

	payload := data[headerLen:]
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
