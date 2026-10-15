package engineer

import (
	"context"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// closingCtx is battleCtx with car 1, ahead, aheadMS up the road and car 2, behind, behindMS back,
// and the gaps to them at the last two lap ends.
func closingCtx(aheadMS, behindMS uint16, aheadLaps, behindLaps [2]uint32) *EvaluationContext {
	ctx := battleCtx()
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = aheadMS
	ctx.LapData.LapData[2].DeltaToCarInFrontMSPart = behindMS
	ctx.PlayerLaps = []LapRecord{
		{LapNumber: 6, CarAheadIdx: 1, GapAheadMS: aheadLaps[0], CarBehindIdx: 2, GapBehindMS: behindLaps[0]},
		{LapNumber: 7, CarAheadIdx: 1, GapAheadMS: aheadLaps[1], CarBehindIdx: 2, GapBehindMS: behindLaps[1]},
	}
	return ctx
}

func TestRivalsRule_ClosingIn(t *testing.T) {
	steady := [2]uint32{5000, 5000}
	tests := []struct {
		name       string
		aheadMS    uint16
		aheadLaps  [2]uint32
		totalLaps  uint16
		teammate   bool
		wantLaps   int // laps to range on the call; 0: no call
		wantGapSec float64
		wantRate   float64
	}{
		{name: "catching the car ahead", aheadMS: 2600, aheadLaps: [2]uint32{3400, 3000}, wantLaps: 4, wantGapSec: 2.6, wantRate: 0.4},
		{name: "pulling away", aheadMS: 2600, aheadLaps: [2]uint32{2200, 2400}},
		{name: "closing too slowly", aheadMS: 1800, aheadLaps: [2]uint32{1900, 1800}},
		{name: "a stop in the laps measured", aheadMS: 2600, aheadLaps: [2]uint32{24_600, 2600}},
		{name: "already in battle range", aheadMS: 1600, aheadLaps: [2]uint32{2400, 2000}},
		{name: "too far to matter yet", aheadMS: 4500, aheadLaps: [2]uint32{5300, 4900}},
		{name: "in range too many laps from now", aheadMS: 3900, aheadLaps: [2]uint32{4100, 3900}},
		{name: "in range only after the flag", aheadMS: 2600, aheadLaps: [2]uint32{3400, 3000}, totalLaps: 11},
		{name: "in range on the last lap", aheadMS: 2600, aheadLaps: [2]uint32{3400, 3000}, totalLaps: 12, wantLaps: 4, wantGapSec: 2.6, wantRate: 0.4},
		{name: "the teammate, whose call covers it", aheadMS: 2600, aheadLaps: [2]uint32{3400, 3000}, teammate: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := closingCtx(tt.aheadMS, 5000, tt.aheadLaps, steady)
			ctx.Session.TotalLaps = uint8(tt.totalLaps)
			if tt.teammate {
				ctx.TeammateCarIndex = 1
			}
			d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_closing")
			if tt.wantLaps == 0 {
				if d != nil {
					t.Fatalf("closing call %+v, want none", d)
				}
				return
			}
			if d == nil || d.Values == nil || d.Values.Ahead == nil {
				t.Fatalf("no closing call with the gap ahead: %+v", d)
			}
			if g := d.Values.Ahead; d.Values.LapsToRange != tt.wantLaps || g.GapSec != tt.wantGapSec || g.Trend != GapClosing || g.PerLapSec != tt.wantRate {
				t.Errorf("values %+v, gap %+v; want %v s closing %v a lap, in range in %d laps", d.Values, *g, tt.wantGapSec, tt.wantRate, tt.wantLaps)
			}
			if d.Urgency != UrgencyLow || d.ID != "rival_closing" {
				t.Errorf("call %q at %q, want a routine rival_closing", d.ID, d.Urgency)
			}
		})
	}

	t.Run("a car catching the player", func(t *testing.T) {
		rule := NewRivalsRule()
		ctx := closingCtx(5000, 2200, steady, [2]uint32{2800, 2500})
		d := directiveFor(rule.Evaluate(ctx), "rival_catching_you")
		if d == nil || d.Values == nil || d.Values.Behind == nil {
			t.Fatalf("no call for the car closing from behind: %+v", d)
		}
		// 2.2 s back, 1.2 s to the defend range at 0.3 s a lap.
		if g := d.Values.Behind; d.Values.LapsToRange != 4 || g.GapSec != 2.2 || g.PerLapSec != 0.3 {
			t.Errorf("values %+v, gap %+v; want 2.2 s closing 0.3 a lap, in range in 4 laps", d.Values, *g)
		}
		if d := directiveFor(rule.Evaluate(ctx), "rival_catching_you"); d != nil {
			t.Fatalf("the same approach called twice: %+v", d)
		}
		// Another car comes between them: the next time car 2 is behind is a new approach.
		laps := &ctx.LapData.LapData
		laps[2].CarPosition, laps[3] = 9, packets.LapData{CarPosition: 6, CurrentLapNum: 8, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
		rule.Evaluate(ctx)
		laps[2].CarPosition, laps[3].CarPosition = 6, 9
		if d := directiveFor(rule.Evaluate(ctx), "rival_catching_you"); d == nil {
			t.Fatal("car 2 behind again: no call")
		}
	})
}

func TestRivalsRule_ClosingInOncePerApproach(t *testing.T) {
	rule := NewRivalsRule()
	ctx := closingCtx(2600, 5000, [2]uint32{3400, 3000}, [2]uint32{5000, 5000})
	ctx.Now = 1_000_000
	calls := func() int {
		ctx.Now += 1000
		return len(subAlertsOf(rule.Evaluate(ctx), "rival_closing"))
	}
	if n := calls(); n != 1 {
		t.Fatalf("closing calls = %d, want 1", n)
	}
	ctx.LastSaid = map[string]int64{"rival_closing": ctx.Now}
	if n := calls(); n != 0 {
		t.Fatalf("the same approach called again: %d", n)
	}
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 4800 // dropped back, not far enough to be a new approach
	calls()
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 2600
	if n := calls(); n != 0 {
		t.Fatalf("called again after dropping back %v s: %d", 4.8, n)
	}
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 5100 // far enough
	calls()
	ctx.LapData.LapData[0].DeltaToCarInFrontMSPart = 2600
	if n := calls(); n != 1 {
		t.Fatalf("a new approach made %d calls, want 1", n)
	}

	// Another car comes between them: the next time car 1 is ahead is a new approach.
	ctx.LastSaid = map[string]int64{"rival_closing": ctx.Now + 1000}
	laps := &ctx.LapData.LapData
	laps[1].CarPosition, laps[3] = 7, packets.LapData{CarPosition: 4, CurrentLapNum: 8, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
	if n := calls(); n != 0 {
		t.Fatalf("calls for a car without a trend: %d", n)
	}
	laps[1].CarPosition, laps[3].CarPosition = 4, 7
	if n := calls(); n != 1 {
		t.Fatalf("car 1 ahead again made %d calls, want 1", n)
	}

	// A call that never got on the radio is made again once it went stale.
	ctx.LastSaid = nil
	ctx.Now += DefaultMaxDelayMs
	if n := calls(); n != 1 {
		t.Fatalf("a lost closing call made %d calls again, want 1", n)
	}
}

func TestRivalsRule_RivalPenalty(t *testing.T) {
	tests := []struct {
		name      string
		car       int
		gapMS     uint16 // the car's delta to the car in front of it, or the player's to it
		joined    bool   // the penalty was there before the first lap data
		wantSub   string
		wantAhead bool
	}{
		{name: "the car ahead", car: 1, gapMS: 3200, wantSub: "rival_penalty_ahead", wantAhead: true},
		{name: "the car behind", car: 2, gapMS: 2100, wantSub: "rival_penalty_behind"},
		{name: "the car ahead too far up the road", car: 1, gapMS: 10_500},
		{name: "a car not right ahead or behind", car: 3},
		{name: "the player's own", car: 0, gapMS: 900},
		{name: "a penalty there when the player joined", car: 1, gapMS: 3200, joined: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := battleCtx()
			laps := &ctx.LapData.LapData
			laps[3] = packets.LapData{CarPosition: 8, CurrentLapNum: 8, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
			switch tt.car {
			case 1:
				laps[0].DeltaToCarInFrontMSPart = tt.gapMS
			case 2:
				laps[2].DeltaToCarInFrontMSPart = tt.gapMS
			}
			rule := NewRivalsRule()
			if tt.joined {
				laps[tt.car].Penalties = 5
			}
			for _, d := range rule.Evaluate(ctx) {
				if d.ID == "rival_penalty" {
					t.Fatalf("the first lap data made a penalty call: %+v", d)
				}
			}
			laps[tt.car].Penalties = 5
			dirs := rule.Evaluate(ctx)
			var got []Directive
			for _, d := range dirs {
				if d.ID == "rival_penalty" {
					got = append(got, d)
				}
			}
			if tt.wantSub == "" {
				if len(got) != 0 {
					t.Fatalf("penalty calls %+v, want none", got)
				}
				return
			}
			if len(got) != 1 || got[0].SubAlert != tt.wantSub || got[0].Values == nil || got[0].Values.PenaltySec != 5 {
				t.Fatalf("penalty calls %+v, want one %s with 5 s", got, tt.wantSub)
			}
			gap := got[0].Values.Behind
			if tt.wantAhead {
				gap = got[0].Values.Ahead
			}
			if gap == nil || gap.GapSec != float64(tt.gapMS)/1000 {
				t.Errorf("values %+v, want the gap %v s on the right side", got[0].Values, float64(tt.gapMS)/1000)
			}
			if again := rule.Evaluate(ctx); directiveFor(again, tt.wantSub) != nil {
				t.Error("the same penalty was said twice")
			}
		})
	}
}

func TestRivalsRule_BattleCallsSayWhoTheRivalIs(t *testing.T) {
	ctx := battleCtx()
	ctx.Participants = &packets.PacketParticipantsData{}
	copy(ctx.Participants.Participants[1].Name[:], "Lewis HAMILTON")
	ctx.Participants.Participants[2].DriverId = packets.InvalidDriverID // an online player without a name
	ctx.Status = &packets.PacketCarStatusData{}
	ctx.Status.CarStatusData[0] = packets.CarStatusData{VisualTyreCompound: packets.CompoundHard, TyresAgeLaps: 4}
	ctx.Status.CarStatusData[1] = packets.CarStatusData{VisualTyreCompound: packets.CompoundMedium, TyresAgeLaps: 12}
	d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_attack")
	if d == nil || d.Values == nil || d.Values.Ahead == nil {
		t.Fatalf("no attack call: %+v", d)
	}
	if g := d.Values.Ahead; g.Name != "Hamilton" || g.Compound != TyreMedium || g.TyreAgeDiffLaps != 8 {
		t.Errorf("rival %+v, want Hamilton on mediums 8 laps older", *g)
	}
	// The car behind has nothing known: no tyres, no name.
	if d := directiveFor(NewRivalsRule().Evaluate(ctx), "rival_defend"); d == nil || d.Values.Behind.Name != "" || d.Values.Behind.Compound != "" {
		t.Errorf("defend call %+v, want a rival nobody knows", d)
	}
}

func TestSpokenName(t *testing.T) {
	tests := []struct {
		name     string
		driverID uint16
		want     string
	}{
		{"VERSTAPPEN", packets.InvalidDriverID, "Verstappen"},
		{"Max VERSTAPPEN", packets.InvalidDriverID, "Verstappen"},
		{"Nico HÜLKENBERG", packets.InvalidDriverID, "Hülkenberg"},
		{"DE VRIES", packets.InvalidDriverID, "De Vries"},
		{"Max VERSTAPPEN 1", packets.InvalidDriverID, "Verstappen"},
		{"K. RAIKKONEN", packets.InvalidDriverID, "Raikkonen"},
		{"SpeedyRacer77", packets.InvalidDriverID, "SpeedyRacer77"},
		{"", 7, "Hamilton"},
		{"", packets.InvalidDriverID, ""},
		{"Player", packets.InvalidDriverID, ""},
		{"Driver 2", packets.InvalidDriverID, ""},
		{"Car #12", packets.InvalidDriverID, ""},
		{"Abcdefghijklmnopqrstuvwxyz…", packets.InvalidDriverID, ""},
	}
	for _, tt := range tests {
		parts := &packets.PacketParticipantsData{}
		copy(parts.Participants[3].Name[:], tt.name)
		parts.Participants[3].DriverId = tt.driverID
		if got := spokenName(parts, 3); got != tt.want {
			t.Errorf("spokenName(%q, driver %d) = %q, want %q", tt.name, tt.driverID, got, tt.want)
		}
	}
	if got := spokenName(nil, 3); got != "" {
		t.Errorf("without participants: %q", got)
	}
}

// newsRace is newRivalRace with the leader (car 3) 12.4 s up the road, a car (car 4) 6.2 s ahead in
// P3, one (car 5) 4.8 s behind in P8 and one (car 6) 30 s back in P15.
func newsRace(t *testing.T) *rivalRace {
	t.Helper()
	r := newRivalRace(t)
	for i, c := range map[int]struct {
		pos      uint8
		leaderMS uint16
	}{3: {1, 0}, 4: {3, 6200}, 5: {8, 17_200}, 6: {15, 42_400}} {
		r.lap.LapData[i] = packets.LapData{CurrentLapNum: 10, CarPosition: c.pos, LapDistance: 1200, TotalDistance: 46_000,
			DeltaToRaceLeaderMSPart: c.leaderMS, DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive}
	}
	r.lap.LapData[rrPlayer].DeltaToRaceLeaderMSPart = 12_400
	r.send()
	r.clock.advance(time.Minute) // past the opening gap report
	return r
}

func TestStrategyNews(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(r *rivalRace)
		stop    []int
		wantSub string // empty: no news
		wantGap float64
	}{
		{name: "the leader", stop: []int{3}, wantSub: "leader_pitted", wantGap: 12.4},
		{name: "a car close behind", stop: []int{5}, wantSub: "nearby_pitted_behind", wantGap: 4.8},
		{name: "a car close ahead", stop: []int{4}, wantSub: "nearby_pitted_ahead", wantGap: 6.2},
		{name: "a car far back", stop: []int{6}},
		{name: "the car right ahead, the overcut's", stop: []int{rrAhead}},
		{name: "the car right ahead out of the overcut's reach", setup: func(r *rivalRace) {
			r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 3000
		}, stop: []int{rrAhead}, wantSub: "nearby_pitted_ahead", wantGap: 3.0},
		{name: "the car right behind, the undercut's", stop: []int{rrBehind}},
		{name: "the car right behind out of the undercut's reach", setup: func(r *rivalRace) {
			r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 3000
		}, stop: []int{rrBehind}, wantSub: "nearby_pitted_behind", wantGap: 3.0},
		{name: "the leader right ahead, the overcut's", setup: func(r *rivalRace) {
			r.lap.LapData[rrPlayer].CarPosition = 2
		}, stop: []int{3}},
		{name: "the nearest of two stops at once", stop: []int{4, 5}, wantSub: "nearby_pitted_behind", wantGap: 4.8},
		{name: "the teammate", setup: func(r *rivalRace) { r.e.teammateCarIndex = 5 }, stop: []int{5}},
		{name: "a drive-through", setup: func(r *rivalRace) { r.lap.LapData[5].NumUnservedDriveThroughPens = 1 }, stop: []int{5}},
		{name: "under the Safety Car", setup: func(r *rivalRace) {
			r.session.SafetyCarStatus = packets.SafetyCarFull
			r.sendSession()
		}, stop: []int{3}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newsRace(t)
			if tt.setup != nil {
				tt.setup(r)
				r.send()
			}
			for _, car := range tt.stop {
				r.lap.LapData[car].PitStatus = packets.PitStatusPitting
			}
			r.send()
			news := spokenCalls(t, r.b, "leader_pitted")
			for _, sub := range []string{"nearby_pitted_ahead", "nearby_pitted_behind"} {
				news = append(news, spokenCalls(t, r.b, sub)...)
			}
			if tt.wantSub == "" {
				if len(news) != 0 {
					t.Fatalf("news %+v, want none", news)
				}
				return
			}
			if len(news) != 1 || news[0].SubAlert != tt.wantSub || news[0].Values == nil {
				t.Fatalf("news %+v, want one %s", news, tt.wantSub)
			}
			gap := news[0].Values.Ahead
			if gap == nil {
				gap = news[0].Values.Behind
			}
			if gap == nil || gap.GapSec != tt.wantGap {
				t.Errorf("values %+v, want the gap %v s", news[0].Values, tt.wantGap)
			}
		})
	}
}

