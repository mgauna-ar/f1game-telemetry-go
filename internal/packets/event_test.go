package packets

import (
	"bytes"
	"encoding/binary"
	"testing"
)

// eventDetails packs a typed event payload into the 12-byte event union.
func eventDetails(t *testing.T, payload any) EventDataDetails {
	t.Helper()
	var buf bytes.Buffer
	if err := binary.Write(&buf, binary.LittleEndian, payload); err != nil {
		t.Fatalf("failed to encode event payload: %v", err)
	}
	var d EventDataDetails
	copy(d.Data[:], buf.Bytes())
	return d
}

func TestPacketEventData_VehicleEventAccessors(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		format  uint16
		payload any
		decode  func(PacketEventData) (vehicleIdx uint8, ok bool)
		want    uint8
	}{
		{
			name:    "fastest lap",
			code:    EventFastestLap,
			payload: FastestLapEventData{VehicleIdx: 3, LapTime: 81.5},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.FastestLapData()
				return d.VehicleIdx, ok && d.LapTime == 81.5
			},
			want: 3,
		},
		{
			name:    "retirement",
			code:    EventRetirement,
			payload: RetirementEventData{VehicleIdx: 4, Reason: ResultReasonTerminalDamage},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.RetirementData()
				return d.VehicleIdx, ok && d.Reason == ResultReasonTerminalDamage
			},
			want: 4,
		},
		{
			name:    "race winner",
			code:    EventRaceWinner,
			payload: RaceWinnerEventData{VehicleIdx: 6},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.RaceWinnerData()
				return d.VehicleIdx, ok
			},
			want: 6,
		},
		{
			name:    "drive through served",
			code:    EventDriveThroughServed,
			payload: DriveThroughPenaltyServedEventData{VehicleIdx: 7},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.DriveThroughServedData()
				return d.VehicleIdx, ok
			},
			want: 7,
		},
		{
			name:    "stop go served",
			code:    EventStopGoServed,
			payload: StopGoPenaltyServedEventData{VehicleIdx: 8, StopTime: 10.5},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.StopGoServedData()
				return d.VehicleIdx, ok && d.StopTime == 10.5
			},
			want: 8,
		},
		{
			name: "penalty issued",
			code: EventPenaltyIssued,
			payload: PenaltyEventData{
				PenaltyType: PenaltyTypeTimePenalty, VehicleIdx: 9, OtherVehicleIdx: 10, Time: 5, LapNum: 12,
			},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.PenaltyData()
				return d.VehicleIdx, ok && d.OtherVehicleIdx == 10 && d.Time == 5 && d.LapNum == 12
			},
			want: 9,
		},
		{
			name:    "speed trap",
			code:    EventSpeedTrapTriggered,
			payload: SpeedTrapEventData{VehicleIdx: 11, Speed: 331.5},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.SpeedTrapData()
				return d.VehicleIdx, ok && d.Speed == 331.5
			},
			want: 11,
		},
		{
			name:    "overtake",
			code:    EventOvertake,
			payload: OvertakeEventData{OvertakingVehicleIdx: 12, BeingOvertakenVehicleIdx: 13},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.OvertakeData()
				return d.OvertakingVehicleIdx, ok && d.BeingOvertakenVehicleIdx == 13
			},
			want: 12,
		},
		{
			name:    "collision 2025",
			code:    EventCollision,
			format:  PacketFormat2025,
			payload: [2]uint8{14, 15},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.CollisionData()
				return d.Vehicle1Idx, ok && d.Vehicle2Idx == 15 && d.Severity == 0
			},
			want: 14,
		},
		{
			name:    "collision 2026",
			code:    EventCollision,
			format:  PacketFormat2026,
			payload: [3]uint8{16, 17, 2},
			decode: func(p PacketEventData) (uint8, bool) {
				d, ok := p.CollisionData()
				return d.Vehicle1Idx, ok && d.Vehicle2Idx == 17 && d.Severity == 2
			},
			want: 16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			format := tt.format
			if format == 0 {
				format = PacketFormat2025
			}
			pkt := PacketEventData{
				Header:       PacketHeader{PacketFormat: format, PacketId: PacketIDEvent},
				EventDetails: eventDetails(t, tt.payload),
			}
			copy(pkt.EventStringCode[:], tt.code)

			got, ok := tt.decode(pkt)
			if !ok {
				t.Fatalf("%s payload did not decode as expected", tt.code)
			}
			if got != tt.want {
				t.Errorf("vehicle index = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestPacketEventData_AccessorsRejectOtherCodes(t *testing.T) {
	var pkt PacketEventData
	copy(pkt.EventStringCode[:], EventButtonStatus)

	if _, ok := pkt.RaceWinnerData(); ok {
		t.Error("RaceWinnerData accepted a BUTN event")
	}
	if _, ok := pkt.DriveThroughServedData(); ok {
		t.Error("DriveThroughServedData accepted a BUTN event")
	}
	if _, ok := pkt.StopGoServedData(); ok {
		t.Error("StopGoServedData accepted a BUTN event")
	}
}
