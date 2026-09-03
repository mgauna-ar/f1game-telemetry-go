package engineer

import (
	"fmt"
	"math"
	"sync"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// QualifyingRule manages lap invalidation, out-lap traffic, session clock countdown, and elimination danger.
type QualifyingRule struct {
	mu                       sync.Mutex
	lastInvalidLapNum        int
	lastOutLapChecked        int
	lastSessionTimeWarned    bool
	lastElimDangerWarned     bool
	lastInLapCooldownLap     int
	lastInLapTrafficRivalIdx int
}

// NewQualifyingRule creates a new QualifyingRule.
func NewQualifyingRule() *QualifyingRule {
	return &QualifyingRule{
		lastInvalidLapNum:        -1,
		lastOutLapChecked:        -1,
		lastInLapCooldownLap:     -1,
		lastInLapTrafficRivalIdx: -1,
	}
}

func (r *QualifyingRule) Name() string {
	return "qualifying"
}

func (r *QualifyingRule) Category() string {
	return string(DirectiveCategoryQualifying)
}

func (r *QualifyingRule) ValidPhases() []DrivingPhase {
	return []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFlyingLap, PhaseInLap}
}

func (r *QualifyingRule) AlertKeys() map[string]AlertKeyConfig {
	return map[string]AlertKeyConfig{
		"qualy_invalid": {
			ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap},
			DedupScope:  DedupScopeLap,
		},
		"qualy_traffic": {
			ValidPhases:       []DrivingPhase{PhaseOutLap},
			MinLapDistancePct: MinQualyOutLapDistancePct,
			DedupScope:        DedupScopeLap,
		},
		"qualy_time": {
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFlyingLap, PhaseInLap},
			DedupScope:  DedupScopePhase,
		},
		"qualy_elim": {
			ValidPhases: []DrivingPhase{PhaseInGarage, PhasePitLane, PhaseOutLap, PhaseFlyingLap, PhaseInLap},
			DedupScope:  DedupScopePhase,
		},
		"inlap_traffic_behind": {
			Category:    DirectiveCategoryQualifying,
			ValidPhases: []DrivingPhase{PhaseInLap},
			DedupScope:  DedupScopeNone,
		},
		"inlap_cooldown": {
			Category:    DirectiveCategoryCoaching,
			ValidPhases: []DrivingPhase{PhaseInLap},
			DedupScope:  DedupScopeLap,
		},
	}
}

func (r *QualifyingRule) Reset(scope DedupScope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if scope == DedupScopeLap || scope == DedupScopeNone {
		r.lastInvalidLapNum = -1
		r.lastOutLapChecked = -1
		r.lastInLapCooldownLap = -1
		r.lastInLapTrafficRivalIdx = -1
	}
	if scope == DedupScopePhase || scope == DedupScopeNone {
		r.lastSessionTimeWarned = false
		r.lastElimDangerWarned = false
		r.lastInLapCooldownLap = -1
		r.lastInLapTrafficRivalIdx = -1
	}
}

