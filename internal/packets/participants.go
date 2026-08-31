package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"
)

// LiveryColour represents the RGB value of a livery color.
type LiveryColour struct {
	Red   uint8 `json:"Red"`
	Green uint8 `json:"Green"`
	Blue  uint8 `json:"Blue"`
}

// ParticipantData contains unified data for a single participant.
type ParticipantData struct {
	AIControlled    uint8           `json:"AIControlled"`
	DriverId        uint16          `json:"DriverId"`
	NetworkId       uint16          `json:"NetworkId"`
	TeamId          uint16          `json:"TeamId"`
	MyTeam          uint8           `json:"MyTeam"`
	RaceNumber      uint8           `json:"RaceNumber"`
	Nationality     uint8           `json:"Nationality"`
	Name            [32]byte        `json:"-"`
	YourTelemetry   uint8           `json:"YourTelemetry"`
	ShowOnlineNames uint8           `json:"ShowOnlineNames"`
	TechLevel       uint16          `json:"TechLevel"`
	Platform        uint8           `json:"Platform"`
	NumColours      uint8           `json:"NumColours"`
	LiveryColours   [4]LiveryColour `json:"LiveryColours"`
}

// NameString returns the participant name as a Go string, trimming null bytes.
func (p ParticipantData) NameString() string {
	n := bytes.IndexByte(p.Name[:], 0)
	if n == -1 {
		n = len(p.Name)
	}
	return strings.TrimSpace(string(p.Name[:n]))
}

// MarshalJSON implements json.Marshaler for ParticipantData.
func (p ParticipantData) MarshalJSON() ([]byte, error) {
	type participantAlias ParticipantData
	return json.Marshal(struct {
		participantAlias
		Name string `json:"Name"`
	}{
		participantAlias: participantAlias(p),
		Name:             p.NameString(),
	})
}

// PacketParticipantsData contains data for all participants. Packet ID: 4.
type PacketParticipantsData struct {
	Header        PacketHeader             `json:"Header"`
	NumActiveCars uint8                    `json:"NumActiveCars"`
	Participants  [MaxCars]ParticipantData `json:"Participants"`
}

func (p PacketParticipantsData) GetHeader() PacketHeader { return p.Header }

const (
	ParticipantStructSize2025 = 57
	ParticipantStructSize2026 = 60
	ParticipantNameLen        = 32
)

type rawParticipant2025 struct {
	AIControlled    uint8
	DriverId        uint8
	NetworkId       uint8
	TeamId          uint8
	MyTeam          uint8
	RaceNumber      uint8
	Nationality     uint8
	Name            [ParticipantNameLen]byte
	YourTelemetry   uint8
	ShowOnlineNames uint8
	TechLevel       uint16
	Platform        uint8
	NumColours      uint8
	LiveryColours   [4]LiveryColour
}

type rawParticipant2026 struct {
	AIControlled    uint8
	DriverId        uint16
	NetworkId       uint16
	TeamId          uint16
	MyTeam          uint8
	RaceNumber      uint8
	Nationality     uint8
	Name            [ParticipantNameLen]byte
	YourTelemetry   uint8
	ShowOnlineNames uint8
	TechLevel       uint16
	Platform        uint8
	NumColours      uint8
	LiveryColours   [4]LiveryColour
}

func decodeParticipantCar(carBytes []byte, is2026 bool) (ParticipantData, error) {
	r := bytes.NewReader(carBytes)
	if is2026 {
		var raw rawParticipant2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return ParticipantData{}, err
		}
		return ParticipantData(raw), nil
	}

	var raw rawParticipant2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return ParticipantData{}, err
	}
	return ParticipantData{
		AIControlled:    raw.AIControlled,
		DriverId:        uint16(raw.DriverId),
		NetworkId:       uint16(raw.NetworkId),
		TeamId:          uint16(raw.TeamId),
		MyTeam:          raw.MyTeam,
		RaceNumber:      raw.RaceNumber,
		Nationality:     raw.Nationality,
		Name:            raw.Name,
		YourTelemetry:   raw.YourTelemetry,
		ShowOnlineNames: raw.ShowOnlineNames,
		TechLevel:       raw.TechLevel,
		Platform:        raw.Platform,
		NumColours:      raw.NumColours,
		LiveryColours:   raw.LiveryColours,
	}, nil
}

// DecodeParticipants decodes a PacketParticipantsData from header and payload bytes.
func DecodeParticipants(header PacketHeader, payload []byte) (*PacketParticipantsData, error) {
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for participants payload: got %d bytes", len(payload))
	}

	numActive := payload[0]
	structSize := ParticipantStructSize2025
	if header.PacketFormat >= PacketFormat2026 {
		structSize = ParticipantStructSize2026
	}

	cars, err := DecodePerCarCustom[ParticipantData](payload, header, structSize, 0, 1, 0, decodeParticipantCar)
	if err != nil {
		return nil, fmt.Errorf("failed to decode participants: %w", err)
	}

	return &PacketParticipantsData{
		Header:        header,
		NumActiveCars: numActive,
		Participants:  cars,
	}, nil
}
