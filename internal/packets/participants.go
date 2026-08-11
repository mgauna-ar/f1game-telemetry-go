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
	r := bytes.NewReader(payload[1:])

	if err := binary.Read(r, binary.LittleEndian, &pkt.Participants); err != nil {
		return nil, fmt.Errorf("failed to decode participants payload: %w", err)
	}

	return &pkt, nil
}
