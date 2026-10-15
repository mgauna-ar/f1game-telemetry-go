package engineer

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FlagsRule manages Safety Car, VSC, Red Flag, rain forecast, and penalties alerts.
type FlagsRule struct {
	mu                       sync.Mutex
	lastSafetyCarStatus      uint8
	lastRedFlagCount         uint8
	rainCalledPct            int // the chance of rain the forecast call said in this rain spell (0: none)
	lastLiveWeather          uint8
	lastCornerCutWarnings    uint8
	lastPenaltyTime          uint8
	lastDriveThroughPnlCount uint8
	lastStopGoPnlCount       uint8
	lastVehicleFIAFlag       int8
	scEndingTriggered        bool
	lastWrongWayAlert        bool
	finalLapSaid             bool
	// sessionSeen and lapSeen: the first session and lap data only record the counts (red flags,
	// penalties, warnings) and the weather, so joining a session midway doesn't announce old news.
	sessionSeen bool
	lapSeen     bool
	// weatherSaid is the weather the radio last went by, and weatherSince when the weather last
	// changed (weatherNow): a change of the rain is said once it held WeatherStepHoldMs.
	weatherSaid, weatherNow uint8
	weatherSince            int64
	// stintTrackTemp is the track temperature as the stint started (stintTempSet), and
	// trackTempCalledAt when the stint's track temperature call was made (0: not yet).
	stintTrackTemp    int
	stintTempSet      bool
	trackTempCalledAt int64
}

// NewFlagsRule creates a new FlagsRule.
func NewFlagsRule() *FlagsRule {
	return &FlagsRule{
		lastVehicleFIAFlag: packets.VehicleFIAFlagNone,
	}
}

func (r *FlagsRule) Name() string {
	return "flags"
}

func (r *FlagsRule) Category() string {
	return string(DirectiveCategoryFlags)
}

func (r *FlagsRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag}
}

func (r *FlagsRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"flags_sc": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag},
			DedupScope:  DedupScopePhase,
		},
		"flags_sc_in": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
		},
		"flags_green": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
		},
		"flags_blue": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
			MinRepeatMs: BlueFlagMinRepeatMs,
		},
		"flags_yellow": {
			Category:           DirectiveCategoryFlags,
			ValidPhases:        []DrivingPhase{PhaseRaceStart, PhaseRacing, PhaseOutLap, PhaseFlyingLap, PhaseInLap},
			DedupScope:         DedupScopeNone,
			BreaksRadioSilence: true,
		},
		"warning_wrong_way": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
		},
		"flags_red": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFormationLap, PhaseGrid, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag},
			DedupScope:  DedupScopePhase,
		},
		"flags_rain": {
			Category:        DirectiveCategoryWeather,
			ValidPhases:     []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:      DedupScopeNone, // once a rain spell, again when likelier (evaluateWeather)
			OutlastsSilence: true,
		},
		// A change of the rain is rare and held WeatherStepHoldMs already: it is said when it
		// comes, and holds back the track temperature after it.
		"weather_change": {
			Category:             DirectiveCategoryWeather,
			ValidPhases:          []DrivingPhase{PhasePitLane, PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:           DedupScopeNone,
			MaxDelayMs:           ConditionMaxDelayMs,
			OutlastsSilence:      true,
			CooldownGroup:        cooldownWeatherNews,
			SkipCategoryCooldown: true,
		},
		"track_temp_swing": {
			Category:      DirectiveCategoryWeather,
			ValidPhases:   []DrivingPhase{PhaseRacing},
			DedupScope:    DedupScopeNone, // once a stint (evaluateTrackTemp)
			MaxDelayMs:    ConditionMaxDelayMs,
			CooldownGroup: cooldownWeatherNews,
		},
		"flags_rain_live": {
			Category:    DirectiveCategoryWeather,
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
		},
		"track_limits": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"penalties": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseFormationLap, PhaseRaceStart, PhasePitLane, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
		},
		// A step of the pit stop, said when it happens.
		"penalty_served": {
			Category:             DirectiveCategoryFlags,
			ValidPhases:          []DrivingPhase{PhasePitLane, PhaseOutLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:           DedupScopeNone,
			PitLaneCall:          true,
			SkipCategoryCooldown: true,
		},
		"flags_drs_enabled": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
		"flags_drs_disabled": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar, PhaseRedFlag},
			DedupScope:  DedupScopeNone,
		},
		"car_collision": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseRaceStart, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
			MinRepeatMs: CollisionMinRepeatMs,
		},
		"car_retirement": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
		},
		"race_fastest_lap": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
		"race_finish": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhasePostRace},
			DedupScope:  DedupScopeNone,
		},
		"race_final_lap": {
			Category:             DirectiveCategoryFlags,
			ValidPhases:          []DrivingPhase{PhaseRacing, PhaseSafetyCar},
			DedupScope:           DedupScopeNone,
			SkipCategoryCooldown: true,
		},
	}
}

