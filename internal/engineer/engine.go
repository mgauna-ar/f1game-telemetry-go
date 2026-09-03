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
)

// EngineerEngine orchestrates server-side analytical rules and broadcasts directives.
type EngineerEngine struct {
	mu             sync.RWMutex
	broadcaster    DirectiveBroadcaster
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
	lastStintLapAge       int
	startLightsActive     bool
	raceStarted           bool
	chequeredFlagReceived bool
	postRaceAnnounced     bool
}

// NewEngineerEngine creates a new EngineerEngine instance with default rules.
func NewEngineerEngine(broadcaster DirectiveBroadcaster) *EngineerEngine {
	e := &EngineerEngine{
		broadcaster:      broadcaster,
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
			if cfg.Category == "" {
				cfg.Category = EngineerDirectiveCategory(rule.Category())
			}
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
	e.resetLocked(sessionUID)
}

func (e *EngineerEngine) resetLocked(sessionUID uint64) {
	e.currentSessionUID = sessionUID
	e.lastDirectives = make(map[string]int64)
	e.stintKeys = make(map[string]bool)
	e.phaseKeys = make(map[string]bool)
	e.lapKeys = make(map[string]int)
	e.teammateCarIndex = -1
	e.playerTeamID = -1
	e.lastStintLapAge = 0
	e.startLightsActive = false
	e.raceStarted = false
	e.chequeredFlagReceived = false
	e.postRaceAnnounced = false
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
		e.resetLocked(header.SessionUID)
	}
	e.playerCarIndex = int(header.PlayerCarIndex)
	e.packetFormat = header.PacketFormat

	switch p := pkt.(type) {
	case *packets.PacketEventData:
		code := p.EventCode()
		switch code {
		case packets.EventStartLights:
			e.startLightsActive = true
			e.raceStarted = false
		case packets.EventLightsOut:
			e.startLightsActive = false
			e.raceStarted = true
		case packets.EventChequeredFlag:
			e.chequeredFlagReceived = true
		}
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
			if currentTyreAge <= PitStopDetectionMaxTyreAgeLaps && e.lastStintLapAge > MinStintLapsForReset {
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
	emitted := e.evaluateLocked(evalCtx)
	broadcaster := e.broadcaster
	e.mu.Unlock()

	for _, d := range emitted {
		e.broadcastDirective(broadcaster, d)
	}
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
	emitted := e.evaluateLocked(ctx)
	broadcaster := e.broadcaster
	e.mu.Unlock()

	for _, d := range emitted {
		e.broadcastDirective(broadcaster, d)
	}
	return emitted
}

func (e *EngineerEngine) evaluateLocked(ctx *EvaluationContext) []Directive {
	var emittedDirectives []Directive

	// Post-race debrief directive when transitioning to PhasePostRace
	if e.currentPhase == PhasePostRace && !e.postRaceAnnounced {
		playerLap := e.getPlayerLapDataLocked()
		if playerLap != nil && playerLap.ResultStatus == packets.ResultStatusFinished {
			e.postRaceAnnounced = true
			postRaceDirective := Directive{
				ID:       "race_finish",
				Category: DirectiveCategoryFlags,
				SubAlert: "race_finish",
				Title:    "Race Finished",
				Message:  fmt.Sprintf("Chequered flag! Outstanding drive, you finished in P%d. Pick up rubber off line, switch to cool down mode and bring the car to parc fermé.", playerLap.CarPosition),
				Urgency:  UrgencyLow,
				Metadata: map[string]any{
					"car_position": int(playerLap.CarPosition),
				},
			}
			prepared := e.emitDirectiveLocked(ctx.Header, postRaceDirective, "race_finish")
			emittedDirectives = append(emittedDirectives, prepared)
		}
	}

	for _, rule := range e.rules {
		if !e.isRuleEnabled(rule) || !e.isValidPhase(rule, ctx.Phase) {
			continue
		}

		directives := rule.Evaluate(ctx)
		for _, d := range directives {
			cat := string(d.Category)
			if cat == "" {
				cat = rule.Category()
				d.Category = EngineerDirectiveCategory(cat)
			}
			alertKey := d.ID
			if alertKey == "" {
				alertKey = d.SubAlert
			}
			if alertKey == "" {
				alertKey = cat
			}
			if e.canEmitDirectiveLocked(alertKey, cat, d.Urgency) {
				prepared := e.emitDirectiveLocked(ctx.Header, d, alertKey)
				emittedDirectives = append(emittedDirectives, prepared)
			}
		}
	}

	return emittedDirectives
}

func (e *EngineerEngine) isRuleEnabled(rule EngineerRule) bool {
	alertKeys := rule.AlertKeys()
	if len(alertKeys) == 0 {
		return e.config.IsAlertEnabled(rule.Category(), rule.Name())
	}
	for alertKey, cfg := range alertKeys {
		cat := string(cfg.Category)
		if cat == "" {
			cat = rule.Category()
		}
		if e.config.IsAlertEnabled(cat, alertKey) {
			return true
		}
	}
	return false
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

	// 4. Post-Race (Chequered Flag finished or retired)
	if playerLap != nil {
		isFinished := playerLap.ResultStatus == packets.ResultStatusFinished ||
			playerLap.ResultStatus == packets.ResultStatusDNF ||
			playerLap.ResultStatus == packets.ResultStatusDSQ ||
			playerLap.ResultStatus == packets.ResultStatusRetired
		if isFinished {
			return PhasePostRace
		}
	}

	// 5. Formation Lap
	if session != nil && session.SafetyCarStatus == packets.SafetyCarFormationLap {
		return PhaseFormationLap
	}

	// 6. Safety Car / VSC
	if session != nil && (session.SafetyCarStatus == packets.SafetyCarFull || session.SafetyCarStatus == packets.SafetyCarVirtual) {
		return PhaseSafetyCar
	}

	// 7. Grid & Race Start procedures (Race sessions only)
	isRace := (session != nil && packets.IsRaceSession(session.SessionType)) || session == nil
	if isRace && playerLap != nil {
		if e.startLightsActive {
			return PhaseGrid
		}
		if !e.raceStarted && playerLap.CurrentLapNum == 1 && speed <= SpeedGridMaxKmh && playerLap.LapDistance < MaxGridTrackDistanceMeters && playerLap.TotalDistance < MaxGridTrackDistanceMeters && playerLap.DriverStatus == packets.DriverStatusOnTrack {
			return PhaseGrid
		}
		if e.raceStarted && playerLap.CurrentLapNum == 1 {
			return PhaseRaceStart
		}
	}

	// 8. Out-Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOutLap {
		return PhaseOutLap
	}

	// 9. In-Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusInLap {
		return PhaseInLap
	}

	// 10. Flying Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusFlyingLap {
		return PhaseFlyingLap
	}

	// 11. Racing
	if session != nil && packets.IsRaceSession(session.SessionType) {
		return PhaseRacing
	}
	if session == nil && playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOnTrack {
		return PhaseRacing
	}

	return PhaseUnknown
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

