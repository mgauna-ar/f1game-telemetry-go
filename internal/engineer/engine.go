package engineer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sort"
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
	callLaps       map[string]int   // alertKey -> the player's lap it was last said on

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
	latestTyreSets    *packets.PacketTyreSetsData
	latestParticipant *packets.PacketParticipantsData

	// Internal state tracking
	lastStintLapAge         int
	startLightsActive       bool
	raceStarted             bool
	chequeredFlagReceived   bool
	postRaceAnnounced       bool
	lastGlobalDirectiveTime int64

	// Calls a passing gate (braking, radio spacing, cooldown, pause) held back, by alert key.
	pending map[string]pendingDirective

	// Box calls: the learned pit entries (kept across sessions), where the player is, calls to box
	// waiting for the line, and the lap a call told the player to box on (0: none).
	pitLanes  *pitLanes
	playerPos playerTrackPosition
	lineWait  map[string]lineWaitDirective
	boxDueLap int
	boxCallAt int64          // unix ms of the last call telling the player to box
	pitPlan   pitPlanTracker // the game's plan for the player's next stop
	// pitEntries marks the cars that entered the pit lane on the latest lap data packet.
	pitEntries [packets.MaxCars]bool

	// The session's red flag count only goes up, so whether a red flag is on now is tracked here:
	// from the count going up (or RDFL) until the restart.
	redFlagActive bool
	redFlagCount  uint8
	redFlagLap    int

	// Session history and freshness for the AI race engineer's live race context
	history      raceHistory
	lastPacketAt int64 // unix ms of the last processed packet

	// now returns the current time; tests replace it.
	now func() time.Time
}

// pendingDirective is a call a passing gate held back until the radio is free.
type pendingDirective struct {
	directive Directive
	alertKey  string
	heldAt    int64 // unix ms the call was first held
	expiresAt int64 // unix ms after which it is no longer worth saying
	lap       int   // the player's lap when it was first held
}

// gateDecision is what the radio gates decide for a call.
type gateDecision int

const (
	gateEmit gateDecision = iota
	gateHold              // only a passing gate is in the way: braking, radio spacing, cooldown or pause
	gateDrop
)

