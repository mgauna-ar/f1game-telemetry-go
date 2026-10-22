package engineer

import (
	"context"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceCar is a car on lap 10 of a race, lapDist into the lap and totalDist into the race.
func raceCar(lapDist, totalDist float32) packets.LapData {
	return packets.LapData{
		CurrentLapNum: 10,
		DriverStatus:  packets.DriverStatusOnTrack,
		ResultStatus:  packets.ResultStatusActive,
		LapDistance:   lapDist,
		TotalDistance: totalDist,
	}
}

// lapperAt is a car a lap up on a player at 2000 m (46 000 m into the race), backM behind them on
// the road; negative is ahead.
func lapperAt(backM float32) packets.LapData {
	return raceCar(2000-backM, 46_000+qualyTrackLen-backM)
}

// blueEval evaluates rule on lap data of a race on qualyTrackLen metres, with the player (car 0,
// at 2000 m) shown flag, at now, with the calls the radio said in lastSaid.
func blueEval(rule *RaceTrafficRule, lastSaid map[string]int64, now int64, flag int8, cars ...packets.LapData) []Directive {
	ctx := qualyCtx(packets.SessionRace, PhaseRacing, append([]packets.LapData{raceCar(2000, 46_000)}, cars...)...)
	ctx.Status = &packets.PacketCarStatusData{}
	ctx.Status.CarStatusData[0].VehicleFIAFlags = flag
	ctx.Now, ctx.LastSaid = now, lastSaid
	return rule.Evaluate(ctx)
}

// The blue flag names the car lapping the player that it is for, once, then says "clear" once it
// went by.
func TestRaceTrafficRule_BlueFlagOneCar(t *testing.T) {
	rule := NewRaceTrafficRule()
	said := map[string]int64{}
	blue := packets.VehicleFIAFlagBlue

	dirs := blueEval(rule, said, 1000, blue, lapperAt(100))
	d := directiveFor(dirs, "flags_blue")
	if d == nil || d.Urgency != UrgencyHigh || d.Values == nil || d.Values.Behind.GapSec != 1.5 {
		t.Fatalf("expected flags_blue for the car 1.5 s back, got %+v", dirs)
	}
	sayAll(said, dirs, 1000)
	if dirs := blueEval(rule, said, 1050, blue, lapperAt(80)); len(dirs) != 0 {
		t.Fatalf("the car was called again: %v", subAlerts(dirs))
	}
	// It goes by; "clear" once it is QualyClearAheadM ahead.
	if dirs := blueEval(rule, said, 3000, packets.VehicleFIAFlagNone, lapperAt(-10)); len(dirs) != 0 {
		t.Fatalf("called %v with the car only 10 m ahead", subAlerts(dirs))
	}
	dirs = blueEval(rule, said, 3500, packets.VehicleFIAFlagNone, lapperAt(-40))
	if directiveFor(dirs, "flags_blue_clear") == nil {
		t.Fatalf("expected clear once the car is 40 m ahead, got %v", subAlerts(dirs))
	}
	sayAll(said, dirs, 3500)
	for now := int64(3550); now < 4000; now += 50 {
		if dirs := blueEval(rule, said, now, packets.VehicleFIAFlagNone, lapperAt(-60)); len(dirs) != 0 {
			t.Fatalf("called %v after clear", subAlerts(dirs))
		}
	}
}

// Two cars lapping the player close together are named in one call; a third coming later gets
// its own, and "clear" waits until it went by too.
func TestRaceTrafficRule_BlueFlagTrain(t *testing.T) {
	rule := NewRaceTrafficRule()
	said := map[string]int64{}
	blue := packets.VehicleFIAFlagBlue

	// 100 m and 160 m back: 1.5 s and 2.5 s at 65 m/s, within BlueFlagTrainSec.
	dirs := blueEval(rule, said, 1000, blue, lapperAt(100), lapperAt(160), lapperAt(600))
	if directiveFor(dirs, "flags_blue_two") == nil {
		t.Fatalf("expected flags_blue_two, got %v", subAlerts(dirs))
	}
	sayAll(said, dirs, 1000)

	// Both went by, the third is coming within BlueFlagRoadSec: its call, not "clear".
	dirs = blueEval(rule, said, 5000, blue, lapperAt(-60), lapperAt(-40), lapperAt(150))
	if directiveFor(dirs, "flags_blue_clear") != nil || directiveFor(dirs, "flags_blue") == nil {
		t.Fatalf("expected the third car's call and no clear, got %v", subAlerts(dirs))
	}
	sayAll(said, dirs, 5000)
	dirs = blueEval(rule, said, 9000, packets.VehicleFIAFlagNone, lapperAt(-300), lapperAt(-280), lapperAt(-40))
	if directiveFor(dirs, "flags_blue_clear") == nil {
		t.Fatalf("expected clear once the third went by, got %v", subAlerts(dirs))
	}
}

// With no lapping car close enough to name, the flag itself is said once, and the nearest lapping
// car counts as called: no second call when it comes close. A new flag soon after isn't said
// again within BlueFlagMinRepeatMs.
func TestRaceTrafficRule_BlueFlagFallback(t *testing.T) {
	rule := NewRaceTrafficRule()
	said := map[string]int64{}
	blue, none := packets.VehicleFIAFlagBlue, packets.VehicleFIAFlagNone

	dirs := blueEval(rule, said, 1000, blue, lapperAt(400)) // 6 s back
	d := directiveFor(dirs, "flags_blue")
	if d == nil || d.Values != nil {
		t.Fatalf("expected the flag itself, got %+v", dirs)
	}
	sayAll(said, dirs, 1000)
	if dirs := blueEval(rule, said, 3000, blue, lapperAt(100)); len(dirs) != 0 {
		t.Fatalf("the car was called again once close: %v", subAlerts(dirs))
	}

	// A flag with no lapping car at all, shown again soon after: said once.
	rule = NewRaceTrafficRule()
	said = map[string]int64{}
	sayAll(said, blueEval(rule, said, 1000, blue), 1000)
	blueEval(rule, said, 2000, none)
	if dirs := blueEval(rule, said, 3000, blue); len(dirs) != 0 {
		t.Fatalf("the flag was said again %v ms later: %v", 2000, subAlerts(dirs))
	}
	blueEval(rule, said, 30_000, none)
	if d := directiveFor(blueEval(rule, said, 30_050, blue), "flags_blue"); d == nil {
		t.Fatal("a flag BlueFlagMinRepeatMs later wasn't said")
	}
}

// A call the radio never said (a gate dropped it) is made again.
func TestRaceTrafficRule_BlueFlagMadeAgainWhenNotSaid(t *testing.T) {
	rule := NewRaceTrafficRule()
	said := map[string]int64{}
	blue := packets.VehicleFIAFlagBlue
	if directiveFor(blueEval(rule, said, 1000, blue, lapperAt(100)), "flags_blue") == nil {
		t.Fatal("expected the first call")
	}
	if directiveFor(blueEval(rule, said, 1050, blue, lapperAt(95)), "flags_blue") == nil {
		t.Fatal("a call the radio never said wasn't made again")
	}
	sayAll(said, []Directive{{ID: "flags_blue"}}, 1050)
	if dirs := blueEval(rule, said, 1100, blue, lapperAt(90)); len(dirs) != 0 {
		t.Fatalf("called again once said: %v", subAlerts(dirs))
	}
}

// Cars a lap down, a lap up but ahead on the road, or in the pits aren't lapping the player.
func TestRaceTrafficRule_NotLapping(t *testing.T) {
	pitting := lapperAt(100)
	pitting.PitStatus = packets.PitStatusPitting
	sameLap := raceCar(1900, 45_900)
	for name, car := range map[string]packets.LapData{"same lap": sameLap, "in the pits": pitting} {
		t.Run(name, func(t *testing.T) {
			d := directiveFor(blueEval(NewRaceTrafficRule(), map[string]int64{}, 1000, packets.VehicleFIAFlagBlue, car), "flags_blue")
			if d == nil || d.Values != nil {
				t.Fatalf("expected the flag itself, with no car named: %+v", d)
			}
		})
	}
	if dirs := blueEval(NewRaceTrafficRule(), map[string]int64{}, 1000, packets.VehicleFIAFlagNone, lapperAt(100)); len(dirs) != 0 {
		t.Fatalf("called %v with no blue flag", subAlerts(dirs))
	}
}

// The blue flag is said on any lap of the race: on an in-lap and on the out-lap after a stop too.
func TestEngineerEngine_BlueFlagOnInAndOutLaps(t *testing.T) {
	for _, status := range []uint8{packets.DriverStatusInLap, packets.DriverStatusOutLap, packets.DriverStatusOnTrack} {
		e, b, clock, h := raceEngine(t)
		player := raceCar(2000, 46_000)
		player.DriverStatus = status
		lap := &packets.PacketLapData{Header: h}
		lap.LapData[0], lap.LapData[1] = player, lapperAt(100)
		e.ProcessPacket(context.Background(), lap)
		st := &packets.PacketCarStatusData{Header: h}
		st.CarStatusData[0].VehicleFIAFlags = packets.VehicleFIAFlagBlue
		e.ProcessPacket(context.Background(), st)
		clock.advance(50 * time.Millisecond)
		e.ProcessPacket(context.Background(), lap)
		if n := spoken(t, b, "flags_blue"); n != 1 {
			t.Errorf("driver status %d: flags_blue said %d times, want once", status, n)
		}
	}
}

// A blue flag call doesn't hold back the other flags news (DRS, retirements) with the flags
// chatter cooldown.
func TestEngineerEngine_BlueFlagDoesNotHoldBackFlagsNews(t *testing.T) {
	r := newTimedRace(t)
	r.make("flags_blue", UrgencyHigh)
	r.tick(0)
	r.tick(time.Duration(RadioDeliveryLatencyMs+TrafficSpeechMs+GlobalRadioChatterCooldownMs) * time.Millisecond)
	r.make("flags_drs_enabled", UrgencyMedium)
	r.tick(0)
	if n := spoken(t, r.b, "flags_drs_enabled"); n != 1 {
		t.Errorf("DRS enabled after a blue flag was said %d times, want once", n)
	}
}

// Every alert key is declared by one rule: a second would silently replace the first's settings.
func TestAlertKeys_DeclaredByOneRule(t *testing.T) {
	owner := map[string]string{}
	for _, rule := range NewEngineerEngine(nil).rules {
		for key := range rule.AlertKeys() {
			if first, ok := owner[key]; ok {
				t.Errorf("%s is declared by %s and %s", key, first, rule.Name())
			}
			owner[key] = rule.Name()
		}
	}
}

// A car's race pace share is the larger of its long window and its last lap.
func TestRacingShare(t *testing.T) {
	ctx := qualyCtx(packets.SessionRace, PhaseRacing, raceCar(2000, 46_000), raceCar(1000, 45_000))
	ctx = withMotion(ctx, map[int]float64{0: 0.5 * qualyFlatMps, 1: qualyFlatMps})
	prof := trafficProfile(ctx)
	if got := racingShare(ctx, 0, prof); got < 0.49 || got > 0.51 {
		t.Errorf("share from the long window %.3f, want 0.5", got)
	}
	// The player's last lap was at the profile's pace: held up a moment, it still counts at that.
	ctx.LapData.LapData[0].LastLapTimeInMS = uint32(prof.lapSec() * 1000)
	if got := racingShare(ctx, 0, prof); got < 0.99 || got > 1.01 {
		t.Errorf("share with a last lap at the profile's pace %.3f, want 1", got)
	}
	// A "last lap" of a few seconds wasn't a whole lap: the long window stands.
	ctx.LapData.LapData[0].LastLapTimeInMS = 3000
	if got := racingShare(ctx, 0, prof); got < 0.49 || got > 0.51 {
		t.Errorf("share with a 3 s last lap %.3f, want 0.5 from the long window", got)
	}
	if got := racingShare(ctx, 5, prof); got != 0 {
		t.Errorf("share of a car with nothing known %.3f, want 0", got)
	}
}
