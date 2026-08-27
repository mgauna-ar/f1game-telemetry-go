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

func decodeLobbyInfoCar(playerBytes []byte, is2026 bool) (LobbyInfoData, error) {
	var li LobbyInfoData
	if is2026 {
		li.AIControlled = playerBytes[0]
		li.TeamId = binary.LittleEndian.Uint16(playerBytes[1:3])
		li.Nationality = playerBytes[3]
		li.Platform = playerBytes[4]
		copy(li.Name[:], playerBytes[5:5+LobbyNameLen])
		li.CarNumber = playerBytes[37]
		li.YourTelemetry = playerBytes[38]
		li.ShowOnlineNames = playerBytes[39]
		li.TechLevel = binary.LittleEndian.Uint16(playerBytes[40:42])
		li.ReadyStatus = playerBytes[42]
	} else {
		li.AIControlled = playerBytes[0]
		li.TeamId = uint16(playerBytes[1])
		li.Nationality = playerBytes[2]
		li.Platform = playerBytes[3]
		copy(li.Name[:], playerBytes[4:4+LobbyNameLen])
		li.CarNumber = playerBytes[36]
		li.YourTelemetry = playerBytes[37]
		li.ShowOnlineNames = playerBytes[38]
		li.TechLevel = binary.LittleEndian.Uint16(playerBytes[39:41])
		li.ReadyStatus = playerBytes[41]
	}
	return li, nil
}

// DecodeLobbyInfo decodes a PacketLobbyInfoData from raw bytes.
func DecodeLobbyInfo(data []byte) (*PacketLobbyInfoData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in lobby info: %w", err)
	}

	payload := data[headerLen:]
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
