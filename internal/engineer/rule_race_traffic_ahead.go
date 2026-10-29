package engineer

import (
	"log/slog"
	"math"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// slowCarAhead is a slow car on the road ahead of the player and when the player reaches it.
type slowCarAhead struct {
	idx     int
	meet    trafficMeeting
	stopped bool
}

// slowCarProfile is the pace profile the slow car calls run on: the field's speeds in this race
// (field true), so a car braking where the field brakes isn't slow; until they are known, the
// track's pace profile, on which only a stopped car is called.
func slowCarProfile(ctx *EvaluationContext) (prof paceProfile, field bool) {
	if prof, ok := raceProfile(ctx); ok {
		return prof, true
	}
	return trafficProfile(ctx), false
}

// evaluateSlowCarAhead warns the player of a slow or stopped car on the road ahead (a crash,
// damage, a car rejoining), so they hear QualyTrafficWarnSec before they reach it: from the
// player's race pace and the car's on the field's speeds here, as the qualifying traffic calls.
// Each car once per approach, with a second one QualyTrainSec behind it counted in the same call.
// Until the field's speeds are known (most of lap 1), a stopped car only, and never on a flat
// profile (at a track first driven): a car in a slow corner would seem stopped.
func (r *RaceTrafficRule) evaluateSlowCarAhead(ctx *EvaluationContext, player *packets.LapData) *Directive {
	prof, field := slowCarProfile(ctx)
	if !field && !r.noFieldLogged {
		r.noFieldLogged = true
		slog.Info("Race traffic waits for the field's speeds", "lap", player.CurrentLapNum)
	}
	if prof.source() == "flat" {
		if !r.noProfileLogged {
			r.noProfileLogged = true
			slog.Info("Race traffic waits for the track's speeds", "lap", player.CurrentLapNum)
		}
		r.ahead = [packets.MaxCars]trafficApproach{}
		return nil
	}
	lapM := ctx.TrackLengthM()
	fast := racingShare(ctx, ctx.PlayerCarIndex, prof)
	calling := onTrack(player) && ctx.Motion.ready(ctx.PlayerCarIndex) && fast > 0
	entryM := ctx.TrackProfile.entry()
	var cars []slowCarAhead
	for i := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex {
			continue
		}
		rival := &ctx.LapData.LapData[i]
		a := &r.ahead[i]
		short, okShort := ctx.Motion.paceShare(i, PaceWindowShortMs, prof)
		long, okLong := ctx.Motion.paceShare(i, PaceWindowLongMs, prof)
		share := max(min(short, long), 0)
		if !onTrack(rival) || !okShort || !okLong || (a.warned && share > RaceSlowClearShare) {
			*a = trafficApproach{}
			continue
		}
		gapM := trackGapM(player.LapDistance, rival.LapDistance, lapM)
		m := meeting(prof, player.LapDistance, gapM, fast, share)
		heard := heardSec(ctx, m)
		if trackApproach(ctx, a, i, gapM, lapM, heard, false, raceTrafficLog) || !calling ||
			share > RaceSlowShare || fast-share < RaceTrafficMinClosingShare || math.IsInf(heard, 1) {
			continue
		}
		stopped := short < RaceStoppedShare
		if !stopped && !field {
			continue
		}
		if !stopped && entryM > 0 && trackGapM(rival.LapDistance, entryM, lapM) <= PitEntryGuardM {
			continue
		}
		cars = append(cars, slowCarAhead{idx: i, meet: m, stopped: stopped})
	}
	first := -1
	for k, c := range cars {
		if heardSec(ctx, c.meet) <= trafficWarnSec(ctx) && (first < 0 || c.meet.reachSec < cars[first].meet.reachSec) {
			first = k
		}
	}
	if first < 0 {
		return nil
	}
	return r.slowCarCallLocked(ctx, cars, cars[first], prof.source())
}

// slowCarCallLocked is the call for slow car first, the one the player reaches next, with the
// other slow cars reached QualyTrainSec after it counted as called.
func (r *RaceTrafficRule) slowCarCallLocked(ctx *EvaluationContext, cars []slowCarAhead, first slowCarAhead, source string) *Directive {
	now, reach := trafficCall(ctx, &r.ahead[first.idx], first.meet, source, "race_slow_car_ahead", "race_slow_car_ahead_now")
	for _, c := range cars {
		if after := c.meet.reachSec - first.meet.reachSec; c.idx != first.idx && after >= 0 && after <= QualyTrainSec {
			r.ahead[c.idx] = r.ahead[first.idx]
			r.ahead[c.idx].train, r.ahead[c.idx].meet = true, c.meet
		}
	}
	values := &DirectiveValues{Ahead: &GapToCar{GapSec: roundTo(first.meet.roadSec, 1), ReachSec: reach}}
	switch {
	case now:
		return &Directive{
			ID:       "race_slow_car_ahead",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_slow_car_ahead_now",
			Title:    "Slow Car Ahead",
			Message:  trafficMessage("Slow car ahead", 0),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	case first.stopped:
		r.ahead[first.idx].subAlert = "race_stopped_car_ahead"
		return &Directive{
			ID:       "race_slow_car_ahead",
			Category: DirectiveCategoryFlags,
			SubAlert: "race_stopped_car_ahead",
			Title:    "Stopped Car Ahead",
			Message:  trafficMessage("Car stopped ahead", reach),
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	}
	return &Directive{
		ID:       "race_slow_car_ahead",
		Category: DirectiveCategoryFlags,
		SubAlert: "race_slow_car_ahead",
		Title:    "Slow Car Ahead",
		Message:  trafficMessage("Slow car ahead", reach),
		Urgency:  UrgencyHigh,
		Values:   values,
	}
}