// NewEngineerEngine creates a new EngineerEngine instance with default rules.
func NewEngineerEngine(broadcaster DirectiveBroadcaster) *EngineerEngine {
	e := &EngineerEngine{
		broadcaster:      broadcaster,
		config:           DefaultEngineerConfig(),
		lastDirectives:   make(map[string]int64),
		callLaps:         make(map[string]int),
		stintKeys:        make(map[string]bool),
		phaseKeys:        make(map[string]bool),
		lapKeys:          make(map[string]int),
		pending:          make(map[string]pendingDirective),
		pitLanes:         newPitLanes(),
		lineWait:         make(map[string]lineWaitDirective),
		teammateCarIndex: -1,
		playerTeamID:     -1,
		currentPhase:     PhaseUnknown,
		previousPhase:    PhaseUnknown,
		now:              time.Now,
	}

	e.rules = []EngineerRule{
		NewTyresRule(),
		NewDamageRule(),
		NewERSRule(),
		NewBrakesRule(),
		NewFuelRule(),
		NewPitPlanRule(),
		NewRivalsRule(),
		NewCoachingRule(),
		NewQualifyingRule(),
		NewFlagsRule(),
		NewTeammateRule(),
		NewTrafficRule(),
		NewReportsRule(),
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
	return e.config.clone()
}

// SetConfig updates the configuration.
func (e *EngineerEngine) SetConfig(cfg EngineerConfig) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if cfg.ChatterCooldownMs <= 0 {
		cfg.ChatterCooldownMs = DefaultDirectiveCooldownMs
	}
	cfg = cfg.clone()
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
	e.callLaps = make(map[string]int)
	e.stintKeys = make(map[string]bool)
	e.phaseKeys = make(map[string]bool)
	e.lapKeys = make(map[string]int)
	e.pending = make(map[string]pendingDirective)
	e.lineWait = make(map[string]lineWaitDirective)
	e.playerPos = playerTrackPosition{}
	e.boxDueLap = 0
	e.boxCallAt = 0
	e.pitPlan = pitPlanTracker{}
	e.pitEntries = [packets.MaxCars]bool{}
	e.redFlagActive = false
	e.redFlagCount = 0
	e.redFlagLap = 0
	e.teammateCarIndex = -1
	e.playerTeamID = -1
	e.lastStintLapAge = 0
	e.startLightsActive = false
	e.raceStarted = false
	e.chequeredFlagReceived = false
	e.postRaceAnnounced = false
	e.lastGlobalDirectiveTime = 0
	e.currentPhase = PhaseUnknown
	e.previousPhase = PhaseUnknown
	e.latestSession = nil
	e.latestLapData = nil
	e.latestTelemetry = nil
	e.latestTelemetry2 = nil
	e.latestDamage = nil
	e.latestStatus = nil
	e.latestTyreSets = nil
	e.latestParticipant = nil
	e.history = raceHistory{}

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
	e.lastPacketAt = e.nowMs()

	switch p := pkt.(type) {
	case *packets.PacketEventData:
		code := p.EventCode()
		switch code {
		case packets.EventStartLights:
			e.startLightsActive = true
			e.raceStarted = false
			e.redFlagActive = false
		case packets.EventLightsOut:
			e.startLightsActive = false
			e.raceStarted = true
			e.redFlagActive = false
		case packets.EventChequeredFlag:
			e.chequeredFlagReceived = true
		case packets.EventRedFlag:
			e.startRedFlagLocked()
		}
		e.recordRaceEventLocked(p)
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
		e.trackRedFlagCountLocked(p)
		e.latestSession = p
	case *packets.PacketLapData:
		e.recordLapTransitionsLocked(p)
		e.pitLanes.learn(e.latestSession, e.latestLapData, p)
		e.pitEntries = pitLaneEntries(e.latestLapData, p)
		e.endRedFlagOnRestartLocked(p)
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
	case *packets.PacketTyreSetsData:
		if int(p.CarIdx) == e.playerCarIndex {
			e.latestTyreSets = p
		}
	case *packets.PacketSessionHistoryData:
		if int(p.CarIdx) < len(e.history.carHistory) {
			e.history.carHistory[p.CarIdx] = p
		}
	}

	e.pitPlan.update(e.latestSession, e.getPlayerLapDataLocked())
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

	ctx := &EvaluationContext{
		Header:           header,
		Packet:           pkt,
		Session:          e.latestSession,
		LapData:          e.latestLapData,
		Telemetry:        e.latestTelemetry,
		Telemetry2:       e.latestTelemetry2,
		Damage:           e.latestDamage,
		Status:           e.latestStatus,
		TyreSets:         e.latestTyreSets,
		Participants:     e.latestParticipant,
		Config:           e.config,
		Phase:            e.currentPhase,
		PreviousPhase:    e.previousPhase,
		PlayerCarIndex:   e.playerCarIndex,
		TeammateCarIndex: e.teammateCarIndex,
		PlayerTeamID:     e.playerTeamID,
		PacketFormat:     e.packetFormat,
		CurrentLap:       currentLap,
		Now:              e.nowMs(),
		PitEntryM:        e.pitEntryLocked(),
		PlayerLaps:       e.history.playerLaps,
		CallLaps:         e.callLaps,
		BoxDueLap:        e.boxDueLap,
		PitPlan:          e.pitPlan.plan,
		CarHistory:       &e.history.carHistory,
	}
	if _, ok := pkt.(*packets.PacketLapData); ok {
		ctx.PitEntries = e.pitEntries
	}
	return ctx
}

// pitEntryLocked is the learned pit entry of the session's track, or 0 while unknown.
func (e *EngineerEngine) pitEntryLocked() float32 {
	if e.latestSession == nil {
		return 0
	}
	return e.pitLanes.entry(e.latestSession.TrackId)
}

func (e *EngineerEngine) nowMs() int64 {
	return e.now().UnixMilli()
}

// startRedFlagLocked marks a red flag as on, remembering the player's lap so the restart can be
// told apart from it.
func (e *EngineerEngine) startRedFlagLocked() {
	e.redFlagActive = true
	e.redFlagLap = 0
	if pLap := e.getPlayerLapDataLocked(); pLap != nil {
		e.redFlagLap = int(pLap.CurrentLapNum)
	}
}

// trackRedFlagCountLocked starts a red flag when the session's red flag count goes up. The first
// session packet only records the count, so joining a session after a red flag starts none.
func (e *EngineerEngine) trackRedFlagCountLocked(p *packets.PacketSessionData) {
	if e.latestSession != nil && p.NumRedFlagPeriods > e.redFlagCount {
		e.startRedFlagLocked()
	}
	e.redFlagCount = p.NumRedFlagPeriods
}