// The rule itself says nothing off the racing phase, whoever stops.
func TestStrategyNewsRule_OnlyRacing(t *testing.T) {
	ctx := battleCtx()
	ctx.LapData.LapData[3] = packets.LapData{CarPosition: 1, CurrentLapNum: 8, ResultStatus: packets.ResultStatusActive, DriverStatus: packets.DriverStatusOnTrack}
	ctx.PitEntries[3] = true
	if dirs := NewStrategyNewsRule().Evaluate(ctx); len(dirs) != 1 || dirs[0].SubAlert != "leader_pitted" {
		t.Fatalf("racing: %+v, want the leader's stop", dirs)
	}
	ctx.Phase = PhaseSafetyCar
	if dirs := NewStrategyNewsRule().Evaluate(ctx); len(dirs) != 0 {
		t.Fatalf("under the Safety Car: %+v, want nothing", dirs)
	}
}

// headsUpCtx is lap 11 of 30, a fifth into a 5 km lap, the lap before the plan's stop on lap 12
// (rejoining P9), at 50 m/s: a stop's 21 s lose 1050 m, so the player would rejoin at 49 950 m.
func headsUpCtx(rivals ...packets.LapData) *EvaluationContext {
	lapData := &packets.PacketLapData{}
	lapData.LapData[0] = packets.LapData{CurrentLapNum: 11, CarPosition: 5, LapDistance: 1000, TotalDistance: 51_000,
		DriverStatus: packets.DriverStatusOnTrack, ResultStatus: packets.ResultStatusActive}
	for i, l := range rivals {
		l.CurrentLapNum, l.ResultStatus = 11, packets.ResultStatusActive
		if l.DriverStatus == 0 {
			l.DriverStatus = packets.DriverStatusOnTrack
		}
		lapData.LapData[1+i] = l
	}
	status := &packets.PacketCarStatusData{}
	status.CarStatusData[0].TyresAgeLaps = 10
	return &EvaluationContext{
		Packet: lapData, LapData: lapData, Status: status, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
		Session: &packets.PacketSessionData{SessionType: packets.SessionRace, TrackLength: 5000, TotalLaps: 30},
		PitPlan: PitPlanState{IdealLap: 12, LatestLap: 15, RejoinPosition: 9},
		PlayerLaps: []LapRecord{
			{LapNumber: 8, LapTimeMS: 100_000, Valid: true},
			{LapNumber: 9, LapTimeMS: 100_000, Valid: true},
			{LapNumber: 10, LapTimeMS: 100_000, Valid: true},
		},
	}
}

