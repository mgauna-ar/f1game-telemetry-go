package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
)

// LobbyInfoData contains lobby data for a single player.
type LobbyInfoData struct {
	AIControlled uint8
	TeamId       uint8
	Nationality  uint8
	Platform     uint8
	Name         [48]byte
	CarNumber    uint8
	ReadyStatus  uint8
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
	Header       PacketHeader
	NumPlayers   uint8
	LobbyPlayers [MaxCars]LobbyInfoData
}

func (p PacketLobbyInfoData) GetHeader() PacketHeader { return p.Header }

// DecodeLobbyInfo decodes a PacketLobbyInfoData from raw bytes.
func DecodeLobbyInfo(data []byte) (*PacketLobbyInfoData, error) {
	var pkt PacketLobbyInfoData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode lobby info packet: %w", err)
	}
	return &pkt, nil
}
