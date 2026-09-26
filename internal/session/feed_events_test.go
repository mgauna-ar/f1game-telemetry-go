package session

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"slices"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Cars in feedTestBroadcaster: 0 and 1 are named by the game, 2 only has a known driver ID and
// 3 has neither.
const (
	carColapinto  = 0
	carVerstappen = 1
	carByDriverID = 2
	carUnnamed    = 3
	unknownDriver = 250
	knownDriverID = 9 // Max Verstappen in packets.DriverNames
)

func feedTestBroadcaster(t *testing.T) *LiveBroadcaster {
	t.Helper()
	b := NewLiveBroadcaster(&mockHub{clientCount: 1})
	var participants [packets.MaxCars]packets.ParticipantData
	copy(participants[carColapinto].Name[:], "Franco Colapinto")
	copy(participants[carVerstappen].Name[:], "Max Verstappen")
	participants[carByDriverID].DriverId = knownDriverID
	participants[carUnnamed].DriverId = unknownDriver
	b.ProcessPacket(&packets.PacketParticipantsData{
		Header:        packets.PacketHeader{PacketId: packets.PacketIDParticipants, SessionUID: 0xF1},
		NumActiveCars: 4,
		Participants:  participants,
	})
	return b
}

func gameEventPacket(t *testing.T, code string, format uint16, payload any) *packets.PacketEventData {
	t.Helper()
	pkt := &packets.PacketEventData{
		Header: packets.PacketHeader{PacketFormat: format, PacketId: packets.PacketIDEvent, SessionUID: 0xF1, SessionTime: 321.5},
	}
	copy(pkt.EventStringCode[:], code)
	if payload != nil {
		var buf bytes.Buffer
		if err := binary.Write(&buf, binary.LittleEndian, payload); err != nil {
			t.Fatalf("failed to encode %s payload: %v", code, err)
		}
		copy(pkt.EventDetails.Data[:], buf.Bytes())
	}
	return pkt
}