func (r *FlagsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone || scope == DedupScopeStint {
		r.stintTempSet, r.trackTempCalledAt = false, 0
	}
	if scope == DedupScopeNone {
		r.lastSafetyCarStatus = 0
		r.lastRedFlagCount = 0
		r.rainCalledPct = 0
		r.lastLiveWeather = 0
		r.lastCornerCutWarnings = 0
		r.lastPenaltyTime = 0
		r.lastDriveThroughPnlCount = 0
		r.lastStopGoPnlCount = 0
		r.lastVehicleFIAFlag = packets.VehicleFIAFlagNone
		r.scEndingTriggered = false
		r.lastWrongWayAlert = false
		r.finalLapSaid = false
		r.sessionSeen = false
		r.lapSeen = false
	}
}

func (r *FlagsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Session-based Flags (SC, Red Flag, Dynamic Weather)
	if ctx.Session != nil && (ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet)) {
		if !r.sessionSeen {
			r.sessionSeen = true
			r.lastRedFlagCount = ctx.Session.NumRedFlagPeriods
			r.lastLiveWeather = ctx.Session.Weather
			r.weatherSaid, r.weatherNow, r.weatherSince = ctx.Session.Weather, ctx.Session.Weather, ctx.Now
		}
		if sc := r.evaluateSafetyCar(ctx); sc != nil {
			directives = append(directives, *sc)
		}
		if rf := r.evaluateRedFlag(ctx.Session); rf != nil {
			directives = append(directives, *rf)
		}
		if weather := r.evaluateWeather(ctx); weather != nil {
			directives = append(directives, *weather)
		}
		if liveWeather := r.evaluateLiveWeather(ctx); liveWeather != nil {
			directives = append(directives, *liveWeather)
		}
		if change := r.evaluateWeatherChange(ctx); change != nil {
			directives = append(directives, *change)
		}
		if temp := r.evaluateTrackTemp(ctx); temp != nil {
			directives = append(directives, *temp)
		}
	}

	// 2. Lap-based Flags (Track Limits warnings & penalties, the last lap)
	playerLap := ctx.PlayerLap()
	if playerLap != nil && (ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
		if !r.lapSeen {
			r.lapSeen = true
			r.lastPenaltyTime = playerLap.Penalties
			r.lastDriveThroughPnlCount = playerLap.NumUnservedDriveThroughPens
			r.lastStopGoPnlCount = playerLap.NumUnservedStopGoPens
			r.lastCornerCutWarnings = playerLap.CornerCuttingWarnings
		}
		if fl := r.evaluateFinalLap(ctx, playerLap); fl != nil {
			directives = append(directives, *fl)
		}
		pnl := r.evaluatePenalties(playerLap)
		if pnl != nil {
			// A steward penalty strictly supersedes corner cutting warnings on the same event
			directives = append(directives, *pnl)
		} else {
			if tl := r.evaluateTrackLimits(ctx, playerLap); tl != nil {
				directives = append(directives, *tl)
			}
		}
	}

	// 3. Status-based Flags (Blue Flag, Yellow Flag)
	if ctx.Status != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarStatusData](ctx.Packet)) {
		if fia := r.evaluateFIAFlags(ctx); fia != nil {
			directives = append(directives, *fia)
		}
	}

	// 4. Event-based Flags (Safety Car Returning / Resume Race)
	if ctx.Packet != nil {
		if evtPkt, ok := ctx.Packet.(*packets.PacketEventData); ok {
			if evt := r.evaluateEvent(ctx, evtPkt); evt != nil {
				directives = append(directives, *evt)
			}
		}
	}

	// 5. Telemetry2-based Flags (Driving Wrong Way in 2026 regulations)
	if ctx.Telemetry2 != nil && (ctx.Packet == nil || isPacketType[*packets.PacketCarTelemetry2Data](ctx.Packet)) {
		if ww := r.evaluateWrongWay(ctx); ww != nil {
			directives = append(directives, *ww)
		}
	}

	return directives
}

