package main

import (
	"bytes"
	"encoding/binary"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// The strategy scenario is a short race run on the game's pit plan. The plan's first stop is
// ideal on lap 3 and latest on lap 5: the player ignores the ideal lap and pits at the end of lap
// 5. The game then plans the second stop for lap 10 (latest 11), and a VSC on lap 9 brings it a
// lap early: the player pits under it. The player runs P2 behind car 2 (car 1 is the teammate),
// which pits at the end of lap 2 (the overcut call); lap 12 is the last. AI cars pit on the first laps, as in the pit
// scenario, so the server learns the pit entry before the plan's first call.
const (
	simStrategyLaps         = 12
	simStrategyRejoin       = 9
	simStrategyTyreAgeStart = 3 // the player's tyres are this many laps old at the start
	simStrategyVSCLap       = 9
	simStrategyVSCFromM     = 2500 // the VSC comes out this far into simStrategyVSCLap...
	simStrategyVSCEndingM   = 600  // ...its ending is announced this far into the next lap...
	simStrategyVSCEndM      = 1000 // ...and it ends this far into it
)

// simStrategyAIPitLaps are the AI cars that pit in the strategy scenario and the lap each pits at
// the end of: car 2, ahead of the player, and the pit scenario's cars.
var simStrategyAIPitLaps = map[int]uint8{2: 2, 9: 1, 10: 2, 11: 3}

// simStrategyPosition is car carIdx's position in the strategy scenario: car 2 leads the player
// and the teammate (car 1).
func simStrategyPosition(carIdx int) uint8 {
	switch carIdx {
	case 0:
		return 2
	case 1:
		return 3
	case 2:
		return 1
	}
	return uint8(carIdx + 1)
}

// simStrategyStops are the laps the player pits at the end of.
var simStrategyStops = []uint8{5, simStrategyVSCLap}

// simStrategyPlans are the game's plan for each stop: its ideal and latest lap.
var simStrategyPlans = [][2]uint8{{3, 5}, {10, 11}}

// simStrategyStopsMade is how many stops the player has made lapDist into lap lapNum: a stop
// counts once the car leaves the box.
func simStrategyStopsMade(lapNum uint8, lapDist float32) int {
	n := 0
	for _, p := range simStrategyStops {
		if lapNum > p+1 || (lapNum == p+1 && lapDist >= simPitBoxEndM) {
			n++
		}
	}
	return n
}

// simStrategyPitStatus is the player's pit status lapDist into lap lapNum.
func simStrategyPitStatus(lapNum uint8, lapDist float32) uint8 {
	for _, p := range simStrategyStops {
		if s := simPitStatus(lapNum, lapDist, p); s != packets.PitStatusNone {
			return s
		}
	}
	return packets.PitStatusNone
}

// simStrategyPlan is the game's plan for the player's next stop (ideal, latest lap); none after
// the last. The game moves it as the car leaves the box, while it is still in the pit lane.
func simStrategyPlan(lapNum uint8, lapDist float32) (ideal, latest uint8) {
	if n := simStrategyStopsMade(lapNum, lapDist); n < len(simStrategyPlans) {
		return simStrategyPlans[n][0], simStrategyPlans[n][1]
	}
	return 0, 0
}

// simStrategyTyreAge is how many laps old the player's tyres are lapDist into lap lapNum.
func simStrategyTyreAge(lapNum uint8, lapDist float32) uint8 {
	age := int(lapNum) - 1 + simStrategyTyreAgeStart
	for _, p := range simStrategyStops {
		if lapNum > p+1 || (lapNum == p+1 && lapDist >= simPitBoxEndM) {
			age = int(lapNum) - int(p+1)
		}
	}
	return uint8(max(age, 0))
}

// simStrategyVSC reports whether the VSC is out lapDist into lap lapNum.
func simStrategyVSC(lapNum uint8, lapDist float32) bool {
	return (lapNum == simStrategyVSCLap && lapDist >= simStrategyVSCFromM) ||
		(lapNum == simStrategyVSCLap+1 && lapDist < simStrategyVSCEndM)
}

// simStrategyVSCEnding reports whether the VSC's ending is announced between the player's lap
// distances prevLapDist and lapDist on lap lapNum.
func simStrategyVSCEnding(lapNum uint8, prevLapDist, lapDist float32) bool {
	return lapNum == simStrategyVSCLap+1 && prevLapDist < simStrategyVSCEndingM && lapDist >= simStrategyVSCEndingM
}

// buildSafetyCarEvent is a SCAR event: safety car type scType, event eventType.
func buildSafetyCarEvent(header packets.PacketHeader, scType, eventType uint8) packets.PacketEventData {
	var evtPkt packets.PacketEventData
	evtPkt.Header = header
	evtPkt.Header.PacketId = packets.PacketIDEvent
	copy(evtPkt.EventStringCode[:], packets.EventSafetyCarStatus)
	var b bytes.Buffer
	_ = binary.Write(&b, binary.LittleEndian, packets.SafetyCarEventData{SafetyCarType: scType, EventType: eventType})
	copy(evtPkt.EventDetails.Data[:], b.Bytes())
	return evtPkt
}
