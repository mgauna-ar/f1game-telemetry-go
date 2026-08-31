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

type rawTimeTrialDataSet2025 struct {
	CarIdx              uint8
	TeamId              uint8
	LapTimeInMS         uint32
	Sector1TimeInMS     uint32
	Sector2TimeInMS     uint32
	Sector3TimeInMS     uint32
	TractionControl     uint8
	GearboxAssist       uint8
	AntiLockBrakes      uint8
	EqualCarPerformance uint8
	CustomSetup         uint8
	Valid               uint8
}

type rawTimeTrialDataSet2026 struct {
	CarIdx              uint8
	TeamId              uint16
	LapTimeInMS         uint32
	Sector1TimeInMS     uint32
	Sector2TimeInMS     uint32
	Sector3TimeInMS     uint32
	TractionControl     uint8
	GearboxAssist       uint8
	AntiLockBrakes      uint8
	EqualCarPerformance uint8
	CustomSetup         uint8
	Valid               uint8
}

type rawTimeTrialPayload2025 struct {
	PlayerSessionBest rawTimeTrialDataSet2025
	PersonalBest      rawTimeTrialDataSet2025
	Rival             rawTimeTrialDataSet2025
}

type rawTimeTrialPayload2026 struct {
	PlayerSessionBest rawTimeTrialDataSet2026
	PersonalBest      rawTimeTrialDataSet2026
	Rival             rawTimeTrialDataSet2026
}

func convertTimeTrial2025(raw rawTimeTrialDataSet2025) TimeTrialDataSet {
	return TimeTrialDataSet{
		CarIdx:              raw.CarIdx,
		TeamId:              uint16(raw.TeamId),
		LapTimeInMS:         raw.LapTimeInMS,
		Sector1TimeInMS:     raw.Sector1TimeInMS,
		Sector2TimeInMS:     raw.Sector2TimeInMS,
		Sector3TimeInMS:     raw.Sector3TimeInMS,
		TractionControl:     raw.TractionControl,
		GearboxAssist:       raw.GearboxAssist,
		AntiLockBrakes:      raw.AntiLockBrakes,
		EqualCarPerformance: raw.EqualCarPerformance,
		CustomSetup:         raw.CustomSetup,
		Valid:               raw.Valid,
	}
}

func convertTimeTrial2026(raw rawTimeTrialDataSet2026) TimeTrialDataSet {
	return TimeTrialDataSet(raw)
}

// DecodeTimeTrial decodes a PacketTimeTrialData from header and payload bytes.
func DecodeTimeTrial(header PacketHeader, payload []byte) (*PacketTimeTrialData, error) {
	r := bytes.NewReader(payload)
	is2026 := header.PacketFormat >= PacketFormat2026

	if is2026 {
		var raw rawTimeTrialPayload2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return nil, fmt.Errorf("failed to decode time trial payload: %w", err)
		}
		return &PacketTimeTrialData{
			Header:                   header,
			PlayerSessionBestDataSet: convertTimeTrial2026(raw.PlayerSessionBest),
			PersonalBestDataSet:      convertTimeTrial2026(raw.PersonalBest),
			RivalDataSet:             convertTimeTrial2026(raw.Rival),
		}, nil
	}

	var raw rawTimeTrialPayload2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return nil, fmt.Errorf("failed to decode time trial payload: %w", err)
	}
	return &PacketTimeTrialData{
		Header:                   header,
		PlayerSessionBestDataSet: convertTimeTrial2025(raw.PlayerSessionBest),
		PersonalBestDataSet:      convertTimeTrial2025(raw.PersonalBest),
		RivalDataSet:             convertTimeTrial2025(raw.Rival),
	}, nil
}
