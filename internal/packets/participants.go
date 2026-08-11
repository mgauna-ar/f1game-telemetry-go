package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
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

// MarshalJSON implements json.Marshaler for ParticipantData.
// Go's encoding/json encodes [N]byte arrays as base64 strings by default,
// which produces garbled driver names on the frontend. This custom marshaler
// serializes the Name field as a proper UTF-8 string instead.
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
	carsPayload := payload[1:]

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := len(carsPayload) / maxCars
	if itemSize < 57 {
		itemSize = 57
	}

	for i := 0; i < maxCars && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+57 > len(carsPayload) {
			break
		}

		carBytes := carsPayload[offset : offset+itemSize]
		var p ParticipantData
		p.AIControlled = carBytes[0]
		p.DriverId = carBytes[1]

		var nameOffset, nameLen int
		if header.PacketFormat >= 2026 {
			p.NetworkId = uint8(binary.LittleEndian.Uint16(carBytes[2:4]))
			nameOffset = 8
			// Check if byte 10 has printable character and byte 8 is race number/zero
			if len(carBytes) >= 42 && carBytes[10] >= 0x20 && carBytes[10] <= 0x7E && carBytes[8] < 100 {
				nameOffset = 10
				p.TeamId = uint8(binary.LittleEndian.Uint16(carBytes[4:6]))
				p.MyTeam = carBytes[6]
				p.RaceNumber = carBytes[8]
				p.Nationality = carBytes[9]
			} else {
				p.TeamId = carBytes[4]
				p.MyTeam = carBytes[5]
				p.RaceNumber = carBytes[6]
				p.Nationality = carBytes[7]
			}
			nameLen = 32
		} else {
			p.NetworkId = carBytes[2]
			p.TeamId = carBytes[3]
			p.MyTeam = carBytes[4]
			p.RaceNumber = carBytes[5]
			p.Nationality = carBytes[6]
			nameOffset = 7
			if itemSize >= 58 {
				nameLen = 48
			} else {
				nameLen = 32
			}
		}

		if nameOffset+nameLen <= len(carBytes) {
			copy(p.Name[:], carBytes[nameOffset:nameOffset+nameLen])
		}
		pkt.Participants[i] = p
	}

	return &pkt, nil
}
