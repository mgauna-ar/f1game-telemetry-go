package engineer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"slices"
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
	lastStintLapAge       int
	stintStartedAt        int64 // unix ms the current stint started; 0 before the first
	startLightsActive     bool
	raceStarted           bool
	chequeredFlagReceived bool
	postRaceAnnounced     bool
	finishedAt            int64 // unix ms the player was first seen finished; 0 before
	phaseStartedAt        int64 // unix ms the current driving phase started
	// radioBusyUntil is when the radio is free for a routine call: the last call said, its
	// speech and the gap after it (and a breather after a critical call).
	radioBusyUntil int64
	// The session clock: the session time last seen running and when, whether it ran this
	// session, and whether it stands still now (a pause).
	clockSessionTime float32
	clockSeenAt      int64
	clockRuns        bool
	clockStill       bool
	// classification is the race's final classification, once the game sends it.
	classification *packets.PacketFinalClassificationData

	// Calls a passing gate (braking, radio spacing, cooldown, pause) held back, by alert key, and
	// how many were held this session (their order).
	pending     map[string]pendingDirective
	pendingSeen uint64

	// What was learned about each track (pit lane, quiet stretches), kept across sessions.
	profiles *trackProfiles
	// motion is how each car moved over the last seconds, for the qualifying traffic calls.
	motion carMotion
	// raceSpeeds is how fast the field runs round the lap in this race, for the slow car calls.
	raceSpeeds raceSpeeds

	// Box calls: where the player is, calls to box waiting for the line, and the lap a call told
	// the player to box on (0: none).
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

	// radioWording is whether the AI may word routine calls: switched on in the voice settings,
	// with an AI provider ready to answer (SetRadioWording).
	radioWording bool
	// delivery is what the dashboards reported about delivering the calls (RecordRadioHeard). A
	// session reset keeps it.
	delivery radioDelivery

	// now returns the current time; tests replace it.
	now func() time.Time
}

// pendingDirective is a call a passing gate held back until the radio is free.
type pendingDirective struct {
	directive Directive
	alertKey  string
	heldAt    int64  // unix ms the call was first held
	seq       uint64 // order it was first held in, for calls held the same millisecond
	clockFrom int64  // unix ms its useful life started: when it was last made, or when radio silence ended
	waitFrom  int64  // unix ms it started waiting for the radio: when first held, or when radio silence ended
	expiresAt int64  // unix ms after which it is no longer worth saying
	lap       int    // the player's lap when it was first held
}

// gateDecision is what the radio gates decide for a call.
type gateDecision int