func (r *QualifyingRule) Evaluate(ctx *EvaluationContext) []Directive {
	r.mu.Lock()
	defer r.mu.Unlock()

	var directives []Directive
	playerLap := ctx.PlayerLap()
	isQualy := ctx.IsQualifyingSession()

	// 1. Lap Invalidation (Track Limits) (from LapData)
	if playerLap != nil && playerLap.CurrentLapInvalid == 1 && (ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
		currentLap := int(playerLap.CurrentLapNum)
		if currentLap != r.lastInvalidLapNum {
			r.lastInvalidLapNum = currentLap
			isPushing := playerLap.DriverStatus == packets.DriverStatusFlyingLap || (isQualy && playerLap.DriverStatus != packets.DriverStatusInLap && playerLap.DriverStatus != packets.DriverStatusOutLap)
			if isPushing {
				directives = append(directives, Directive{
					ID:       "qualy_invalid",
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_deleted_lap",
					Title:    "Lap Deleted",
					Message:  fmt.Sprintf("Lap %d deleted for track limits! Recharge ERS and reset for next flying attempt.", currentLap),
					Urgency:  UrgencyCritical,
				})
			}
		}
	}

	// 2. Qualifying Out-Lap Clean Air / Traffic Detection (from LapData)
	if isQualy && playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOutLap && ctx.LapData != nil &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) {
		currentLap := int(playerLap.CurrentLapNum)
		isFinalSector := playerLap.Sector >= 2 || (ctx.Session != nil && ctx.Session.TrackLength > 0 && playerLap.LapDistance > float32(ctx.Session.TrackLength)*FinalSectorTrackDistanceFraction)
		if isFinalSector && r.lastOutLapChecked != currentLap {
			playerTrackDist := playerLap.TotalDistance
			var minAheadDelta float32 = MaxTrackDistanceDeltaInitial

			for i, rival := range ctx.LapData.LapData {
				if i == ctx.PlayerCarIndex || rival.TotalDistance == 0 {
					continue
				}
				deltaDist := rival.TotalDistance - playerTrackDist
				if deltaDist > MinTrafficAheadDistanceMeters && deltaDist < minAheadDelta {
					minAheadDelta = deltaDist
				}
			}

			maxCleanAirDist := ctx.Config.QualyCleanAirSec * QualyOutLapSpeedMetersPerSec
			if minAheadDelta < maxCleanAirDist {
				r.lastOutLapChecked = currentLap
				gapEstSec := minAheadDelta / QualyOutLapSpeedMetersPerSec
				directives = append(directives, Directive{
					ID:       "qualy_traffic",
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_traffic",
					Title:    "Traffic Ahead on Out-Lap",
					Message:  fmt.Sprintf("Traffic ahead before starting hot lap — car ahead is only ~%.1fs away (<%dm). Direct driver to build clean air.", gapEstSec, int(minAheadDelta)),
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"gap_sec":   gapEstSec,
						"gap_meter": minAheadDelta,
					},
				})
			} else if minAheadDelta >= maxCleanAirDist && minAheadDelta < MaxCleanAirDistanceMeters {
				r.lastOutLapChecked = currentLap
				directives = append(directives, Directive{
					ID:       "qualy_traffic",
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_clean_air",
					Title:    "Clean Air Window",
					Message:  "Track is clear ahead with clean air gap. Instruct driver to prepare front tyres and launch out of the final turn.",
					Urgency:  UrgencyLow,
				})
			}
		}
	}

	// 3. Qualifying / Practice Session Clock Countdown (from SessionData)
	if ctx.Session != nil && (isQualy || ctx.IsPracticeSession()) && ctx.Session.SessionTimeLeft > 0 &&
		(ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet)) {
		if float32(ctx.Session.SessionTimeLeft) <= ctx.Config.QualyTimeWarnSec && !r.lastSessionTimeWarned {
			r.lastSessionTimeWarned = true
			sessionName := packets.SessionTypeName(ctx.Session.SessionType)
			minRemaining := int(math.Round(float64(ctx.Config.QualyTimeWarnSec) / float64(packets.SecondsPerMinute)))
			directives = append(directives, Directive{
				ID:       "qualy_time",
				Category: DirectiveCategoryQualifying,
				SubAlert: "qualy_session_time",
				Title:    "Session Time Warning",
				Message:  fmt.Sprintf("Under %d minutes remaining in %s! Direct driver to leave pit lane now for final flying lap.", minRemaining, sessionName),
				Urgency:  UrgencyCritical,
			})
		}
	}

	// 4. Qualifying Elimination Danger Zone (from SessionData & LapData)
	if ctx.Session != nil && isQualy && ctx.Session.SessionTimeLeft > 0 && ctx.Session.SessionTimeLeft <= uint16(QualyElimDangerTimeSec) && !r.lastElimDangerWarned &&
		(ctx.Packet == nil || isPacketType[*packets.PacketSessionData](ctx.Packet)) {
		if playerLap != nil && playerLap.CarPosition > 0 {
			playerPos := int(playerLap.CarPosition)
			isQ1Danger := (ctx.Session.SessionType == packets.SessionQ1 || ctx.Session.SessionType == packets.SessionSprintQ1) && playerPos >= QualyQ1EliminationPositionThreshold
			isQ2Danger := (ctx.Session.SessionType == packets.SessionQ2 || ctx.Session.SessionType == packets.SessionSprintQ2) && playerPos >= QualyQ2EliminationPositionThreshold
			if isQ1Danger || isQ2Danger {
				r.lastElimDangerWarned = true
				sessionName := packets.SessionTypeName(ctx.Session.SessionType)
				directives = append(directives, Directive{
					ID:       "qualy_elim",
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_elimination_danger",
					Title:    "Elimination Danger Zone",
					Message:  fmt.Sprintf("We are in P%d in the elimination danger zone with under 5 minutes left in %s! Time to box for fresh soft tyres.", playerPos, sessionName),
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"position": playerPos,
						"session":  sessionName,
					},
				})
			}
		}
	}

	// 5. In-Lap Fast Traffic Behind & Cooldown Instructions (Qualy / Practice only)
	if (isQualy || ctx.IsPracticeSession()) && (ctx.Phase == PhaseInLap || (playerLap != nil && playerLap.DriverStatus == packets.DriverStatusInLap)) &&
		(ctx.Packet == nil || isPacketType[*packets.PacketLapData](ctx.Packet)) && playerLap != nil {
		currentLap := int(playerLap.CurrentLapNum)

		// Cooldown instruction once per in-lap
		if r.lastInLapCooldownLap != currentLap {
			r.lastInLapCooldownLap = currentLap
			directives = append(directives, Directive{
				ID:       "inlap_cooldown",
				Category: DirectiveCategoryCoaching,
				SubAlert: "inlap_cooldown",
				Title:    "Cool Down Car",
				Message:  "Flying lap completed, box this lap. Recharge ERS battery, cool the brakes and bring the car home safely.",
				Urgency:  UrgencyLow,
			})
		}

		// Fast car approaching on hot lap behind
		if ctx.LapData != nil {
			maxTrafficBehindDist := float32(InLapFastCarBehindGapSec * AverageRaceSpeedMetersPerSec)
			for i, rival := range ctx.LapData.LapData {
				if i == ctx.PlayerCarIndex || rival.TotalDistance == 0 || rival.DriverStatus != packets.DriverStatusFlyingLap {
					continue
				}
				// Rival is behind player: playerLap.TotalDistance - rival.TotalDistance > 0
				distBehind := playerLap.TotalDistance - rival.TotalDistance
				if distBehind > 0 && distBehind < maxTrafficBehindDist && r.lastInLapTrafficRivalIdx != i {
					r.lastInLapTrafficRivalIdx = i
					gapSec := distBehind / AverageRaceSpeedMetersPerSec
					directives = append(directives, Directive{
						ID:       "inlap_traffic_behind",
						Category: DirectiveCategoryQualifying,
						SubAlert: "inlap_traffic_behind",
						Title:    "Fast Car Behind on Flying Lap",
						Message:  fmt.Sprintf("Traffic warning! Fast car approaching on flying lap behind (%.1fs gap). Give way safely.", gapSec),
						Urgency:  UrgencyHigh,
						Metadata: map[string]any{
							"rival_idx": i,
							"gap_sec":   gapSec,
						},
					})
				}
			}
		}
	}

	return directives
}