func TestPitPlan_HeadsUpSaysTheTrafficAtTheRejoin(t *testing.T) {
	const rejoinAt = 49_950
	tests := []struct {
		name    string
		rival   packets.LapData
		wantGap float64 // 0: a clear rejoin
	}{
		{"a car just ahead of the rejoin", packets.LapData{TotalDistance: rejoinAt + 70}, 1.4},
		{"a car a lap down at the same spot", packets.LapData{TotalDistance: rejoinAt + 70 - 5000}, 1.4},
		{"a car further ahead", packets.LapData{TotalDistance: rejoinAt + 125}, 0},
		{"a car just behind the rejoin", packets.LapData{TotalDistance: rejoinAt - 50}, 0},
		{"a car in the pit lane", packets.LapData{TotalDistance: rejoinAt + 70, PitStatus: packets.PitStatusPitting}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dirs := NewPitPlanRule().Evaluate(headsUpCtx(tt.rival))
			if len(dirs) != 1 {
				t.Fatalf("calls %+v, want the heads-up", dirs)
			}
			d := dirs[0]
			if tt.wantGap == 0 {
				if d.SubAlert != "pit_plan_next_lap" || d.Values == nil || d.Values.Position != 9 || d.Values.Ahead != nil {
					t.Errorf("heads-up %s %+v, want the plain one rejoining P9", d.SubAlert, d.Values)
				}
				return
			}
			if d.SubAlert != "pit_plan_next_lap_traffic" || d.Values == nil || d.Values.Position != 9 || d.Values.Ahead == nil || d.Values.Ahead.GapSec != tt.wantGap {
				t.Errorf("heads-up %s %+v, want the traffic one: P9, %v s behind a car", d.SubAlert, d.Values, tt.wantGap)
			}
		})
	}
}

