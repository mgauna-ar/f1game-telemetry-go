package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TrafficRule manages clean air pit rejoin window calculation alerts and pit lane execution procedures.
type TrafficRule struct {
	mu                     sync.Mutex
	lastPitLimiterStatus   uint8
	lastPitStatus          uint8
	penaltyReminderFired   bool
	pitTimerReported       bool
	limiterOverspeedFired  bool
	lastRecordedPitTimerMS uint16
	cleanAirLap            int // the lap the clean air call was made on
}

// NewTrafficRule creates a new TrafficRule.
func NewTrafficRule() *TrafficRule {
	return &TrafficRule{}
}

func (r *TrafficRule) Name() string {
	return "traffic"
}

func (r *TrafficRule) Category() string {
	return string(DirectiveCategoryPitStrategy)
}

// ValidPhases includes PhaseInGarage, the phase of a car standing in its pit box, so the rule sees
// the stop it times; its calls are said in the pit lane and after.
func (r *TrafficRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhasePitLane, PhaseInLap, PhaseOutLap, PhaseInGarage}
}

func (r *TrafficRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"pit_clean_air": {
			ValidPhases:    []DrivingPhase{PhaseRacing},
			DedupScope:     DedupScopeNone,
			NotWhileBoxDue: true,
			LapBound:       true,
		},
		"pit_serve_penalty": {
			ValidPhases: []DrivingPhase{PhasePitLane},
			DedupScope:  DedupScopeStint,
		},
		"pit_stop_duration": {
			ValidPhases:          []DrivingPhase{PhasePitLane, PhaseOutLap},
			DedupScope:           DedupScopeStint,
			SkipCategoryCooldown: true,
		},
		"pit_limiter_exit": {
			ValidPhases: []DrivingPhase{PhasePitLane, PhaseOutLap},
			DedupScope:  DedupScopeStint,
		},
		"pit_limiter_overspeed": {
			ValidPhases: []DrivingPhase{PhasePitLane, PhaseRacing, PhaseInLap},
			DedupScope:  DedupScopeStint,
		},
		// Said by the engine, not this rule: on the lap a call told the driver to box.
		"pit_entry_reminder": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  MomentMaxDelayMs,
		},
	}
}

func (r *TrafficRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.penaltyReminderFired = false
		r.pitTimerReported = false
		r.limiterOverspeedFired = false
		r.lastRecordedPitTimerMS = 0
		r.lastPitLimiterStatus = 0
		r.lastPitStatus = 0
	}
	if scope == DedupScopeNone {
		r.cleanAirLap = 0
	}
}