// evaluateFinalLap says once a race, early on the player's last lap and out of the pit lane, that
// it is the last lap and where they are. A lapped player's last lap starts when the leader takes
// the flag, wherever they are, so it is said then unless their line is near.
func (r *FlagsRule) evaluateFinalLap(ctx *EvaluationContext, lap *packets.LapData) *Directive {
	if !isFinalLap(ctx, lap) {
		// A flashback to before the last lap re-drives it.
		if ctx.Session != nil && int(lap.CurrentLapNum) < int(ctx.Session.TotalLaps) {
			r.finalLapSaid = false
		}
		return nil
	}
	callToPct := float32(FinalLapCallToPct)
	if int(lap.CurrentLapNum) < int(ctx.Session.TotalLaps) {
		callToPct = FinalLapLappedCallToPct
	}
	if r.finalLapSaid || lap.PitStatus != packets.PitStatusNone || lap.CarPosition == 0 ||
		ctx.CalculateLapDistancePct() > callToPct {
		return nil
	}
	r.finalLapSaid = true
	pos := int(lap.CarPosition)
	subAlert, msg := "race_final_lap", fmt.Sprintf("Last lap, P%d. Bring it home.", pos)
	if pos == 1 {
		subAlert, msg = "race_final_lap_lead", "Last lap, and we're leading. Bring it home."
	}
	return &Directive{
		ID:       "race_final_lap",
		Category: DirectiveCategoryFlags,
		SubAlert: subAlert,
		Title:    "Final Lap",
		Message:  msg,
		Urgency:  UrgencyMedium,
		Values:   &DirectiveValues{Position: pos},
	}
}

// isFinalLap reports whether the player is racing their last lap of a race of more than one lap:
// the race's last lap, or, lapped, the lap they are on once the leader has taken the flag.
func isFinalLap(ctx *EvaluationContext, lap *packets.LapData) bool {
	if !ctx.IsRaceSession() || lap == nil || ctx.Session.TotalLaps <= 1 || lap.ResultStatus != packets.ResultStatusActive {
		return false
	}
	n, total := int(lap.CurrentLapNum), int(ctx.Session.TotalLaps)
	return n == total || (ctx.ChequeredFlag && n > 0 && n < total)
}

func (r *FlagsRule) evaluateWrongWay(ctx *EvaluationContext) *Directive {
	telemetry2 := ctx.PlayerTelemetry2()
	if telemetry2 == nil {
		return nil
	}
	if telemetry2.DrivingWrongWay == 1 {
		if !r.lastWrongWayAlert {
			r.lastWrongWayAlert = true
			return &Directive{
				ID:       "warning_wrong_way",
				Category: DirectiveCategoryFlags,
				SubAlert: "wrong_way",
				Title:    "Wrong Way Warning",
				Message:  "Warning! You are driving the wrong way! Turn around or stop immediately.",
				Urgency:  UrgencyCritical,
			}
		}
	} else {
		r.lastWrongWayAlert = false
	}
	return nil
}

