package engineer

import (
	"cmp"
	"log/slog"
	"slices"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// RaceTrafficRule says, in a race, the cars the player meets on the road: the cars lapping them
// when the game shows the blue flag, and "clear" once they went by; a slow or stopped car ahead,
// by when the player reaches it; and, when the player is slow or leaving the pits, the cars
// coming from behind.
type RaceTrafficRule struct {
	mu sync.Mutex
	// lapping is where the rule stands with each car lapping the player.
	lapping [packets.MaxCars]lappingCar
	// flag is the player's flag at the last lap data, and blueAt when it last turned blue.
	// blueCalled says a call was made for that blue flag; fallbackAt is when the flag itself was
	// said (no car close enough to name), until the radio is known to have said it.
	flag       int8
	blueAt     int64
	blueCalled bool
	fallbackAt int64
	// clearAt is when "clear" was made for the cars that went by, until the radio said it.
	clearAt int64
	// ahead is where the rule stands with each slow car ahead; noProfileLogged says the log has
	// said there is no pace profile to time them on, noFieldLogged that the field's speeds aren't
	// known yet.
	ahead           [packets.MaxCars]trafficApproach
	noProfileLogged bool
	noFieldLogged   bool
	// The cars coming from behind a slow player, and the pit exit call.
	carsBehind
	// motionEpoch is the motion samples' epoch the road gaps were worked out in.
	motionEpoch int
}

// lappingCar is where the rule stands with one car lapping the player.
type lappingCar struct {
	warned    bool
	madeAt    int64 // unix ms the call naming it was made
	confirmed bool  // the radio said it
	passedAt  int64 // unix ms it went by (0: not yet)
	// overSince is since when it runs more than BlueFlagRoadSec+TrafficRearmSec back (0: not); a
	// car that stays that far back for TrafficRearmMs is called again when it comes back.
	overSince int64
}

// lapper is a car lapping the player, behind them on the road.
type lapper struct {
	idx     int
	roadM   float32 // how far back on the road
	roadSec float64 // the same at its race pace
}

// NewRaceTrafficRule creates a new RaceTrafficRule.
func NewRaceTrafficRule() *RaceTrafficRule {
	return &RaceTrafficRule{flag: packets.VehicleFIAFlagNone}
}

func (r *RaceTrafficRule) Name() string {
	return "race_traffic"
}

func (r *RaceTrafficRule) Category() string {
	return string(DirectiveCategoryFlags)
}

func (r *RaceTrafficRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhasePitLane}
}

func (r *RaceTrafficRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		// The blue flag, naming one car or two, on any lap of the race: an in-lap and the out-lap
		// after a stop are when the player is lapped most.
		"flags_blue": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
		},
		"flags_blue_clear": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficCloseSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
		},
		// A slow or stopped car on the road ahead, QualyTrafficWarnSec before the player gets there.
		"race_slow_car_ahead": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
		},
		// The cars coming from behind a slow player: the warning, "on you now" and "clear"; the
		// follow-ups also in the pit lane, after the pit exit call.
		"race_car_behind": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
		},
		"race_car_behind_close": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhasePitLane},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficCloseSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
			PitLaneCall:   true,
		},
		"race_car_behind_clear": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhasePitLane},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficCloseSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
			PitLaneCall:   true,
		},
		// A car coming past the pit exit as the player leaves their box after a stop.
		"race_pit_exit_traffic": {
			Category:      DirectiveCategoryFlags,
			ValidPhases:   []DrivingPhase{PhasePitLane},
			DedupScope:    DedupScopeNone,
			MaxDelayMs:    TrafficMaxDelayMs,
			MinRepeatMs:   TrafficMinRepeatMs,
			SpeechMs:      TrafficSpeechMs,
			CooldownGroup: cooldownRaceTraffic,
			PitLaneCall:   true,
		},
	}
}

func (r *RaceTrafficRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lapping = [packets.MaxCars]lappingCar{}
		r.flag, r.blueAt, r.blueCalled, r.fallbackAt = packets.VehicleFIAFlagNone, 0, false, 0
		r.clearAt, r.motionEpoch = 0, 0
		r.ahead, r.noProfileLogged, r.noFieldLogged = [packets.MaxCars]trafficApproach{}, false, false
		r.carsBehind = carsBehind{}
	}
}

