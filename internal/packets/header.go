package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const (
	HeaderSize       = 29
	MaxCars          = 24
	MaxCars2025      = 22
	MaxCars2026      = 24
	PacketFormat2025 = 2025
	PacketFormat2026 = 2026
)

// VisualTyreCompoundName returns the human-readable visual tyre compound name.
func VisualTyreCompoundName(compound uint8) string {
	switch compound {
	case CompoundSoft, CompoundClassicS, CompoundSuperSoft:
		return CompoundNameSoft
	case CompoundMedium, CompoundClassicM:
		return CompoundNameMedium
	case CompoundHard, CompoundClassicH:
		return CompoundNameHard
	case CompoundInter:
		return CompoundNameIntermediate
	case CompoundWet:
		return CompoundNameWet
	default:
		return CompoundNameMedium
	}
}

// ActualTyreCompoundName returns the human-readable F1 compound identifier (C1-C5, etc.).
func ActualTyreCompoundName(compound uint8) string {
	switch compound {
	case ActualCompoundC5:
		return "C5"
	case ActualCompoundC4:
		return "C4"
	case ActualCompoundC3:
		return "C3"
	case ActualCompoundC2:
		return "C2"
	case ActualCompoundC1:
		return "C1"
	case ActualCompoundC0:
		return "C0"
	case CompoundInter:
		return "INTERMEDIATE"
	case CompoundWet:
		return "WET"
	default:
		return "UNKNOWN"
	}
}

// MaxCarsForFormat returns the maximum number of cars for a given packet format (22 for 2025, 24 for 2026).
func MaxCarsForFormat(packetFormat uint16) int {
	if packetFormat >= PacketFormat2026 {
		return MaxCars2026
	}
	return MaxCars2025
}

// PerCarItemSize calculates the per-car byte stride based on packet payload length and format car count.
func PerCarItemSize(payload []byte, header PacketHeader, structSize, trailer int) int {
	maxCars := MaxCarsForFormat(header.PacketFormat)
	if len(payload) == 0 || maxCars <= 0 {
		return structSize
	}

	netLen := len(payload)
	if trailer > 0 && len(payload) >= trailer {
		netLen = len(payload) - trailer
	}

	if netLen > 0 {
		if netLen%maxCars == 0 {
			size := netLen / maxCars
			if size >= structSize {
				return size
			}
		}
		if netLen%MaxCars == 0 {
			size := netLen / MaxCars
			if size >= structSize {
				return size
			}
		}
	}

	return structSize
}

// PacketHeader is the header present at the start of every UDP packet.
type PacketHeader struct {
	PacketFormat            uint16
	GameYear                uint8
	GameMajorVersion        uint8
	GameMinorVersion        uint8
	PacketVersion           uint8
	PacketId                uint8
	SessionUID              uint64
	SessionTime             float32
	FrameIdentifier         uint32
	OverallFrameIdentifier  uint32
	PlayerCarIndex          uint8
	SecondaryPlayerCarIndex uint8
}

// FormatSessionUID formats a uint64 session UID into a standard hexadecimal string (e.g. 0x00000000075BCD15).
func FormatSessionUID(uid uint64) string {
	return fmt.Sprintf("0x%016X", uid)
}

// MarshalJSON serializes PacketHeader, ensuring SessionUID is formatted as a hex string ("0x...")
// to prevent JavaScript 64-bit integer precision loss.
func (h PacketHeader) MarshalJSON() ([]byte, error) {
	type Alias PacketHeader
	return json.Marshal(&struct {
		Alias
		SessionUID string `json:"SessionUID"`
	}{
		Alias:      Alias(h),
		SessionUID: FormatSessionUID(h.SessionUID),
	})
}

// UnmarshalJSON deserializes PacketHeader, supporting SessionUID as either a hex/decimal string, raw number, or json.Number.
func (h *PacketHeader) UnmarshalJSON(data []byte) error {
	type Alias PacketHeader
	aux := struct {
		*Alias
		SessionUID any `json:"SessionUID"`
	}{
		Alias: (*Alias)(h),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	switch v := aux.SessionUID.(type) {
	case float64:
		h.SessionUID = uint64(v)
	case json.Number:
		val, err := strconv.ParseUint(v.String(), 0, 64)
		if err != nil {
			return fmt.Errorf("invalid SessionUID %q: %w", v.String(), err)
		}
		h.SessionUID = val
	case string:
		clean := strings.TrimSpace(v)
		if clean == "" {
			h.SessionUID = 0
			return nil
		}
		val, err := strconv.ParseUint(clean, 0, 64)
		if err != nil {
			return fmt.Errorf("invalid SessionUID %q: %w", v, err)
		}
		h.SessionUID = val
	case nil:
		h.SessionUID = 0
	default:
		return fmt.Errorf("unexpected type for SessionUID: %T", aux.SessionUID)
	}
	return nil
}

// Packet is the interface implemented by all packet types.
type Packet interface {
	GetHeader() PacketHeader
}

// DecodeHeaderWithOffset decodes a PacketHeader and returns the header length (29 bytes for F1 2025/2026).
func DecodeHeaderWithOffset(data []byte) (PacketHeader, int, error) {
	if len(data) < HeaderSize {
		return PacketHeader{}, 0, fmt.Errorf("data too short for header: got %d bytes, need %d", len(data), HeaderSize)
	}

	var h PacketHeader
	err := binary.Read(bytes.NewReader(data[:HeaderSize]), binary.LittleEndian, &h)
	if err != nil {
		return PacketHeader{}, 0, fmt.Errorf("failed to decode header: %w", err)
	}
	return h, HeaderSize, nil
}

// DecodeHeader decodes a PacketHeader from raw bytes.
func DecodeHeader(data []byte) (PacketHeader, error) {
	h, _, err := DecodeHeaderWithOffset(data)
	return h, err
}
