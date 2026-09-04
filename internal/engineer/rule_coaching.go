package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// CoachingRule manages micro-sector delta coaching alerts vs personal best,
// as well as formation lap tyre/brake preparation and race start launch evaluation.
type CoachingRule struct {
	mu                 sync.Mutex
	bestSector1MS      int
	bestSector2MS      int
	lastLapNumber      int
	lastNeutralizedLap int
	formationLapFired  bool
	gridApproachFired  bool
	startReactionFired bool
}

// NewCoachingRule creates a new CoachingRule.
func NewCoachingRule() *CoachingRule {
	return &CoachingRule{}
}

func (r *CoachingRule) Name() string {
	return "coaching"
}

func (r *CoachingRule) Category() string {
	return string(DirectiveCategoryCoaching)
}

func (r *CoachingRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseRacing, PhaseFormationLap, PhaseRaceStart}
}

func (r *CoachingRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"coaching_s1": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"coaching_s2": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"formation_lap_start": {
			ValidPhases: []DrivingPhase{PhaseFormationLap},
			DedupScope:  DedupScopePhase,
		},
		"grid_approach": {
			ValidPhases: []DrivingPhase{PhaseFormationLap},
			DedupScope:  DedupScopePhase,
		},
		"start_reaction_time": {
			ValidPhases: []DrivingPhase{PhaseRaceStart, PhaseRacing},
			DedupScope:  DedupScopePhase,
		},
	}
}

func (r *CoachingRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone || scope == DedupScopePhase {
		r.formationLapFired = false
		r.gridApproachFired = false
		r.startReactionFired = false
	}
	if scope == DedupScopeNone {
		r.bestSector1MS = 0
		r.bestSector2MS = 0
		r.lastLapNumber = 0
		r.lastNeutralizedLap = 0
	}
}

// GetBestSector1MS returns the tracked personal best sector 1 in milliseconds.
func (r *CoachingRule) GetBestSector1MS() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.bestSector1MS
}