const (
	gateEmit        gateDecision = iota
	gateHold                     // only a passing gate is in the way: braking, radio spacing, cooldown or pause
	gateHoldSilence              // radio silence is in the way of a call that outlasts it (OutlastsSilence)
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
		profiles:         newTrackProfiles(),
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
		NewStrategyNewsRule(),
		NewPitPlanRule(),
		NewRivalsRule(),
		NewCoachingRule(),
		NewQualifyingRule(),
		NewFlagsRule(),
		NewTeammateRule(),
		NewTrafficRule(),
		NewRaceTrafficRule(),
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

// SetRadioWording says whether the AI may word routine calls: AI wording is on and the AI
// provider has what it needs (a key, or a custom server's address).
func (e *EngineerEngine) SetRadioWording(on bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.radioWording = on
}

// wordableLocked reports whether the AI may word a call that stays worth saying for ttlMs: a
// routine call, while AI wording is on. Calls said at a moment (a battle, a sector time, an aero
// zone) go stale before a line comes, and box calls are left out by the caller. Must hold e.mu.
func (e *EngineerEngine) wordableLocked(urgency string, ttlMs int64) bool {
	return e.radioWording && !isUrgent(urgency) && ttlMs >= RadioLineMinTTLMs
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
	e.stintStartedAt = 0
	e.startLightsActive = false
	e.raceStarted = false
	e.chequeredFlagReceived = false
	e.postRaceAnnounced = false
	e.finishedAt = 0
	e.classification = nil
	e.phaseStartedAt = 0
	e.radioBusyUntil = 0
	e.clockSessionTime, e.clockSeenAt, e.clockRuns, e.clockStill = 0, 0, false, false
	e.profiles.resetSession()
	e.motion = carMotion{}
	e.raceSpeeds = raceSpeeds{}
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
	e.trackSessionClockLocked(header.SessionTime)

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
		case packets.EventFlashback:
			// The driver went back in time: calls held or waiting for the line are about a moment
			// that no longer happened.
			e.pending = make(map[string]pendingDirective)
			e.lineWait = make(map[string]lineWaitDirective)
			e.profiles.spoilQuietLap()
			e.motion.reset()
			e.raceSpeeds.dropPasses()
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
		e.detectStintStartLocked(p)
		e.recordLapTransitionsLocked(p)
		e.profiles.learnPitLane(e.latestSession, e.latestLapData, p)
		if e.playerCarIndex >= 0 && e.playerCarIndex < len(p.LapData) {
			e.profiles.endQuietLap(int(p.LapData[e.playerCarIndex].CurrentLapNum))
		}
		e.pitEntries = pitLaneEntries(e.latestLapData, p)
		if s := e.latestSession; s != nil {
			trackLen := float32(s.TrackLength)
			// Push speeds are learned in timed sessions only: in a race, the cars marked on a push
			// lap may be behind a Safety Car, starting, or crawling back. The race speeds are
			// learned from every car racing, with no Safety Car and no yellow flag where it is.
			learn := e.profiles.pushSteps(s.TrackId, trackLen)
			if packets.IsRaceSession(s.SessionType) {
				learn = e.raceSpeeds.steps(s, trackLen)
			}
			e.motion.sample(p, header.SessionTime, trackLen, learn)
			if e.playerCarIndex >= 0 && e.playerCarIndex < len(p.LapData) {
				e.profiles.savePushSpeeds(int(p.LapData[e.playerCarIndex].CurrentLapNum))
			}
		}
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
				e.startStintLocked("tyre age reset")
			}
			e.lastStintLapAge = currentTyreAge
		}
	case *packets.PacketCarTelemetryData:
		e.latestTelemetry = p
		e.sampleQuietLocked()
	case *packets.PacketCarTelemetry2Data:
		e.latestTelemetry2 = p
	case *packets.PacketTyreSetsData:
		if int(p.CarIdx) == e.playerCarIndex {
			if e.latestTyreSets != nil && p.FittedIdx != e.latestTyreSets.FittedIdx {
				e.startStintLocked("new tyre set fitted")
			}
			e.latestTyreSets = p
		}
	case *packets.PacketSessionHistoryData:
		if int(p.CarIdx) < len(e.history.carHistory) {
			e.history.carHistory[p.CarIdx] = p
		}
	case *packets.PacketFinalClassificationData:
		e.classification = p
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
		ChequeredFlag:    e.chequeredFlagReceived,
		TrackProfile:     e.trackProfileLocked(),
		LastSaid:         e.lastDirectives,
		Motion:           &e.motion,
		RaceSpeeds:       &e.raceSpeeds,
		DeliveryLeadMs:   e.delivery.leadMs(),
	}
	if _, ok := pkt.(*packets.PacketLapData); ok {
		ctx.PitEntries = e.pitEntries
	}
	return ctx
}

// detectStintStartLocked starts a stint when the player stops in the pits, or leaves the garage
// for a new run in practice or qualifying.
func (e *EngineerEngine) detectStintStartLocked(next *packets.PacketLapData) {
	before := e.getPlayerLapDataLocked()
	if before == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(next.LapData) {
		return
	}
	after := next.LapData[e.playerCarIndex]
	switch {
	case after.NumPitStops > before.NumPitStops:
		e.startStintLocked("pit stop")
	case before.DriverStatus == packets.DriverStatusInGarage && after.DriverStatus != packets.DriverStatusInGarage:
		e.startStintLocked("left the garage")
	}
}

