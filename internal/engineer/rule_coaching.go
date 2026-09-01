package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// CoachingRule manages micro-sector delta coaching alerts vs personal best.
type CoachingRule struct {
	mu            sync.Mutex
	bestSector1MS int
	bestSector2MS int
	bestSector3MS int
	lastLapNumber int
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
	return []DrivingPhase{PhaseFlyingLap, PhaseRacing}
}

func (r *CoachingRule) DedupScope() DedupScope {
	return DedupScopeLap
}

func (r *CoachingRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"coaching_s1": {
			ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
		"coaching_s2": {
			ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
			DedupScope:  DedupScopeLap,
		},
	}
}

func (r *CoachingRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.bestSector1MS = 0
		r.bestSector2MS = 0
		r.bestSector3MS = 0
		r.lastLapNumber = 0
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

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}

	playerLap := ctx.PlayerLap()
	if playerLap == nil {
		return nil
	}

	isSectorCoachingPhase := (ctx.Phase == PhaseFlyingLap || (ctx.Phase == PhaseRacing && ctx.IsRaceSession())) &&
		ctx.Phase != PhaseSafetyCar &&
		ctx.Phase != PhaseInLap &&
		ctx.Phase != PhaseOutLap &&
		ctx.Phase != PhasePitLane &&
		ctx.Phase != PhaseInGarage
	isCompetitiveDriver := playerLap.DriverStatus != packets.DriverStatusInLap &&
		playerLap.DriverStatus != packets.DriverStatusOutLap &&
		playerLap.DriverStatus != packets.DriverStatusInGarage &&
		playerLap.PitStatus == packets.PitStatusNone

	if !isSectorCoachingPhase || !isCompetitiveDriver {
		return nil
	}

	currentLap := int(playerLap.CurrentLapNum)
	s1 := int(playerLap.Sector1TimeMSPart) + int(playerLap.Sector1TimeMinutesPart)*packets.MillisPerMinute
	s2 := int(playerLap.Sector2TimeMSPart) + int(playerLap.Sector2TimeMinutesPart)*packets.MillisPerMinute

	if s1 > 0 && (r.bestSector1MS == 0 || s1 < r.bestSector1MS) {
		r.bestSector1MS = s1
	}
	if s2 > 0 && (r.bestSector2MS == 0 || s2 < r.bestSector2MS) {
		r.bestSector2MS = s2
	}

	var directives []Directive

	if int(playerLap.Sector) == 1 && s1 > 0 && r.bestSector1MS > 0 && currentLap == r.lastLapNumber {
		deltaS1 := float64(s1-r.bestSector1MS) / 1000.0
		if deltaS1 >= SectorTimeLossThresholdSec {
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
		deltaS2 := float64(s2-r.bestSector2MS) / 1000.0
		if deltaS2 >= SectorTimeLossThresholdSec {
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