func (r *CoachingRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive

	// 1. Formation Lap and Grid Procedure alerts
	if ctx.Phase == PhaseFormationLap {
		if !r.formationLapFired {
			r.formationLapFired = true
			directives = append(directives, Directive{
				ID:       "formation_lap_start",
				Category: DirectiveCategoryCoaching,
				SubAlert: "formation_lap_start",
				Title:    "Formation Lap Start",
				Message:  "Formation lap. Weave to put heat into the tyre carcasses and warm the front brakes.",
				Urgency:  UrgencyMedium,
			})
		}

		playerLap := ctx.PlayerLap()
		if !r.gridApproachFired && playerLap != nil && ctx.Session != nil && ctx.Session.TrackLength > 0 {
			fraction := playerLap.LapDistance / float32(ctx.Session.TrackLength)
			if fraction >= GridApproachDistanceFraction {
				r.gridApproachFired = true
				directives = append(directives, Directive{
					ID:       "grid_approach",
					Category: DirectiveCategoryCoaching,
					SubAlert: "grid_approach",
					Title:    "Approaching Grid",
					Message:  "Approaching the grid. Line up carefully in your box and find the clutch bite point.",
					Urgency:  UrgencyMedium,
				})
			}
		}
		return directives
	}

	// 2. Race Start Reaction Time debrief
	playerLap := ctx.PlayerLap()
	if (ctx.Phase == PhaseRaceStart || ctx.Phase == PhaseRacing) && ctx.IsRaceSession() && playerLap != nil && playerLap.CurrentLapNum == 1 {
		if !r.startReactionFired && ctx.Session != nil && playerLap.LapDistance <= RaceStartLaunchMaxDistanceM {
			rt := ctx.Session.StartReactionTime
			if rt >= MinValidReactionTimeSeconds && rt <= MaxValidReactionTimeSeconds {
				r.startReactionFired = true
				var msg string
				switch {
				case rt < FastReactionTimeThresholdSec:
					msg = fmt.Sprintf("Great launch! Reaction time %.2fs, excellent start.", rt)
				case rt > SlowReactionTimeThresholdSec:
					msg = fmt.Sprintf("Launch reaction time was %.2fs, let's focus on maintaining track position into Turn 1.", rt)
				default:
					msg = fmt.Sprintf("Solid start off the line, reaction time %.2fs.", rt)
				}
				directives = append(directives, Directive{
					ID:       "start_reaction_time",
					Category: DirectiveCategoryCoaching,
					SubAlert: "start_reaction_time",
					Title:    "Launch Reaction Time",
					Message:  msg,
					Urgency:  UrgencyMedium,
					Metadata: map[string]any{
						"reaction_time_sec": rt,
					},
				})
			}
		}
	}

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return directives
	}

	if playerLap == nil {
		return directives
	}

	currentLap := int(playerLap.CurrentLapNum)

	// Neutralization Shield (SC, VSC, or SafetyCarDelta active)
	isNeutralized := ctx.Phase == PhaseSafetyCar ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap.SafetyCarDelta != 0
	if isNeutralized {
		r.lastNeutralizedLap = currentLap
		r.lastLapNumber = currentLap
		return directives
	}

	// Restart Lap Cooldown: suppress coaching for the remainder of any lap that had a neutralization
	if currentLap == r.lastNeutralizedLap {
		r.lastLapNumber = currentLap
		return directives
	}

	// Yellow Flag suppression: driver had to slow down for incident ahead
	if status := ctx.PlayerStatus(); status != nil && status.VehicleFIAFlags == packets.VehicleFIAFlagYellow {
		r.lastLapNumber = currentLap
		return directives
	}

	isSectorCoachingPhase := ctx.Phase == PhaseRacing && ctx.IsRaceSession() &&
		playerLap.CurrentLapNum > 1 &&
		ctx.Phase != PhaseSafetyCar &&
		ctx.Phase != PhaseInLap &&
		ctx.Phase != PhaseOutLap &&
		ctx.Phase != PhasePitLane &&
		ctx.Phase != PhaseInGarage &&
		ctx.Phase != PhaseGrid &&
		ctx.Phase != PhaseRaceStart &&
		ctx.Phase != PhasePostRace
	isCompetitiveDriver := playerLap.DriverStatus != packets.DriverStatusInLap &&
		playerLap.DriverStatus != packets.DriverStatusOutLap &&
		playerLap.DriverStatus != packets.DriverStatusInGarage &&
		playerLap.PitStatus == packets.PitStatusNone

	if !isCompetitiveDriver {
		return directives
	}

	s1 := int(playerLap.Sector1TimeMSPart) + int(playerLap.Sector1TimeMinutesPart)*packets.MillisPerMinute
	s2 := int(playerLap.Sector2TimeMSPart) + int(playerLap.Sector2TimeMinutesPart)*packets.MillisPerMinute

	// Only update baseline PBs on clean, green-flag sectors
	if s1 > 0 && (r.bestSector1MS == 0 || s1 < r.bestSector1MS) {
		r.bestSector1MS = s1
	}
	if s2 > 0 && (r.bestSector2MS == 0 || s2 < r.bestSector2MS) {
		r.bestSector2MS = s2
	}

	if !isSectorCoachingPhase {
		r.lastLapNumber = currentLap
		return directives
	}

	if int(playerLap.Sector) == 1 && s1 > 0 && r.bestSector1MS > 0 && currentLap == r.lastLapNumber {
		deltaS1 := float64(s1-r.bestSector1MS) / float64(packets.MillisPerSecond)
		if deltaS1 >= SectorTimeLossThresholdSec && deltaS1 <= SectorTimeLossMaxThresholdSec {
			directives = append(directives, Directive{
				ID:       "coaching_s1",
				Category: DirectiveCategoryCoaching,
				SubAlert: "sector_delta",
				Title:    "Sector 1 Delta",
				Message:  fmt.Sprintf("Time lost in Sector 1 (+%.2fs vs personal best). Focus on apex speed and smooth steering input.", deltaS1),
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"sector": 1,
					"delta":  deltaS1,
				},
			})
		}
	}

	if int(playerLap.Sector) == 2 && s2 > 0 && r.bestSector2MS > 0 && currentLap == r.lastLapNumber {
		deltaS2 := float64(s2-r.bestSector2MS) / float64(packets.MillisPerSecond)
		if deltaS2 >= SectorTimeLossThresholdSec && deltaS2 <= SectorTimeLossMaxThresholdSec {
			directives = append(directives, Directive{
				ID:       "coaching_s2",
				Category: DirectiveCategoryCoaching,
				SubAlert: "sector_delta",
				Title:    "Sector 2 Delta",
				Message:  fmt.Sprintf("Time lost in Sector 2 (+%.2fs vs personal best). Prioritize corner exit traction.", deltaS2),
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"sector": 2,
					"delta":  deltaS2,
				},
			})
		}
	}

	r.lastLapNumber = currentLap
	return directives
}