func intValue(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func floatValue(p *float32) any {
	if p == nil {
		return nil
	}
	return *p
}

func TestGameFeedEvent(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		format  uint16
		payload any
		want    FeedEvent
	}{
		{
			name:    "fastest lap",
			code:    packets.EventFastestLap,
			payload: packets.FastestLapEventData{VehicleIdx: carVerstappen, LapTime: 81.5},
			want: FeedEvent{Type: FeedTypeFastestLap, Severity: FeedSeverityPurple,
				VehicleIdx: ptrTo(carVerstappen), DriverName: "Max Verstappen", LapTime: ptrTo(float32(81.5))},
		},
		{
			name:    "overtake",
			code:    packets.EventOvertake,
			payload: packets.OvertakeEventData{OvertakingVehicleIdx: carColapinto, BeingOvertakenVehicleIdx: carVerstappen},
			want: FeedEvent{Type: FeedTypeOvertake, Severity: FeedSeverityInfo,
				VehicleIdx: ptrTo(carColapinto), DriverName: "Franco Colapinto",
				OtherVehicleIdx: ptrTo(carVerstappen), TargetDriverName: "Max Verstappen"},
		},
		{
			name: "time penalty",
			code: packets.EventPenaltyIssued,
			payload: packets.PenaltyEventData{PenaltyType: packets.PenaltyTypeTimePenalty, InfringementType: 7,
				VehicleIdx: carVerstappen, OtherVehicleIdx: packets.InvalidVehicleIdx, Time: 5, LapNum: 12, PlacesGained: 1},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityWarning,
				VehicleIdx: ptrTo(carVerstappen), DriverName: "Max Verstappen",
				PenaltyType: ptrTo(int(packets.PenaltyTypeTimePenalty)), InfringementType: ptrTo(7),
				PenaltyTime: ptrTo(5), LapNum: ptrTo(12), PlacesGained: ptrTo(1)},
		},
		{
			name: "long time penalty is severe",
			code: packets.EventPenaltyIssued,
			payload: packets.PenaltyEventData{PenaltyType: packets.PenaltyTypeTimePenalty,
				VehicleIdx: carColapinto, OtherVehicleIdx: carVerstappen, Time: 10, LapNum: 3},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityDanger,
				VehicleIdx: ptrTo(carColapinto), DriverName: "Franco Colapinto",
				OtherVehicleIdx: ptrTo(carVerstappen), TargetDriverName: "Max Verstappen",
				PenaltyType: ptrTo(int(packets.PenaltyTypeTimePenalty)), InfringementType: ptrTo(0),
				PenaltyTime: ptrTo(10), LapNum: ptrTo(3), PlacesGained: ptrTo(0)},
		},
		{
			name: "disqualification without a time",
			code: packets.EventPenaltyIssued,
			payload: packets.PenaltyEventData{PenaltyType: packets.PenaltyTypeDisqualified,
				VehicleIdx: carColapinto, OtherVehicleIdx: packets.InvalidVehicleIdx, Time: packets.PenaltyTimeNotApplicable, LapNum: 4},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityDanger,
				VehicleIdx: ptrTo(carColapinto), DriverName: "Franco Colapinto",
				PenaltyType: ptrTo(int(packets.PenaltyTypeDisqualified)), InfringementType: ptrTo(0),
				LapNum: ptrTo(4), PlacesGained: ptrTo(0)},
		},
		{
			name:    "speed trap",
			code:    packets.EventSpeedTrapTriggered,
			payload: packets.SpeedTrapEventData{VehicleIdx: carByDriverID, Speed: 331.5},
			want: FeedEvent{Type: FeedTypeSpeedTrap, Severity: FeedSeveritySuccess,
				VehicleIdx: ptrTo(carByDriverID), DriverName: "Max Verstappen", Speed: ptrTo(float32(331.5))},
		},
		{
			name:    "retirement",
			code:    packets.EventRetirement,
			payload: packets.RetirementEventData{VehicleIdx: carUnnamed, Reason: packets.ResultReasonTerminalDamage},
			want:    FeedEvent{Type: FeedTypeRetirement, Severity: FeedSeverityDanger, VehicleIdx: ptrTo(carUnnamed)},
		},
		{
			name:    "drive through served",
			code:    packets.EventDriveThroughServed,
			payload: packets.DriveThroughPenaltyServedEventData{VehicleIdx: carColapinto},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityInfo,
				VehicleIdx: ptrTo(carColapinto), DriverName: "Franco Colapinto"},
		},
		{
			name:    "stop go served",
			code:    packets.EventStopGoServed,
			payload: packets.StopGoPenaltyServedEventData{VehicleIdx: carVerstappen, StopTime: 10},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityInfo,
				VehicleIdx: ptrTo(carVerstappen), DriverName: "Max Verstappen"},
		},
		{
			name:    "collision",
			code:    packets.EventCollision,
			format:  packets.PacketFormat2026,
			payload: [3]uint8{carVerstappen, carColapinto, 2},
			want: FeedEvent{Type: FeedTypePenalty, Severity: FeedSeverityDanger,
				VehicleIdx: ptrTo(carVerstappen), DriverName: "Max Verstappen",
				OtherVehicleIdx: ptrTo(carColapinto), TargetDriverName: "Franco Colapinto"},
		},
		{
			name:    "race winner",
			code:    packets.EventRaceWinner,
			payload: packets.RaceWinnerEventData{VehicleIdx: carColapinto},
			want: FeedEvent{Type: FeedTypeGeneral, Severity: FeedSeveritySuccess,
				VehicleIdx: ptrTo(carColapinto), DriverName: "Franco Colapinto"},
		},
		{name: "red flag", code: packets.EventRedFlag, want: FeedEvent{Type: FeedTypeFlag, Severity: FeedSeverityDanger}},
		{name: "chequered flag", code: packets.EventChequeredFlag, want: FeedEvent{Type: FeedTypeFlag, Severity: FeedSeverityInfo}},
		{name: "session started", code: packets.EventSessionStarted, want: FeedEvent{Type: FeedTypeGeneral, Severity: FeedSeverityInfo}},
		{name: "session ended", code: packets.EventSessionEnded, want: FeedEvent{Type: FeedTypeGeneral, Severity: FeedSeverityPurple}},
		{
			name:    "start lights",
			code:    packets.EventStartLights,
			payload: packets.StartLightsEventData{NumLights: 3},
			want:    FeedEvent{Type: FeedTypeGeneral, Severity: FeedSeverityWarning},
		},
		{name: "lights out", code: packets.EventLightsOut, want: FeedEvent{Type: FeedTypeGeneral, Severity: FeedSeveritySuccess}},
	}

	// The rows the broadcaster builds itself are covered by the live_broadcaster tests.
	selfBuilt := []string{packets.EventTeamMateInPits, packets.EventDisqualification, packets.EventSafetyCarStatus}
	covered := make([]string, 0, len(selfBuilt)+len(tests))
	covered = append(covered, selfBuilt...)
	for _, tt := range tests {
		covered = append(covered, tt.code)
		t.Run(tt.name, func(t *testing.T) {
			format := tt.format
			if format == 0 {
				format = packets.PacketFormat2025
			}
			b := feedTestBroadcaster(t)
			got, ok := b.gameFeedEvent(gameEventPacket(t, tt.code, format, tt.payload))
			if !ok {
				t.Fatalf("%s was not turned into a feed row", tt.code)
			}

			want := tt.want
			want.EventCode = tt.code
			want.SessionTime = 321.5
			assertFeedEvent(t, got, want)

			if !slices.Contains(FeedEventCodes, got.EventCode) {
				t.Errorf("%s is missing from FeedEventCodes", got.EventCode)
			}
			if !slices.Contains(FeedEventTypes, got.Type) {
				t.Errorf("type %q is missing from FeedEventTypes", got.Type)
			}
			if !slices.Contains(FeedSeverities, got.Severity) {
				t.Errorf("severity %q is missing from FeedSeverities", got.Severity)
			}
		})
	}

	// A code added to FeedEventCodes needs a case above (or a broadcaster test for its own rows).
	slices.Sort(covered)
	codes := slices.Clone(FeedEventCodes)
	slices.Sort(codes)
	if !slices.Equal(slices.Compact(covered), codes) {
		t.Errorf("tested codes %v do not match FeedEventCodes %v", covered, codes)
	}
}

