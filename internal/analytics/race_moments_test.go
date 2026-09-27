package analytics

import (
	"reflect"
	"strings"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	sessionfeed "github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

func scRow(status uint8, lap int) sessionfeed.FeedEvent {
	return sessionfeed.FeedEvent{EventCode: packets.EventSafetyCarStatus, SafetyCarStatus: new(int(status)), RaceLap: lap}
}

func TestRaceControlPeriods(t *testing.T) {
	events := []sessionfeed.FeedEvent{
		scRow(packets.SafetyCarFormationLap, 0),
		scRow(packets.SafetyCarNone, 1),
		{EventCode: packets.EventLightsOut, RaceLap: 1},
		scRow(packets.SafetyCarVirtual, 8),
		// The VSC becomes a full safety car
		scRow(packets.SafetyCarFull, 9),
		scRow(packets.SafetyCarNone, 12),
		// Still out when the session ends
		scRow(packets.SafetyCarVirtual, 40),
	}
	want := []RaceControlPeriod{
		{Kind: PeriodVirtualSafetyCar, StartLap: 8, EndLap: 9},
		{Kind: PeriodSafetyCar, StartLap: 9, EndLap: 12},
		{Kind: PeriodVirtualSafetyCar, StartLap: 40},
	}
	if got := RaceControlPeriods(events); !reflect.DeepEqual(got, want) {
		t.Errorf("RaceControlPeriods = %+v, want %+v", got, want)
	}
	if got := RaceControlPeriods(nil); got != nil {
		t.Errorf("expected no periods without events, got %+v", got)
	}
}

func TestBuildSessionDebriefKeyMoments(t *testing.T) {
	session := &storage.Session{TrackName: "Monza", SessionType: "Race", PlayerCarIndex: new(1)}
	cls := &ClassificationResponse{Standings: []DriverStanding{
		{Position: 1, CarIndex: 0, DriverName: "Leader"},
		{Position: 2, CarIndex: 1, DriverName: "Me"},
	}}
	events := []sessionfeed.FeedEvent{
		scRow(packets.SafetyCarFull, 5),
		scRow(packets.SafetyCarNone, 7),
		{EventCode: packets.EventOvertake, VehicleIdx: new(1), OtherVehicleIdx: new(4), RaceLap: 3},
		{EventCode: packets.EventOvertake, VehicleIdx: new(1), OtherVehicleIdx: new(5), RaceLap: 4},
		{EventCode: packets.EventOvertake, VehicleIdx: new(4), OtherVehicleIdx: new(1), RaceLap: 6},
		// Other cars' overtakes and warnings are not key moments
		{EventCode: packets.EventOvertake, VehicleIdx: new(6), OtherVehicleIdx: new(7), RaceLap: 6},
		{EventCode: packets.EventPenaltyIssued, VehicleIdx: new(8), DriverName: "Rival",
			PenaltyType: new(int(packets.PenaltyTypeWarning)), RaceLap: 8},
		{EventCode: packets.EventPenaltyIssued, VehicleIdx: new(1), DriverName: "Me",
			PenaltyType: new(int(packets.PenaltyTypeTimePenalty)), PenaltyTime: new(5), RaceLap: 9},
		{EventCode: packets.EventRetirement, VehicleIdx: new(9), DriverName: "Unlucky", RaceLap: 10},
	}
	summary := BuildSessionDebrief(session, cls, events).Summary
	for _, want := range []string{
		"RACE CONTROL KEY MOMENTS",
		"- Safety Car: laps 5-7",
		"- L9: YOU: 5s time penalty",
		"- L10: Unlucky retired",
		"- Your overtakes: 2 made, 1 suffered",
	} {
		if !strings.Contains(summary, want) {
			t.Errorf("expected %q in the debrief:\n%s", want, summary)
		}
	}
	if strings.Contains(summary, "Rival") {
		t.Errorf("a warning is not a key moment:\n%s", summary)
	}

	if old := BuildSessionDebrief(session, cls, nil).Summary; strings.Contains(old, "RACE CONTROL") {
		t.Errorf("a session without stored events has no key moments section:\n%s", old)
	}
}
