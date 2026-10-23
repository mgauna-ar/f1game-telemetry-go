package engineer

import (
	"fmt"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// TeammateRule manages teammate proximity and pit status alerts, in races.
type TeammateRule struct {
	mu                            sync.Mutex
	lastTeammatePittingWarned     bool
	lastTeammatePittingLapNum     int
	aheadCalled                   bool // the teammate right ahead was called; re-armed once they pull away
	playerBoxed                   bool // the player stopped in their box on this pit lane visit
	lastTeammateDoubleStackLapNum int
}

// NewTeammateRule creates a new TeammateRule.
func NewTeammateRule() *TeammateRule {
	return &TeammateRule{
		lastTeammatePittingLapNum:     -1,
		lastTeammateDoubleStackLapNum: -1,
	}
}

func (r *TeammateRule) Name() string {
	return "teammate"
}

func (r *TeammateRule) Category() string {
	return string(DirectiveCategoryTeammate)
}

// ValidPhases includes PhaseInGarage, the phase of a car standing in its pit box, so the rule sees
// the player's stop: a double-stack is only called on the way in.
func (r *TeammateRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseOutLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhasePitLane, PhaseInGarage}
}

func (r *TeammateRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"teammate_ahead": {
			ValidPhases: []DrivingPhase{PhaseRacing},
			DedupScope:  DedupScopeNone,
			MaxDelayMs:  MomentMaxDelayMs,
		},
		"teammate_pitting": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhaseSafetyCar},
			DedupScope:  DedupScopeNone,
		},
		// Said as the player enters the pit lane, so the pit limiter doesn't hold it.
		"teammate_doublestack": {
			ValidPhases: []DrivingPhase{PhaseRacing, PhaseOutLap, PhaseInLap, PhaseSafetyCar, PhasePitLane},
			DedupScope:  DedupScopeNone,
			PitLaneCall: true,
		},
	}
}

func (r *TeammateRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeNone {
		r.lastTeammatePittingWarned = false
		r.lastTeammatePittingLapNum = -1
		r.aheadCalled = false
		r.playerBoxed = false
		r.lastTeammateDoubleStackLapNum = -1
	}
}

func (r *TeammateRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ctx.Packet != nil && !isPacketType[*packets.PacketLapData](ctx.Packet) {
		return nil
	}
	// In qualifying and practice a car in the pit lane is going out on a run or coming back from
	// one: there is no stop to share the box for. The teammate-ahead call is a race's.
	if timedSession(ctx) {
		return nil
	}

	if ctx.TeammateCarIndex < 0 || ctx.LapData == nil || ctx.TeammateCarIndex >= len(ctx.LapData.LapData) {
		return nil
	}

	playerLap := ctx.PlayerLap()
	if playerLap == nil {
		return nil
	}
	switch playerLap.PitStatus {
	case packets.PitStatusInPitArea:
		r.playerBoxed = true
	case packets.PitStatusNone:
		r.playerBoxed = false
	}
	if playerLap.DriverStatus == packets.DriverStatusInGarage || playerLap.PitStatus == packets.PitStatusInPitArea {
		return nil
	}

	teammateLap := ctx.LapData.LapData[ctx.TeammateCarIndex]
	if teammateLap.DriverStatus == packets.DriverStatusInGarage || teammateLap.ResultStatus != packets.ResultStatusActive {
		r.aheadCalled = false
		return nil
	}

	var directives []Directive
	currentLap := int(playerLap.CurrentLapNum)

	// Double-stack: the teammate is in the pit lane as the player comes in for a stop (not on the
	// way out, nor for a drive-through), or when the player is told to box this lap. Once a lap: the
	// call to box and the pit entry are the same stop.
	isPlayerPitting := playerLap.PitStatus == packets.PitStatusPitting
	comingIn := isPlayerPitting && !r.playerBoxed && playerLap.NumUnservedDriveThroughPens == 0
	isTeammateInPits := teammateLap.PitStatus == packets.PitStatusPitting || teammateLap.PitStatus == packets.PitStatusInPitArea
	boxingThisLap := ctx.BoxDueLap == currentLap && !isPlayerPitting
	if isTeammateInPits && (comingIn || boxingThisLap) && currentLap != r.lastTeammateDoubleStackLapNum {
		r.lastTeammateDoubleStackLapNum = currentLap
		directives = append(directives, Directive{
			ID:       "teammate_doublestack",
			Category: DirectiveCategoryTeammate,
			SubAlert: "teammate_doublestack",
			Title:    "Double-Stack Pit Stop",
			Message:  "Teammate is in the pits! Double-stack pit stop, expect a brief hold in the box.",
			Urgency:  UrgencyHigh,
		})
	}

	// The teammate's stop, once a pit lane visit; the double-stack call already says it.
	if !isPlayerPitting && teammateLap.PitStatus == packets.PitStatusPitting && !r.lastTeammatePittingWarned && currentLap != r.lastTeammatePittingLapNum {
		r.lastTeammatePittingWarned = true
		r.lastTeammatePittingLapNum = currentLap
		if currentLap != r.lastTeammateDoubleStackLapNum {
			directives = append(directives, Directive{
				ID:       "teammate_pitting",
				Category: DirectiveCategoryTeammate,
				SubAlert: "teammate_pitting",
				Title:    "Teammate In Boxes",
				Message:  "Teammate is in the pit lane for service. Pit box is currently occupied.",
				Urgency:  UrgencyMedium,
			})
		}
	} else if teammateLap.PitStatus == packets.PitStatusNone {
		r.lastTeammatePittingWarned = false
	}

	if d, ok := r.aheadCall(ctx, playerLap, &teammateLap); ok {
		directives = append(directives, d)
	}
	return directives
}

// aheadCall says the teammate is right ahead, out on track and within TeammateGapThresholdSec,
// once per approach: it is called again after they pull away past the threshold or stop being
// right ahead.
func (r *TeammateRule) aheadCall(ctx *EvaluationContext, playerLap, teammateLap *packets.LapData) (Directive, bool) {
	isNeutralized := ctx.Phase == PhaseSafetyCar ||
		(ctx.Session != nil && ctx.Session.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap.SafetyCarDelta != 0
	rightAhead := playerLap.CarPosition > 1 && teammateLap.CarPosition == playerLap.CarPosition-1 &&
		onTrack(teammateLap) && onTrack(playerLap)
	if !rightAhead || isNeutralized {
		if !rightAhead {
			r.aheadCalled = false
		}
		return Directive{}, false
	}
	gapSec := raceGapSec(ctx, ctx.TeammateCarIndex, ctx.PlayerCarIndex)
	if gapSec > TeammateGapThresholdSec+RivalRearmHysteresisSec {
		r.aheadCalled = false
	}
	if r.aheadCalled || gapSec <= 0 || gapSec > TeammateGapThresholdSec {
		return Directive{}, false
	}
	r.aheadCalled = true
	return Directive{
		ID:       "teammate_ahead",
		Category: DirectiveCategoryTeammate,
		SubAlert: "teammate_proximity",
		Title:    "Teammate Ahead",
		Message:  fmt.Sprintf("Teammate is directly ahead (gap: %.1fs). Race them clean, no contact.", gapSec),
		Urgency:  UrgencyLow,
		Values:   &DirectiveValues{Ahead: &GapToCar{GapSec: roundTo(gapSec, 1)}},
	}, true
}
