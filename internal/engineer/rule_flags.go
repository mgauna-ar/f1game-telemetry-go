package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// FlagsRule manages Safety Car, VSC, Red Flag, rain forecast, and penalties alerts.
type FlagsRule struct {
	mu                       sync.Mutex
	lastSafetyCarStatus      uint8
	lastRedFlagCount         uint8
	rainForecastCalled       bool
	lastLiveWeather          uint8
	lastCornerCutWarnings    uint8
	lastPenaltyTime          uint8
	lastDriveThroughPnlCount uint8
	lastStopGoPnlCount       uint8
	lastVehicleFIAFlag       int8
	scEndingTriggered        bool
	lastWrongWayAlert        bool
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
			Category:    DirectiveCategoryWeather,
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopePhase,
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
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseFormationLap},
			DedupScope:  DedupScopeNone,
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
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
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
	}
}

func (r *FlagsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lastSafetyCarStatus = 0
		r.lastRedFlagCount = 0
		r.rainForecastCalled = false
		r.lastLiveWeather = 0
		r.lastCornerCutWarnings = 0
		r.lastPenaltyTime = 0
		r.lastDriveThroughPnlCount = 0
		r.lastStopGoPnlCount = 0
		r.lastVehicleFIAFlag = packets.VehicleFIAFlagNone
		r.scEndingTriggered = false
		r.lastWrongWayAlert = false
	}
}

func (r *FlagsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Session-based Flags (SC, Red Flag, Dynamic Weather)
	if ctx.Session != nil && (ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet)) {
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
	}

	// 2. Lap-based Flags (Track Limits warnings & penalties)
	playerLap := ctx.PlayerLap()
	if playerLap != nil && (ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
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
		if !ctx.IsRaceSession() {
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
		if !ctx.IsRaceSession() {
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
				return &Directive{
					ID:       "car_collision",
					Category: DirectiveCategoryFlags,
					SubAlert: "car_collision",
					Title:    "Contact Reported",
					Message:  "Contact reported! Check steering and front wing balance, reporting on next radio check.",
					Urgency:  UrgencyCritical,
				}
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

// evaluateWeather calls rain in the forecast once per rain spell: once a sample inside the
// horizon passes the threshold, nothing more is said until none does. While it already rains,
// the live weather call covers it.
func (r *FlagsRule) evaluateWeather(ctx *EvaluationContext) *Directive {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryWeather), "flags_rain") {
		return nil
	}
	var soonest *packets.WeatherForecastSample
	for _, sample := range sessionForecast(ctx.Session) {
		if float32(sample.RainPercentage) >= ctx.Config.RainProbPct && float32(sample.TimeOffset) <= ctx.Config.RainHorizonMin {
			soonest = &sample
			break
		}
	}
	if soonest == nil {
		r.rainForecastCalled = false
		return nil
	}
	if r.rainForecastCalled || ctx.Session.Weather >= packets.WeatherLightRain {
		return nil
	}
	r.rainForecastCalled = true
	return &Directive{
		ID:       "flags_rain",
		Category: DirectiveCategoryWeather,
		SubAlert: "weather_rain",
		Title:    "Weather Transition",
		Message:  fmt.Sprintf("Weather radar confirms %d%% chance of rain in the next %d minutes.", soonest.RainPercentage, soonest.TimeOffset),
		Urgency:  UrgencyHigh,
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
