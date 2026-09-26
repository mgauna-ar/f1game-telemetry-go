package packets

import "fmt"

// NoLapTime is how FormatLapTimeMS renders a missing time.
const NoLapTime = "no time"

// FormatLapTimeMS renders milliseconds as m:ss.mmm (or s.mmm under a minute).
func FormatLapTimeMS(ms uint32) string {
	if ms == 0 {
		return NoLapTime
	}
	minutes := ms / MillisPerMinute
	seconds := float64(ms%MillisPerMinute) / MillisPerSecond
	if minutes == 0 {
		return fmt.Sprintf("%.3f", seconds)
	}
	return fmt.Sprintf("%d:%06.3f", minutes, seconds)
}
