package packets

import (
	"bytes"
	"encoding/binary"
	"testing"
)

// Helper to create a valid packet header
func createHeader(packetID uint8) PacketHeader {
	return PacketHeader{
		PacketFormat:            2025,
		GameYear:                25,
		GameMajorVersion:        1,
		GameMinorVersion:        0,
		PacketVersion:           1,
		PacketId:                packetID,
		SessionUID:              123456789,
		SessionTime:             12.5,
		FrameIdentifier:         100,
		OverallFrameIdentifier:  100,
		PlayerCarIndex:          0,
		SecondaryPlayerCarIndex: 255,
	}
}

// Helper to serialize a header to bytes
func serializeHeader(h PacketHeader) []byte {
	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, &h)
	return buf.Bytes()
}

func TestDecodeHeader(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		wantErr bool
		wantID  uint8
	}{
		{
			name:    "Valid header",
			data:    serializeHeader(createHeader(PacketIDMotion)),
			wantErr: false,
			wantID:  PacketIDMotion,
		},
		{
			name:    "Data too short",
			data:    make([]byte, 10), // less than 29 bytes
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DecodeHeader(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodeHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.PacketId != tt.wantID {
				t.Errorf("DecodeHeader() got PacketId = %v, want %v", got.PacketId, tt.wantID)
			}
		})
	}
}

func TestDecode(t *testing.T) {
	tests := []struct {
		name     string
		packetID uint8
		wantErr  bool
	}{
		// We expect errors here because the payload size won't match the specific struct requirements
		// for DecodeMotion, DecodeSession etc, since we only pass the header.
		// However, it should NOT fail with "unknown packet ID".
		{"Motion Packet", PacketIDMotion, true},
		{"Session Packet", PacketIDSession, true},
		{"Unknown Packet", 255, true}, // 255 is not a valid packet ID
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			headerData := serializeHeader(createHeader(tt.packetID))

			_, err := Decode(headerData)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Decode() expected error but got none")
				} else if tt.packetID == 255 && err.Error() != "unknown packet ID: 255" {
					t.Errorf("Decode() unexpected error message: %v", err)
				}
			} else {
				if err != nil {
					t.Errorf("Decode() unexpected error: %v", err)
				}
			}
		})
	}
}