func assertFeedEvent(t *testing.T, got, want FeedEvent) {
	t.Helper()
	checks := []struct {
		field     string
		got, want any
	}{
		{"eventCode", got.EventCode, want.EventCode},
		{"type", got.Type, want.Type},
		{"severity", got.Severity, want.Severity},
		{"vehicleIdx", intValue(got.VehicleIdx), intValue(want.VehicleIdx)},
		{"driverName", got.DriverName, want.DriverName},
		{"otherVehicleIdx", intValue(got.OtherVehicleIdx), intValue(want.OtherVehicleIdx)},
		{"targetDriverName", got.TargetDriverName, want.TargetDriverName},
		{"lapNum", intValue(got.LapNum), intValue(want.LapNum)},
		{"speed", floatValue(got.Speed), floatValue(want.Speed)},
		{"lapTime", floatValue(got.LapTime), floatValue(want.LapTime)},
		{"penaltyType", intValue(got.PenaltyType), intValue(want.PenaltyType)},
		{"infringementType", intValue(got.InfringementType), intValue(want.InfringementType)},
		{"penaltyTime", intValue(got.PenaltyTime), intValue(want.PenaltyTime)},
		{"placesGained", intValue(got.PlacesGained), intValue(want.PlacesGained)},
		{"safetyCarStatus", intValue(got.SafetyCarStatus), intValue(want.SafetyCarStatus)},
		{"sessionTime", got.SessionTime, want.SessionTime},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s = %v, want %v", c.field, c.got, c.want)
		}
	}
}

func TestGameFeedEvent_SkipsEventsTheFeedDoesNotShow(t *testing.T) {
	for _, code := range []string{
		packets.EventTeamMateInPits, // built from lap data for every car
		packets.EventSafetyCarStatus,
		packets.EventDRSEnabled,
		packets.EventDRSDisabled,
		packets.EventFlashback,
		packets.EventButtonStatus,
	} {
		t.Run(code, func(t *testing.T) {
			b := feedTestBroadcaster(t)
			if evt, ok := b.gameFeedEvent(gameEventPacket(t, code, packets.PacketFormat2025, nil)); ok {
				t.Errorf("%s should not reach the feed, got %+v", code, evt)
			}
		})
	}
}

func TestFeedEvent_JSONHasNoText(t *testing.T) {
	b := feedTestBroadcaster(t)
	evt, ok := b.gameFeedEvent(gameEventPacket(t, packets.EventOvertake, packets.PacketFormat2025,
		packets.OvertakeEventData{OvertakingVehicleIdx: carColapinto, BeingOvertakenVehicleIdx: carUnnamed}))
	if !ok {
		t.Fatal("OVTK was not turned into a feed row")
	}
	js, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var fields map[string]any
	if err := json.Unmarshal(js, &fields); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if _, has := fields["description"]; has {
		t.Errorf("feed rows must not carry text: %s", js)
	}
	// The unnamed car keeps its index and gets no made-up English name.
	if _, has := fields["targetDriverName"]; has {
		t.Errorf("an unnamed car must not get a driver name: %s", js)
	}
	if fields["otherVehicleIdx"] != float64(carUnnamed) {
		t.Errorf("otherVehicleIdx = %v, want %d", fields["otherVehicleIdx"], carUnnamed)
	}
}

func TestDriverName(t *testing.T) {
	b := feedTestBroadcaster(t)
	tests := []struct {
		name       string
		vehicleIdx int
		want       string
	}{
		{"game name", carColapinto, "Franco Colapinto"},
		{"known driver ID", carByDriverID, "Max Verstappen"},
		{"unknown driver ID", carUnnamed, ""},
		{"out of range", packets.MaxCars, ""},
		{"negative", -1, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := b.driverName(tt.vehicleIdx); got != tt.want {
				t.Errorf("driverName(%d) = %q, want %q", tt.vehicleIdx, got, tt.want)
			}
		})
	}

	if got := NewLiveBroadcaster(nil).driverName(0); got != "" {
		t.Errorf("driverName without participants = %q, want empty", got)
	}
}

func TestSafetyCarFeedEvent(t *testing.T) {
	tests := []struct {
		status   uint8
		severity string
	}{
		{packets.SafetyCarFull, FeedSeverityWarning},
		{packets.SafetyCarVirtual, FeedSeverityWarning},
		{packets.SafetyCarFormationLap, FeedSeverityInfo},
		{packets.SafetyCarNone, FeedSeveritySuccess},
	}
	for _, tt := range tests {
		evt := safetyCarFeedEvent(tt.status, 12)
		assertFeedEvent(t, evt, FeedEvent{
			EventCode: packets.EventSafetyCarStatus, Type: FeedTypeFlag, Severity: tt.severity,
			SafetyCarStatus: ptrTo(int(tt.status)), SessionTime: 12,
		})
	}
}
