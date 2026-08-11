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

// DecodeLapData decodes a PacketLapData from raw bytes.
func DecodeLapData(data []byte) (*PacketLapData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in lap data: %w", err)
	}

	var pkt PacketLapData
	pkt.Header = header

	payload := data[headerLen:]
	r := bytes.NewReader(payload)

	if err := binary.Read(r, binary.LittleEndian, &pkt.LapData); err != nil {
		return nil, fmt.Errorf("failed to decode lap data payload: %w", err)
	}

	if r.Len() >= 1 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.TimeTrialPBCarIdx)
	}
	if r.Len() >= 1 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.TimeTrialRivalCarIdx)
	}

	return &pkt, nil
}
