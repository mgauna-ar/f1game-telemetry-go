package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
)

// LobbyInfoData contains unified lobby data for a single player.
type LobbyInfoData struct {
	AIControlled    uint8    `json:"AIControlled"`
	TeamId          uint16   `json:"TeamId"`
	Nationality     uint8    `json:"Nationality"`
	Platform        uint8    `json:"Platform"`
	Name            [32]byte `json:"-"`
	CarNumber       uint8    `json:"CarNumber"`
	YourTelemetry   uint8    `json:"YourTelemetry"`
	ShowOnlineNames uint8    `json:"ShowOnlineNames"`
	TechLevel       uint16   `json:"TechLevel"`
	ReadyStatus     uint8    `json:"ReadyStatus"`
}

// NameString returns the lobby player name as a Go string, trimming null bytes.
func (l LobbyInfoData) NameString() string {
	n := bytes.IndexByte(l.Name[:], 0)
	if n == -1 {
		n = len(l.Name)
	}
	return strings.TrimSpace(string(l.Name[:n]))
}

// PacketLobbyInfoData contains lobby info for all players. Packet ID: 9.
type PacketLobbyInfoData struct {
	Header       PacketHeader           `json:"Header"`
	NumPlayers   uint8                  `json:"NumPlayers"`
	LobbyPlayers [MaxCars]LobbyInfoData `json:"LobbyPlayers"`
}

func (p PacketLobbyInfoData) GetHeader() PacketHeader { return p.Header }

const (
	LobbyInfoStructSize2025 = 42
	LobbyInfoStructSize2026 = 43
	LobbyNameLen            = 32
)

type rawLobbyInfo2025 struct {
	AIControlled    uint8
	TeamId          uint8
	Nationality     uint8
	Platform        uint8
	Name            [LobbyNameLen]byte
	CarNumber       uint8
	YourTelemetry   uint8
	ShowOnlineNames uint8
	TechLevel       uint16
	ReadyStatus     uint8
}

type rawLobbyInfo2026 struct {
	AIControlled    uint8
	TeamId          uint16
	Nationality     uint8
	Platform        uint8
	Name            [LobbyNameLen]byte
	CarNumber       uint8
	YourTelemetry   uint8
	ShowOnlineNames uint8
	TechLevel       uint16
	ReadyStatus     uint8
}

func decodeLobbyInfoCar(playerBytes []byte, is2026 bool) (LobbyInfoData, error) {
	r := bytes.NewReader(playerBytes)
	if is2026 {
		var raw rawLobbyInfo2026
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return LobbyInfoData{}, err
		}
		return LobbyInfoData(raw), nil
	}

	var raw rawLobbyInfo2025
	if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
		return LobbyInfoData{}, err
	}
	return LobbyInfoData{
		AIControlled:    raw.AIControlled,
		TeamId:          uint16(raw.TeamId),
		Nationality:     raw.Nationality,
		Platform:        raw.Platform,
		Name:            raw.Name,
		CarNumber:       raw.CarNumber,
		YourTelemetry:   raw.YourTelemetry,
		ShowOnlineNames: raw.ShowOnlineNames,
		TechLevel:       raw.TechLevel,
		ReadyStatus:     raw.ReadyStatus,
	}, nil
}

// DecodeLobbyInfo decodes a PacketLobbyInfoData from header and payload bytes.
func DecodeLobbyInfo(header PacketHeader, payload []byte) (*PacketLobbyInfoData, error) {
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for lobby info payload: got %d bytes", len(payload))
	}

	numPlayers := payload[0]
	structSize := LobbyInfoStructSize2025
	if header.PacketFormat >= PacketFormat2026 {
		structSize = LobbyInfoStructSize2026
	}

	cars, err := DecodePerCarCustom[LobbyInfoData](payload, header, structSize, 0, 1, int(numPlayers), decodeLobbyInfoCar)
	if err != nil {
		return nil, fmt.Errorf("failed to decode lobby info: %w", err)
	}

	return &PacketLobbyInfoData{
		Header:       header,
		NumPlayers:   numPlayers,
		LobbyPlayers: cars,
	}, nil
}
