package engineer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// EngineerEngine orchestrates server-side analytical rules and broadcasts directives.
type EngineerEngine struct {
	mu             sync.RWMutex
	broadcaster    DirectiveBroadcaster
	repo           storage.Repository
	config         EngineerConfig
	rules          []EngineerRule
	alertRules     map[string]AlertKeyConfig
	lastDirectives map[string]int64 // alertKey/category -> timestamp ms

	// Deduplication states
	stintKeys map[string]bool
	phaseKeys map[string]bool
	lapKeys   map[string]int // alertKey -> lapNum

	// Tracked session state
	currentSessionUID uint64
	packetFormat      uint16
	playerCarIndex    int
	teammateCarIndex  int
	playerTeamID      int
	currentPhase      DrivingPhase
	previousPhase     DrivingPhase

	// Latest packet snapshots
	latestSession     *packets.PacketSessionData
	latestLapData     *packets.PacketLapData
	latestTelemetry   *packets.PacketCarTelemetryData
	latestTelemetry2  *packets.PacketCarTelemetry2Data
	latestDamage      *packets.PacketCarDamageData
	latestStatus      *packets.PacketCarStatusData
	latestParticipant *packets.PacketParticipantsData

	// Internal state tracking
	lastStintLapAge int
	bestSector1MS   int
}

// NewEngineerEngine creates a new EngineerEngine instance with default rules.
func NewEngineerEngine(broadcaster DirectiveBroadcaster, repo storage.Repository) *EngineerEngine {
	e := &EngineerEngine{
		broadcaster:      broadcaster,
		repo:             repo,
		config:           DefaultEngineerConfig(),
		lastDirectives:   make(map[string]int64),
		stintKeys:        make(map[string]bool),
		phaseKeys:        make(map[string]bool),
		lapKeys:          make(map[string]int),
		teammateCarIndex: -1,
		playerTeamID:     -1,
		currentPhase:     PhaseUnknown,
		previousPhase:    PhaseUnknown,
	}

	e.rules = []EngineerRule{
		NewTyresRule(),
		NewDamageRule(),
		NewERSRule(),
		NewBrakesRule(),
		NewFuelRule(),
		NewRivalsRule(),
		NewCoachingRule(),
		NewQualifyingRule(),
		NewFlagsRule(),
		NewTeammateRule(),
		NewTrafficRule(),
	}

	e.alertRules = make(map[string]AlertKeyConfig)
	for _, rule := range e.rules {
		for k, cfg := range rule.AlertKeys() {
			e.alertRules[k] = cfg
		}
	}

	return e
}

// SetBroadcaster updates the broadcaster interface (e.g. WebSocket Hub).
func (e *EngineerEngine) SetBroadcaster(b DirectiveBroadcaster) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.broadcaster = b
}

// GetConfig returns a copy of the current configuration.
func (e *EngineerEngine) GetConfig() EngineerConfig {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.config
}

// SetConfig updates the configuration.
func (e *EngineerEngine) SetConfig(cfg EngineerConfig) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if cfg.ChatterCooldownMs <= 0 {
		cfg.ChatterCooldownMs = DefaultDirectiveCooldownMs
	}
	if cfg.EnabledCategories == nil {
		cfg.EnabledCategories = make(map[string]bool)
	}
	e.config = cfg
}

// Reset clears state when a new session starts.
func (e *EngineerEngine) Reset(sessionUID uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.currentSessionUID = sessionUID
	e.lastDirectives = make(map[string]int64)
	e.stintKeys = make(map[string]bool)
	e.phaseKeys = make(map[string]bool)
	e.lapKeys = make(map[string]int)
	e.teammateCarIndex = -1
	e.playerTeamID = -1
	e.bestSector1MS = 0
	e.lastStintLapAge = 0
	e.currentPhase = PhaseUnknown
	e.previousPhase = PhaseUnknown
	e.latestSession = nil
	e.latestLapData = nil
	e.latestTelemetry = nil
	e.latestTelemetry2 = nil
	e.latestDamage = nil
	e.latestStatus = nil
	e.latestParticipant = nil

	for _, rule := range e.rules {
		rule.Reset(DedupScopeNone)
	}
}

