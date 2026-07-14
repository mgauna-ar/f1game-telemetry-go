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
	LapTimeInMS        uint32
	Sector1TimeMSPart  uint16
	Sector1TimeMinutesPart uint8
	Sector2TimeMSPart  uint16
	Sector2TimeMinutesPart uint8
	Sector3TimeMSPart  uint16
	Sector3TimeMinutesPart uint8
	LapValidBitFlags   uint8
}

// TyreStintHistoryData contains tyre stint history data.
type TyreStintHistoryData struct {
	EndLap             uint8
	TyreActualCompound uint8
	TyreVisualCompound uint8
}

// PacketSessionHistoryData contains session history for a single car. Packet ID: 11.
type PacketSessionHistoryData struct {
	Header                PacketHeader
	CarIdx                uint8
	NumLaps               uint8
	NumTyreStints         uint8
	BestLapTimeLapNum     uint8
	BestSector1LapNum     uint8
	BestSector2LapNum     uint8
	BestSector3LapNum     uint8
	LapHistoryData        [MaxLapHistoryEntries]LapHistoryData
	TyreStintHistoryData  [MaxTyreStintHistoryEntries]TyreStintHistoryData
}

func (p PacketSessionHistoryData) GetHeader() PacketHeader { return p.Header }

// DecodeSessionHistory decodes a PacketSessionHistoryData from raw bytes.
func DecodeSessionHistory(data []byte) (*PacketSessionHistoryData, error) {
	var pkt PacketSessionHistoryData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode session history packet: %w", err)
	}
	return &pkt, nil
}