func (r *FlagsRule) evaluateSafetyCar(ctx *EvaluationContext) *Directive {
	if !ctx.IsRaceSession() {
		return nil
	}
	scStatus := ctx.Session.SafetyCarStatus
	prevStatus := r.lastSafetyCarStatus
	if scStatus == prevStatus {
		return nil
	}
	r.lastSafetyCarStatus = scStatus
	switch scStatus {
	case packets.SafetyCarFull:
		if safetyCarStopNear(ctx, scStatus) {
			return &Directive{
				ID:       "flags_sc",
				Category: DirectiveCategoryFlags,
				SubAlert: "safety_car_box",
				Title:    "Safety Car Deployed: Box",
				Message:  fmt.Sprintf("Full Safety Car deployed near the planned stop (ideal lap %d). Take the stop under the Safety Car.", ctx.PitPlan.IdealLap),
				Urgency:  UrgencyCritical,
				BoxCall:  BoxCallInstruction,
			}
		}
		return &Directive{
			ID:       "flags_sc",
			Category: DirectiveCategoryFlags,
			SubAlert: "safety_car",
			Title:    "Safety Car Deployed",
			Message:  "Full Safety Car deployed! Maintain delta positive, stand by for pit stop window.",
			Urgency:  UrgencyCritical,
			BoxCall:  BoxCallOption,
		}
	case packets.SafetyCarVirtual:
		if safetyCarStopNear(ctx, scStatus) {
			return &Directive{
				ID:       "flags_sc",
				Category: DirectiveCategoryFlags,
				SubAlert: "vsc_box",
				Title:    "VSC Deployed: Box",
				Message:  fmt.Sprintf("Virtual Safety Car deployed near the planned stop (ideal lap %d). Take the stop under the VSC.", ctx.PitPlan.IdealLap),
				Urgency:  UrgencyCritical,
				BoxCall:  BoxCallInstruction,
			}
		}
		return &Directive{
			ID:       "flags_sc",
			Category: DirectiveCategoryFlags,
			SubAlert: "vsc",
			Title:    "VSC Deployed",
			Message:  "Virtual Safety Car (VSC) deployed! Maintain delta, no overtaking.",
			Urgency:  UrgencyCritical,
			BoxCall:  BoxCallOption,
		}
	case packets.SafetyCarNone:
		if prevStatus == packets.SafetyCarFull || prevStatus == packets.SafetyCarVirtual {
			r.scEndingTriggered = false
			return &Directive{
				ID:       "flags_green",
				Category: DirectiveCategoryFlags,
				SubAlert: "flags_green",
				Title:    "Green Flag",
				Message:  "Track is clear, green flag! Safety car period ended.",
				Urgency:  UrgencyHigh,
			}
		}
		return nil
	default:
		return nil
	}
}

