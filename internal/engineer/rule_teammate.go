package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TeammateRule manages teammate proximity and pit status alerts.
type TeammateRule struct {
	mu                        sync.Mutex
	lastTeammateAheadWarned   bool
	lastTeammatePittingWarned bool
	lastTeammatePittingLapNum int
	lastTeammateAheadWarnLap  int
}

// NewTeammateRule creates a new TeammateRule.
func NewTeammateRule() *TeammateRule {
	return &TeammateRule{
		lastTeammatePittingLapNum: -1,
		lastTeammateAheadWarnLap:  -1,
	}
}

func (r *TeammateRule) Name() string {
	return "teammate"
}

func (r *TeammateRule) Category() string {
	return string(DirectiveCategoryTeammate)
}

func (r *TeammateRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseRacing, PhaseInLap, PhaseSafetyCar}
}

func (r *TeammateRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"teammate_ahead": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
		},
		"teammate_pitting": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
		},
	}
}

func (r *TeammateRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lastTeammateAheadWarned = false
		r.lastTeammatePittingWarned = false
		r.lastTeammatePittingLapNum = -1
		r.lastTeammateAheadWarnLap = -1
	}
}

func (r *TeammateRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}

	if ctx.TeammateCarIndex < 0 || ctx.LapData == nil || ctx.TeammateCarIndex >= len(ctx.LapData.LapData) {
		return nil
	}

	playerLap := ctx.PlayerLap()
	if playerLap == nil || playerLap.DriverStatus == packets.DriverStatusInGarage || playerLap.PitStatus == packets.PitStatusInPitArea {
		return nil
	}

	teammateLap := ctx.LapData.LapData[ctx.TeammateCarIndex]
	if teammateLap.DriverStatus == packets.DriverStatusInGarage {
		return nil
	}

	var directives []Directive
	currentLap := int(playerLap.CurrentLapNum)
	distDiff := playerLap.TotalDistance - teammateLap.TotalDistance
	gapSeconds := distDiff / AverageRaceSpeedMetersPerSec

	if teammateLap.PitStatus == packets.PitStatusPitting && !r.lastTeammatePittingWarned && currentLap != r.lastTeammatePittingLapNum {
		r.lastTeammatePittingWarned = true
		r.lastTeammatePittingLapNum = currentLap
		directives = append(directives, Directive{
			ID:       "teammate_pitting",
			Category: DirectiveCategoryTeammate,
			SubAlert: "teammate_pitting",
			Title:    "Teammate In Boxes",
			Message:  "Teammate is in the pit lane for service. Pit box is currently occupied.",
			Urgency:  UrgencyMedium,
		})
	} else if teammateLap.PitStatus != packets.PitStatusPitting {
		r.lastTeammatePittingWarned = false
	}

	isNeutralized := ctx.Phase == PhaseSafetyCar ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap.SafetyCarDelta != 0

	if !isNeutralized && gapSeconds < 0 && gapSeconds >= -TeammateGapThresholdSec && currentLap != r.lastTeammateAheadWarnLap {
		r.lastTeammateAheadWarnLap = currentLap
		directives = append(directives, Directive{
			ID:       "teammate_ahead",
			Category: DirectiveCategoryTeammate,
			SubAlert: "teammate_proximity",
			Title:    "Teammate Ahead",
			Message:  fmt.Sprintf("Teammate is directly ahead (gap: %.1fs). Exercise caution and avoid compromising team race pace.", -gapSeconds),
			Urgency:  UrgencyLow,
		})
	}

	return directives
}
