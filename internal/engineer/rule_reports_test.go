package engineer

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// Car indices in the reports fixture: the player runs between a car ahead and a car behind.
const (
	rpPlayer = 0
	rpAhead  = 1
	rpBehind = 2
)

// reportsRace is a race for the reports rule: the player's position, the gaps around them now,
// the lap ends behind them and their tyre wear.
type reportsRace struct {
	lap         int
	lapDistance float32
	position    uint8
	gapAheadMS  uint32
	gapBehindMS uint32
	pitStops    uint8
	tyreAge     uint8
	wear        [4]float32
	records     []LapRecord
	safetyCar   uint8
	callLaps    map[string]int
	boxDueLap   int
	cfg         EngineerConfig
}

func newReportsRace(lap int) *reportsRace {
	return &reportsRace{lap: lap, lapDistance: 500, position: 5, gapAheadMS: 1400, gapBehindMS: 2000, tyreAge: 10, cfg: DefaultEngineerConfig()}
}

// withGapHistory adds lap ends before r.lap with the same cars around the player: the gap ahead
// moves aheadPerLapMS a lap and the gap behind behindPerLapMS a lap, ending at the gaps now.
func (r *reportsRace) withGapHistory(laps, aheadPerLapMS, behindPerLapMS int) *reportsRace {
	for i := laps; i >= 1; i-- {
		r.records = append(r.records, LapRecord{
			LapNumber:    r.lap - i,
			CarAheadIdx:  rpAhead,
			GapAheadMS:   uint32(int(r.gapAheadMS) - (i-1)*aheadPerLapMS),
			CarBehindIdx: rpBehind,
			GapBehindMS:  uint32(int(r.gapBehindMS) - (i-1)*behindPerLapMS),
			PitStops:     int(r.pitStops),
		})
	}
	return r
}

// withWearHistory adds lap ends before r.lap on the current tyres, the front right wearing
// perLap a lap up to its wear now.
func (r *reportsRace) withWearHistory(laps int, wearNow, perLap float32) *reportsRace {
	r.wear = wheels[float32](0, wearNow, 0, 0)
	r.records = nil
	for i := laps; i >= 1; i-- {
		r.records = append(r.records, LapRecord{
			LapNumber:   r.lap - i,
			TyreWearPct: wheels[float32](0, wearNow-float32(i-1)*perLap, 0, 0),
			PitStops:    int(r.pitStops),
		})
	}
	return r
}

func (r *reportsRace) ctx() *EvaluationContext {
	lapData := &packets.PacketLapData{}
	set := func(idx int, pos uint8, gapMS uint32) {
		lapData.LapData[idx] = packets.LapData{
			CurrentLapNum:                uint8(r.lap),
			LapDistance:                  r.lapDistance,
			CarPosition:                  pos,
			ResultStatus:                 packets.ResultStatusActive,
			DriverStatus:                 packets.DriverStatusOnTrack,
			DeltaToCarInFrontMSPart:      uint16(gapMS % packets.MillisPerMinute),
			DeltaToCarInFrontMinutesPart: uint8(gapMS / packets.MillisPerMinute),
		}
	}
	set(rpPlayer, r.position, r.gapAheadMS)
	lapData.LapData[rpPlayer].NumPitStops = r.pitStops
	if r.position > 1 {
		set(rpAhead, r.position-1, 0)
	}
	set(rpBehind, r.position+1, r.gapBehindMS)

	status := &packets.PacketCarStatusData{}
	status.CarStatusData[rpPlayer].TyresAgeLaps = r.tyreAge
	damage := &packets.PacketCarDamageData{}
	damage.CarDamageData[rpPlayer].TyresWear = r.wear

	callLaps := r.callLaps
	if callLaps == nil {
		callLaps = map[string]int{}
	}
	return &EvaluationContext{
		Packet:         lapData,
		Session:        &packets.PacketSessionData{SessionType: packets.SessionRace, TotalLaps: 30, TrackLength: 5000, SafetyCarStatus: r.safetyCar},
		LapData:        lapData,
		Status:         status,
		Damage:         damage,
		Config:         r.cfg,
		Phase:          PhaseRacing,
		PlayerCarIndex: rpPlayer,
		PlayerLaps:     r.records,
		CallLaps:       callLaps,
		BoxDueLap:      r.boxDueLap,
	}
}

func findDirective(ds []Directive, key string) (Directive, bool) {
	for _, d := range ds {
		if d.SubAlert == key {
			return d, true
		}
	}
	return Directive{}, false
}

