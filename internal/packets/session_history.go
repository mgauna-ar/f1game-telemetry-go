package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

const (
	MaxLapHistoryEntries       = 100
	MaxTyreStintHistoryEntries = 8
)

// LapHistoryData contains lap history timing data.
type LapHistoryData struct {
	LapTimeInMS            uint32
	Sector1TimeMSPart      uint16
	Sector1TimeMinutesPart uint8
	Sector2TimeMSPart      uint16
	Sector2TimeMinutesPart uint8
	Sector3TimeMSPart      uint16
	Sector3TimeMinutesPart uint8
	LapValidBitFlags       uint8
}

// TyreStintHistoryData contains tyre stint history data.
type TyreStintHistoryData struct {
	EndLap             uint8
	TyreActualCompound uint8
	TyreVisualCompound uint8
}

// PacketSessionHistoryData contains session history for a single car. Packet ID: 11.
type PacketSessionHistoryData struct {
	Header               PacketHeader
	CarIdx               uint8
	NumLaps              uint8
	NumTyreStints        uint8
	BestLapTimeLapNum    uint8
	BestSector1LapNum    uint8
	BestSector2LapNum    uint8
	BestSector3LapNum    uint8
	LapHistoryData       [MaxLapHistoryEntries]LapHistoryData
	TyreStintHistoryData [MaxTyreStintHistoryEntries]TyreStintHistoryData
}

func (p PacketSessionHistoryData) GetHeader() PacketHeader { return p.Header }

type rawSessionHistoryPayload struct {
	CarIdx               uint8
	NumLaps              uint8
	NumTyreStints        uint8
	BestLapTimeLapNum    uint8
	BestSector1LapNum    uint8
	BestSector2LapNum    uint8
	BestSector3LapNum    uint8
	LapHistoryData       [MaxLapHistoryEntries]LapHistoryData
	TyreStintHistoryData [MaxTyreStintHistoryEntries]TyreStintHistoryData
}

// DecodeSessionHistory decodes a PacketSessionHistoryData from header and payload bytes.
func DecodeSessionHistory(header PacketHeader, payload []byte) (*PacketSessionHistoryData, error) {
	var raw rawSessionHistoryPayload
	err := binary.Read(bytes.NewReader(payload), binary.LittleEndian, &raw)
	if err != nil {
		return nil, fmt.Errorf("failed to decode session history packet: %w", err)
	}
	return &PacketSessionHistoryData{
		Header:               header,
		CarIdx:               raw.CarIdx,
		NumLaps:              raw.NumLaps,
		NumTyreStints:        raw.NumTyreStints,
		BestLapTimeLapNum:    raw.BestLapTimeLapNum,
		BestSector1LapNum:    raw.BestSector1LapNum,
		BestSector2LapNum:    raw.BestSector2LapNum,
		BestSector3LapNum:    raw.BestSector3LapNum,
		LapHistoryData:       raw.LapHistoryData,
		TyreStintHistoryData: raw.TyreStintHistoryData,
	}, nil
}