func TestTrafficRule_CleanAirSaysTheRejoinPosition(t *testing.T) {
	for _, pos := range []uint8{0, 8} {
		lapData := &packets.PacketLapData{}
		lapData.LapData[0] = packets.LapData{CurrentLapNum: 12, LapDistance: 1000, TotalDistance: 56_000}
		status := &packets.PacketCarStatusData{}
		status.CarStatusData[0].TyresAgeLaps = 10
		ctx := &EvaluationContext{
			LapData: lapData, Status: status, Config: DefaultEngineerConfig(), Phase: PhaseRacing,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace, TrackLength: 5000,
				PitStopWindowIdealLap: 10, PitStopWindowLatestLap: 15, PitStopRejoinPosition: pos},
		}
		dirs := NewTrafficRule().Evaluate(ctx)
		if len(dirs) != 1 || dirs[0].SubAlert != "pit_clean_air" {
			t.Fatalf("rejoin P%d: calls %+v, want clean air", pos, dirs)
		}
		if got := dirs[0].Values; (pos == 0) != (got == nil) || (got != nil && got.Position != int(pos)) {
			t.Errorf("rejoin P%d: values %+v", pos, got)
		}
	}
}

func TestFlagsRule_PenaltyServed(t *testing.T) {
	h := createTestHeader(packets.PacketFormat2025, 1, 0)
	tests := []struct {
		name string
		p    *packets.PacketEventData
		want bool
	}{
		{"a drive-through", event(h, packets.EventDriveThroughServed, 0), true},
		{"a stop-go", event(h, packets.EventStopGoServed, 0, 0, 0, 0x20, 0x41), true},
		{"another car's", event(h, packets.EventDriveThroughServed, 4), false},
		{"another car's stop-go", event(h, packets.EventStopGoServed, 4), false},
	}
	for _, tt := range tests {
		ctx := &EvaluationContext{Packet: tt.p, Config: DefaultEngineerConfig(), Phase: PhasePitLane,
			Session: &packets.PacketSessionData{SessionType: packets.SessionRace}}
		d := directiveFor(seededFlagsRule().Evaluate(ctx), "penalty_served")
		if (d != nil) != tt.want {
			t.Errorf("%s: penalty served call %+v, want %v", tt.name, d, tt.want)
		}
	}
}