// Evaluate works on lap data, in races only.
func (r *RaceTrafficRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	player := ctx.PlayerLap()
	if !ctx.IsRaceSession() || player == nil || ctx.LapData == nil ||
		(ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet)) {
		return nil
	}
	r.followLocked(ctx)
	var dirs []Directive
	if ctx.Phase != PhasePitLane {
		dirs = append(dirs, r.evaluateBlueFlag(ctx, player)...)
		if d := r.evaluateSlowCarAhead(ctx, player); d != nil {
			dirs = append(dirs, *d)
		}
	}
	return append(dirs, r.evaluateCarsComing(ctx, player)...)
}

// followLocked forgets what was worked out from motion samples since dropped (a flashback), and
// checks the calls made on the last packet got on the radio: a car whose call the radio didn't say
// is called again, and so is the flag.
func (r *RaceTrafficRule) followLocked(ctx *EvaluationContext) {
	if ctx.Motion != nil && ctx.Motion.epoch != r.motionEpoch {
		r.motionEpoch = ctx.Motion.epoch
		r.lapping = [packets.MaxCars]lappingCar{}
		r.ahead = [packets.MaxCars]trafficApproach{}
		r.behind = [packets.MaxCars]trafficApproach{}
		r.clearAt = 0
	}
	prof, _ := slowCarProfile(ctx)
	confirmTraffic(ctx, &r.ahead, "race_slow_car_ahead", prof, raceTrafficLog)
	r.followBehindLocked(ctx, raceBehindKeys, raceTrafficLog)
	for i := range r.lapping {
		c := &r.lapping[i]
		if !c.warned || c.confirmed {
			continue
		}
		if ctx.LastSaid["flags_blue"] < c.madeAt {
			*c = lappingCar{}
			continue
		}
		c.confirmed = true
	}
	if r.fallbackAt > 0 {
		r.blueCalled = ctx.LastSaid["flags_blue"] >= r.fallbackAt
		r.fallbackAt = 0
	}
	if r.clearAt > 0 {
		if ctx.LastSaid["flags_blue_clear"] >= r.clearAt {
			r.forgetPassedLocked()
		}
		r.clearAt = 0
	}
}

// evaluateBlueFlag says the blue flag the game shows the player with the car it is for: the
// nearest car lapping them within BlueFlagRoadSec on the road, or two of them when another is
// BlueFlagTrainSec behind it, each once as it comes past. Then "clear" once the cars called went
// by.
func (r *RaceTrafficRule) evaluateBlueFlag(ctx *EvaluationContext, player *packets.LapData) []Directive {
	prof := trafficProfile(ctx)
	cars := lappingCars(ctx, player, prof)
	r.trackLappingLocked(ctx, player, cars)

	flag := packets.VehicleFIAFlagNone
	if s := ctx.PlayerStatus(); s != nil {
		flag = s.VehicleFIAFlags
	}
	blue := flag == packets.VehicleFIAFlagBlue
	if blue && r.flag != packets.VehicleFIAFlagBlue {
		r.blueAt, r.blueCalled = ctx.Now, false
		logBlueFlag(ctx, cars, prof)
	}
	r.flag = flag

	var dirs []Directive
	if blue {
		if d := r.blueFlagCallLocked(ctx, cars); d != nil {
			dirs = append(dirs, *d)
		}
	}
	if d := r.clearCallLocked(ctx, player, cars); d != nil {
		dirs = append(dirs, *d)
	}
	return dirs
}