func (r *FlagsRule) evaluateEvent(ctx *EvaluationContext, p *packets.PacketEventData) *Directive {
	switch p.EventCode() {
	case packets.EventSafetyCarStatus:
		if !ctx.IsRaceSession() {
			return nil
		}
		d, ok := p.SafetyCarData()
		if !ok {
			return nil
		}
		switch d.EventType {
		case packets.SafetyCarEventReturning:
			if !r.scEndingTriggered {
				r.scEndingTriggered = true
				if d.SafetyCarType == packets.SafetyCarVirtual {
					return &Directive{
						ID:       "flags_sc_in",
						Category: DirectiveCategoryFlags,
						SubAlert: "vsc_ending",
						Title:    "VSC Ending",
						Message:  "VSC ending! Keep the delta positive and be ready to go when it turns green.",
						Urgency:  UrgencyHigh,
					}
				}
				return &Directive{
					ID:       "flags_sc_in",
					Category: DirectiveCategoryFlags,
					SubAlert: "flags_sc_in",
					Title:    "Safety Car In This Lap",
					Message:  "Safety Car in this lap, Safety Car in this lap! Maintain delta positive, warm front tyres and prepare for restart.",
					Urgency:  UrgencyHigh,
				}
			}
		case packets.SafetyCarEventResumeRace:
			r.scEndingTriggered = false
			return &Directive{
				ID:       "flags_green",
				Category: DirectiveCategoryFlags,
				SubAlert: "flags_green",
				Title:    "Green Flag",
				Message:  "Green flag, green flag! Race is resumed, push now.",
				Urgency:  UrgencyHigh,
			}
		}

	case packets.EventDRSEnabled:
		if !ctx.IsRaceSession() || drsCallOnOverrideCar(ctx, p) {
			return nil
		}
		return &Directive{
			ID:       "flags_drs_enabled",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_drs_enabled",
			Title:    "DRS Enabled",
			Message:  "DRS enabled, DRS is now active.",
			Urgency:  UrgencyMedium,
		}

	case packets.EventDRSDisabled:
		if !ctx.IsRaceSession() || drsCallOnOverrideCar(ctx, p) {
			return nil
		}
		reasonStr := "Race control has disabled DRS."
		if d, ok := p.DRSDisabledData(); ok {
			switch d.Reason {
			case packets.DRSDisabledReasonSurfaceConditions:
				reasonStr = "DRS disabled due to wet track conditions."
			case packets.DRSDisabledReasonSafetyCar:
				reasonStr = "DRS disabled due to Safety Car."
			case packets.DRSDisabledReasonRedFlag:
				reasonStr = "DRS disabled due to Red Flag."
			case packets.DRSDisabledReasonMinLapNotReached:
				reasonStr = "DRS disabled, minimum laps not reached."
			}
		}
		return &Directive{
			ID:       "flags_drs_disabled",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_drs_disabled",
			Title:    "DRS Disabled",
			Message:  reasonStr,
			Urgency:  UrgencyHigh,
		}

	case packets.EventCollision:
		if col, ok := p.CollisionData(); ok {
			if int(col.Vehicle1Idx) == ctx.PlayerCarIndex || int(col.Vehicle2Idx) == ctx.PlayerCarIndex {
				return collisionDirective(col, p.Header.PacketFormat)
			}
		}

	case packets.EventRetirement:
		if !ctx.IsRaceSession() {
			return nil
		}
		if ret, ok := p.RetirementData(); ok {
			if int(ret.VehicleIdx) == ctx.PlayerCarIndex {
				return nil
			}
			driverName := fmt.Sprintf("Car %d", ret.VehicleIdx)
			if ctx.Participants != nil && int(ret.VehicleIdx) < len(ctx.Participants.Participants) {
				name := ctx.Participants.Participants[ret.VehicleIdx].NameString()
				if name != "" {
					driverName = name
				}
			}
			isTeammate := int(ret.VehicleIdx) == ctx.TeammateCarIndex
			var msg string
			if isTeammate {
				msg = fmt.Sprintf("Teammate %s has retired from the race.", driverName)
			} else {
				msg = fmt.Sprintf("%s has retired from the race, watch for potential yellow flags or debris.", driverName)
			}
			return &Directive{
				ID:       "car_retirement",
				Category: DirectiveCategoryFlags,
				SubAlert: "car_retirement",
				Title:    "Car Retirement",
				Message:  msg,
				Urgency:  UrgencyMedium,
			}
		}

	case packets.EventDriveThroughServed:
		if d, ok := p.DriveThroughServedData(); ok && int(d.VehicleIdx) == ctx.PlayerCarIndex {
			return penaltyServedDirective("Drive-through penalty served.")
		}

	case packets.EventStopGoServed:
		if d, ok := p.StopGoServedData(); ok && int(d.VehicleIdx) == ctx.PlayerCarIndex {
			return penaltyServedDirective("Stop-go penalty served.")
		}

	case packets.EventFastestLap:
		// Only the player's: the phrases congratulate the driver.
		if fl, ok := p.FastestLapData(); ok && int(fl.VehicleIdx) == ctx.PlayerCarIndex {
			return &Directive{
				ID:       "race_fastest_lap",
				Category: DirectiveCategoryFlags,
				SubAlert: "race_fastest_lap",
				Title:    "Fastest Lap",
				Message:  fmt.Sprintf("Fastest lap of the race, %.3f.", fl.LapTime),
				Urgency:  UrgencyMedium,
			}
		}
	}
	return nil
}