func TestReportsRule_GapReport(t *testing.T) {
	t.Run("says the position and the gaps with how they move", func(t *testing.T) {
		race := newReportsRace(3).withGapHistory(2, -200, 30)
		d, ok := findDirective(NewReportsRule().Evaluate(race.ctx()), "gap_report")
		if !ok {
			t.Fatal("no gap report on lap 3")
		}
		v := d.Values
		if v == nil || v.Position != 5 {
			t.Fatalf("values = %+v, want position 5", v)
		}
		if v.Ahead == nil || v.Ahead.GapSec != 1.4 || v.Ahead.Trend != GapClosing || v.Ahead.PerLapSec != 0.2 {
			t.Errorf("ahead = %+v, want 1.4 s closing 0.2 s a lap", v.Ahead)
		}
		if v.Behind == nil || v.Behind.GapSec != 2.0 || v.Behind.Trend != GapStable || v.Behind.PerLapSec != 0 {
			t.Errorf("behind = %+v, want 2.0 s stable", v.Behind)
		}
		if d.Category != DirectiveCategoryRivals || d.Urgency != UrgencyLow {
			t.Errorf("category %s urgency %s, want rivals low", d.Category, d.Urgency)
		}
		if d.Message != "P5. Gap ahead 1.4s, closing 0.2s a lap. Gap behind 2.0s, stable." {
			t.Errorf("message = %q", d.Message)
		}
	})

	t.Run("a gap opening and no trend yet", func(t *testing.T) {
		race := newReportsRace(3).withGapHistory(2, 300, 0)
		race.records[len(race.records)-1].CarBehindIdx = 7 // another car was behind at the line
		d, _ := findDirective(NewReportsRule().Evaluate(race.ctx()), "gap_report")
		if d.Values == nil || d.Values.Ahead.Trend != GapOpening || d.Values.Ahead.PerLapSec != 0.3 {
			t.Errorf("ahead = %+v, want opening 0.3 s a lap", d.Values.Ahead)
		}
		if d.Values.Behind == nil || d.Values.Behind.Trend != "" {
			t.Errorf("behind = %+v, want a gap without a trend", d.Values.Behind)
		}
	})

	t.Run("leader and cars far away", func(t *testing.T) {
		race := newReportsRace(4)
		race.position = 1
		race.gapAheadMS = 0
		race.gapBehindMS = 12_500
		d, ok := findDirective(NewReportsRule().Evaluate(race.ctx()), "gap_report")
		if !ok || d.Values.Position != 1 || d.Values.Ahead != nil || d.Values.Behind != nil {
			t.Fatalf("got %+v, want P1 with nobody close", d.Values)
		}
		if d.Message != "P1. Nobody within 10 seconds." {
			t.Errorf("message = %q", d.Message)
		}
	})

	t.Run("every few laps, early in the lap, from lap 3", func(t *testing.T) {
		rule := NewReportsRule()
		said := map[int]bool{}
		for lap := 1; lap <= 10; lap++ {
			for _, dist := range []float32{100, 500, 1500, 2500, 4500} {
				race := newReportsRace(lap)
				race.lapDistance = dist
				if _, ok := findDirective(rule.Evaluate(race.ctx()), "gap_report"); ok {
					if said[lap] {
						t.Errorf("two gap reports on lap %d", lap)
					}
					said[lap] = true
					if dist != 500 && dist != 1500 {
						t.Errorf("gap report at %v m into the lap", dist)
					}
				}
			}
		}
		for lap := 1; lap <= 10; lap++ {
			if want := lap == 3 || lap == 6 || lap == 9; said[lap] != want {
				t.Errorf("lap %d: report %v, want %v", lap, said[lap], want)
			}
		}
	})

	t.Run("the laps apart setting", func(t *testing.T) {
		rule := NewReportsRule()
		var laps []int
		for lap := 3; lap <= 9; lap++ {
			race := newReportsRace(lap)
			race.cfg.GapReportLaps = 2
			if _, ok := findDirective(rule.Evaluate(race.ctx()), "gap_report"); ok {
				laps = append(laps, lap)
			}
		}
		if len(laps) != 4 || laps[0] != 3 || laps[3] != 9 {
			t.Errorf("reports on laps %v, want 3 5 7 9", laps)
		}
	})

	skips := []struct {
		name string
		set  func(r *reportsRace)
	}{
		{"under the safety car", func(r *reportsRace) { r.safetyCar = packets.SafetyCarFull }},
		{"under the virtual safety car", func(r *reportsRace) { r.safetyCar = packets.SafetyCarVirtual }},
		{"on the lap the player boxes", func(r *reportsRace) { r.boxDueLap = r.lap }},
		{"right after a stop", func(r *reportsRace) { r.pitStops, r.tyreAge = 1, 1 }},
		{"after a rival call this lap", func(r *reportsRace) { r.callLaps = map[string]int{"rival_defend": r.lap} }},
		{"after a rival call last lap", func(r *reportsRace) { r.callLaps = map[string]int{"rival_attack_override": r.lap - 1} }},
	}
	for _, tc := range skips {
		t.Run("skipped "+tc.name+", then on the next lap", func(t *testing.T) {
			rule := NewReportsRule()
			race := newReportsRace(3)
			tc.set(race)
			if _, ok := findDirective(rule.Evaluate(race.ctx()), "gap_report"); ok {
				t.Fatal("gap report made")
			}
			next := newReportsRace(5)
			if _, ok := findDirective(rule.Evaluate(next.ctx()), "gap_report"); !ok {
				t.Error("no gap report once it can be made")
			}
		})
	}

	t.Run("not in qualifying or off the racing phase", func(t *testing.T) {
		ctx := newReportsRace(3).ctx()
		ctx.Session.SessionType = packets.SessionQ1
		if ds := NewReportsRule().Evaluate(ctx); len(ds) > 0 {
			t.Errorf("qualifying: got %v", ds)
		}
		ctx = newReportsRace(3).ctx()
		ctx.Phase = PhaseSafetyCar
		if ds := NewReportsRule().Evaluate(ctx); len(ds) > 0 {
			t.Errorf("safety car phase: got %v", ds)
		}
	})

	t.Run("a flashback re-arms the report", func(t *testing.T) {
		rule := NewReportsRule()
		rule.Evaluate(newReportsRace(6).ctx())
		if _, ok := findDirective(rule.Evaluate(newReportsRace(3).ctx()), "gap_report"); !ok {
			t.Error("no gap report after going back to lap 3")
		}
	})
}