// blueFlagCallLocked is the call for the blue flag shown now: the nearest car lapping the player
// within BlueFlagRoadSec not called yet (nor warned of as coming behind a slow player), with the
// next one when it is BlueFlagTrainSec behind it.
// With none that close, the flag itself is said once per flag, at most every BlueFlagMinRepeatMs
// and not while a car called is still on its way, and the nearest lapping car counts as called.
func (r *RaceTrafficRule) blueFlagCallLocked(ctx *EvaluationContext, cars []lapper) *Directive {
	first := -1
	for k, c := range cars {
		if c.roadSec > BlueFlagRoadSec {
			break
		}
		if !r.lapping[c.idx].warned && !r.behind[c.idx].warned {
			first = k
			break
		}
	}
	if first < 0 {
		last, said := ctx.LastSaid["flags_blue"]
		if r.blueCalled || r.waitingLocked(cars) || (said && ctx.Now-last < BlueFlagMinRepeatMs) {
			return nil
		}
		r.blueCalled, r.fallbackAt = true, ctx.Now
		for _, c := range cars {
			if !r.lapping[c.idx].warned {
				r.lapping[c.idx] = lappingCar{warned: true, madeAt: ctx.Now}
				break
			}
		}
		return &Directive{
			ID:       "flags_blue",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_blue",
			Title:    "Blue Flag",
			Message:  "Blue flags. Let the car behind through.",
			Urgency:  UrgencyHigh,
		}
	}

	second := -1
	for k := first + 1; k < len(cars) && cars[k].roadSec-cars[first].roadSec <= BlueFlagTrainSec; k++ {
		if !r.lapping[cars[k].idx].warned && !r.behind[cars[k].idx].warned {
			second = k
			break
		}
	}
	r.blueCalled = true
	near := cars[first]
	r.lapping[near.idx] = lappingCar{warned: true, madeAt: ctx.Now}
	values := &DirectiveValues{Behind: withRival(ctx, near.idx, &GapToCar{GapSec: roundTo(near.roadSec, 1)})}
	if second < 0 {
		return &Directive{
			ID:       "flags_blue",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_blue",
			Title:    "Blue Flag",
			Message:  "Blue flags. Let the car behind through.",
			Urgency:  UrgencyHigh,
			Values:   values,
		}
	}
	r.lapping[cars[second].idx] = lappingCar{warned: true, madeAt: ctx.Now}
	return &Directive{
		ID:       "flags_blue",
		Category: DirectiveCategoryFlags,
		SubAlert: "flags_blue_two",
		Title:    "Blue Flag, Two Cars",
		Message:  "Blue flags, two cars to let by.",
		Urgency:  UrgencyHigh,
		Values:   values,
	}
}

// waitingLocked reports whether a car called is still on its way past the player: one the blue
// flag named, or one of cars warned of as coming behind.
func (r *RaceTrafficRule) waitingLocked(cars []lapper) bool {
	for _, c := range r.lapping {
		if c.warned && c.passedAt == 0 {
			return true
		}
	}
	return slices.ContainsFunc(cars, func(l lapper) bool { return r.behind[l.idx].warned })
}

// trackLappingLocked moves the called cars on: one that went by (its gap wrapped past half a lap)
// is kept for "clear", with when. One off the track or no longer a lap up is forgotten, and so is
// one that runs well back for a while: it is called again when it comes back.
func (r *RaceTrafficRule) trackLappingLocked(ctx *EvaluationContext, player *packets.LapData, cars []lapper) {
	lapM := ctx.TrackLengthM()
	for i := range r.lapping {
		c := &r.lapping[i]
		if !c.warned || c.passedAt > 0 {
			continue
		}
		rival := &ctx.LapData.LapData[i]
		if !onTrack(rival) || rival.TotalDistance-player.TotalDistance < lapM/2 {
			*c = lappingCar{}
			continue
		}
		if c.confirmed && trackGapM(rival.LapDistance, player.LapDistance, lapM) > lapM/2 {
			c.passedAt = ctx.Now
			afterFlag := -1.0
			if r.blueAt > 0 {
				afterFlag = roundTo(float64(ctx.Now-r.blueAt)/1000, 1)
			}
			slog.Info("Lapping car passed", "car", i, "after_call_sec", roundTo(float64(ctx.Now-c.madeAt)/1000, 1), "after_flag_sec", afterFlag)
			continue
		}
		back := slices.IndexFunc(cars, func(l lapper) bool { return l.idx == i })
		if back >= 0 && cars[back].roadSec <= BlueFlagRoadSec+TrafficRearmSec {
			c.overSince = 0
			continue
		}
		if c.overSince == 0 {
			c.overSince = ctx.Now
		} else if ctx.Now-c.overSince >= TrafficRearmMs {
			*c = lappingCar{}
		}
	}
}