// startStintLocked re-arms the calls said once a stint (wear, damage, temperatures) for a new set
// of tyres. One stop sends several signals (stop count, new set, tyre age), so a stint started
// less than StintResetMinGapMs ago isn't started again.
func (e *EngineerEngine) startStintLocked(reason string) {
	now := e.nowMs()
	if e.stintStartedAt != 0 && now-e.stintStartedAt < StintResetMinGapMs {
		return
	}
	e.stintStartedAt = now
	e.stintKeys = make(map[string]bool)
	for _, r := range e.rules {
		r.Reset(DedupScopeStint)
	}
	slog.Debug("Engineer stint started", "reason", reason)
}

// trackProfileLocked is what was learned about the session's track, or nil.
func (e *EngineerEngine) trackProfileLocked() *trackProfile {
	if e.latestSession == nil {
		return nil
	}
	return e.profiles.profile(e.latestSession.TrackId)
}

// pitEntryLocked is the learned pit entry of the session's track, or 0 while unknown.
func (e *EngineerEngine) pitEntryLocked() float32 {
	return e.trackProfileLocked().entry()
}

// sampleQuietLocked samples the player's driving for the track's quiet stretches, at racing pace
// only: a race lap or a push lap (not under a Safety Car, that is its own phase), out of the pit
// lane.
func (e *EngineerEngine) sampleQuietLocked() {
	s, lap, tele := e.latestSession, e.getPlayerLapDataLocked(), e.getPlayerTelemetryLocked()
	if s == nil || lap == nil || tele == nil || s.TrackId < 0 || s.TrackLength == 0 {
		return
	}
	if (e.currentPhase != PhaseRacing && e.currentPhase != PhaseFlyingLap) || lap.PitStatus != packets.PitStatusNone {
		return
	}
	e.profiles.sampleQuiet(s.TrackId, float32(s.TrackLength), int(lap.CurrentLapNum), lap.LapDistance, tele)
}

// trackSessionClockLocked notices the game standing still: a pause stops the session clock, and
// offline the packets may stop too. Held calls don't age while it stands still: once it runs
// again their clocks move on by the time it stood. A clock never seen running (a test's fixed
// session time) is never taken for a pause.
func (e *EngineerEngine) trackSessionClockLocked(sessionTime float32) {
	now := e.nowMs()
	switch {
	case e.clockSeenAt == 0 || sessionTime < e.clockSessionTime:
		// The first packet, or the clock went back (a flashback, a restart).
		e.clockSessionTime, e.clockSeenAt, e.clockStill = sessionTime, now, false
	case sessionTime > e.clockSessionTime:
		still := now - e.clockSeenAt - int64(float64(sessionTime-e.clockSessionTime)*1000)
		if still >= PauseDetectMs {
			e.shiftHeldCallsLocked(still)
		}
		e.clockRuns = true
		e.clockSessionTime, e.clockSeenAt, e.clockStill = sessionTime, now, false
	default:
		e.clockStill = e.clockRuns && now-e.clockSeenAt >= PauseDetectMs
	}
}