func (e *EngineerEngine) isGamePaused(isCritical bool) bool {
	return e.latestSession != nil && e.latestSession.GamePaused == 1 && !isCritical
}

func (e *EngineerEngine) isPhaseAllowed(alertKey string) bool {
	rule, hasRule := e.alertRules[alertKey]
	if !hasRule {
		return true
	}

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
		lapDistPct := CalculateLapDistanceFraction(e.latestSession, e.getPlayerLapDataLocked())
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

	return true
}

func (e *EngineerEngine) isDeduplicated(alertKey string, isCritical bool) bool {
	if isCritical {
		return false
	}

	rule, hasRule := e.alertRules[alertKey]
	if !hasRule {
		return false
	}

	currentLapNum := 1
	if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
		currentLapNum = int(pLap.CurrentLapNum)
	}

	switch rule.DedupScope {
	case DedupScopeStint:
		return e.stintKeys[alertKey]
	case DedupScopePhase:
		return e.phaseKeys[alertKey]
	case DedupScopeLap:
		if lastLap, exists := e.lapKeys[alertKey]; exists && lastLap == currentLapNum {
			return true
		}
	}

	return false
}

func (e *EngineerEngine) isSmartDiscretionSuppressed(isCritical bool) bool {
	if isCritical || !e.config.SmartDiscretionEnabled {
		return false
	}

	playerTele := e.getPlayerTelemetryLocked()
	if playerTele != nil {
		brakeActive := playerTele.Brake > SmartDiscretionBrakeThreshold
		heavySteer := math.Abs(float64(playerTele.Steer)) > SmartDiscretionSteerThreshold
		if brakeActive || heavySteer {
			return true
		}
	}

	return false
}

func (e *EngineerEngine) isChatterCooldownActive(category string, isCritical bool) bool {
	if isCritical {
		return false
	}

	now := time.Now().UnixMilli()
	cooldownMs := int64(e.config.ChatterCooldownMs)
	if cooldownMs <= 0 {
		cooldownMs = DefaultDirectiveCooldownMs
	}

	lastTime, exists := e.lastDirectives[category]
	return exists && now-lastTime < cooldownMs
}

func (e *EngineerEngine) canEmitDirectiveLocked(alertKey, category, urgency string) bool {
	isCritical := urgency == UrgencyCritical || urgency == UrgencyHigh

	// 0. Subsystem & sub-alert enable check
	if !e.config.IsAlertEnabled(category, alertKey) {
		return false
	}

	// 1. Paused game check
	if e.isGamePaused(isCritical) {
		return false
	}

	// 2. Strict Radio Silence during Grid and Race Start
	// During PhaseGrid or PhaseRaceStart, only true emergency alerts (UrgencyCritical) are permitted.
	if (e.currentPhase == PhaseGrid || e.currentPhase == PhaseRaceStart) && urgency != UrgencyCritical {
		return false
	}

	// 3. Strict Radio Discipline during Flying Lap (Hot Lap)
	// During PhaseFlyingLap, only lap invalidation or critical emergency alerts are permitted.
	if e.currentPhase == PhaseFlyingLap && urgency != UrgencyCritical && alertKey != "qualy_invalid" {
		return false
	}

	// 4. Post-Race suppression: only race_finish announcement or emergencies permitted
	if e.currentPhase == PhasePostRace && urgency != UrgencyCritical && alertKey != "race_finish" {
		return false
	}

	// 5. Driving phase rule validation
	if !e.isPhaseAllowed(alertKey) {
		return false
	}

	// 5. Deduplication check
	if e.isDeduplicated(alertKey, isCritical) {
		return false
	}

	// 6. Smart Driving Discretion check
	if e.isSmartDiscretionSuppressed(isCritical) {
		return false
	}

	// 7. Per-category chatter cooldown check
	if e.isChatterCooldownActive(category, isCritical) {
		return false
	}

	return true
}

func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive Directive, alertKey string) Directive {
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

	return directive
}

func (e *EngineerEngine) broadcastDirective(broadcaster DirectiveBroadcaster, directive Directive) {
	if broadcaster == nil {
		return
	}
	data, err := json.Marshal(directive)
	if err != nil {
		slog.Error("Failed to marshal engineer directive", "alertKey", directive.SubAlert, "error", err)
		return
	}
	slog.Info("Proactive directive emitted", "category", string(directive.Category), "subAlert", directive.SubAlert, "urgency", string(directive.Urgency), "message", directive.Message)
	broadcaster.Broadcast(data)
}
