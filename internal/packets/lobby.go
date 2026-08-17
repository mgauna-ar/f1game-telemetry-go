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

const LobbyInfoStructSize = 54

// DecodeLobbyInfo decodes a PacketLobbyInfoData from raw bytes.
func DecodeLobbyInfo(data []byte) (*PacketLobbyInfoData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in lobby info: %w", err)
	}

	var pkt PacketLobbyInfoData
	pkt.Header = header

	payload := data[headerLen:]
	if len(payload) < 1 {
		return nil, fmt.Errorf("data too short for lobby info payload: got %d bytes", len(payload))
	}

	pkt.NumPlayers = payload[0]
	playersPayload := payload[1:]

	maxCars := MaxCarsForFormat(header.PacketFormat)
	itemSize := LobbyInfoStructSize
	if maxCars > 0 && len(playersPayload)%maxCars == 0 && len(playersPayload)/maxCars >= LobbyInfoStructSize {
		itemSize = len(playersPayload) / maxCars
	} else if len(playersPayload)%MaxCars == 0 && len(playersPayload)/MaxCars >= LobbyInfoStructSize {
		itemSize = len(playersPayload) / MaxCars
	}

	numToRead := int(pkt.NumPlayers)
	if numToRead <= 0 || numToRead > maxCars {
		numToRead = maxCars
	}

	for i := 0; i < numToRead && i < MaxCars; i++ {
		offset := i * itemSize
		if offset+LobbyInfoStructSize > len(playersPayload) {
			break
		}
		r := bytes.NewReader(playersPayload[offset : offset+LobbyInfoStructSize])
		if err := binary.Read(r, binary.LittleEndian, &pkt.LobbyPlayers[i]); err != nil {
			return nil, fmt.Errorf("failed to decode lobby player %d: %w", i, err)
		}
	}

	return &pkt, nil
}
