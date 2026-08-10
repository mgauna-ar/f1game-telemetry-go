package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
)

// ParticipantData contains data for a single participant.
type ParticipantData struct {
	AIControlled    uint8
	DriverId        uint8
	NetworkId       uint8
	TeamId          uint8
	MyTeam          uint8
	RaceNumber      uint8
	Nationality     uint8
	Name            [48]byte
	YourTelemetry   uint8
	ShowOnlineNames uint8
	TechLevel       uint16
	Platform        uint8
}

// NameString returns the participant name as a Go string, trimming null bytes.
func (p ParticipantData) NameString() string {
	n := bytes.IndexByte(p.Name[:], 0)
	if n == -1 {
		n = len(p.Name)
	}
	return strings.TrimSpace(string(p.Name[:n]))
}

// PacketParticipantsData contains data for all participants. Packet ID: 4.
type PacketParticipantsData struct {
	Header        PacketHeader
	NumActiveCars uint8
	Participants  [MaxCars]ParticipantData
}

func (p PacketParticipantsData) GetHeader() PacketHeader { return p.Header }

// DecodeParticipants decodes a PacketParticipantsData from raw bytes.
func DecodeParticipants(data []byte) (*PacketParticipantsData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in participants: %w", err)
	}

	var pkt PacketParticipantsData
	pkt.Header = header

	payload := data[headerLen:]
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for participants payload: got %d bytes", len(payload))
	}

	pkt.NumActiveCars = payload[0]
	r := bytes.NewReader(payload[1:])

	if r.Len() < MaxCars*60 && r.Len() >= MaxCars*57 {
		type ParticipantData2023 struct {
			AIControlled    uint8
			DriverId        uint8
			NetworkId       uint8
			TeamId          uint8
			MyTeam          uint8
			RaceNumber      uint8
			Nationality     uint8
			Name            [48]byte
			YourTelemetry   uint8
			ShowOnlineNames uint8
		}
		var p2023 [MaxCars]ParticipantData2023
		if err := binary.Read(r, binary.LittleEndian, &p2023); err != nil {
			return nil, fmt.Errorf("failed to decode 2023 participants payload: %w", err)
		}
		for i := 0; i < MaxCars; i++ {
			pkt.Participants[i] = ParticipantData{
				AIControlled:    p2023[i].AIControlled,
				DriverId:        p2023[i].DriverId,
				NetworkId:       p2023[i].NetworkId,
				TeamId:          p2023[i].TeamId,
				MyTeam:          p2023[i].MyTeam,
				RaceNumber:      p2023[i].RaceNumber,
				Nationality:     p2023[i].Nationality,
				Name:            p2023[i].Name,
				YourTelemetry:   p2023[i].YourTelemetry,
				ShowOnlineNames: p2023[i].ShowOnlineNames,
			}
		}
	} else {
		if err := binary.Read(r, binary.LittleEndian, &pkt.Participants); err != nil {
			return nil, fmt.Errorf("failed to decode participants payload: %w", err)
		}
	}

	return &pkt, nil
}