// endRedFlagOnRestartLocked ends a red flag once the player runs again: a new lap, or out of the
// garage onto an out-lap (how qualifying and practice restart). Start lights and lights out end
// it too (ProcessPacket).
func (e *EngineerEngine) endRedFlagOnRestartLocked(next *packets.PacketLapData) {
	if !e.redFlagActive || e.playerCarIndex < 0 || e.playerCarIndex >= len(next.LapData) {
		return
	}
	after := next.LapData[e.playerCarIndex]
	if e.redFlagLap == 0 {
		e.redFlagLap = int(after.CurrentLapNum)
		return
	}
	leftGarage := false
	if before := e.getPlayerLapDataLocked(); before != nil {
		leftGarage = before.DriverStatus == packets.DriverStatusInGarage && after.DriverStatus == packets.DriverStatusOutLap
	}
	if int(after.CurrentLapNum) > e.redFlagLap || leftGarage {
		e.redFlagActive = false
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

	// The chequered flag of a race: where the player finished. Qualifying and practice end with
	// their own calls (the last lap's result).
	if e.currentPhase == PhasePostRace && !e.postRaceAnnounced && e.isRaceSessionLocked() {
		playerLap := e.getPlayerLapDataLocked()
		if playerLap != nil && playerLap.ResultStatus == packets.ResultStatusFinished {
			e.postRaceAnnounced = true
			prepared := e.emitDirectiveLocked(ctx.Header, e.raceFinishDirectiveLocked(int(playerLap.CarPosition)), "race_finish", 0)
			emittedDirectives = append(emittedDirectives, prepared)
		}
	}

	e.updatePlayerPositionLocked(ctx)
	e.releaseLineWaitLocked()
	emittedDirectives = append(emittedDirectives, e.releasePendingLocked(ctx.Header)...)
	// A held call to box just said opens a box order the rules must see.
	ctx.BoxDueLap = e.boxDueLap

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
			switch e.gateDirectiveLocked(alertKey, cat, d.Urgency) {
			case gateEmit:
				if e.waitForLineLocked(d, alertKey) {
					continue
				}
				prepared := e.emitDirectiveLocked(ctx.Header, d, alertKey, 0)
				emittedDirectives = append(emittedDirectives, prepared)
			case gateHold:
				e.holdDirectiveLocked(d, alertKey)
			case gateDrop:
			}
		}
	}

	return append(emittedDirectives, e.pitEntryReminderLocked(ctx.Header)...)
}

// raceFinishDirectiveLocked is the chequered flag call for a finish in position pos: a win, a
// podium, points or none.
func (e *EngineerEngine) raceFinishDirectiveLocked(pos int) Directive {
	pointsPositions := RacePointsPositions
	if e.latestSession != nil && (e.latestSession.SessionType == packets.SessionSprintRace || e.latestSession.SessionType == packets.SessionEqualSprintRace) {
		pointsPositions = SprintPointsPositions
	}
	subAlert := "race_finish"
	result := "outside the points"
	switch {
	case pos == 1:
		subAlert = "race_finish_win"
		result = "the win"
	case pos <= PodiumPositions:
		subAlert = "race_finish_podium"
		result = "a podium"
	case pos <= pointsPositions:
		subAlert = "race_finish_points"
		result = "points"
	}
	return Directive{
		ID:       "race_finish",
		Category: DirectiveCategoryFlags,
		SubAlert: subAlert,
		Title:    "Race Finished",
		Message:  fmt.Sprintf("Chequered flag, P%d: %s. Cool-down lap, then bring the car to parc fermé.", pos, result),
		Urgency:  UrgencyLow,
		Values:   &DirectiveValues{Position: pos},
	}
}

// holdDirectiveLocked keeps a call a passing gate blocked, so it is said once the radio is free
// instead of being lost. A newer call for the same alert key replaces it: it is what is true now.
func (e *EngineerEngine) holdDirectiveLocked(d Directive, alertKey string) {
	now := e.nowMs()
	heldAt, lap := now, e.playerPos.lap
	if prev, ok := e.pending[alertKey]; ok {
		heldAt, lap = prev.heldAt, prev.lap
	}
	e.pending[alertKey] = pendingDirective{
		directive: d,
		alertKey:  alertKey,
		heldAt:    heldAt,
		expiresAt: now + e.maxDelayMs(alertKey),
		lap:       lap,
	}
}