func TestFlagsRule_RainForecast(t *testing.T) {
	rule := NewFlagsRule()
	session := &packets.PacketSessionData{SessionType: packets.SessionRace, Weather: packets.WeatherOvercast, NumWeatherForecastSamples: 2}
	ctx := &EvaluationContext{Session: session, Packet: session, Config: DefaultEngineerConfig(), Phase: PhaseRacing}
	forecast := func(inFive uint8) *Directive {
		session.WeatherForecastSamples[0] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 0, RainPercentage: 10}
		session.WeatherForecastSamples[1] = packets.WeatherForecastSample{SessionType: packets.SessionRace, TimeOffset: 5, RainPercentage: inFive}
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "flags_rain" {
				return &d
			}
		}
		return nil
	}

	d := forecast(60)
	if d == nil || d.SubAlert != "weather_rain" || d.Urgency != UrgencyMedium || d.Values.RainPct != 60 || d.Values.Minutes != 5 {
		t.Fatalf("first forecast call %+v, want a routine weather_rain, 60%% in 5 minutes", d)
	}
	steps := []struct {
		pct     uint8
		wantPct int // 0: no call
	}{
		{70, 0},  // not enough likelier to say again
		{75, 75}, // likelier
		{40, 0},  // below the threshold, still the same spell
		{55, 0},  // back up: not new
		{30, 0},  // the spell is over
		{55, 55}, // a new spell
	}
	for _, s := range steps {
		d := forecast(s.pct)
		if (d != nil) != (s.wantPct != 0) || (d != nil && d.Values.RainPct != s.wantPct) {
			t.Fatalf("forecast at %d%%: call %+v, want %d%%", s.pct, d, s.wantPct)
		}
	}

	// It rains, then stops: the next rain in the forecast is a new spell.
	session.Weather = packets.WeatherLightRain
	if d := forecast(80); d != nil {
		t.Fatalf("forecast while it rains: %+v", d)
	}
	session.Weather = packets.WeatherOvercast
	session.ForecastAccuracy = packets.ForecastAccuracyApproximate
	if d := forecast(55); d == nil || d.SubAlert != "weather_rain_approx" {
		t.Fatalf("an approximate forecast after the rain: %+v, want weather_rain_approx", d)
	}
}