// evaluateFIAFlags calls the flag shown to the player when it changes: a yellow in any session, a
// blue in races (in qualifying and practice the car behind on a push lap is its own call).
func (r *FlagsRule) evaluateFIAFlags(ctx *EvaluationContext) *Directive {
	status := ctx.PlayerStatus()
	if status == nil {
		return nil
	}
	flag := status.VehicleFIAFlags
	if flag == r.lastVehicleFIAFlag {
		return nil
	}
	r.lastVehicleFIAFlag = flag

	switch flag {
	case packets.VehicleFIAFlagBlue:
		if !ctx.IsRaceSession() {
			return nil
		}
		return &Directive{
			ID:       "flags_blue",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_blue",
			Title:    "Blue Flag",
			Message:  "Blue flags! Leader is approaching from behind, yield position cleanly.",
			Urgency:  UrgencyHigh,
		}
	case packets.VehicleFIAFlagYellow:
		return &Directive{
			ID:       "flags_yellow",
			Category: DirectiveCategoryFlags,
			SubAlert: "flags_yellow",
			Title:    "Yellow Flag",
			Message:  "Yellow flag in this sector. Careful, be ready to lift.",
			Urgency:  UrgencyHigh,
		}
	}
	return nil
}

func (r *FlagsRule) evaluateRedFlag(p *packets.PacketSessionData) *Directive {
	redFlagCount := p.NumRedFlagPeriods
	if redFlagCount <= r.lastRedFlagCount {
		return nil
	}
	r.lastRedFlagCount = redFlagCount
	return &Directive{
		ID:       "flags_red",
		Category: DirectiveCategoryFlags,
		SubAlert: "red_flag",
		Title:    "Red Flag Deployed",
		Message:  "Red Flag! Session stopped. Bring the car slowly back to the pit lane.",
		Urgency:  UrgencyCritical,
	}
}

// evaluateWeather calls rain in the forecast once per rain spell: when the first sample inside the
// horizon passes the threshold, and again when that chance rises RainRearmPct over the one said.
// The spell is over when it rains (the live weather call covers that) or no sample inside the
// horizon comes within RainRearmPct of the threshold, so a forecast hovering at the threshold
// isn't said over and over. An approximate forecast is said as one.
func (r *FlagsRule) evaluateWeather(ctx *EvaluationContext) *Directive {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryWeather), "flags_rain") {
		return nil
	}
	if ctx.Session.Weather >= packets.WeatherLightRain {
		r.rainCalledPct = 0
		return nil
	}
	var soonest *packets.WeatherForecastSample
	var likeliest float32
	for _, sample := range sessionForecast(ctx.Session) {
		if float32(sample.TimeOffset) > ctx.Config.RainHorizonMin {
			break
		}
		likeliest = max(likeliest, float32(sample.RainPercentage))
		if soonest == nil && float32(sample.RainPercentage) >= ctx.Config.RainProbPct {
			soonest = &sample
		}
	}
	if soonest == nil {
		if likeliest < ctx.Config.RainProbPct-RainRearmPct {
			r.rainCalledPct = 0
		}
		return nil
	}
	pct := int(soonest.RainPercentage)
	if r.rainCalledPct > 0 && pct < r.rainCalledPct+RainRearmPct {
		return nil
	}
	r.rainCalledPct = pct
	subAlert := "weather_rain"
	msg := fmt.Sprintf("Weather radar shows %d%% chance of rain in the next %d minutes.", pct, soonest.TimeOffset)
	if ctx.Session.ForecastAccuracy == packets.ForecastAccuracyApproximate {
		subAlert = "weather_rain_approx"
		msg = fmt.Sprintf("The forecast is only approximate: about %d%% chance of rain in the next %d minutes.", pct, soonest.TimeOffset)
	}
	return &Directive{
		ID:       "flags_rain",
		Category: DirectiveCategoryWeather,
		SubAlert: subAlert,
		Title:    "Weather Transition",
		Message:  msg,
		Urgency:  UrgencyMedium,
		Values:   &DirectiveValues{RainPct: pct, Minutes: int(soonest.TimeOffset)},
	}
}