// releasePendingLocked says the held calls the gates now let through, oldest first, and forgets
// the ones that went stale or that the gates now turn down for good (phase, switch, dedup).
func (e *EngineerEngine) releasePendingLocked(header packets.PacketHeader) []Directive {
	if len(e.pending) == 0 {
		return nil
	}
	held := make([]pendingDirective, 0, len(e.pending))
	for _, p := range e.pending {
		held = append(held, p)
	}
	sort.Slice(held, func(i, j int) bool {
		if held[i].heldAt != held[j].heldAt {
			return held[i].heldAt < held[j].heldAt
		}
		return held[i].alertKey < held[j].alertKey
	})

	now := e.nowMs()
	var released []Directive
	for _, p := range held {
		if now > p.expiresAt || (e.alertRules[p.alertKey].LapBound && e.playerPos.lap != p.lap) {
			delete(e.pending, p.alertKey)
			continue
		}
		switch e.gateDirectiveLocked(p.alertKey, string(p.directive.Category), p.directive.Urgency) {
		case gateEmit:
			if e.waitForLineLocked(p.directive, p.alertKey) {
				continue
			}
			released = append(released, e.emitDirectiveLocked(header, p.directive, p.alertKey, now-p.heldAt))
		case gateDrop:
			delete(e.pending, p.alertKey)
		case gateHold:
		}
	}
	return released
}

func (e *EngineerEngine) maxDelayMs(alertKey string) int64 {
	if rule, ok := e.alertRules[alertKey]; ok && rule.MaxDelayMs > 0 {
		return rule.MaxDelayMs
	}
	return DefaultMaxDelayMs
}

func (e *EngineerEngine) minRepeatMs(alertKey string) int64 {
	if rule, ok := e.alertRules[alertKey]; ok && rule.MinRepeatMs > 0 {
		return rule.MinRepeatMs
	}
	return DefaultMinRepeatMs
}

