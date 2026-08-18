package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// TimeTrialDataSet contains time trial data for a single data set (personal best, rival, etc.).
type TimeTrialDataSet struct {
	CarIdx              uint8  `json:"CarIdx"`
	TeamId              uint16 `json:"TeamId"`
	LapTimeInMS         uint32 `json:"LapTimeInMS"`
	Sector1TimeInMS     uint32 `json:"Sector1TimeInMS"`
	Sector2TimeInMS     uint32 `json:"Sector2TimeInMS"`
	Sector3TimeInMS     uint32 `json:"Sector3TimeInMS"`
	TractionControl     uint8  `json:"TractionControl"`
	GearboxAssist       uint8  `json:"GearboxAssist"`
	AntiLockBrakes      uint8  `json:"AntiLockBrakes"`
	EqualCarPerformance uint8  `json:"EqualCarPerformance"`
	CustomSetup         uint8  `json:"CustomSetup"`
	Valid               uint8  `json:"Valid"`
}

// PacketTimeTrialData contains time trial data. Packet ID: 14.
type PacketTimeTrialData struct {
	Header                   PacketHeader     `json:"Header"`
	PlayerSessionBestDataSet TimeTrialDataSet `json:"PlayerSessionBestDataSet"`
	PersonalBestDataSet      TimeTrialDataSet `json:"PersonalBestDataSet"`
	RivalDataSet             TimeTrialDataSet `json:"RivalDataSet"`
}

func (p PacketTimeTrialData) GetHeader() PacketHeader { return p.Header }

const (
	TimeTrialDataSetSize2025 = 24
	TimeTrialDataSetSize2026 = 25
)

func decodeTimeTrialDataSet(r *bytes.Reader, is2026 bool) (TimeTrialDataSet, error) {
	var ds TimeTrialDataSet
	if err := binary.Read(r, binary.LittleEndian, &ds.CarIdx); err != nil {
		return ds, err
	}
	if is2026 {
		if err := binary.Read(r, binary.LittleEndian, &ds.TeamId); err != nil {
			return ds, err
		}
	} else {
		var t8 uint8
		if err := binary.Read(r, binary.LittleEndian, &t8); err != nil {
			return ds, err
		}
		ds.TeamId = uint16(t8)
	}
	_ = binary.Read(r, binary.LittleEndian, &ds.LapTimeInMS)
	_ = binary.Read(r, binary.LittleEndian, &ds.Sector1TimeInMS)
	_ = binary.Read(r, binary.LittleEndian, &ds.Sector2TimeInMS)
	_ = binary.Read(r, binary.LittleEndian, &ds.Sector3TimeInMS)
	_ = binary.Read(r, binary.LittleEndian, &ds.TractionControl)
	_ = binary.Read(r, binary.LittleEndian, &ds.GearboxAssist)
	_ = binary.Read(r, binary.LittleEndian, &ds.AntiLockBrakes)
	_ = binary.Read(r, binary.LittleEndian, &ds.EqualCarPerformance)
	_ = binary.Read(r, binary.LittleEndian, &ds.CustomSetup)
	_ = binary.Read(r, binary.LittleEndian, &ds.Valid)
	return ds, nil
}

// DecodeTimeTrial decodes a PacketTimeTrialData from raw bytes.
func DecodeTimeTrial(data []byte) (*PacketTimeTrialData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in time trial: %w", err)
	}

	var pkt PacketTimeTrialData
	pkt.Header = header

	payload := data[headerLen:]
	is2026 := header.PacketFormat >= PacketFormat2026
	r := bytes.NewReader(payload)

	ds1, err := decodeTimeTrialDataSet(r, is2026)
	if err != nil {
		return nil, fmt.Errorf("failed to decode player session best in time trial: %w", err)
	}
	pkt.PlayerSessionBestDataSet = ds1

	ds2, err := decodeTimeTrialDataSet(r, is2026)
	if err != nil {
		return nil, fmt.Errorf("failed to decode personal best in time trial: %w", err)
	}
	pkt.PersonalBestDataSet = ds2

	ds3, err := decodeTimeTrialDataSet(r, is2026)
	if err != nil {
		return nil, fmt.Errorf("failed to decode rival data in time trial: %w", err)
	}
	pkt.RivalDataSet = ds3

	return &pkt, nil
}