func (r *TrafficRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	playerLap := ctx.PlayerLap()
	status := ctx.PlayerStatus()

	// 0. Pit Entry Speed Limiter Overspeed Warning
	if (ctx.Phase == PhasePitLane || (playerLap != nil && playerLap.PitStatus == packets.PitStatusPitting)) &&
		status != nil && status.PitLimiterStatus == 0 {
		tele := ctx.PlayerTelemetry()
		if tele != nil && ctx.Session != nil && ctx.Session.PitSpeedLimit > 0 {
			limit := uint16(ctx.Session.PitSpeedLimit)
			if tele.Speed > limit+PitLimiterOverspeedDeltaKmh && !r.limiterOverspeedFired {
				r.limiterOverspeedFired = true
				directives = append(directives, Directive{
					ID:       "pit_limiter_overspeed",
					Category: DirectiveCategoryPitStrategy,
					SubAlert: "pit_limiter_overspeed",
					Title:    "Pit Limiter Overspeed Warning",
					Message:  fmt.Sprintf("Speed limiter! Drop speed, pit limiter line approaching! Pit limit is %d km/h!", ctx.Session.PitSpeedLimit),
					Urgency:  UrgencyCritical,
				})
			}
		}
	}

	// 1. Pit Limiter Exit Directive (from CarStatusData)
	if status != nil {
		if r.lastPitLimiterStatus == 1 && status.PitLimiterStatus == 0 && (ctx.Phase == PhasePitLane || ctx.Phase == PhaseOutLap || ctx.Phase == PhaseRacing) {
			directives = append(directives, Directive{
				ID:       "pit_limiter_exit",
				Category: DirectiveCategoryPitStrategy,
				SubAlert: "pit_limiter_exit",
				Title:    "Pit Limiter Off",
				Message:  "Pit limiter off. Mind the white line on exit and push now.",
				Urgency:  UrgencyHigh,
			})
		}
		r.lastPitLimiterStatus = status.PitLimiterStatus
	}

	// 2. Pit Stop Procedures (penalty serving & box duration debrief from LapData)
	if playerLap != nil {
		// Penalty to serve reminder
		if ctx.Phase == PhasePitLane || playerLap.PitStatus == packets.PitStatusPitting {
			if playerLap.PitStopShouldServePen == 1 && !r.penaltyReminderFired {
				r.penaltyReminderFired = true
				var pnlMsg string
				if playerLap.Penalties > 0 {
					pnlMsg = fmt.Sprintf("Hold for %d-second penalty before tyres are changed. Do not work on the car until served.", playerLap.Penalties)
				} else {
					pnlMsg = "Serve penalty first. Car must remain stationary before mechanics touch the tyres."
				}
				directives = append(directives, Directive{
					ID:       "pit_serve_penalty",
					Category: DirectiveCategoryPitStrategy,
					SubAlert: "pit_serve_penalty",
					Title:    "Serve Penalty in Box",
					Message:  pnlMsg,
					Urgency:  UrgencyCritical,
				})
			}
		}

		// Pit Stop Timer tracking & debrief
		if playerLap.PitStopTimerInMS > r.lastRecordedPitTimerMS {
			r.lastRecordedPitTimerMS = playerLap.PitStopTimerInMS
		}

		// Transition away from pit box: PitStatus was InPitArea and now is Pitting, or car is moving on pit exit
		wasInPitArea := r.lastPitStatus == packets.PitStatusInPitArea
		leavingBox := wasInPitArea && (playerLap.PitStatus == packets.PitStatusPitting || playerLap.PitStatus == packets.PitStatusNone)

		if leavingBox && r.lastRecordedPitTimerMS > 0 && !r.pitTimerReported {
			r.pitTimerReported = true
			durationSec := float32(r.lastRecordedPitTimerMS) / packets.MillisPerSecond
			subAlert := "pit_stop_duration"
			durMsg := fmt.Sprintf("Stationary time %.1fs. Clean stop, push now.", durationSec)
			switch {
			case durationSec <= FastPitStopDurationSec:
				subAlert = "pit_stop_fast"
				durMsg = fmt.Sprintf("Rapid stop! Stationary time was %.1fs, brilliant work by the crew.", durationSec)
			case durationSec >= SlowPitStopDurationSec:
				subAlert = "pit_stop_slow"
				durMsg = fmt.Sprintf("Stationary time was %.1fs, longer than planned. Let's make up time on the out-lap.", durationSec)
			}
			directives = append(directives, Directive{
				ID:       "pit_stop_duration",
				Category: DirectiveCategoryPitStrategy,
				SubAlert: subAlert,
				Title:    "Pit Stop Duration",
				Message:  durMsg,
				Urgency:  UrgencyMedium,
				Values:   &DirectiveValues{StopSec: roundTo(float64(durationSec), 1)},
			})
		}
		r.lastPitStatus = playerLap.PitStatus
	}

	// 3. Clean air on rejoin: inside the pit window, early enough to box this lap, once a lap
	if d := r.evaluateCleanAir(ctx, playerLap); d != nil {
		directives = append(directives, *d)
	}

	return directives
}

// evaluateCleanAir says when pitting now would bring the player out in clean air: inside the
// game's pit window, while this lap's pit entry can still be made, at most once a lap.
func (r *TrafficRule) evaluateCleanAir(ctx *EvaluationContext, playerLap *packets.LapData) *Directive {
	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}
	if !ctx.IsRaceSession() || ctx.Phase != PhaseRacing || ctx.Session == nil ||
		ctx.Session.SafetyCarStatus != packets.SafetyCarNone || playerLap == nil || ctx.LapData == nil {
		return nil
	}
	currentLap := int(playerLap.CurrentLapNum)
	windowOpen, windowClose := int(ctx.Session.PitStopWindowIdealLap), int(ctx.Session.PitStopWindowLatestLap)
	if windowOpen == 0 || windowClose == 0 || currentLap < windowOpen || currentLap > windowClose {
		return nil
	}
	// Once a call told the player to box this lap, the option to is only noise.
	if currentLap == r.cleanAirLap || ctx.BoxTiming() != BoxThisLap || ctx.BoxDueLap >= currentLap {
		return nil
	}
	// Tyres this fresh were just fitted: the window is for the next stop.
	if status := ctx.PlayerStatus(); status != nil && int(status.TyresAgeLaps) < CleanAirMinTyreAgeLaps {
		return nil
	}

	trackLen := float64(ctx.TrackLengthM())
	rejoinAt := float64(playerLap.TotalDistance) - DefaultPitLaneLossSeconds*AverageRaceSpeedMetersPerSec
	window := CleanAirTrafficWindowSeconds * AverageRaceSpeedMetersPerSec
	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || rival.TotalDistance == 0 || rival.ResultStatus != packets.ResultStatusActive ||
			rival.PitStatus != packets.PitStatusNone || rival.DriverStatus == packets.DriverStatusInGarage {
			continue
		}
		gap := math.Mod(math.Abs(float64(rival.TotalDistance)-rejoinAt), trackLen)
		if math.Min(gap, trackLen-gap) < window {
			return nil
		}
	}

	r.cleanAirLap = currentLap
	return &Directive{
		ID:       "pit_clean_air",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: "pit_clean_air",
		Title:    "Clean Air Pit Window",
		Message:  "Box this lap and you rejoin in clean air. Good chance for the undercut.",
		Urgency:  UrgencyLow,
		BoxCall:  BoxCallOption,
	}
}