// speechTTLMs is how long a dashboard may keep the call queued behind other speech: what is left
// of the call's useful life, capped so a call never plays long after its moment.
func (e *EngineerEngine) speechTTLMs(alertKey string, heldForMs int64) int64 {
	return max(min(e.maxDelayMs(alertKey)-heldForMs, MaxSpeechTTLMs), MinSpeechTTLMs)
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
	// 1. Red Flag session halt, until the restart
	if e.redFlagActive {
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
		// The start's radio silence covers the launch and the first corners, not the whole lap.
		if e.raceStarted && playerLap.CurrentLapNum == 1 && playerLap.LapDistance < RaceStartPhaseDistanceM {
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

	// 10. Racing. A race lap is racing whatever the game calls it (a "flying lap" included).
	if session != nil && packets.IsRaceSession(session.SessionType) {
		return PhaseRacing
	}

	// 11. Flying Lap
	if playerLap != nil && playerLap.DriverStatus == packets.DriverStatusFlyingLap {
		return PhaseFlyingLap
	}

	// 12. Practice and qualifying: on track but not on a timed lap, so not pushing, like an out-lap.
	if session != nil && (packets.IsQualifyingSession(session.SessionType) || packets.IsPracticeSession(session.SessionType)) &&
		playerLap != nil && playerLap.DriverStatus == packets.DriverStatusOnTrack {
		return PhaseOutLap
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

	now := e.nowMs()
	cooldownMs := int64(e.config.ChatterCooldownMs)
	if cooldownMs <= 0 {
		cooldownMs = DefaultDirectiveCooldownMs
	}

	lastTime, exists := e.lastDirectives[category]
	return exists && now-lastTime < cooldownMs
}

// gateDirectiveLocked runs a call through the radio gates. Gates that say the call is wrong here
// (switch, phase, dedup, repeat) drop it; gates that only say "not right now" (pause, braking or
// steering, category cooldown, radio spacing) hold it so it is said once the radio is free.
func (e *EngineerEngine) gateDirectiveLocked(alertKey, category, urgency string) gateDecision {
	isCritical := urgency == UrgencyCritical || urgency == UrgencyHigh

	// 0. Subsystem & sub-alert enable check
	if !e.config.IsAlertEnabled(category, alertKey) {
		return gateDrop
	}

	// 1-2. Radio silence on the grid, at the race start and on a flying lap: only emergencies
	// (UrgencyCritical) and the calls that must break it (BreaksRadioSilence: a yellow flag, a
	// deleted lap, a slow car ahead).
	silent := e.currentPhase == PhaseGrid || e.currentPhase == PhaseRaceStart || e.currentPhase == PhaseFlyingLap
	if silent && urgency != UrgencyCritical && !e.alertRules[alertKey].BreaksRadioSilence {
		return gateDrop
	}

	// 4. Time Trial session integrity:
	// In Time Trial mode, suppress race-specific categories (fuel, pit strategy, rivals, teammate).
	if e.latestSession != nil && e.latestSession.SessionType == packets.SessionTimeTrial {
		if category == string(DirectiveCategoryFuel) || category == string(DirectiveCategoryPitStrategy) || category == string(DirectiveCategoryRivals) || category == string(DirectiveCategoryTeammate) {
			return gateDrop
		}
	}

	// 5. Driving phase rule validation
	if !e.isPhaseAllowed(alertKey) {
		return gateDrop
	}

	// 6. Deduplication check
	if e.isDeduplicated(alertKey, isCritical) {
		return gateDrop
	}

	// 6b. A stop to come is moot once the driver was told to box.
	if e.boxDueLap != 0 && e.alertRules[alertKey].NotWhileBoxDue {
		return gateDrop
	}

	// 7. Repeat limit, at every urgency: a call never repeats within its MinRepeatMs (a crash's
	// several collision events, a flickering blue flag, an engine that stays hot).
	now := e.nowMs()
	if last, said := e.lastDirectives[alertKey]; said && now-last < e.minRepeatMs(alertKey) {
		return gateDrop
	}

	// 8. Pit box & pit limiter: while stationary in the box or on the limiter, non-critical calls
	// wait for the pit exit. Flags, weather and the pit lane's own calls (stop time, penalty) don't.
	playerLap := e.getPlayerLapDataLocked()
	playerStatus := e.getPlayerCarStatusLocked()
	isPitLimiterActive := playerStatus != nil && playerStatus.PitLimiterStatus == 1
	isPitBoxActive := playerLap != nil && playerLap.PitStatus == packets.PitStatusInPitArea
	if (isPitLimiterActive || isPitBoxActive) && urgency != UrgencyCritical && category != string(DirectiveCategoryFlags) &&
		category != string(DirectiveCategoryWeather) && category != string(DirectiveCategoryPitStrategy) {
		return gateHold
	}

	// 9. Paused game: say it once the game runs again
	if e.isGamePaused(isCritical) {
		return gateHold
	}

	// 10. Smart Driving Discretion: say it once the driver is off the brakes and straight
	if e.isSmartDiscretionSuppressed(isCritical) {
		return gateHold
	}

	// 11. Per-category chatter cooldown check
	if !e.alertRules[alertKey].SkipCategoryCooldown && e.isChatterCooldownActive(category, isCritical) {
		return gateHold
	}

	// 12. Global radio chatter spacing:
	// Prevent firing directives from different categories back-to-back within GlobalChatterCooldownMs.
	if !isCritical && e.config.GlobalChatterCooldownMs > 0 && (now-e.lastGlobalDirectiveTime) < e.config.GlobalChatterCooldownMs {
		return gateHold
	}

	return gateEmit
}

// emitDirectiveLocked records a call as said and stamps it for the wire. heldForMs is how long a
// passing gate held it back (0 for a fresh call).
func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive Directive, alertKey string, heldForMs int64) Directive {
	now := e.nowMs()
	category := string(directive.Category)

	e.lastDirectives[category] = now
	e.lastDirectives[alertKey] = now
	e.lastGlobalDirectiveTime = now
	delete(e.pending, alertKey)

	currentLapNum := 1
	if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
		currentLapNum = int(pLap.CurrentLapNum)
	}
	e.callLaps[alertKey] = currentLapNum
	if rule, hasRule := e.alertRules[alertKey]; hasRule {
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
	directive.Type = DirectiveMessageType
	directive.Timestamp = now
	directive.TTLMs = e.speechTTLMs(alertKey, heldForMs)
	e.setBoxTimingLocked(&directive)
	if directive.SubAlert == "" {
		directive.SubAlert = alertKey
	}
	if directive.CarIndex == 0 && header.PlayerCarIndex != 0 {
		directive.CarIndex = int(header.PlayerCarIndex)
	}
	if directive.SessionTime == 0 {
		directive.SessionTime = header.SessionTime
	}

	e.recordRadioCallLocked(directive)
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
	attrs := []any{"category", string(directive.Category), "subAlert", directive.SubAlert, "urgency", string(directive.Urgency), "message", directive.Message}
	if directive.Box != "" {
		attrs = append(attrs, "box", string(directive.Box))
	}
	slog.Info("Proactive directive emitted", attrs...)
	broadcaster.Broadcast(data)
}