// ProcessPacket inspects incoming telemetry packets and evaluates proactive directives.
func (e *EngineerEngine) ProcessPacket(ctx context.Context, pkt packets.Packet) {
	if pkt == nil {
		return
	}

	header := pkt.GetHeader()
	if header.SessionUID == 0 {
		return
	}

	e.mu.Lock()
	if e.currentSessionUID != header.SessionUID {
		e.mu.Unlock()
		e.Reset(header.SessionUID)
		e.mu.Lock()
	}
	e.playerCarIndex = int(header.PlayerCarIndex)
	e.packetFormat = header.PacketFormat

	switch p := pkt.(type) {
	case *packets.PacketParticipantsData:
		e.latestParticipant = p
		playerIdx := e.playerCarIndex
		if playerIdx < len(p.Participants) {
			playerTeam := int(p.Participants[playerIdx].TeamId)
			e.playerTeamID = playerTeam
			for i := 0; i < int(p.NumActiveCars) && i < len(p.Participants); i++ {
				if i != playerIdx && int(p.Participants[i].TeamId) == playerTeam {
					e.teammateCarIndex = i
					break
				}
			}
		}
	case *packets.PacketSessionData:
		e.latestSession = p
	case *packets.PacketLapData:
		e.latestLapData = p
	case *packets.PacketCarDamageData:
		e.latestDamage = p
	case *packets.PacketCarStatusData:
		e.latestStatus = p
		playerIdx := e.playerCarIndex
		if playerIdx < len(p.CarStatusData) {
			status := p.CarStatusData[playerIdx]
			currentTyreAge := int(status.TyresAgeLaps)
			if currentTyreAge <= 1 && e.lastStintLapAge > 3 {
				e.stintKeys = make(map[string]bool)
				for _, r := range e.rules {
					r.Reset(DedupScopeStint)
				}
			}
			e.lastStintLapAge = currentTyreAge
		}
	case *packets.PacketCarTelemetryData:
		e.latestTelemetry = p
	case *packets.PacketCarTelemetry2Data:
		e.latestTelemetry2 = p
	}

	e.updateDrivingPhaseLocked()

	evalCtx := e.buildEvaluationContextLocked(header, pkt)
	e.evaluateLocked(evalCtx)
	e.mu.Unlock()
}

func (e *EngineerEngine) buildEvaluationContextLocked(header packets.PacketHeader, pkt packets.Packet) *EvaluationContext {
	currentLap := 1
	if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
		currentLap = int(pLap.CurrentLapNum)
	}

	return &EvaluationContext{
		Header:           header,
		Packet:           pkt,
		Session:          e.latestSession,
		LapData:          e.latestLapData,
		Telemetry:        e.latestTelemetry,
		Telemetry2:       e.latestTelemetry2,
		Damage:           e.latestDamage,
		Status:           e.latestStatus,
		Participants:     e.latestParticipant,
		Config:           e.config,
		Phase:            e.currentPhase,
		PreviousPhase:    e.previousPhase,
		PlayerCarIndex:   e.playerCarIndex,
		TeammateCarIndex: e.teammateCarIndex,
		PlayerTeamID:     e.playerTeamID,
		PacketFormat:     e.packetFormat,
		CurrentLap:       currentLap,
		Now:              time.Now().UnixMilli(),
	}
}

// Evaluate runs rule evaluation directly for the provided context.
func (e *EngineerEngine) Evaluate(ctx *EvaluationContext) []Directive {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.evaluateLocked(ctx)
}

func (e *EngineerEngine) evaluateLocked(ctx *EvaluationContext) []Directive {
	var emittedDirectives []Directive

	for _, rule := range e.rules {
		if !e.isRuleEnabled(rule) || !e.isValidPhase(rule, ctx.Phase) {
			continue
		}

		directives := rule.Evaluate(ctx)
		for _, d := range directives {
			alertKey := d.ID
			if alertKey == "" {
				alertKey = d.SubAlert
			}
			if alertKey == "" {
				alertKey = string(d.Category)
			}
			if e.canEmitDirectiveLocked(alertKey, string(d.Category), d.Urgency) {
				e.emitDirectiveLocked(ctx.Header, d, alertKey)
				emittedDirectives = append(emittedDirectives, d)
			}
		}

		if coaching, ok := rule.(*CoachingRule); ok {
			e.bestSector1MS = coaching.GetBestSector1MS()
		}
	}

	return emittedDirectives
}

func (e *EngineerEngine) isRuleEnabled(rule EngineerRule) bool {
	return e.config.IsAlertEnabled(rule.Category(), rule.Name())
}