// clearCallLocked says the road behind is clear once every car called went by and the nearest is
// QualyClearAheadM ahead, within TrafficClearWithinMs of the last pass. Not while another car
// lapping the player is within BlueFlagRoadSec: its own call is next.
func (r *RaceTrafficRule) clearCallLocked(ctx *EvaluationContext, player *packets.LapData, cars []lapper) *Directive {
	if r.clearAt > 0 {
		return nil
	}
	lapM := ctx.TrackLengthM()
	var lastPass int64
	nearest := lapM
	for i, c := range r.lapping {
		if !c.warned {
			continue
		}
		if c.passedAt == 0 {
			return nil
		}
		lastPass = max(lastPass, c.passedAt)
		nearest = min(nearest, trackGapM(player.LapDistance, ctx.LapData.LapData[i].LapDistance, lapM))
	}
	if lastPass == 0 {
		return nil
	}
	if (len(cars) > 0 && cars[0].roadSec <= BlueFlagRoadSec) || ctx.Now-lastPass > TrafficClearWithinMs {
		r.forgetPassedLocked()
		return nil
	}
	if nearest < QualyClearAheadM || nearest > lapM/2 {
		return nil
	}
	r.clearAt = ctx.Now
	return &Directive{
		ID:       "flags_blue_clear",
		Category: DirectiveCategoryFlags,
		SubAlert: "flags_blue_clear",
		Title:    "Blue Flag Cars Through",
		Message:  "Clear, they're through.",
		Urgency:  UrgencyHigh,
	}
}

// forgetPassedLocked forgets the cars called that went by.
func (r *RaceTrafficRule) forgetPassedLocked() {
	for i := range r.lapping {
		if r.lapping[i].passedAt > 0 {
			r.lapping[i] = lappingCar{}
		}
	}
}

// lappingCars are the cars on track a lap or more ahead of the player in the race (half a lap or
// more on the race distance) that are behind them on the road, nearest first, with how far back:
// in metres, and in seconds at the car's race pace (the profile's while unknown).
func lappingCars(ctx *EvaluationContext, player *packets.LapData, prof paceProfile) []lapper {
	lapM := ctx.TrackLengthM()
	var cars []lapper
	for i := range ctx.LapData.LapData {
		rival := &ctx.LapData.LapData[i]
		if i == ctx.PlayerCarIndex || !onTrack(rival) || rival.TotalDistance-player.TotalDistance < lapM/2 {
			continue
		}
		gapM := trackGapM(rival.LapDistance, player.LapDistance, lapM)
		if gapM > lapM/2 {
			continue
		}
		share := racingShare(ctx, i, prof)
		if share <= 0 {
			share = 1
		}
		cars = append(cars, lapper{idx: i, roadM: gapM, roadSec: prof.sec(rival.LapDistance, gapM) / share})
	}
	slices.SortFunc(cars, func(a, b lapper) int { return cmp.Compare(a.roadSec, b.roadSec) })
	return cars
}

// logBlueFlag logs the blue flag the game just showed the player, with the car lapping them that is
// nearest on the road (car -1: none), so how early the game shows it can be read off a race.
func logBlueFlag(ctx *EvaluationContext, cars []lapper, prof paceProfile) {
	if len(cars) == 0 {
		slog.Info("Blue flag shown", "car", -1, "profile", prof.source())
		return
	}
	near := cars[0]
	train := 0
	for _, c := range cars {
		if c.roadSec <= near.roadSec+BlueFlagTrainSec {
			train++
		}
	}
	slog.Info("Blue flag shown", "car", near.idx, "road_sec", roundTo(near.roadSec, 1), "road_m", int(near.roadM),
		"cars", train, "driver_status", ctx.LapData.LapData[near.idx].DriverStatus, "profile", prof.source())
}
