package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// TimeTrialDataSet contains time trial data for a single data set (personal best, rival, etc.).
type TimeTrialDataSet struct {
	CarIdx               uint8
	TeamId               uint8
	LapTimeInMS          uint32
	Sector1TimeInMS      uint32
	Sector2TimeInMS      uint32
	Sector3TimeInMS      uint32
	TractionControl      uint8
	GearboxAssist        uint8
	AntiLockBrakes       uint8
	EqualCarPerformance  uint8
	CustomSetup          uint8
	Valid                uint8
}

// PacketTimeTrialData contains time trial data. Packet ID: 14.
type PacketTimeTrialData struct {
	Header              PacketHeader
	PlayerSessionBestDataSet TimeTrialDataSet
	PersonalBestDataSet      TimeTrialDataSet
	RivalDataSet             TimeTrialDataSet
}

func (p PacketTimeTrialData) GetHeader() PacketHeader { return p.Header }

// DecodeTimeTrial decodes a PacketTimeTrialData from raw bytes.
func DecodeTimeTrial(data []byte) (*PacketTimeTrialData, error) {
	var pkt PacketTimeTrialData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode time trial packet: %w", err)
	}
	return &pkt, nil
}