// shiftHeldCallsLocked moves the clocks of the held calls on by ms, the time the game stood still.
func (e *EngineerEngine) shiftHeldCallsLocked(ms int64) {
	for key, p := range e.pending {
		p.heldAt += ms
		p.clockFrom += ms
		p.waitFrom += ms
		p.expiresAt += ms
		e.pending[key] = p
	}
	slog.Debug("Engineer paused, held calls kept", "pausedMs", ms, "held", len(e.pending))
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
		if pos, ok := e.finishPositionLocked(); ok {
			e.postRaceAnnounced = true
			prepared := e.emitDirectiveLocked(ctx.Header, e.raceFinishDirectiveLocked(pos), "race_finish", 0)
			emittedDirectives = append(emittedDirectives, prepared)
		}
	}

	e.updatePlayerPositionLocked(ctx)
	e.releaseLineWaitLocked()
	// Urgent calls have the radio first: the held ones, then this packet's. Routine calls, held or
	// new, are said after them, oldest first, so one never goes out just before a Safety Car call.
	emittedDirectives = append(emittedDirectives, e.releasePendingLocked(ctx.Header, true)...)
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
			switch e.gateDirectiveLocked(alertKey, cat, d.Urgency, 0) {
			case gateEmit:
				if !isUrgent(d.Urgency) {
					e.holdDirectiveLocked(d, alertKey) // said below, in turn
					continue
				}
				if e.waitForLineLocked(d, alertKey) {
					continue
				}
				prepared := e.emitDirectiveLocked(ctx.Header, d, alertKey, 0)
				emittedDirectives = append(emittedDirectives, prepared)
			case gateHold, gateHoldSilence:
				e.holdDirectiveLocked(d, alertKey)
			case gateDrop:
			}
		}
	}
	emittedDirectives = append(emittedDirectives, e.releasePendingLocked(ctx.Header, false)...)

	return append(emittedDirectives, e.pitEntryReminderLocked(ctx.Header)...)
}

// finishPositionLocked is where the player finished the race, once they have: the final
// classification's place when it came. A time penalty only counts in the classification, so with
// one the call waits up to FinishClassificationWaitMs for it before going by the track position.
func (e *EngineerEngine) finishPositionLocked() (int, bool) {
	playerLap := e.getPlayerLapDataLocked()
	if playerLap == nil || playerLap.ResultStatus != packets.ResultStatusFinished {
		return 0, false
	}
	now := e.nowMs()
	if e.finishedAt == 0 {
		e.finishedAt = now
	}
	if c := e.classification; c != nil && e.playerCarIndex < len(c.ClassificationData) {
		if pos := int(c.ClassificationData[e.playerCarIndex].Position); pos > 0 {
			return pos, true
		}
	}
	if playerLap.Penalties > 0 && now-e.finishedAt < FinishClassificationWaitMs {
		return 0, false
	}
	return int(playerLap.CarPosition), true
}

