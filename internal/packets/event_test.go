package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
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

func TestPacketEventData_MarshalJSON_VehicleEvents(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		format  uint16
		payload any
		want    map[string]float64
	}{
		{
			name:    "fastest lap",
			code:    EventFastestLap,
			payload: FastestLapEventData{VehicleIdx: 3, LapTime: 81.5},
			want:    map[string]float64{"VehicleIdx": 3, "LapTime": 81.5},
		},
		{
			name:    "retirement",
			code:    EventRetirement,
			payload: RetirementEventData{VehicleIdx: 4, Reason: ResultReasonTerminalDamage},
			want:    map[string]float64{"VehicleIdx": 4, "Reason": float64(ResultReasonTerminalDamage)},
		},
		{
			name:    "teammate in pits",
			code:    EventTeamMateInPits,
			payload: TeamMateInPitsEventData{VehicleIdx: 5},
			want:    map[string]float64{"VehicleIdx": 5},
		},
		{
			name:    "race winner",
			code:    EventRaceWinner,
			payload: RaceWinnerEventData{VehicleIdx: 6},
			want:    map[string]float64{"VehicleIdx": 6},
		},
		{
			name:    "drive through served",
			code:    EventDriveThroughServed,
			payload: DriveThroughPenaltyServedEventData{VehicleIdx: 7},
			want:    map[string]float64{"VehicleIdx": 7},
		},
		{
			name:    "stop go served",
			code:    EventStopGoServed,
			payload: StopGoPenaltyServedEventData{VehicleIdx: 8, StopTime: 10.5},
			want:    map[string]float64{"VehicleIdx": 8, "StopTime": 10.5},
		},
		{
			name: "penalty issued",
			code: EventPenaltyIssued,
			payload: PenaltyEventData{
				PenaltyType:      PenaltyTypeTimePenalty,
				InfringementType: 6,
				VehicleIdx:       9,
				OtherVehicleIdx:  10,
				Time:             5,
				LapNum:           12,
				PlacesGained:     1,
			},
			want: map[string]float64{
				"VehicleIdx":       9,
				"OtherVehicleIdx":  10,
				"PenaltyType":      float64(PenaltyTypeTimePenalty),
				"InfringementType": 6,
				"PenaltyTime":      5,
				"LapNum":           12,
				"PlacesGained":     1,
			},
		},
		{
			name:    "speed trap",
			code:    EventSpeedTrapTriggered,
			payload: SpeedTrapEventData{VehicleIdx: 11, Speed: 331.5},
			want:    map[string]float64{"VehicleIdx": 11, "Speed": 331.5},
		},
		{
			name:    "overtake",
			code:    EventOvertake,
			payload: OvertakeEventData{OvertakingVehicleIdx: 12, BeingOvertakenVehicleIdx: 13},
			want:    map[string]float64{"VehicleIdx": 12, "OtherVehicleIdx": 13},
		},
		{
			name:    "collision 2025",
			code:    EventCollision,
			format:  PacketFormat2025,
			payload: [2]uint8{14, 15},
			want:    map[string]float64{"VehicleIdx": 14, "OtherVehicleIdx": 15},
		},
		{
			name:    "collision 2026",
			code:    EventCollision,
			format:  PacketFormat2026,
			payload: [3]uint8{16, 17, 2},
			want:    map[string]float64{"VehicleIdx": 16, "OtherVehicleIdx": 17, "Severity": 2},
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

			js, err := json.Marshal(pkt)
			if err != nil {
				t.Fatalf("MarshalJSON failed: %v", err)
			}
			var got map[string]any
			if err := json.Unmarshal(js, &got); err != nil {
				t.Fatalf("failed to unmarshal event JSON: %v", err)
			}

			if got["EventCode"] != tt.code {
				t.Errorf("EventCode = %v, want %s", got["EventCode"], tt.code)
			}
			for field, want := range tt.want {
				v, ok := got[field].(float64)
				if !ok {
					t.Errorf("%s missing from %s", field, js)
					continue
				}
				// Compare through float32 so float fields survive the round trip.
				if float32(v) != float32(want) {
					t.Errorf("%s = %v, want %v", field, v, want)
				}
			}
		})
	}
}
