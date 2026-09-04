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
	lastRecordedPitTimerMS uint16
	pitTimerReported       bool
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

func (r *TrafficRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhasePitLane, PhaseOutLap}
}

func (r *TrafficRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"pit_clean_air": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
		"pit_serve_penalty": {
			ValidPhases: []DrivingPhase{PhasePitLane},
			DedupScope:  DedupScopeStint,
		},
		"pit_stop_duration": {
			ValidPhases: []DrivingPhase{PhasePitLane, PhaseOutLap},
			DedupScope:  DedupScopeStint,
		},
		"pit_limiter_exit": {
			ValidPhases: []DrivingPhase{PhasePitLane, PhaseOutLap},
			DedupScope:  DedupScopeStint,
		},
	}
}

func (r *TrafficRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeStint || scope == DedupScopeNone {
		r.penaltyReminderFired = false
		r.pitTimerReported = false
		r.lastRecordedPitTimerMS = 0
		r.lastPitLimiterStatus = 0
		r.lastPitStatus = 0
	}
}

func (r *TrafficRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	playerLap := ctx.PlayerLap()
	status := ctx.PlayerStatus()

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
					Metadata: map[string]any{
						"penalty_sec": playerLap.Penalties,
					},
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
			durationSec := float32(r.lastRecordedPitTimerMS) / 1000.0
			var durMsg string
			switch {
			case durationSec <= FastPitStopDurationSec:
				durMsg = fmt.Sprintf("Rapid stop! Stationary time was %.1fs, brilliant work by the crew.", durationSec)
			case durationSec >= SlowPitStopDurationSec:
				durMsg = fmt.Sprintf("Stationary time was %.1fs, longer than planned. Let's make up time on the out-lap.", durationSec)
			default:
				durMsg = fmt.Sprintf("Stationary time %.1fs. Clean stop, push now.", durationSec)
			}
			directives = append(directives, Directive{
				ID:       "pit_stop_duration",
				Category: DirectiveCategoryPitStrategy,
				SubAlert: "pit_stop_duration",
				Title:    "Pit Stop Duration",
				Message:  durMsg,
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"duration_sec": durationSec,
				},
			})
		}
		r.lastPitStatus = playerLap.PitStatus
	}

	// 3. Clean Air Pit Window (LapData based)
	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return directives
	}

	if !ctx.IsRaceSession() || ctx.Phase != PhaseRacing ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap == nil || ctx.LapData == nil {
		return directives
	}

	// Strategy integrity: suppress clean air pit calls if player already pitted or race is near conclusion
	if playerLap.NumPitStops >= 1 {
		return directives
	}
	currentLap := int(playerLap.CurrentLapNum)
	if ctx.Session != nil && ctx.Session.TotalLaps > 0 {
		lapsRemaining := int(ctx.Session.TotalLaps) - currentLap
		if lapsRemaining <= CleanAirMinRemainingLaps {
			return directives
		}
	}
	trackLen := float32(DefaultTrackLengthMeters)
	if ctx.Session != nil && ctx.Session.TrackLength > 0 {
		trackLen = float32(ctx.Session.TrackLength)
	}

	pitLossDistance := float32(DefaultPitLaneLossSeconds * AverageRaceSpeedMetersPerSec)
	targetRejoinTotalDist := playerLap.TotalDistance - pitLossDistance
	trafficCount := 0

	for i, rival := range ctx.LapData.LapData {
		if i == ctx.PlayerCarIndex || rival.TotalDistance == 0 {
			continue
		}
		distDelta := math.Abs(float64(rival.TotalDistance - targetRejoinTotalDist))
		distDeltaOnTrack := math.Mod(distDelta, float64(trackLen))
		windowDistance := CleanAirTrafficWindowSeconds * AverageRaceSpeedMetersPerSec
		if distDeltaOnTrack < windowDistance {
			trafficCount++
		}
	}

	if trafficCount == 0 && currentLap%CleanAirPeriodicLapModulo == 0 {
		directives = append(directives, Directive{
			ID:       "pit_clean_air",
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_clean_air",
			Title:    "Clean Air Pit Window",
			Message:  "Pit window offers clean air on rejoin. Ideal opportunity for undercut/overcut strategy.",
			Urgency:  UrgencyLow,
		})
	}

	return directives
}
