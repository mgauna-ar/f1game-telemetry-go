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
	lastCornerCutWarnings    uint8
	lastPenaltiesCount       uint8
	lastPenaltyTime          uint8
	lastDriveThroughPnlCount uint8
	lastStopGoPnlCount       uint8
}

// NewFlagsRule creates a new FlagsRule.
func NewFlagsRule() *FlagsRule {
	return &FlagsRule{
		lastWeatherAlertOffset: -1,
	}
}

func (r *FlagsRule) Name() string {
	return "flags"
}

func (r *FlagsRule) Category() string {
	return string(DirectiveCategoryFlags)
}

func (r *FlagsRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag}
}

func (r *FlagsRule) DedupScope() DedupScope {
	return DedupScopePhase
}

func (r *FlagsRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lastSafetyCarStatus = 0
		r.lastRedFlagCount = 0
		r.lastWeatherAlertOffset = -1
		r.lastCornerCutWarnings = 0
		r.lastPenaltiesCount = 0
		r.lastPenaltyTime = 0
		r.lastDriveThroughPnlCount = 0
		r.lastStopGoPnlCount = 0
	}
}

func (r *FlagsRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Session-based Flags (SC, Red Flag, Dynamic Weather)
	if ctx.Session != nil && (ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet)) {
		p := ctx.Session

		// 1.1 Flags: Full Safety Car / VSC (Race sessions only)
		if ctx.IsRaceSession() {
			scStatus := p.SafetyCarStatus
			if scStatus != r.lastSafetyCarStatus {
				r.lastSafetyCarStatus = scStatus
				switch scStatus {
				case packets.SafetyCarFull:
					directives = append(directives, Directive{
						ID:       "flags_sc",
						Category: DirectiveCategoryFlags,
						SubAlert: "safety_car",
						Title:    "Safety Car Deployed",
						Message:  "Full Safety Car deployed! Maintain delta positive, stand by for pit stop window.",
						Urgency:  UrgencyCritical,
					})
				case packets.SafetyCarVirtual:
					directives = append(directives, Directive{
						ID:       "flags_sc",
						Category: DirectiveCategoryFlags,
						SubAlert: "vsc",
						Title:    "VSC Deployed",
						Message:  "Virtual Safety Car (VSC) deployed! Maintain delta, no overtaking.",
						Urgency:  UrgencyCritical,
					})
				}
			}
		}

		// 1.2 Flags: Red Flag session halt
		redFlagCount := p.NumRedFlagPeriods
		if redFlagCount > r.lastRedFlagCount {
			r.lastRedFlagCount = redFlagCount
			directives = append(directives, Directive{
				ID:       "flags_red",
				Category: DirectiveCategoryFlags,
				SubAlert: "red_flag",
				Title:    "Red Flag Deployed",
				Message:  "Red Flag deployed! Session stopped. Instruct driver to return to pit lane slowly.",
				Urgency:  UrgencyCritical,
			})
		}

		// 1.3 Dynamic Weather Progression
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
				directives = append(directives, Directive{
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
				})
				break
			}
		}
	}

	// 2. Lap-based Flags (Track Limits warnings & penalties)
	playerLap := ctx.PlayerLap()
	if playerLap != nil && (ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
		// 2.1 Track Limits Corner Cutting Warnings
		cutWarnings := playerLap.CornerCuttingWarnings
		if int(cutWarnings) >= ctx.Config.CornerCutWarnThreshold && cutWarnings > r.lastCornerCutWarnings {
			r.lastCornerCutWarnings = cutWarnings
			directives = append(directives, Directive{
				ID:       "track_limits",
				Category: DirectiveCategoryFlags,
				SubAlert: "track_limits_warnings",
				Title:    "Track Limits Warning",
				Message:  fmt.Sprintf("Driver has accumulated %d track limits / corner cutting warnings! Keep inside white lines to avoid penalty.", cutWarnings),
				Urgency:  UrgencyCritical,
				Metadata: map[string]any{
					"warnings": cutWarnings,
				},
			})
		}

		// 2.2 Steward Incurred Penalties
		pnlTime := playerLap.Penalties
		numPnl := playerLap.NumUnservedDriveThroughPens + playerLap.NumUnservedStopGoPens
		if pnlTime > r.lastPenaltyTime || numPnl > (r.lastDriveThroughPnlCount+r.lastStopGoPnlCount) {
			r.lastPenaltyTime = pnlTime
			r.lastDriveThroughPnlCount = playerLap.NumUnservedDriveThroughPens
			r.lastStopGoPnlCount = playerLap.NumUnservedStopGoPens

			var pnlMsg string
			switch {
			case pnlTime > 0:
				pnlMsg = fmt.Sprintf("Driver has been assessed a %d-second time penalty by the stewards!", pnlTime)
			case playerLap.NumUnservedDriveThroughPens > 0:
				pnlMsg = "Drive-through penalty issued by race control! Must serve within 3 laps."
			default:
				pnlMsg = "Stop-and-go penalty issued by race control!"
			}
			directives = append(directives, Directive{
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
			})
		}
	}

	return directives
}
