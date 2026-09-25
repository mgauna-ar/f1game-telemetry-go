package packets

import (
	"encoding/binary"
	"testing"
)

// specPacketSize holds the full on-the-wire size (header included) of every packet type
// as published in the official F1 25 and F1 25 2026 Season Pack UDP specifications.
type specPacketSize struct {
	name     string
	packetID uint8
	format   uint16
	size     int
}

var specPacketSizes = []specPacketSize{
	{"Motion 2025", PacketIDMotion, PacketFormat2025, 1349},
	{"Motion 2026", PacketIDMotion, PacketFormat2026, 1325},
	{"Session 2025", PacketIDSession, PacketFormat2025, 753},
	{"Session 2026", PacketIDSession, PacketFormat2026, 926},
	{"LapData 2025", PacketIDLapData, PacketFormat2025, 1285},
	{"LapData 2026", PacketIDLapData, PacketFormat2026, 1399},
	{"Event 2025", PacketIDEvent, PacketFormat2025, 45},
	{"Event 2026", PacketIDEvent, PacketFormat2026, 45},
	{"Participants 2025", PacketIDParticipants, PacketFormat2025, 1284},
	{"Participants 2026", PacketIDParticipants, PacketFormat2026, 1470},
	{"CarSetup 2025", PacketIDCarSetup, PacketFormat2025, 1133},
	{"CarSetup 2026", PacketIDCarSetup, PacketFormat2026, 1233},
	{"CarTelemetry 2025", PacketIDCarTelemetry, PacketFormat2025, 1352},
	{"CarTelemetry 2026", PacketIDCarTelemetry, PacketFormat2026, 1448},
	{"CarStatus 2025", PacketIDCarStatus, PacketFormat2025, 1239},
	{"CarStatus 2026", PacketIDCarStatus, PacketFormat2026, 1445},
	{"FinalClassification 2025", PacketIDFinalClassification, PacketFormat2025, 1042},
	{"FinalClassification 2026", PacketIDFinalClassification, PacketFormat2026, 1134},
	{"LobbyInfo 2025", PacketIDLobbyInfo, PacketFormat2025, 954},
	{"LobbyInfo 2026", PacketIDLobbyInfo, PacketFormat2026, 1062},
	{"CarDamage 2025", PacketIDCarDamage, PacketFormat2025, 1041},
	{"CarDamage 2026", PacketIDCarDamage, PacketFormat2026, 1133},
	{"SessionHistory 2025", PacketIDSessionHistory, PacketFormat2025, 1460},
	{"SessionHistory 2026", PacketIDSessionHistory, PacketFormat2026, 1460},
	{"TyreSets 2025", PacketIDTyreSets, PacketFormat2025, 231},
	{"TyreSets 2026", PacketIDTyreSets, PacketFormat2026, 231},
	{"MotionEx 2025", PacketIDMotionEx, PacketFormat2025, 273},
	{"MotionEx 2026", PacketIDMotionEx, PacketFormat2026, 273},
	{"TimeTrial 2025", PacketIDTimeTrial, PacketFormat2025, 101},
	{"TimeTrial 2026", PacketIDTimeTrial, PacketFormat2026, 104},
	{"LapPositions 2025", PacketIDLapPositions, PacketFormat2025, 1131},
	{"LapPositions 2026", PacketIDLapPositions, PacketFormat2026, 1231},
	{"CarTelemetry2 2026", PacketIDCarTelemetry2, PacketFormat2026, 269},
}

// buildSpecPacket builds a spec-sized packet: a valid header followed by a payload whose
// leading count byte (for packets that carry one) reports a full grid.
func buildSpecPacket(tc specPacketSize) []byte {
	data := make([]byte, tc.size)
	copy(data, serializeHeader(createHeader(tc.packetID, tc.format)))
	switch tc.packetID {
	case PacketIDParticipants, PacketIDFinalClassification, PacketIDLobbyInfo:
		data[HeaderSize] = uint8(MaxCarsForFormat(tc.format))
	}
	return data
}

func TestDecodeSpecSizedPackets(t *testing.T) {
	for _, tc := range specPacketSizes {
		t.Run(tc.name, func(t *testing.T) {
			pkt, err := Decode(buildSpecPacket(tc))
			if err != nil {
				t.Fatalf("Decode() error = %v, want nil", err)
			}
			if got := pkt.GetHeader().PacketId; got != tc.packetID {
				t.Errorf("Decode() PacketId = %d, want %d", got, tc.packetID)
			}
		})
	}
}

func TestDecodeTruncatedPackets(t *testing.T) {
	for _, tc := range specPacketSizes {
		t.Run(tc.name, func(t *testing.T) {
			full := buildSpecPacket(tc)
			for n := 0; n < len(full); n++ {
				pkt, err := Decode(full[:n])
				if err == nil && n < minDecodableSize(tc) {
					t.Fatalf("Decode(%d of %d bytes) error = nil, want error for truncated packet", n, len(full))
				}
				if err == nil && pkt == nil {
					t.Fatalf("Decode(%d of %d bytes) returned nil packet without error", n, len(full))
				}
			}
		})
	}
}

// minDecodableSize is the shortest packet the decoder accepts for a spec packet type.
// Trailing fields that the decoders treat as optional (the lap data time trial indices,
// the car setup and car telemetry trailers, and the 2026 session extension) may be absent.
func minDecodableSize(tc specPacketSize) int {
	maxCars := MaxCarsForFormat(tc.format)
	switch tc.packetID {
	case PacketIDLapData:
		return HeaderSize + maxCars*LapDataStructSize
	case PacketIDCarSetup:
		return HeaderSize + maxCars*CarSetupStructSize
	case PacketIDCarTelemetry:
		if tc.format >= PacketFormat2026 {
			return HeaderSize + maxCars*CarTelemetryStructSize2026
		}
		return HeaderSize + maxCars*CarTelemetryStructSize2025
	case PacketIDSession:
		return HeaderSize + binary.Size(sessionData2025{})
	}
	return tc.size
}

func TestDecodeGarbageInput(t *testing.T) {
	tests := []struct {
		name string
		data []byte
	}{
		{"nil", nil},
		{"empty", []byte{}},
		{"single byte", []byte{0xFF}},
		{"header only, unknown packet ID", serializeHeader(createHeader(PacketIDLiveSnapshot, PacketFormat2025))},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := Decode(tt.data); err == nil {
				t.Errorf("Decode() error = nil, want error")
			}
		})
	}
}

// FuzzDecode feeds arbitrary bytes to the packet dispatcher. Decoding must never panic,
// and exactly one of the returned packet and error must be non-nil.
func FuzzDecode(f *testing.F) {
	for _, tc := range specPacketSizes {
		f.Add(buildSpecPacket(tc))
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		pkt, err := Decode(data)
		if err == nil && pkt == nil {
			t.Fatalf("Decode() returned nil packet without error for %d bytes", len(data))
		}
		if err != nil && pkt != nil {
			t.Fatalf("Decode() returned non-nil packet %T alongside error %v", pkt, err)
		}
	})
}