// evaluateWeatherChange says how the rain changed once the new weather held WeatherStepHoldMs:
// heavier, easing, or stopped. Rain starting is the live rain call's, and a change of the clouds
// isn't said.
func (r *FlagsRule) evaluateWeatherChange(ctx *EvaluationContext) *Directive {
	w := ctx.Session.Weather
	if w != r.weatherNow {
		r.weatherNow, r.weatherSince = w, ctx.Now
	}
	if w == r.weatherSaid || ctx.Now-r.weatherSince < WeatherStepHoldMs {
		return nil
	}
	said := r.weatherSaid
	r.weatherSaid = w
	if said < packets.WeatherLightRain {
		return nil
	}
	subAlert, title := "rain_easing", "Rain Easing"
	msg := fmt.Sprintf("The rain is easing: %s now.", packets.WeatherName(w))
	switch {
	case w < packets.WeatherLightRain:
		subAlert, title, msg = "track_drying", "Rain Stopped", "The rain has stopped. The track will start to dry."
	case w > said:
		subAlert, title = "rain_heavier", "Rain Heavier"
		msg = fmt.Sprintf("The rain is getting heavier: %s now.", packets.WeatherName(w))
	}
	return &Directive{
		ID:       "weather_change",
		Category: DirectiveCategoryWeather,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyMedium,
	}
}

// evaluateTrackTemp says once a stint, racing in a race, that the track temperature moved
// TrackTempSwingC or more since the stint started. A call that never got on the radio is made
// again while it still holds.
func (r *FlagsRule) evaluateTrackTemp(ctx *EvaluationContext) *Directive {
	t := int(ctx.Session.TrackTemperature)
	if !r.stintTempSet {
		r.stintTrackTemp, r.stintTempSet = t, true
		return nil
	}
	if r.trackTempCalledAt != 0 && ctx.CallLost("track_temp_swing", r.trackTempCalledAt, ConditionMaxDelayMs) {
		r.trackTempCalledAt = 0
	}
	delta := t - r.stintTrackTemp
	if !ctx.IsRaceSession() || ctx.Phase != PhaseRacing || r.trackTempCalledAt != 0 || (delta < TrackTempSwingC && delta > -TrackTempSwingC) {
		return nil
	}
	r.trackTempCalledAt = ctx.Now
	subAlert, title := "track_temp_up", "Track Temperature Up"
	msg := fmt.Sprintf("The track is %d°C hotter than at the start of the stint, %d°C now.", delta, t)
	if delta < 0 {
		subAlert, title = "track_temp_down", "Track Temperature Down"
		msg = fmt.Sprintf("The track is %d°C cooler than at the start of the stint, %d°C now.", -delta, t)
	}
	return &Directive{
		ID:       "track_temp_swing",
		Category: DirectiveCategoryWeather,
		SubAlert: subAlert,
		Title:    title,
		Message:  msg,
		Urgency:  UrgencyLow,
		Values:   &DirectiveValues{TrackTempDeltaC: delta},
	}
}

// penaltyServedDirective says the player served their drive-through or stop-go.
func penaltyServedDirective(msg string) *Directive {
	return &Directive{
		ID:       "penalty_served",
		Category: DirectiveCategoryFlags,
		SubAlert: "penalty_served",
		Title:    "Penalty Served",
		Message:  msg,
		Urgency:  UrgencyMedium,
	}
}

// evaluateTrackLimits calls each new corner cutting warning from CornerCutWarnThreshold on, in
// races only: in qualifying and practice a cut deletes the lap instead (qualy_invalid).
func (r *FlagsRule) evaluateTrackLimits(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if ctx.Session != nil && !ctx.IsRaceSession() {
		return nil
	}
	cutWarnings := playerLap.CornerCuttingWarnings
	if int(cutWarnings) >= ctx.Config.CornerCutWarnThreshold && cutWarnings > r.lastCornerCutWarnings {
		r.lastCornerCutWarnings = cutWarnings
		return &Directive{
			ID:       "track_limits",
			Category: DirectiveCategoryFlags,
			SubAlert: "track_limits_warnings",
			Title:    "Track Limits Warning",
			Message:  fmt.Sprintf("That is %d warnings for track limits. Keep it inside the white lines.", cutWarnings),
			Urgency:  UrgencyCritical,
			Values:   &DirectiveValues{Count: int(cutWarnings)},
		}
	}
	return nil
}