func TestReportsRule_TyreLife(t *testing.T) {
	// A 30-lap race: the context's player is on lap `lap`, 500 m into a 5000 m lap.
	tyreCalls := func(rule *ReportsRule, race *reportsRace) []Directive {
		var calls []Directive
		for _, d := range rule.Evaluate(race.ctx()) {
			if d.Category == DirectiveCategoryTyres {
				calls = append(calls, d)
			}
		}
		return calls
	}

	t.Run("laps left at eight and at three", func(t *testing.T) {
		rule := NewReportsRule()
		// 5% a lap towards the 75% limit: 40% leaves 7 laps.
		calls := tyreCalls(rule, newReportsRace(8).withWearHistory(3, 40, 5))
		if len(calls) != 1 || calls[0].SubAlert != "tyre_life" || calls[0].Values.TyreLapsLeft != 7 || calls[0].Urgency != UrgencyLow {
			t.Fatalf("got %+v, want tyre_life with 7 laps left", calls)
		}
		if calls := tyreCalls(rule, newReportsRace(8).withWearHistory(3, 40, 5)); len(calls) > 0 {
			t.Errorf("same lap again: got %+v", calls)
		}
		if calls := tyreCalls(rule, newReportsRace(9).withWearHistory(4, 45, 5)); len(calls) > 0 {
			t.Errorf("6 laps left: got %+v, want nothing new", calls)
		}
		calls = tyreCalls(rule, newReportsRace(12).withWearHistory(7, 62, 5))
		if len(calls) != 1 || calls[0].Values.TyreLapsLeft != 3 || calls[0].Urgency != UrgencyMedium {
			t.Fatalf("got %+v, want tyre_life with 3 laps left", calls)
		}
		if calls := tyreCalls(rule, newReportsRace(13).withWearHistory(8, 67, 5)); len(calls) > 0 {
			t.Errorf("after both calls: got %+v", calls)
		}
	})

	t.Run("straight to three laps says it once", func(t *testing.T) {
		rule := NewReportsRule()
		calls := tyreCalls(rule, newReportsRace(8).withWearHistory(3, 65, 5))
		if len(calls) != 1 || calls[0].Values.TyreLapsLeft != 2 {
			t.Fatalf("got %+v, want one call with 2 laps left", calls)
		}
		if calls := tyreCalls(rule, newReportsRace(9).withWearHistory(4, 68, 5)); len(calls) > 0 {
			t.Errorf("got %+v", calls)
		}
	})

	t.Run("tyres that make the end", func(t *testing.T) {
		rule := NewReportsRule()
		// Lap 22 of 30: 8.9 laps to go; 1% a lap from 50% leaves 25 laps.
		calls := tyreCalls(rule, newReportsRace(22).withWearHistory(5, 50, 1))
		if len(calls) != 1 || calls[0].SubAlert != "tyre_life_end" || calls[0].Values != nil {
			t.Fatalf("got %+v, want tyre_life_end", calls)
		}
		if calls := tyreCalls(rule, newReportsRace(23).withWearHistory(6, 51, 1)); len(calls) > 0 {
			t.Errorf("said twice: %+v", calls)
		}
	})

	t.Run("make the end waits until the end is near", func(t *testing.T) {
		if calls := tyreCalls(NewReportsRule(), newReportsRace(5).withWearHistory(4, 10, 1)); len(calls) > 0 {
			t.Errorf("26 laps to go: got %+v", calls)
		}
	})

	t.Run("make the end beats laps left", func(t *testing.T) {
		// Lap 26 of 30: 4.9 laps to go, 7 laps of life.
		calls := tyreCalls(NewReportsRule(), newReportsRace(26).withWearHistory(5, 40, 5))
		if len(calls) != 1 || calls[0].SubAlert != "tyre_life_end" {
			t.Fatalf("got %+v, want tyre_life_end", calls)
		}
	})

	t.Run("needs three lap ends on the set", func(t *testing.T) {
		if calls := tyreCalls(NewReportsRule(), newReportsRace(8).withWearHistory(2, 40, 5)); len(calls) > 0 {
			t.Errorf("got %+v", calls)
		}
	})

	t.Run("a new set starts over", func(t *testing.T) {
		rule := NewReportsRule()
		tyreCalls(rule, newReportsRace(8).withWearHistory(3, 40, 5))
		race := newReportsRace(14)
		race.pitStops = 1
		race.withWearHistory(4, 40, 5)
		race.records = append([]LapRecord{{LapNumber: 8, TyreWearPct: wheels[float32](0, 60, 0, 0)}}, race.records...)
		calls := tyreCalls(rule, race)
		if len(calls) != 1 || calls[0].Values.TyreLapsLeft != 7 {
			t.Fatalf("got %+v, want 7 laps left on the new set", calls)
		}
	})
}

