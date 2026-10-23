package engineer

import (
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// raceBehindKeys are the race traffic rule's cars-behind alert keys.
var raceBehindKeys = behindKeys{
	warn: "race_car_behind", close: "race_car_behind_close", clear: "race_car_behind_clear", pitExit: "race_pit_exit_traffic",
}

// evaluateCarsComing warns a player who is slow in a race (a spin, damage, rejoining, just out of
// the pit lane) of the cars closing on them from behind at race pace, so they hear
// QualyTrafficWarnSec before a car gets there, then "on you now" and "clear", as the qualifying
// out-lap calls (stepBehindLocked). A car counts at its race pace, and only RaceTrafficMinClosingShare
// faster than the player. No warning while the player slows for the pit entry, nor on a flat
// profile. "Clear" is said in the pit lane too, after the pit exit call.
func (r *RaceTrafficRule) evaluateCarsComing(ctx *EvaluationContext, player *packets.LapData) []Directive {
	prof := trafficProfile(ctx)
	if prof.source() == "flat" {
		r.behind = [packets.MaxCars]trafficApproach{}
		return nil
	}
	var shares [packets.MaxCars]float64
	for i := range shares {
		shares[i] = racingShare(ctx, i, prof)
	}
	slow, ready := r.joinLocked(ctx, player, prof, slowShare(ctx, ctx.PlayerCarIndex, prof))
	onTrackNow := ready && onTrack(player)
	calling := onTrackNow && ctx.Phase != PhasePitLane && (r.justJoined(ctx) || playerSlow(ctx, prof)) &&
		!nearPitEntry(ctx, player)
	calls := r.stepBehindLocked(ctx, player, prof, behindStep{
		slow:       slow,
		counts:     func(i int, _ *packets.LapData) bool { return shares[i] > 0 },
		share:      func(i int) float64 { return shares[i] },
		minClosing: RaceTrafficMinClosingShare,
		calling:    calling,
		closing:    onTrackNow,
		following:  ready,
		log:        raceTrafficLog,
		key:        "race_car_behind", nowKey: "race_car_behind_now", twoKey: "race_car_behind_two",
	})

	var dirs []Directive
	if calls.warn >= 0 {
		dirs = append(dirs, raceCarBehindCall(calls))
	}
	if calls.close >= 0 {
		dirs = append(dirs, Directive{
			ID:       "race_car_behind_close",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_car_behind_close",
			Title:    "Car on You",
			Message:  "Car right behind you now, hold your line.",
			Urgency:  UrgencyHigh,
			Values:   &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(calls.closeMeet.roadSec, 1)}},
		})
	}
	if calls.clear {
		dirs = append(dirs, Directive{
			ID:       "race_car_behind_clear",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_car_behind_clear",
			Title:    "Clear Behind",
			Message:  "Clear, it's through.",
			Urgency:  UrgencyHigh,
		})
	}
	if d := r.racePitExitLocked(ctx, player, prof, shares); d != nil {
		dirs = append(dirs, *d)
	}
	return dirs
}

// raceCarBehindCall is the warning of a car coming behind the step decided on: of one car, two,
// or one right there.
func raceCarBehindCall(calls behindCalls) Directive {
	values := &DirectiveValues{Behind: &GapToCar{GapSec: roundTo(calls.meet.roadSec, 1), ReachSec: calls.reach}}
	switch {
	case calls.now:
		return Directive{
			ID:       "race_car_behind",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_car_behind_now",
			Title:    "Car Coming Behind",
			Message:  trafficMessage("Car coming behind", 0),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	case calls.second >= 0:
		return Directive{
			ID:       "race_car_behind",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_car_behind_two",
			Title:    "Cars Coming Behind",
			Message:  trafficMessage("Two cars coming behind", calls.reach),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	}
	return Directive{
		ID:       "race_car_behind",
		Category: DirectiveCategoryFlags,
		SubAlert: "race_car_behind",
		Title:    "Car Coming Behind",
		Message:  trafficMessage("Car coming behind", calls.reach),
		Urgency:  UrgencyHigh,
		Values:   values,
	}
}

// racePitExitLocked warns a player leaving their box after a stop of a car on track that will
// pass the pit exit as they get there, at its race pace (pitExitLocked). A drive-through has no
// stop in the box, so no call; nor under a Safety Car or VSC, where no car runs at race pace.
func (r *RaceTrafficRule) racePitExitLocked(ctx *EvaluationContext, player *packets.LapData, prof paceProfile, shares [packets.MaxCars]float64) *Directive {
	if ctx.Session != nil && neutralisedStatus(ctx.Session.SafetyCarStatus) {
		return nil
	}
	car, afterSec := r.pitExitLocked(ctx, player, ctx.PreviousPhase == PhaseInGarage, prof,
		func(i int, _ *packets.LapData) bool { return shares[i] > 0 },
		func(i int) float64 { return shares[i] })
	if car < 0 {
		return nil
	}
	return &Directive{
		ID:       "race_pit_exit_traffic",
		Category: DirectiveCategoryFlags,
		SubAlert: "race_pit_exit_traffic",
		Title:    "Car at the Pit Exit",
		Message:  "Car coming past the pit exit, careful as you join.",
		Urgency:  UrgencyHigh,
		Values:   &DirectiveValues{Behind: withRival(ctx, car, &GapToCar{GapSec: roundTo(afterSec, 1)})},
	}
}

// playerSlow reports whether the player runs at RaceSlowShare of the pace profile or slower over
// both pace windows: a spin, damage, rejoining; braking early for one corner is never both.
func playerSlow(ctx *EvaluationContext, prof paceProfile) bool {
	short, okShort := ctx.Motion.paceShare(ctx.PlayerCarIndex, PaceWindowShortMs, prof)
	long, okLong := ctx.Motion.paceShare(ctx.PlayerCarIndex, PaceWindowLongMs, prof)
	return okShort && okLong && short <= RaceSlowShare && long <= RaceSlowShare
}

// slowInRace reports whether the player is slow in a race (playerSlow) on a learned pace profile.
func slowInRace(ctx *EvaluationContext) bool {
	prof := trafficProfile(ctx)
	return ctx.IsRaceSession() && prof.source() != "flat" && playerSlow(ctx, prof)
}

// nearPitEntry reports whether the player is within PitEntryGuardM before the learned pit entry
// on their way in: on an in-lap, told to box this lap, or on the pit limiter. They slow down there
// on purpose.
func nearPitEntry(ctx *EvaluationContext, player *packets.LapData) bool {
	entryM := ctx.TrackProfile.entry()
	if entryM <= 0 || trackGapM(player.LapDistance, entryM, ctx.TrackLengthM()) > PitEntryGuardM {
		return false
	}
	status := ctx.PlayerStatus()
	return player.DriverStatus == packets.DriverStatusInLap || ctx.BoxDueLap == int(player.CurrentLapNum) ||
		(status != nil && status.PitLimiterStatus == 1)
}