func TestFlagsRule_WeatherChanges(t *testing.T) {
	rule := NewFlagsRule()
	session := &packets.PacketSessionData{SessionType: packets.SessionRace, Weather: packets.WeatherLightRain}
	ctx := &EvaluationContext{Session: session, Packet: session, Config: DefaultEngineerConfig(), Phase: PhaseRacing, Now: 1_000_000}
	steps := []struct {
		atSec   int64
		weather uint8
		want    string
	}{
		{0, packets.WeatherLightRain, ""},  // joining in the rain: nothing to say
		{1, packets.WeatherHeavyRain, ""},  // heavier...
		{15, packets.WeatherHeavyRain, ""}, // ...not for long enough yet
		{21, packets.WeatherHeavyRain, "rain_heavier"},
		{30, packets.WeatherLightRain, ""}, // a flicker
		{35, packets.WeatherHeavyRain, ""},
		{60, packets.WeatherHeavyRain, ""},
		{61, packets.WeatherStorm, ""},
		{82, packets.WeatherStorm, "rain_heavier"},
		{90, packets.WeatherLightRain, ""},
		{111, packets.WeatherLightRain, "rain_easing"},
		{120, packets.WeatherOvercast, ""},
		{141, packets.WeatherOvercast, "track_drying"},
		{150, packets.WeatherLightCloud, ""},
		{171, packets.WeatherLightCloud, ""}, // clouds aren't news
		{180, packets.WeatherLightRain, ""},  // rain starting is the live rain call's
		{201, packets.WeatherLightRain, ""},
	}
	start := ctx.Now
	for _, s := range steps {
		ctx.Now = start + s.atSec*1000
		session.Weather = s.weather
		var got string
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "weather_change" {
				got = d.SubAlert
			}
		}
		if got != s.want {
			t.Fatalf("at %d s, weather %d: change %q, want %q", s.atSec, s.weather, got, s.want)
		}
	}
}