func (e *EngineerEngine) isValidPhase(rule EngineerRule, currentPhase DrivingPhase) bool {
	phases := rule.ValidPhases()
	if len(phases) == 0 {
		return true
	}
	for _, p := range phases {
		if p == currentPhase {
			return true
		}
	}
	return false
}

func (e *EngineerEngine) updateDrivingPhaseLocked() {
	playerLap := e.getPlayerLapDataLocked()
	playerTele := e.getPlayerTelemetryLocked()

	newPhase := e.deriveDrivingPhase(e.latestSession, playerLap, playerTele)
	if newPhase != e.currentPhase {
		e.previousPhase = e.currentPhase
		e.currentPhase = newPhase
		e.phaseKeys = make(map[string]bool)
		for _, r := range e.rules {
			r.Reset(DedupScopePhase)
		}
	}
}

func (e *EngineerEngine) deriveDrivingPhase(session *packets.PacketSessionData, playerLap *packets.LapData, playerTelemetry *packets.CarTelemetryData) DrivingPhase {
	// 1. Red Flag session halt
	if session != nil && session.NumRedFlagPeriods > 0 {
		return PhaseRedFlag
	}

	// 2. In Garage: explicit DriverStatusInGarage or stationary in pit area
	var speed float32
	if playerTelemetry != nil {
		speed = float32(playerTelemetry.Speed)
	}
	isPitArea := playerLap != nil && playerLap.PitStatus == packets.PitStatusInPitArea
	if playerLap != nil && (playerLap.DriverStatus == packets.DriverStatusInGarage || (isPitArea && speed <= SpeedGarageMaxKmh)) {
		return PhaseInGarage
	}

	// 3. Pit Lane: actively pitting or moving in pit area/limiter zone
	if playerLap != nil {
		isPitting := playerLap.PitStatus == packets.PitStatusPitting
		isPitLaneTimerActive := playerLap.PitLaneTimerActive == 1
		if isPitting || isPitArea || isPitLaneTimerActive {
			return PhasePitLane
		}
	}

	// 4. Formation Lap
	if session != nil && session.SafetyCarStatus == packets.SafetyCarFormationLap {
		return PhaseFormationLap
	}

	// 5. Safety Car / VSC
	if session != nil && (session.SafetyCarStatus == packets.SafetyCarFull || session.SafetyCarStatus == packets.SafetyCarVirtual) {
		return PhaseSafetyCar
	}

	// 6. Out-Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOutLap {
		return PhaseOutLap
	}

	// 7. In-Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusInLap {
		return PhaseInLap
	}

	// 8. Flying Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusFlyingLap {
		return PhaseFlyingLap
	}

	// 9. Racing
	if session != nil && packets.IsRaceSession(session.SessionType) {
		return PhaseRacing
	}
	if session == nil && playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOnTrack {
		return PhaseRacing
	}

	return PhaseUnknown
}

func (e *EngineerEngine) calculateLapDistancePct(session *packets.PacketSessionData, playerLap *packets.LapData) float32 {
	if session != nil && session.TrackLength > 0 && playerLap != nil && playerLap.LapDistance >= 0 {
		pct := playerLap.LapDistance / float32(session.TrackLength)
		if pct < 0 {
			return 0
		}
		if pct > 1 {
			return 1
		}
		return pct
	}
	if playerLap != nil {
		switch playerLap.Sector {
		case 0:
			return 0.15
		case 1:
			return 0.50
		case 2:
			return 0.85
		}
	}
	return 0
}

func (e *EngineerEngine) getPlayerLapDataLocked() *packets.LapData {
	if e.latestLapData == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(e.latestLapData.LapData) {
		return nil
	}
	return &e.latestLapData.LapData[e.playerCarIndex]
}

func (e *EngineerEngine) getPlayerCarStatusLocked() *packets.CarStatusData {
	if e.latestStatus == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(e.latestStatus.CarStatusData) {
		return nil
	}
	return &e.latestStatus.CarStatusData[e.playerCarIndex]
}

func (e *EngineerEngine) getPlayerTelemetryLocked() *packets.CarTelemetryData {
	if e.latestTelemetry == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(e.latestTelemetry.CarTelemetryData) {
		return nil
	}
	return &e.latestTelemetry.CarTelemetryData[e.playerCarIndex]
}

func (e *EngineerEngine) isRaceSessionLocked() bool {
	if e.latestSession == nil {
		return true
	}
	return packets.IsRaceSession(e.latestSession.SessionType)
}

