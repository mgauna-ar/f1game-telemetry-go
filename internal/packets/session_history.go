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
	LapTimeInMS            uint32 `json:"LapTimeInMS"`
	Sector1TimeMSPart      uint16 `json:"Sector1TimeMSPart"`
	Sector1TimeMinutesPart uint8  `json:"Sector1TimeMinutesPart"`
	Sector2TimeMSPart      uint16 `json:"Sector2TimeMSPart"`
	Sector2TimeMinutesPart uint8  `json:"Sector2TimeMinutesPart"`
	Sector3TimeMSPart      uint16 `json:"Sector3TimeMSPart"`
	Sector3TimeMinutesPart uint8  `json:"Sector3TimeMinutesPart"`
	LapValidBitFlags       uint8  `json:"LapValidBitFlags"`
}

// TyreStintHistoryData contains tyre stint history data.
type TyreStintHistoryData struct {
	EndLap             uint8 `json:"EndLap"`
	TyreActualCompound uint8 `json:"TyreActualCompound"`
	TyreVisualCompound uint8 `json:"TyreVisualCompound"`
}

// PacketSessionHistoryData contains session history for a single car. Packet ID: 11.
type PacketSessionHistoryData struct {
	Header               PacketHeader                                     `json:"Header"`
	CarIdx               uint8                                            `json:"CarIdx"`
	NumLaps              uint8                                            `json:"NumLaps"`
	NumTyreStints        uint8                                            `json:"NumTyreStints"`
	BestLapTimeLapNum    uint8                                            `json:"BestLapTimeLapNum"`
	BestSector1LapNum    uint8                                            `json:"BestSector1LapNum"`
	BestSector2LapNum    uint8                                            `json:"BestSector2LapNum"`
	BestSector3LapNum    uint8                                            `json:"BestSector3LapNum"`
	LapHistoryData       [MaxLapHistoryEntries]LapHistoryData             `json:"LapHistoryData"`
	TyreStintHistoryData [MaxTyreStintHistoryEntries]TyreStintHistoryData `json:"TyreStintHistoryData"`
}

func (p PacketSessionHistoryData) GetHeader() PacketHeader { return p.Header }

// SectorsMS returns the lap's three sector times in ms (0 for a sector not driven yet).
func (l LapHistoryData) SectorsMS() [3]uint32 {
	return [3]uint32{
		uint32(l.Sector1TimeMinutesPart)*MillisPerMinute + uint32(l.Sector1TimeMSPart),
		uint32(l.Sector2TimeMinutesPart)*MillisPerMinute + uint32(l.Sector2TimeMSPart),
		uint32(l.Sector3TimeMinutesPart)*MillisPerMinute + uint32(l.Sector3TimeMSPart),
	}
}

// Valid reports whether the game counts the lap.
func (l LapHistoryData) Valid() bool { return l.LapValidBitFlags&LapValidBitFlag != 0 }

// Lap returns the history entry of a lap number (1-based), if the packet holds it.
func (p *PacketSessionHistoryData) Lap(lapNum int) (LapHistoryData, bool) {
	if lapNum < 1 || lapNum > min(int(p.NumLaps), len(p.LapHistoryData)) {
		return LapHistoryData{}, false
	}
	return p.LapHistoryData[lapNum-1], true
}

// LastCompletedLap returns the last lap with a lap time. NumLaps counts the lap in progress,
// whose entry only has the sectors driven so far.
func (p *PacketSessionHistoryData) LastCompletedLap() (LapHistoryData, bool) {
	for n := min(int(p.NumLaps), len(p.LapHistoryData)); n >= 1; n-- {
		if lap := p.LapHistoryData[n-1]; lap.LapTimeInMS > 0 {
			return lap, true
		}
	}
	return LapHistoryData{}, false
}

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