// The engine hands the rules the player's lap ends and the lap each call was said on.
func TestEngineerEngine_ContextCarriesTheRaceHistory(t *testing.T) {
	f := runRaceLaps(t)
	f.engine.mu.Lock()
	ctx := f.engine.buildEvaluationContextLocked(f.header, nil)
	f.engine.mu.Unlock()
	if len(ctx.PlayerLaps) != 4 {
		t.Errorf("player laps = %d, want 4", len(ctx.PlayerLaps))
	}
	if lap := ctx.CallLaps["rival_defend_override"]; lap < 2 {
		t.Errorf("rival_defend_override said on lap %d, want a lap of the race", lap)
	}
}

func TestDirectiveValues_OnTheWire(t *testing.T) {
	d := Directive{SubAlert: "gap_report", Values: &DirectiveValues{
		Position: 5,
		Ahead:    &GapToCar{GapSec: 1.4, Trend: GapClosing, PerLapSec: 0.2},
		Behind:   &GapToCar{GapSec: 2, Trend: GapStable},
	}}
	raw, _ := json.Marshal(d)
	want := `"values":{"position":5,"ahead":{"gap_sec":1.4,"trend":"closing","per_lap_sec":0.2},"behind":{"gap_sec":2,"trend":"stable"}}`
	if !strings.Contains(string(raw), want) {
		t.Errorf("json = %s, want it to hold %s", raw, want)
	}
	raw, _ = json.Marshal(Directive{SubAlert: "tyre_wear"})
	if strings.Contains(string(raw), "values") {
		t.Errorf("a call without numbers sends values: %s", raw)
	}
}

// A 2026 aero zone call (rivals category) just before the report's lap doesn't hold the report
// past its moment.
func TestEngineerEngine_GapReportIsNotHeldByTheRivalsCooldown(t *testing.T) {
	e, b, clock, h := raceEngine(t)
	before := len(spokenBoxes(t, b, "gap_report"))

	clock.advance(20 * time.Second)
	e.mu.Lock()
	e.lastDirectives[string(DirectiveCategoryRivals)] = e.nowMs() - 5_000
	e.mu.Unlock()
	e.ProcessPacket(context.Background(), &packets.PacketLapData{Header: h, LapData: [packets.MaxCars]packets.LapData{
		{CurrentLapNum: 13, CarPosition: 5, LapDistance: 1200, DriverStatus: packets.DriverStatusOnTrack},
	}})

	if got := len(spokenBoxes(t, b, "gap_report")); got != before+1 {
		t.Errorf("gap reports said = %d, want %d", got, before+1)
	}
}