func (e *EngineerEngine) canEmitDirectiveLocked(alertKey, category, urgency string) bool {
	isCritical := urgency == UrgencyCritical || urgency == UrgencyHigh

	// 0. Subsystem & sub-alert enable check
	if !e.config.IsAlertEnabled(category, alertKey) {
		return false
	}

	// 1. Paused game check
	if e.latestSession != nil && e.latestSession.GamePaused == 1 && !isCritical {
		return false
	}

	// 2. Driving phase rule validation
	rule, hasRule := e.alertRules[alertKey]
	if hasRule {
		phaseAllowed := false
		for _, vp := range rule.ValidPhases {
			if vp == e.currentPhase {
				phaseAllowed = true
				break
			}
		}
		if !phaseAllowed {
			return false
		}

		if e.currentPhase == PhaseOutLap && rule.MinLapDistancePct > 0 {
			lapDistPct := e.calculateLapDistancePct(e.latestSession, e.getPlayerLapDataLocked())
			if lapDistPct < rule.MinLapDistancePct {
				return false
			}
		}

		if rule.SuppressAfterPitForLaps > 0 && e.isRaceSessionLocked() {
			playerLap := e.getPlayerLapDataLocked()
			playerStatus := e.getPlayerCarStatusLocked()
			if playerLap != nil && playerStatus != nil {
				if playerLap.NumPitStops > 0 && int(playerStatus.TyresAgeLaps) <= rule.SuppressAfterPitForLaps {
					return false
				}
			}
		}

		currentLapNum := 1
		if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
			currentLapNum = int(pLap.CurrentLapNum)
		}

		switch rule.DedupScope {
		case DedupScopeStint:
			if e.stintKeys[alertKey] && !isCritical {
				return false
			}
		case DedupScopePhase:
			if e.phaseKeys[alertKey] && !isCritical {
				return false
			}
		case DedupScopeLap:
			if lastLap, exists := e.lapKeys[alertKey]; exists && lastLap == currentLapNum && !isCritical {
				return false
			}
		}
	}

	// 3. Smart Driving Discretion check
	if !isCritical && e.config.SmartDiscretionEnabled {
		playerTele := e.getPlayerTelemetryLocked()
		if playerTele != nil {
			brakeActive := playerTele.Brake > SmartDiscretionBrakeThreshold
			heavySteer := math.Abs(float64(playerTele.Steer)) > SmartDiscretionSteerThreshold
			if brakeActive || heavySteer {
				return false
			}
		}
	}

	// 4. Per-category chatter cooldown check
	now := time.Now().UnixMilli()
	cooldownMs := int64(e.config.ChatterCooldownMs)
	if cooldownMs <= 0 {
		cooldownMs = DefaultDirectiveCooldownMs
	}
	if !isCritical {
		lastTime, exists := e.lastDirectives[category]
		if exists && now-lastTime < cooldownMs {
			return false
		}
	}

	return true
}

func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive Directive, alertKey string) {
	now := time.Now().UnixMilli()
	category := string(directive.Category)

	e.lastDirectives[category] = now
	e.lastDirectives[alertKey] = now

	if rule, hasRule := e.alertRules[alertKey]; hasRule {
		currentLapNum := 1
		if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
			currentLapNum = int(pLap.CurrentLapNum)
		}
		switch rule.DedupScope {
		case DedupScopeStint:
			e.stintKeys[alertKey] = true
		case DedupScopePhase:
			e.phaseKeys[alertKey] = true
		case DedupScopeLap:
			e.lapKeys[alertKey] = currentLapNum
		}
	}

	directive.ID = fmt.Sprintf("directive_%d_%s", now, alertKey)
	directive.Type = "directive"
	directive.Timestamp = now
	if directive.SubAlert == "" {
		directive.SubAlert = alertKey
	}
	if directive.CarIndex == 0 && header.PlayerCarIndex != 0 {
		directive.CarIndex = int(header.PlayerCarIndex)
	}
	if directive.SessionTime == 0 {
		directive.SessionTime = header.SessionTime
	}

	if e.broadcaster != nil {
		data, err := json.Marshal(directive)
		if err != nil {
			slog.Error("Failed to marshal engineer directive", "alertKey", alertKey, "error", err)
			return
		}
		slog.Info("Proactive directive emitted", "category", string(directive.Category), "subAlert", directive.SubAlert, "urgency", string(directive.Urgency), "message", directive.Message)
		e.broadcaster.Broadcast(data)
	}
}
