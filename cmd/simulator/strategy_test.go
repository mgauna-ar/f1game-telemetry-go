package main

import "testing"

// The player's out-laps are the laps after the stops, as the game reports them.
func TestSimStrategyOutLap(t *testing.T) {
	for lap := uint8(1); lap <= simStrategyLaps; lap++ {
		want := lap == 6 || lap == simStrategyVSCLap+1
		if got := simStrategyOutLap(lap); got != want {
			t.Errorf("lap %d out-lap = %v, want %v", lap, got, want)
		}
	}
}
