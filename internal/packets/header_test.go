package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"strings"
	"testing"
)

func TestFormatSessionUID(t *testing.T) {
	tests := []struct {
		uid      uint64
		expected string
	}{
		{0, "0x0000000000000000"},
		{0x1234567890ABCDEF, "0x1234567890ABCDEF"},
		{1, "0x0000000000000001"},
		{0xFFFFFFFFFFFFFFFF, "0xFFFFFFFFFFFFFFFF"},
	}

	for _, tt := range tests {
		got := FormatSessionUID(tt.uid)
		if got != tt.expected {
			t.Errorf("FormatSessionUID(%d) = %s, expected %s", tt.uid, got, tt.expected)
		}
	}
}

func TestPacketHeader_MarshalJSON(t *testing.T) {
	h := PacketHeader{
		PacketFormat:            PacketFormat2026,
		GameYear:                26,
		GameMajorVersion:        1,
		GameMinorVersion:        0,
		PacketVersion:           1,
		PacketId:                PacketIDLiveSnapshot,
		SessionUID:              0x1234567890ABCDEF,
		SessionTime:             123.45,
		FrameIdentifier:         500,
		OverallFrameIdentifier:  600,
		PlayerCarIndex:          2,
		SecondaryPlayerCarIndex: 255,
	}

	data, err := json.Marshal(h)
	if err != nil {
		t.Fatalf("failed to marshal PacketHeader: %v", err)
	}

	jsonStr := string(data)
	if !strings.Contains(jsonStr, `"SessionUID":"0x1234567890ABCDEF"`) {
		t.Errorf("expected SessionUID to be serialized as hex string, got: %s", jsonStr)
	}
	if !strings.Contains(jsonStr, `"PacketId":255`) {
		t.Errorf("expected PacketId to be serialized, got: %s", jsonStr)
	}
	if !strings.Contains(jsonStr, `"PlayerCarIndex":2`) {
		t.Errorf("expected PlayerCarIndex to be serialized, got: %s", jsonStr)
	}
}

func TestPacketHeader_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		expectedUID uint64
		wantErr     bool
	}{
		{
			name:        "Hex string SessionUID",
			jsonInput:   `{"PacketId":1,"SessionUID":"0x1234567890ABCDEF"}`,
			expectedUID: 0x1234567890ABCDEF,
		},
		{
			name:        "Hex string lowercase 0x",
			jsonInput:   `{"PacketId":1,"SessionUID":"0xabcdef"}`,
			expectedUID: 0xABCDEF,
		},
		{
			name:        "Raw numeric SessionUID",
			jsonInput:   `{"PacketId":1,"SessionUID":123456}`,
			expectedUID: 123456,
		},
		{
			name:        "Decimal string SessionUID",
			jsonInput:   `{"PacketId":1,"SessionUID":"987654321"}`,
			expectedUID: 987654321,
		},
		{
			name:        "Empty string SessionUID",
			jsonInput:   `{"PacketId":1,"SessionUID":""}`,
			expectedUID: 0,
		},
		{
			name:        "Null SessionUID",
			jsonInput:   `{"PacketId":1,"SessionUID":null}`,
			expectedUID: 0,
		},
		{
			name:        "Missing SessionUID",
			jsonInput:   `{"PacketId":1}`,
			expectedUID: 0,
		},
		{
			name:      "Invalid string SessionUID",
			jsonInput: `{"PacketId":1,"SessionUID":"invalid-hex"}`,
			wantErr:   true,
		},
		{
			name:      "Invalid type for SessionUID",
			jsonInput: `{"PacketId":1,"SessionUID":["array"]}`,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var h PacketHeader
			err := json.Unmarshal([]byte(tt.jsonInput), &h)
			if (err != nil) != tt.wantErr {
				t.Fatalf("json.Unmarshal() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && h.SessionUID != tt.expectedUID {
				t.Errorf("expected SessionUID %d (0x%X), got %d (0x%X)", tt.expectedUID, tt.expectedUID, h.SessionUID, h.SessionUID)
			}
		})
	}
}

func TestPacketHeader_RoundTripJSON(t *testing.T) {
	orig := PacketHeader{
		PacketFormat:            PacketFormat2026,
		GameYear:                26,
		GameMajorVersion:        1,
		GameMinorVersion:        2,
		PacketVersion:           1,
		PacketId:                PacketIDLapData,
		SessionUID:              0xABCDEF0123456789,
		SessionTime:             88.5,
		FrameIdentifier:         1234,
		OverallFrameIdentifier:  5678,
		PlayerCarIndex:          1,
		SecondaryPlayerCarIndex: 255,
	}

	bytesData, err := json.Marshal(orig)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var decoded PacketHeader
	if err := json.Unmarshal(bytesData, &decoded); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if decoded != orig {
		t.Errorf("round trip mismatch: got %+v, want %+v", decoded, orig)
	}
}

func TestDecodeHeaderWithOffset(t *testing.T) {
	var buf bytes.Buffer
	_ = binary.Write(&buf, binary.LittleEndian, uint16(PacketFormat2026))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(26))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(0))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(PacketIDSession))
	_ = binary.Write(&buf, binary.LittleEndian, uint64(0x1122334455667788))
	_ = binary.Write(&buf, binary.LittleEndian, float32(12.5))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(100))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(200))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(0))
	_ = binary.Write(&buf, binary.LittleEndian, uint8(255))

	raw := buf.Bytes()
	if len(raw) != HeaderSize {
		t.Fatalf("expected header size %d, got %d", HeaderSize, len(raw))
	}

	h, offset, err := DecodeHeaderWithOffset(raw)
	if err != nil {
		t.Fatalf("failed to decode header: %v", err)
	}
	if offset != HeaderSize {
		t.Errorf("expected offset %d, got %d", HeaderSize, offset)
	}
	if h.PacketFormat != PacketFormat2026 || h.SessionUID != 0x1122334455667788 || h.PacketId != PacketIDSession {
		t.Errorf("unexpected header decoded: %+v", h)
	}

	// Too short data
	_, _, err = DecodeHeaderWithOffset(raw[:HeaderSize-1])
	if err == nil {
		t.Errorf("expected error for truncated header, got nil")
	}

	// DecodeHeader
	h2, err := DecodeHeader(raw)
	if err != nil {
		t.Fatalf("DecodeHeader failed: %v", err)
	}
	if h2 != h {
		t.Errorf("DecodeHeader mismatch: got %+v, want %+v", h2, h)
	}
}