// raceFinishDirectiveLocked is the chequered flag call for a finish in position pos: a win, a
// podium, points or none.
func (e *EngineerEngine) raceFinishDirectiveLocked(pos int) Directive {
	pointsPositions := RacePointsPositions
	if isSprintRace(e.latestSession) {
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
	e.pendingSeen++
	heldAt, seq, waitFrom, lap := now, e.pendingSeen, now, e.playerPos.lap
	if prev, ok := e.pending[alertKey]; ok {
		heldAt, seq, waitFrom, lap = prev.heldAt, prev.seq, prev.waitFrom, prev.lap
	}
	e.pending[alertKey] = pendingDirective{
		directive: d,
		alertKey:  alertKey,
		heldAt:    heldAt,
		seq:       seq,
		clockFrom: now,
		waitFrom:  waitFrom,
		expiresAt: now + e.maxDelayMs(alertKey),
		lap:       lap,
	}
}

// releasePendingLocked says the held calls the gates now let through, oldest first, and forgets
// the ones that went stale or that the gates now turn down for good (phase, switch, dedup). A call
// waiting out radio silence doesn't age until the silence ends, for at most SilenceMaxHoldMs.
// With urgentOnly, only the urgent calls are looked at.
func (e *EngineerEngine) releasePendingLocked(header packets.PacketHeader, urgentOnly bool) []Directive {
	if len(e.pending) == 0 {
		return nil
	}
	held := make([]pendingDirective, 0, len(e.pending))
	for _, p := range e.pending {
		if !urgentOnly || isUrgent(p.directive.Urgency) {
			held = append(held, p)
		}
	}
	sort.Slice(held, func(i, j int) bool {
		if held[i].heldAt != held[j].heldAt {
			return held[i].heldAt < held[j].heldAt
		}
		return held[i].seq < held[j].seq
	})

	now := e.nowMs()
	var released []Directive
	for _, p := range held {
		// A held call doesn't go stale while the game stands still.
		stale := now > p.expiresAt && !e.clockStill
		if stale || (e.alertRules[p.alertKey].LapBound && e.playerPos.lap != p.lap) {
			delete(e.pending, p.alertKey)
			continue
		}
		switch e.gateDirectiveLocked(p.alertKey, string(p.directive.Category), p.directive.Urgency, now-p.waitFrom) {
		case gateEmit:
			if e.waitForLineLocked(p.directive, p.alertKey) {
				continue
			}
			released = append(released, e.emitDirectiveLocked(header, p.directive, p.alertKey, now-p.clockFrom))
		case gateHoldSilence:
			if now-p.heldAt > SilenceMaxHoldMs {
				delete(e.pending, p.alertKey)
				continue
			}
			p.clockFrom, p.waitFrom, p.expiresAt = now, now, now+e.maxDelayMs(p.alertKey)
			e.pending[p.alertKey] = p
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

// speechMs is about how long the call takes to say.
func (e *EngineerEngine) speechMs(alertKey string) int64 {
	if rule, ok := e.alertRules[alertKey]; ok && rule.SpeechMs > 0 {
		return rule.SpeechMs
	}
	return DefaultSpeechMs
}

// cooldownKey is the chatter cooldown a call starts and waits for: its cooldown group, else its
// category.
func (e *EngineerEngine) cooldownKey(alertKey, category string) string {
	if group := e.alertRules[alertKey].CooldownGroup; group != "" {
		return group
	}
	return category
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
		e.phaseStartedAt = e.nowMs()
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

// isGamePaused reports whether the game is paused: the session says so (online), or its clock
// stands still (offline).
func (e *EngineerEngine) isGamePaused(isCritical bool) bool {
	paused := e.clockStill || (e.latestSession != nil && e.latestSession.GamePaused == 1)
	return paused && !isCritical
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

// discretionHoldLocked reports whether a routine call waits for a better moment to be said. Once
// the track's quiet stretches are learned, it waits until its speech would start on one long
// enough to say it, for up to QuietWaitShare of its useful life (waitedMs is how long it waited
// so far). Before that, and after, it waits only while the driver brakes or steers hard. A call
// that must break radio silence is said at once.
func (e *EngineerEngine) discretionHoldLocked(alertKey, urgency string, waitedMs int64) bool {
	if isUrgent(urgency) || !e.config.SmartDiscretionEnabled {
		return false
	}
	waitLimit := int64(QuietWaitShare * float64(e.maxDelayMs(alertKey)))
	if !e.alertRules[alertKey].BreaksRadioSilence && waitedMs < waitLimit {
		// A call the AI words is spoken once its line comes, so it looks that much further ahead.
		lead := int64(RadioDeliveryLatencyMs)
		if e.wordableLocked(urgency, e.speechTTLMs(alertKey, waitedMs)) {
			lead += RadioLineLeadMs
		}
		if runway, ok := e.quietRunwayLocked(lead); ok {
			return runway < e.speechMs(alertKey)
		}
	}
	playerTele := e.getPlayerTelemetryLocked()
	return playerTele != nil && (playerTele.Brake > SmartDiscretionBrakeThreshold ||
		math.Abs(float64(playerTele.Steer)) > SmartDiscretionSteerThreshold)
}

// quietRunwayLocked is how long the player stays on a quiet stretch once speech starts leadMs
// from now. ok is false when the track's quiet stretches don't apply: not learned yet, or the
// player isn't at racing pace (Safety Car, out-lap, pit lane).
func (e *EngineerEngine) quietRunwayLocked(leadMs int64) (int64, bool) {
	if (e.currentPhase != PhaseRacing && e.currentPhase != PhaseFlyingLap) || !e.playerPos.known || e.playerPos.inPitLane {
		return 0, false
	}
	return e.trackProfileLocked().quietRunwayMs(e.playerPos.lapDistance, leadMs)
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
// (switch, phase, dedup, repeat) drop it; gates that only say "not right now" (pause, a Safety Car
// just out, braking or not on a straight, category cooldown, the radio busy) hold it so it is said
// once the radio is free. waitedMs is how long the call has waited so far (0 for a fresh one).
func (e *EngineerEngine) gateDirectiveLocked(alertKey, category, urgency string, waitedMs int64) gateDecision {
	isCritical := urgency == UrgencyCritical || urgency == UrgencyHigh
	cfg := e.alertRules[alertKey]

	// 0. Subsystem & sub-alert enable check
	if !e.config.IsAlertEnabled(category, alertKey) {
		return gateDrop
	}

	// 1-2. Radio silence on the grid, at the race start and on a flying lap: only emergencies
	// (UrgencyCritical) and the calls that must break it (BreaksRadioSilence: a yellow flag, a
	// deleted lap, a slow car ahead). A condition of the car waits it out (OutlastsSilence).
	silenced := false
	silent := e.currentPhase == PhaseGrid || e.currentPhase == PhaseRaceStart || e.currentPhase == PhaseFlyingLap
	if silent && urgency != UrgencyCritical && !cfg.BreaksRadioSilence {
		if !cfg.OutlastsSilence {
			return gateDrop
		}
		silenced = true
	}

	// 4. Time Trial session integrity:
	// In Time Trial mode, suppress race-specific categories (fuel, pit strategy, rivals, teammate).
	if e.latestSession != nil && e.latestSession.SessionType == packets.SessionTimeTrial {
		if category == string(DirectiveCategoryFuel) || category == string(DirectiveCategoryPitStrategy) || category == string(DirectiveCategoryRivals) || category == string(DirectiveCategoryTeammate) {
			return gateDrop
		}
	}

	// 5. Driving phase rule validation. A condition of the car outlasts a phase that passes with
	// the radio silence (the grid, the start, a flying lap, the formation lap).
	if !e.isPhaseAllowed(alertKey) {
		if !cfg.OutlastsSilence || !passesWithSilence(e.currentPhase) || slices.Contains(cfg.ValidPhases, e.currentPhase) {
			return gateDrop
		}
		silenced = true
	}

	// 6. Deduplication check
	if e.isDeduplicated(alertKey, isCritical) {
		return gateDrop
	}

	// 6b. A stop to come is moot once the driver was told to box.
	if e.boxDueLap != 0 && cfg.NotWhileBoxDue {
		return gateDrop
	}

	// 7. Repeat limit, at every urgency: a call never repeats within its MinRepeatMs (a crash's
	// several collision events, a flickering blue flag, an engine that stays hot).
	now := e.nowMs()
	if last, said := e.lastDirectives[alertKey]; said && now-last < e.minRepeatMs(alertKey) {
		return gateDrop
	}
	if silenced {
		return gateHoldSilence
	}

	// 8. Pit box & pit limiter: while stationary in the box or on the limiter, non-critical calls
	// wait for the pit exit. Flags, weather and the pit lane's own calls (stop time, penalty) don't.
	playerLap := e.getPlayerLapDataLocked()
	playerStatus := e.getPlayerCarStatusLocked()
	isPitLimiterActive := playerStatus != nil && playerStatus.PitLimiterStatus == 1
	isPitBoxActive := playerLap != nil && playerLap.PitStatus == packets.PitStatusInPitArea
	if (isPitLimiterActive || isPitBoxActive) && urgency != UrgencyCritical && !cfg.PitLaneCall && category != string(DirectiveCategoryFlags) &&
		category != string(DirectiveCategoryWeather) && category != string(DirectiveCategoryPitStrategy) {
		return gateHold
	}

	// 9. Paused game: say it once the game runs again
	if e.isGamePaused(isCritical) {
		return gateHold
	}

	// 9b. A Safety Car just out: its own calls (the flag, the fuel mix, the stop) come first.
	if cfg.WaitsForSCToSettle && e.currentPhase == PhaseSafetyCar && now-e.phaseStartedAt < SCColdCallDelayMs {
		return gateHold
	}

	// 10. Smart Driving Discretion: say it on a straight, or at least off the brakes and straight
	if e.discretionHoldLocked(alertKey, urgency, waitedMs) {
		return gateHold
	}

	// 11. Per-category chatter cooldown check
	if !cfg.SkipCategoryCooldown && e.isChatterCooldownActive(e.cooldownKey(alertKey, category), isCritical) {
		return gateHold
	}

	// 12. The radio is busy: the last call is still being said, or a critical call needs a
	// breather after it. Urgent calls go at once; the dashboard cuts routine speech for them.
	if !isCritical && e.config.GlobalChatterCooldownMs > 0 && now < e.radioBusyUntil {
		return gateHold
	}

	return gateEmit
}

// passesWithSilence reports whether a phase passes with the radio silence around it: the
// formation lap, the grid, the start and a flying lap.
func passesWithSilence(phase DrivingPhase) bool {
	return phase == PhaseFormationLap || phase == PhaseGrid || phase == PhaseRaceStart || phase == PhaseFlyingLap
}

// emitDirectiveLocked records a call as said and stamps it for the wire. heldForMs is how long a
// passing gate held it back (0 for a fresh call).
func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive Directive, alertKey string, heldForMs int64) Directive {
	now := e.nowMs()
	category := string(directive.Category)

	e.lastDirectives[e.cooldownKey(alertKey, category)] = now
	e.lastDirectives[alertKey] = now
	directive.TTLMs = e.speechTTLMs(alertKey, heldForMs)
	directive.Wordable = directive.BoxCall == BoxCallNone && e.wordableLocked(directive.Urgency, directive.TTLMs)
	busyUntil := now + RadioDeliveryLatencyMs + e.speechMs(alertKey) + e.config.GlobalChatterCooldownMs
	if directive.Wordable {
		busyUntil += RadioLineLeadMs
	}
	if directive.Urgency == UrgencyCritical {
		busyUntil += CriticalBreatherMs
	}
	e.radioBusyUntil = max(e.radioBusyUntil, busyUntil)
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

	directive.ID = fmt.Sprintf("%s%d_%s", directiveIDPrefix, now, alertKey)
	directive.Type = DirectiveMessageType
	directive.Timestamp = now
	if e.playerPos.known {
		directive.lapDistance = e.playerPos.lapDistance
	}
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
	if directive.lapDistance > 0 {
		attrs = append(attrs, "lapDistance", int(directive.lapDistance))
	}
	if directive.Box != "" {
		attrs = append(attrs, "box", string(directive.Box))
	}
	if directive.Wordable {
		attrs = append(attrs, "wordable", true)
	}
	slog.Info("Proactive directive emitted", attrs...)
	broadcaster.Broadcast(data)
}

// isSprintRace reports whether the session is a sprint. F1 25 sends no sprint session type: a
// sprint weekend runs two races, and the sprint is the first, when the game gives the two
// different race types. When it gives both the same, it is taken for a Grand Prix.
func isSprintRace(s *packets.PacketSessionData) bool {
	if s == nil {
		return false
	}
	if s.SessionType == packets.SessionSprintRace || s.SessionType == packets.SessionEqualSprintRace {
		return true
	}
	var races []uint8
	for i := 0; i < int(s.NumSessionsInWeekend) && i < len(s.WeekendStructure); i++ {
		if t := s.WeekendStructure[i]; packets.IsRaceSession(t) {
			races = append(races, t)
		}
	}
	return len(races) >= 2 && s.SessionType == races[0] && races[0] != races[len(races)-1]
}
