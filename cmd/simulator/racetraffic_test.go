package main

import (
	"math"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// One run of the race traffic scenario to the start of lap 4: car 1 holds raceBattleSec behind
// the player through the first half of lap 2, right behind them in the order; the two cars a lap
// up go by the player on lap 3, under a blue flag shown before the first pass and gone after the
// second.
func TestRaceTrafficSim_Run(t *testing.T) {
	rs := newRaceTrafficSim()
	passLap := map[int]uint8{}
	blueBeforePass := false
	for k := 0; k < 20*400 && rs.cars[0].lapNum <= raceLappedLap; k++ {
		rs.step(0.05)
		p := rs.cars[0]
		for _, i := range []int{2, 3} {
			if _, seen := passLap[i]; !seen && rs.passed[i] {
				passLap[i] = p.lapNum
			}
		}
		if rs.blue && !rs.passed[2] {
			blueBeforePass = true
		}
		if p.lapNum == 2 && p.lapM > 100 && p.lapM < raceBattleUntilM {
			var player, car packets.LapData
			rs.applyLap(0, &player)
			rs.applyLap(1, &car)
			gap := float64(car.DeltaToCarInFrontMSPart) / 1000
			if car.CarPosition != player.CarPosition+1 || math.Abs(gap-raceBattleSec) > 0.1 {
				t.Fatalf("at %.0f m into lap 2, car 1 is P%d, %.2f s behind P%d: want right behind, %.1f s back",
					p.lapM, car.CarPosition, gap, player.CarPosition, raceBattleSec)
			}
		}
	}
	if rs.cars[0].lapNum != raceLappedLap+1 {
		t.Fatalf("the player reached lap %d, want %d", rs.cars[0].lapNum, raceLappedLap+1)
	}
	if passLap[2] != raceLappedLap || passLap[3] != raceLappedLap {
		t.Errorf("lapping cars went by on laps %v, want both on lap %d", passLap, raceLappedLap)
	}
	if !blueBeforePass {
		t.Error("no blue flag before the first lapping car went by")
	}
	for k := 0; k < 40; k++ {
		rs.step(0.05)
	}
	if rs.playerFlag() == packets.VehicleFIAFlagBlue {
		t.Error("the flag is still blue after both lapping cars went by")
	}
	var lapper, player packets.LapData
	rs.applyLap(2, &lapper)
	rs.applyLap(0, &player)
	if lapper.TotalDistance-player.TotalDistance < simTrackLengthM/2 {
		t.Errorf("the lapping car is %.0f m ahead in the race, want a lap", lapper.TotalDistance-player.TotalDistance)
	}
}

// A lapping car joins with lap times as if it had raced: its first lap over the line is a whole one.
func TestRaceTrafficSim_LappingCarsLapTimes(t *testing.T) {
	rs := newRaceTrafficSim()
	for rs.cars[0].lapNum < raceLappedLap {
		rs.step(0.05)
	}
	full := rs.secOver(0, simTrackLengthM, raceLapperShare) * 1000
	for k := 0; k < 20*30; k++ {
		rs.step(0.05)
	}
	for _, i := range []int{2, 3} {
		if got := float64(rs.cars[i].lastLapMs); math.Abs(got-full) > 200 {
			t.Errorf("car %d's last lap %.0f ms, want a whole lap, %.0f ms", i, got, full)
		}
	}
}

// On lap 4 the player goes by car 4, stopped on the straight, then by car 5 at half pace; car 4
// goes out of the race after it and car 5 speeds up.
func TestRaceTrafficSim_SlowCars(t *testing.T) {
	rs := newRaceTrafficSim()
	stoppedAt, slowSpeed := -1.0, 0.0
	for k := 0; k < 20*600 && !rs.passed[5]; k++ {
		rs.step(0.05)
		if rs.active[4] && !rs.passed[4] {
			if stoppedAt < 0 {
				stoppedAt = rs.cars[4].lapM
			}
			if rs.cars[4].lapM != stoppedAt || rs.speedKmh(4) != 0 {
				t.Fatalf("car 4 moved from %.0f m to %.0f m", stoppedAt, rs.cars[4].lapM)
			}
		}
		if rs.active[5] && !rs.passed[5] {
			slowSpeed = rs.cars[5].speedMps / rs.speedAt(rs.cars[5].lapM)
		}
	}
	if !rs.passed[4] || !rs.passed[5] {
		t.Fatalf("the player went by car 4: %v, car 5: %v; want both", rs.passed[4], rs.passed[5])
	}
	if stoppedAt != raceStoppedAtM || rs.cars[0].lapNum != raceSlowLap {
		t.Errorf("car 4 stopped at %.0f m, passed on lap %d; want %.0f m on lap %d", stoppedAt, rs.cars[0].lapNum, raceStoppedAtM, raceSlowLap)
	}
	if math.Abs(slowSpeed-raceSlowShare) > 0.01 {
		t.Errorf("car 5 ran at %.2f of the push pace before the pass, want %v", slowSpeed, raceSlowShare)
	}
	for k := 0; k < 20*int(raceSlowGoneSec+1); k++ {
		rs.step(0.05)
	}
	var gone packets.LapData
	rs.applyLap(4, &gone)
	if gone.ResultStatus != packets.ResultStatusInactive || rs.cars[5].share != raceShare {
		t.Errorf("after the passes car 4's result status is %d, car 5's share %.2f; want inactive, and race pace", gone.ResultStatus, rs.cars[5].share)
	}
}