// evaluatePenalties calls a new penalty: a drive-through, a stop-go, or the seconds of a time
// penalty. The counts are followed down too (a penalty served), so the next one is still called.
func (r *FlagsRule) evaluatePenalties(playerLap *packets.LapData) *Directive {
	pnlTime := playerLap.Penalties
	newTime := pnlTime > r.lastPenaltyTime
	addedSec := int(pnlTime) - int(r.lastPenaltyTime)
	newDriveThrough := playerLap.NumUnservedDriveThroughPens > r.lastDriveThroughPnlCount
	newStopGo := playerLap.NumUnservedStopGoPens > r.lastStopGoPnlCount
	r.lastPenaltyTime = pnlTime
	r.lastDriveThroughPnlCount = playerLap.NumUnservedDriveThroughPens
	r.lastStopGoPnlCount = playerLap.NumUnservedStopGoPens

	subAlert := "penalties_incurred"
	var msg string
	var values *DirectiveValues
	switch {
	case newDriveThrough:
		subAlert = "penalty_drive_through"
		msg = "Drive-through penalty. It must be served within three laps."
	case newStopGo:
		subAlert = "penalty_stop_go"
		msg = "Stop-go penalty. It must be served within three laps."
	case newTime:
		msg = fmt.Sprintf("%d-second time penalty from the stewards.", addedSec)
		values = &DirectiveValues{PenaltySec: addedSec}
	default:
		return nil
	}
	return &Directive{
		ID:       "penalties",
		Category: DirectiveCategoryFlags,
		SubAlert: subAlert,
		Title:    "Steward Penalty Issued",
		Message:  msg,
		Urgency:  UrgencyCritical,
		Values:   values,
	}
}

func (r *FlagsRule) evaluateLiveWeather(ctx *EvaluationContext) *Directive {
	if ctx.Session == nil {
		return nil
	}
	currentWeather := ctx.Session.Weather
	prevWeather := r.lastLiveWeather
	r.lastLiveWeather = currentWeather

	// Trigger on transition from dry (<= WeatherOvercast) to rain (>= WeatherLightRain)
	if prevWeather <= packets.WeatherOvercast && currentWeather >= packets.WeatherLightRain && r.lastSafetyCarStatus != packets.SafetyCarFormationLap {
		return &Directive{
			ID:       "flags_rain_live",
			Category: DirectiveCategoryWeather,
			SubAlert: "flags_rain_live",
			Title:    "Track Rain Onset",
			Message:  "Rain is now falling on track! Watch out for changing grip levels into braking zones.",
			Urgency:  UrgencyHigh,
		}
	}
	return nil
}

// collisionDirective is the call for a contact the player was part of. From 2026 the game rates
// how hard it was: a light touch is said without urgency, a heavy one as such.
func collisionDirective(col packets.CollisionEventData, packetFormat uint16) *Directive {
	subAlert, msg, urgency := "car_collision", "Contact reported! Check steering and front wing balance.", UrgencyCritical
	if packetFormat >= packets.PacketFormat2026 {
		switch col.Severity {
		case packets.CollisionSeverityLow:
			subAlert, msg, urgency = "car_collision_light", "Light contact. Tell us if anything feels wrong.", UrgencyHigh
		case packets.CollisionSeverityHigh:
			subAlert, msg = "car_collision_heavy", "Heavy contact! Check for damage: steering, front wing, tyres."
		}
	}
	return &Directive{
		ID:       "car_collision",
		Category: DirectiveCategoryFlags,
		SubAlert: subAlert,
		Title:    "Contact Reported",
		Message:  msg,
		Urgency:  urgency,
	}
}

// drsCallOnOverrideCar reports whether a DRS event came for a player whose car runs the 2026
// regulations, which have no DRS: nothing is said, and the event is logged so it can be checked.
func drsCallOnOverrideCar(ctx *EvaluationContext, p *packets.PacketEventData) bool {
	if !ctx.Is2026() {
		return false
	}
	slog.Info("DRS event on a 2026 car, not said", "event", p.EventCode())
	return true
}
