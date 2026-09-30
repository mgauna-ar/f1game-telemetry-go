package packets

import "testing"

func historyLap(lapMS, s1, s2, s3 uint32, flags uint8) LapHistoryData {
	return LapHistoryData{
		LapTimeInMS:            lapMS,
		Sector1TimeMSPart:      uint16(s1 % MillisPerMinute),
		Sector1TimeMinutesPart: uint8(s1 / MillisPerMinute),
		Sector2TimeMSPart:      uint16(s2 % MillisPerMinute),
		Sector2TimeMinutesPart: uint8(s2 / MillisPerMinute),
		Sector3TimeMSPart:      uint16(s3 % MillisPerMinute),
		Sector3TimeMinutesPart: uint8(s3 / MillisPerMinute),
		LapValidBitFlags:       flags,
	}
}

func TestLapHistorySectorsAndValidity(t *testing.T) {
	lap := historyLap(150_500, 61_000, 30_000, 59_500, LapValidBitFlag)
	if got := lap.SectorsMS(); got != [3]uint32{61_000, 30_000, 59_500} {
		t.Errorf("SectorsMS() = %v, want the minutes parts added", got)
	}
	if !lap.Valid() {
		t.Error("Valid() = false for a lap with the valid bit")
	}
	if historyLap(1, 1, 0, 0, Sector1ValidBitFlag).Valid() {
		t.Error("Valid() = true without the lap valid bit")
	}
}

func TestSessionHistoryLapLookup(t *testing.T) {
	h := &PacketSessionHistoryData{NumLaps: 3}
	h.LapHistoryData[0] = historyLap(90_000, 30_000, 30_000, 30_000, LapValidBitFlag)
	h.LapHistoryData[1] = historyLap(89_000, 29_000, 30_000, 30_000, LapValidBitFlag)
	h.LapHistoryData[2] = historyLap(0, 29_500, 0, 0, 0) // in progress

	if lap, ok := h.Lap(2); !ok || lap.LapTimeInMS != 89_000 {
		t.Errorf("Lap(2) = %+v, %v", lap, ok)
	}
	for _, n := range []int{0, 4, -1} {
		if _, ok := h.Lap(n); ok {
			t.Errorf("Lap(%d) found a lap outside the %d the packet holds", n, h.NumLaps)
		}
	}
	if last, ok := h.LastCompletedLap(); !ok || last.LapTimeInMS != 89_000 {
		t.Errorf("LastCompletedLap() = %+v, %v; want lap 2, not the lap in progress", last, ok)
	}
	if _, ok := (&PacketSessionHistoryData{NumLaps: 1}).LastCompletedLap(); ok {
		t.Error("LastCompletedLap() found a lap on the first lap")
	}
}
