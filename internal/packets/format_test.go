package packets

import "testing"

func TestFormatLapTimeMS(t *testing.T) {
	tests := []struct {
		ms   uint32
		want string
	}{
		{0, NoLapTime},
		{999, "0.999"},
		{59_999, "59.999"},
		{60_000, "1:00.000"},
		{83_456, "1:23.456"},
		{61_005, "1:01.005"},
		{605_007, "10:05.007"},
	}
	for _, tt := range tests {
		if got := FormatLapTimeMS(tt.ms); got != tt.want {
			t.Errorf("FormatLapTimeMS(%d) = %q, want %q", tt.ms, got, tt.want)
		}
	}
}
