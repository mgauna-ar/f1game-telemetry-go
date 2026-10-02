package engineer

import (
	"context"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestEngineerEngine_RaceFinishSaysTheResult(t *testing.T) {
	tests := []struct {
		name        string
		sessionType uint8
		pos         uint8
		want        string // "" for no call
	}{
		{"win", packets.SessionRace, 1, "race_finish_win"},
		{"podium", packets.SessionRace, 3, "race_finish_podium"},
		{"points", packets.SessionRace, 9, "race_finish_points"},
		{"outside the points", packets.SessionRace, 15, "race_finish"},
		{"ninth in a sprint scores nothing", packets.SessionSprintRace, 9, "race_finish"},
		{"eighth in a sprint scores", packets.SessionSprintRace, 8, "race_finish_points"},
		{"the end of qualifying is no race finish", packets.SessionQ3, 4, ""},
		{"nor the end of practice", packets.SessionP1, 4, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &mockBroadcaster{}
			e := newTestEngineerEngine(b)
			h := createTestHeader(packets.PacketFormat2025, 880, 0)
			e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: h, SessionType: tt.sessionType, TrackLength: qualyTrackLen})
			e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
				{CurrentLapNum: 20, CarPosition: tt.pos, ResultStatus: packets.ResultStatusFinished, DriverStatus: packets.DriverStatusOnTrack},
			}})
			for _, key := range []string{"race_finish_win", "race_finish_podium", "race_finish_points", "race_finish"} {
				want := 0
				if key == tt.want {
					want = 1
				}
				if got := spoken(t, b, key); got != want {
					t.Errorf("%s said %d times, want %d", key, got, want)
				}
			}
		})
	}
}

func TestFlagsRule_FastestLapOnlyThePlayers(t *testing.T) {
	event := func(vehicle uint8) *packets.PacketEventData {
		p := &packets.PacketEventData{EventStringCode: [4]uint8{'F', 'T', 'L', 'P'}}
		p.EventDetails.Data[0] = vehicle
		return p
	}
	for _, tt := range []struct {
		vehicle uint8
		want    bool
	}{{0, true}, {4, false}} {
		ctx := &EvaluationContext{Packet: event(tt.vehicle), Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		if got := directiveFor(NewFlagsRule().Evaluate(ctx), "race_fastest_lap") != nil; got != tt.want {
			t.Errorf("fastest lap by car %d: call = %v, want %v", tt.vehicle, got, tt.want)
		}
	}
}

func TestFlagsRule_Penalties(t *testing.T) {
	rule := NewFlagsRule()
	step := func(timeSec, driveThroughs, stopGos uint8) *Directive {
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{Penalties: timeSec, NumUnservedDriveThroughPens: driveThroughs, NumUnservedStopGoPens: stopGos}
		ctx := &EvaluationContext{Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "penalties" {
				return &d
			}
		}
		return nil
	}
	expect := func(d *Directive, subAlert string, seconds int) {
		t.Helper()
		if d == nil || d.SubAlert != subAlert {
			t.Fatalf("expected %s, got %+v", subAlert, d)
		}
		got := 0
		if d.Values != nil {
			got = d.Values.PenaltySec
		}
		if got != seconds {
			t.Fatalf("penalty seconds = %d, want %d", got, seconds)
		}
	}

	expect(step(5, 0, 0), "penalties_incurred", 5)
	if d := step(5, 0, 0); d != nil {
		t.Fatalf("the same penalty was called again: %+v", d)
	}
	expect(step(10, 0, 0), "penalties_incurred", 5) // a second one: its own five seconds
	if d := step(0, 0, 0); d != nil {               // served at the stop
		t.Fatalf("serving a penalty is no new one: %+v", d)
	}
	expect(step(5, 0, 0), "penalties_incurred", 5) // a new one after the stop is still called
	expect(step(5, 1, 0), "penalty_drive_through", 0)
	expect(step(5, 1, 1), "penalty_stop_go", 0)
}

func TestFlagsRule_TrackLimitsSaysTheCount(t *testing.T) {
	lapPkt := &packets.PacketLapData{}
	lapPkt.LapData[0] = packets.LapData{CornerCuttingWarnings: 3}
	ctx := &EvaluationContext{Packet: lapPkt, LapData: lapPkt, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
		Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
	d := directiveFor(NewFlagsRule().Evaluate(ctx), "track_limits_warnings")
	if d == nil || d.Values == nil || d.Values.Count != 3 {
		t.Fatalf("expected 3 warnings in the values, got %+v", d)
	}
}

func TestRivalsRule_DRSOnlyWhenAvailable(t *testing.T) {
	rivalsCtx := func(rivalDRS, playerDRS uint8) *EvaluationContext {
		lapPkt := &packets.PacketLapData{}
		lapPkt.LapData[0] = packets.LapData{CarPosition: 5, CurrentLapNum: 8, DeltaToCarInFrontMSPart: 700}
		lapPkt.LapData[1] = packets.LapData{CarPosition: 6, CurrentLapNum: 8, DeltaToCarInFrontMSPart: 600}
		lapPkt.LapData[2] = packets.LapData{CarPosition: 4, CurrentLapNum: 8}
		status := &packets.PacketCarStatusData{}
		status.CarStatusData[0].DRSAllowed = playerDRS
		status.CarStatusData[1].DRSAllowed = rivalDRS
		return &EvaluationContext{
			Packet: lapPkt, LapData: lapPkt, Status: status, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			PacketFormat: packets.PacketFormat2025,
			Session:      &packets.PacketSessionData{SessionType: packets.SessionRace},
		}
	}
	tests := []struct {
		name                 string
		rivalDRS, playerDRS  uint8
		wantDefend, wantAtck string
	}{
		{"no DRS yet", 0, 0, "rival_defend", "rival_attack"},
		{"both have DRS", 1, 1, "rival_defend_drs", "rival_attack_drs"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dirs := NewRivalsRule().Evaluate(rivalsCtx(tt.rivalDRS, tt.playerDRS))
			defend, attack := directiveFor(dirs, tt.wantDefend), directiveFor(dirs, tt.wantAtck)
			if defend == nil || defend.ID != "rival_defend" || defend.Values.Behind.GapSec != 0.6 {
				t.Errorf("expected %s with the 0.6 s gap behind, got %v", tt.wantDefend, subAlerts(dirs))
			}
			if attack == nil || attack.ID != "rival_attack" || attack.Values.Ahead.GapSec != 0.7 {
				t.Errorf("expected %s with the 0.7 s gap ahead, got %v", tt.wantAtck, subAlerts(dirs))
			}
		})
	}
}

func TestTyresRule_WearWarningThenCritical(t *testing.T) {
	rule := NewTyresRule()
	wear := func(pct float32) []Directive {
		dmg := &packets.PacketCarDamageData{}
		dmg.CarDamageData[0].TyresWear = [4]float32{pct, pct, pct, pct}
		return rule.Evaluate(&EvaluationContext{Packet: dmg, Damage: dmg, Config: DefaultEngineerConfig(), Phase: PhaseRacing})
	}
	if d := directiveFor(wear(45), "tyre_wear"); d == nil || d.Urgency != UrgencyLow {
		t.Fatalf("expected the wear warning at 45%%, got %+v", d)
	}
	if d := directiveFor(wear(78), "tyre_wear_critical"); d == nil || d.Urgency != UrgencyHigh {
		t.Fatalf("expected the critical wear call at 78%%, got %+v", d)
	}
}
