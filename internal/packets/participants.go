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

func decodeParticipantCar(carBytes []byte, is2026 bool) (ParticipantData, error) {
	var p ParticipantData
	if is2026 {
		p.AIControlled = carBytes[0]
		p.DriverId = binary.LittleEndian.Uint16(carBytes[1:3])
		p.NetworkId = binary.LittleEndian.Uint16(carBytes[3:5])
		p.TeamId = binary.LittleEndian.Uint16(carBytes[5:7])
		p.MyTeam = carBytes[7]
		p.RaceNumber = carBytes[8]
		p.Nationality = carBytes[9]
		copy(p.Name[:], carBytes[10:10+ParticipantNameLen])
		p.YourTelemetry = carBytes[42]
		p.ShowOnlineNames = carBytes[43]
		p.TechLevel = binary.LittleEndian.Uint16(carBytes[44:46])
		p.Platform = carBytes[46]
		p.NumColours = carBytes[47]
		for c := 0; c < 4; c++ {
			p.LiveryColours[c] = LiveryColour{
				Red:   carBytes[48+c*3],
				Green: carBytes[48+c*3+1],
				Blue:  carBytes[48+c*3+2],
			}
		}
	} else {
		p.AIControlled = carBytes[0]
		p.DriverId = uint16(carBytes[1])
		p.NetworkId = uint16(carBytes[2])
		p.TeamId = uint16(carBytes[3])
		p.MyTeam = carBytes[4]
		p.RaceNumber = carBytes[5]
		p.Nationality = carBytes[6]
		copy(p.Name[:], carBytes[7:7+ParticipantNameLen])
		p.YourTelemetry = carBytes[39]
		p.ShowOnlineNames = carBytes[40]
		p.TechLevel = binary.LittleEndian.Uint16(carBytes[41:43])
		p.Platform = carBytes[43]
		p.NumColours = carBytes[44]
		for c := 0; c < 4; c++ {
			p.LiveryColours[c] = LiveryColour{
				Red:   carBytes[45+c*3],
				Green: carBytes[45+c*3+1],
				Blue:  carBytes[45+c*3+2],
			}
		}
	}
	return p, nil
}

// DecodeParticipants decodes a PacketParticipantsData from raw bytes.
func DecodeParticipants(data []byte) (*PacketParticipantsData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in participants: %w", err)
	}

	payload := data[headerLen:]
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