func TestFlagsRule_TrackTemperatureSwing(t *testing.T) {
	rule := NewFlagsRule()
	session := &packets.PacketSessionData{SessionType: packets.SessionRace}
	ctx := &EvaluationContext{Session: session, Packet: session, Config: DefaultEngineerConfig(), Phase: PhaseRacing, Now: 1_000_000}
	temp := func(c int8) *Directive {
		ctx.Now += 1000
		session.TrackTemperature = c
		for _, d := range rule.Evaluate(ctx) {
			if d.ID == "track_temp_swing" {
				return &d
			}
		}
		return nil
	}
	check := func(c int8, wantSub string, wantDelta int) {
		t.Helper()
		d := temp(c)
		if wantSub == "" {
			if d != nil {
				t.Fatalf("at %d °C: %+v, want no call", c, d)
			}
			return
		}
		if d == nil || d.SubAlert != wantSub || d.Values == nil || d.Values.TrackTempDeltaC != wantDelta {
			t.Fatalf("at %d °C: %+v, want %s by %d", c, d, wantSub, wantDelta)
		}
	}

	check(30, "", 0) // the stint's start
	check(35, "", 0)
	ctx.Phase = PhaseSafetyCar
	check(36, "", 0) // not under the Safety Car...
	ctx.Phase = PhaseRacing
	check(36, "track_temp_up", 6) // ...but once racing
	ctx.LastSaid = map[string]int64{"track_temp_swing": ctx.Now}
	check(40, "", 0) // once a stint

	rule.Reset(DedupScopeStint)
	check(40, "", 0) // the new stint's start
	check(34, "track_temp_down", -6)

	// A call that never got on the radio is made again while it holds.
	ctx.LastSaid = nil
	ctx.Now += ConditionMaxDelayMs
	check(34, "track_temp_down", -6)

	rule = NewFlagsRule()
	session.SessionType = packets.SessionQ1
	check(30, "", 0)
	check(40, "", 0) // not in qualifying
}

// News of the cars around and of the weather has a cooldown of its own: it doesn't hold back the
// calls of its category said soon after.
func TestEngineerEngine_NewsDoesNotHoldBackItsCategory(t *testing.T) {
	tests := []struct{ news, call string }{
		{"rival_closing", "rival_attack"},
		{"rival_catching_you", "rival_defend"},
		{"rival_penalty", "rival_attack"},
		{"leader_pitted", "pit_clean_air"},
		{"nearby_pitted", "pit_clean_air"},
		{"weather_change", "flags_rain"},
		{"track_temp_swing", "flags_rain"},
	}
	for _, tt := range tests {
		t.Run(tt.news, func(t *testing.T) {
			r := newTimedRace(t)
			r.make(tt.news, UrgencyLow)
			r.tick(0)
			if spoken(t, r.b, tt.news) != 1 {
				t.Fatalf("%s not said", tt.news)
			}
			r.tick(10 * time.Second) // the radio is free again, within the category's cooldown
			r.make(tt.call, UrgencyMedium)
			r.tick(0)
			if spoken(t, r.b, tt.call) != 1 {
				t.Errorf("%s held back by the %s call before it", tt.call, tt.news)
			}
		})
	}
}

// The new calls are routine: the AI may word them.
func TestEngineerEngine_NewCallsAreWordable(t *testing.T) {
	for _, key := range []string{"rival_closing", "rival_catching_you", "rival_penalty", "leader_pitted", "nearby_pitted", "weather_change", "track_temp_swing", "penalty_served"} {
		e := NewEngineerEngine(nil)
		e.SetRadioWording(true)
		if d := emitNow(e, Directive{Urgency: UrgencyLow}, key, 0); !d.Wordable {
			t.Errorf("%s isn't wordable (ttl %d ms)", key, d.TTLMs)
		}
	}
}

