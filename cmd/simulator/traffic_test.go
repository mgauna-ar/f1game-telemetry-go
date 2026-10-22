package main

import (
	"math"
	"testing"
)

// One run of the traffic scenario: the push lap takes the player's simulated lap time, car 1
// passes the player on the out-lap and the player passes car 2 on the push lap.
func TestTrafficSim_Run(t *testing.T) {
	ts := newTrafficSim()
	var pushLapMs uint32
	passedOnStage := map[int]int{}
	left := false
	for k := 0; k < 20*500 && (!left || ts.stage != trafficGarage); k++ {
		stage := ts.stage
		left = left || stage != trafficGarage
		ts.step(0.05)
		for i := 1; i <= 2; i++ {
			if _, seen := passedOnStage[i]; !seen && ts.passed[i] {
				passedOnStage[i] = stage
			}
		}
		if stage == trafficPushLap && ts.stage == trafficInLap {
			pushLapMs = ts.cars[0].lastLapMs
		}
	}
	s := simSectorsMS(0, 1)
	if want := float64(s[0] + s[1] + s[2]); math.Abs(float64(pushLapMs)-want) > 400 {
		t.Errorf("push lap %d ms, want about %v", pushLapMs, want)
	}
	if passedOnStage[1] != trafficOutLap || passedOnStage[2] != trafficPushLap {
		t.Errorf("passes by stage %v: want car 1 on the out-lap and car 2 on the push lap", passedOnStage)
	}
}
