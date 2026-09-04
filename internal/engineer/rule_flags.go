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
	lastWeatherAlertOffset   int
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
		lastWeatherAlertOffset: -1,
		lastVehicleFIAFlag:     packets.VehicleFIAFlagNone,
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
		},
		"flags_yellow": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
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
			ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"penalties": {
			Category:    DirectiveCategoryFlags,
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseFormationLap},
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
		r.lastWeatherAlertOffset = -1
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
		}
	case packets.SafetyCarVirtual:
		return &Directive{
			ID:       "flags_sc",
			Category: DirectiveCategoryFlags,
			SubAlert: "vsc",
			Title:    "VSC Deployed",
			Message:  "Virtual Safety Car (VSC) deployed! Maintain delta, no overtaking.",
			Urgency:  UrgencyCritical,
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
	if !ctx.IsRaceSession() || p.EventCode() != packets.EventSafetyCarStatus {
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
	return nil
}

func (r *FlagsRule) evaluateFIAFlags(ctx *EvaluationContext) *Directive {
	if !ctx.IsRaceSession() {
		return nil
	}
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
			Message:  "Yellow flag in this sector. Incident ahead, no overtaking and be prepared to lift.",
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

func (r *FlagsRule) evaluateWeather(ctx *EvaluationContext) *Directive {
	if !ctx.Config.IsAlertEnabled(string(DirectiveCategoryWeather), "flags_rain") {
		return nil
	}
	p := ctx.Session
	numSamples := int(p.NumWeatherForecastSamples)
	if numSamples > len(p.WeatherForecastSamples) {
		numSamples = len(p.WeatherForecastSamples)
	}
	for i := 0; i < numSamples; i++ {
		sample := p.WeatherForecastSamples[i]
		rainPct := int(sample.RainPercentage)
		timeOffset := int(sample.TimeOffset)
		if rainPct >= int(ctx.Config.RainProbPct) && timeOffset <= int(ctx.Config.RainHorizonMin) && r.lastWeatherAlertOffset != timeOffset {
			r.lastWeatherAlertOffset = timeOffset
			return &Directive{
				ID:       "flags_rain",
				Category: DirectiveCategoryWeather,
				SubAlert: "weather_rain",
				Title:    "Weather Transition",
				Message:  fmt.Sprintf("Weather radar confirms %d%% chance of rain in the next %d minutes.", rainPct, timeOffset),
				Urgency:  UrgencyHigh,
				Metadata: map[string]any{
					"rain_pct":    rainPct,
					"time_offset": timeOffset,
				},
			}
		}
	}
	return nil
}

func (r *FlagsRule) evaluateTrackLimits(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	cutWarnings := playerLap.CornerCuttingWarnings
	if int(cutWarnings) >= ctx.Config.CornerCutWarnThreshold && cutWarnings > r.lastCornerCutWarnings {
		r.lastCornerCutWarnings = cutWarnings
		return &Directive{
			ID:       "track_limits",
			Category: DirectiveCategoryFlags,
			SubAlert: "track_limits_warnings",
			Title:    "Track Limits Warning",
			Message:  fmt.Sprintf("We have accumulated %d track limits warnings! Keep inside white lines to avoid a penalty.", cutWarnings),
			Urgency:  UrgencyCritical,
			Metadata: map[string]any{
				"warnings": cutWarnings,
			},
		}
	}
	return nil
}

func (r *FlagsRule) evaluatePenalties(playerLap *packets.LapData) *Directive {
	pnlTime := playerLap.Penalties
	numPnl := playerLap.NumUnservedDriveThroughPens + playerLap.NumUnservedStopGoPens
	if pnlTime <= r.lastPenaltyTime && numPnl <= (r.lastDriveThroughPnlCount+r.lastStopGoPnlCount) {
		return nil
	}
	r.lastPenaltyTime = pnlTime
	r.lastDriveThroughPnlCount = playerLap.NumUnservedDriveThroughPens
	r.lastStopGoPnlCount = playerLap.NumUnservedStopGoPens

	var pnlMsg string
	switch {
	case pnlTime > 0:
		pnlMsg = fmt.Sprintf("We have been assessed a %d-second time penalty by the stewards! We will serve it at the next stop.", pnlTime)
	case playerLap.NumUnservedDriveThroughPens > 0:
		pnlMsg = "Drive-through penalty issued by race control! We must serve it within 3 laps."
	default:
		pnlMsg = "Stop-and-go penalty issued by race control!"
	}
	return &Directive{
		ID:       "penalties",
		Category: DirectiveCategoryFlags,
		SubAlert: "penalties_incurred",
		Title:    "Steward Penalty Issued",
		Message:  pnlMsg,
		Urgency:  UrgencyCritical,
		Metadata: map[string]any{
			"penalty_time_sec": pnlTime,
			"drive_through":    playerLap.NumUnservedDriveThroughPens,
			"stop_go":          playerLap.NumUnservedStopGoPens,
		},
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
			Metadata: map[string]any{
				"weather": currentWeather,
			},
		}
	}
	return nil
}