// The new calls go through the engine to the wire with their values.
func TestEngineerEngine_ClosingCallOnTheWire(t *testing.T) {
	r := newRivalRace(t)
	r.clock.advance(time.Minute)
	r.e.mu.Lock()
	r.e.history.playerLaps = []LapRecord{
		{LapNumber: 8, CarAheadIdx: rrAhead, GapAheadMS: 3400, CarBehindIdx: rrBehind},
		{LapNumber: 9, CarAheadIdx: rrAhead, GapAheadMS: 3000, CarBehindIdx: rrBehind},
	}
	r.e.mu.Unlock()
	r.lap.LapData[rrPlayer].DeltaToCarInFrontMSPart = 2600
	r.lap.LapData[rrBehind].DeltaToCarInFrontMSPart = 4000
	r.send()
	calls := spokenCalls(t, r.b, "rival_closing")
	if len(calls) != 1 || calls[0].Values == nil || calls[0].Values.LapsToRange != 4 || calls[0].Values.Ahead == nil || calls[0].Values.Ahead.PerLapSec != 0.4 {
		t.Fatalf("closing calls %+v, want one with the gap closing 0.4 a lap, in range in 4 laps", calls)
	}
}

// A weather call made on a qualifying push lap waits for the radio to open, and a likelier
// forecast is said again in the same phase.
func TestEngineerEngine_WeatherCallsOutlastAPushLap(t *testing.T) {
	for _, key := range []string{"flags_rain", "weather_change"} {
		t.Run(key, func(t *testing.T) {
			r := newTimedRace(t)
			r.e.ProcessPacket(context.Background(), &packets.PacketSessionData{Header: r.h, SessionType: packets.SessionQ1, TrackLength: 5000})
			r.lap.DriverStatus = packets.DriverStatusFlyingLap
			r.tick(time.Second)
			if r.e.currentPhase != PhaseFlyingLap {
				t.Fatalf("phase %v, want a push lap", r.e.currentPhase)
			}
			r.make(key, UrgencyMedium)
			r.tick(time.Second)
			if n := spoken(t, r.b, key); n != 0 {
				t.Fatalf("%s said %d times on the push lap", key, n)
			}
			r.lap.DriverStatus = packets.DriverStatusInLap
			r.tick(time.Second)
			if n := spoken(t, r.b, key); n != 1 {
				t.Fatalf("%s said %d times on the in-lap, want 1", key, n)
			}
		})
	}

	t.Run("a likelier forecast", func(t *testing.T) {
		r := newTimedRace(t)
		r.make("flags_rain", UrgencyMedium)
		r.tick(0)
		r.tick(time.Minute)
		r.make("flags_rain", UrgencyMedium)
		r.tick(0)
		if n := spoken(t, r.b, "flags_rain"); n != 2 {
			t.Fatalf("forecast said %d times, want both", n)
		}
	})
}

// Right after the player's stop the gaps say nothing yet about who is closing.
func TestEngineerEngine_ClosingCallsWaitAfterTheStop(t *testing.T) {
	for key, want := range map[string]int{"rival_closing": 0, "rival_catching_you": 0, "rival_penalty": 1} {
		r := newTimedRace(t)
		r.lap.NumPitStops = 1
		r.e.ProcessPacket(context.Background(), &packets.PacketCarStatusData{Header: r.h, CarStatusData: [packets.MaxCars]packets.CarStatusData{{TyresAgeLaps: 1}}})
		r.make(key, UrgencyLow)
		r.tick(time.Second)
		if n := spoken(t, r.b, key); n != want {
			t.Errorf("%s said %d times on the lap after the stop, want %d", key, n, want)
		}
	}
}

// A stop's steps and a change of the rain are said when they happen, whatever was said before
// them in their category.
func TestEngineerEngine_SaidWhenTheyHappen(t *testing.T) {
	tests := []struct{ before, call string }{
		{"penalties", "penalty_served"},
		{"track_temp_swing", "weather_change"},
	}
	for _, tt := range tests {
		t.Run(tt.call, func(t *testing.T) {
			r := newTimedRace(t)
			r.make(tt.before, UrgencyCritical)
			r.tick(0)
			r.tick(15 * time.Second) // the radio is free again, within the category's cooldown
			r.make(tt.call, UrgencyMedium)
			r.tick(0)
			if n := spoken(t, r.b, tt.call); n != 1 {
				t.Errorf("%s said %d times after %s, want 1", tt.call, n, tt.before)
			}
		})
	}
}
