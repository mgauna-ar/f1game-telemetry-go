package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// EngineerDirectiveCategory represents categories of proactive intelligence.
type EngineerDirectiveCategory string

const (
	DirectiveCategoryPitStrategy EngineerDirectiveCategory = "pit_strategy"
	DirectiveCategoryCoaching    EngineerDirectiveCategory = "coaching"
	DirectiveCategoryWeather     EngineerDirectiveCategory = "weather"
	DirectiveCategoryTeammate    EngineerDirectiveCategory = "teammate"
	DirectiveCategoryTyres       EngineerDirectiveCategory = "tyres"
	DirectiveCategoryDamage      EngineerDirectiveCategory = "damage"
	DirectiveCategoryERS         EngineerDirectiveCategory = "ers"
	DirectiveCategoryBrakes      EngineerDirectiveCategory = "brakes"
	DirectiveCategoryFuel        EngineerDirectiveCategory = "fuel"
	DirectiveCategoryRivals      EngineerDirectiveCategory = "rivals"
	DirectiveCategoryQualifying  EngineerDirectiveCategory = "qualy"
	DirectiveCategoryFlags       EngineerDirectiveCategory = "flags"
)

// Urgency levels for directives
const (
	UrgencyLow      = "low"
	UrgencyMedium   = "medium"
	UrgencyHigh     = "high"
	UrgencyCritical = "critical"
)

// Analytical thresholds and timing constants for Engineer Directive Engine
const (
	DefaultPitLaneLossSeconds      = 21.0
	CleanAirTrafficWindowSeconds   = 3.0
	SectorTimeLossThresholdSec     = 0.35
	TeammateGapThresholdSec        = 2.5
	DefaultDirectiveCooldownMs     = 45_000
	WeatherRainTransitionProbPct   = 50
	WeatherRainHorizonMinutes      = 5
	PunctureWearThresholdPct       = 95.0
	CriticalWingDamageThresholdPct = 40.0
	OverheatRearTyres2025C         = 115.0
	OverheatRearTyres2026C         = 110.0
	ColdTyresTargetC               = 85.0
	EngineOverheatDefaultC         = 125.0
	BrakeOverheatDefaultC          = 900.0
	BrakeColdDefaultC              = 200.0
	FuelDeltaDeficitDefaultLaps    = -0.5
	UndercutGapDefaultSec          = 2.5
	RivalDefendGapDefaultSec       = 1.0
	RivalAttackGapDefaultSec       = 1.2
	QualyCleanAirDefaultSec        = 4.0
	QualyTimeWarnDefaultSec        = 180.0
	QualyElimDangerTimeSec         = 300.0
	CornerCutWarnDefaultThreshold  = 2
	SmartDiscretionBrakeThreshold  = 0.50
	SmartDiscretionSteerThreshold  = 0.45
	MinOutLapDistanceCompletionPct = 0.30
	MinQualyOutLapDistancePct      = 0.50
	PostPitSuppressionLaps         = 1
	AverageRaceSpeedMetersPerSec   = 65.0
	QualyOutLapSpeedMetersPerSec   = 60.0
	SpeedGarageMaxKmh              = 5.0
	MaxCleanAirDistanceMeters      = 9000.0
	EngineOverheatCooldownMs       = 60_000
	BrakeOverheatCooldownMs        = 45_000
	BrakeColdCooldownMs            = 60_000
	RivalDamageWingThresholdPct    = 20.0
	MaxTrackDistanceDeltaInitial   = 99999.0
)

// DrivingPhase represents the real-time operational context of the driver.
type DrivingPhase string

const (
	PhaseRedFlag      DrivingPhase = "RED_FLAG"
	PhaseInGarage     DrivingPhase = "IN_GARAGE"
	PhasePitLane      DrivingPhase = "PIT_LANE"
	PhaseFormationLap DrivingPhase = "FORMATION_LAP"
	PhaseSafetyCar    DrivingPhase = "SAFETY_CAR"
	PhaseOutLap       DrivingPhase = "OUT_LAP"
	PhaseInLap        DrivingPhase = "IN_LAP"
	PhaseFlyingLap    DrivingPhase = "FLYING_LAP"
	PhaseRacing       DrivingPhase = "RACING"
	PhaseUnknown      DrivingPhase = "UNKNOWN"
)

// DedupScope represents the deduplication lifecycle for a specific alert type.
type DedupScope string

const (
	DedupScopeStint DedupScope = "stint"
	DedupScopePhase DedupScope = "phase"
	DedupScopeLap   DedupScope = "lap"
	DedupScopeNone  DedupScope = "none"
)

// AlertPhaseRule defines execution guards for an alert key.
type AlertPhaseRule struct {
	ValidPhases             []DrivingPhase
	MinLapDistancePct       float32
	SuppressAfterPitForLaps int
	DedupScope              DedupScope
}

var alertPhaseRules = map[string]AlertPhaseRule{
	"tyre_wear": {
		ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"tyre_puncture": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"tyre_overheat": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap},
		DedupScope:  DedupScopeStint,
	},
	"tyre_cold": {
		ValidPhases:       []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
		MinLapDistancePct: MinOutLapDistanceCompletionPct,
		DedupScope:        DedupScopePhase,
	},
	"damage_wing": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"damage_floor": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"damage_engine": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"damage_faults": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeStint,
	},
	"ers_low": {
		ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
		DedupScope:  DedupScopeLap,
	},
	"engine_temp": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap},
		DedupScope:  DedupScopeStint,
	},
	"brake_hot": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing},
		DedupScope:  DedupScopeStint,
	},
	"brake_cold": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseSafetyCar},
		DedupScope:  DedupScopePhase,
	},
	"fuel_delta": {
		ValidPhases: []DrivingPhase{PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeLap,
	},
	"undercut": {
		ValidPhases: []DrivingPhase{PhaseRacing, PhaseInLap},
		DedupScope:  DedupScopeStint,
	},
	"pit_window": {
		ValidPhases: []DrivingPhase{PhaseRacing, PhaseInLap},
		DedupScope:  DedupScopeLap,
	},
	"rival_defend": {
		ValidPhases:             []DrivingPhase{PhaseRacing},
		SuppressAfterPitForLaps: PostPitSuppressionLaps,
		DedupScope:              DedupScopeNone,
	},
	"rival_attack": {
		ValidPhases:             []DrivingPhase{PhaseRacing},
		SuppressAfterPitForLaps: PostPitSuppressionLaps,
		DedupScope:              DedupScopeNone,
	},
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
	"flags_sc": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag},
		DedupScope:  DedupScopePhase,
	},
	"flags_red": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar, PhaseRedFlag},
		DedupScope:  DedupScopePhase,
	},
	"flags_rain": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFormationLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopePhase,
	},
	"track_limits": {
		ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
		DedupScope:  DedupScopeLap,
	},
	"penalties": {
		ValidPhases: []DrivingPhase{PhaseOutLap, PhaseFlyingLap, PhaseRacing, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeNone,
	},
	"coaching_s1": {
		ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
		DedupScope:  DedupScopeLap,
	},
	"coaching_s2": {
		ValidPhases: []DrivingPhase{PhaseFlyingLap, PhaseRacing},
		DedupScope:  DedupScopeLap,
	},
	"teammate_ahead": {
		ValidPhases: []DrivingPhase{PhaseRacing, PhaseFlyingLap},
		DedupScope:  DedupScopeNone,
	},
	"teammate_pitting": {
		ValidPhases: []DrivingPhase{PhaseRacing, PhaseFlyingLap, PhaseOutLap, PhaseInLap, PhaseSafetyCar},
		DedupScope:  DedupScopeNone,
	},
	"pit_clean_air": {
		ValidPhases: []DrivingPhase{PhaseRacing},
		DedupScope:  DedupScopeNone,
	},
}

// EngineerConfig holds user-configurable thresholds and subsystem toggles.
type EngineerConfig struct {
	ChatterCooldownMs      int             `json:"chatter_cooldown_ms"`
	SmartDiscretionEnabled bool            `json:"smart_discretion_enabled"`
	TyreWearWarnPct        float32         `json:"tyre_wear_warn_pct"`
	TyreWearCritPct        float32         `json:"tyre_wear_crit_pct"`
	TyreOverheatC          float32         `json:"tyre_overheat_c"`
	TyreColdC              float32         `json:"tyre_cold_c"`
	WingDamageWarnPct      float32         `json:"wing_damage_warn_pct"`
	WingDamageCritPct      float32         `json:"wing_damage_crit_pct"`
	FloorDamageWarnPct     float32         `json:"floor_damage_warn_pct"`
	EngineWearWarnPct      float32         `json:"engine_wear_warn_pct"`
	ERSLowPct              float32         `json:"ers_low_pct"`
	EngineOverheatC        float32         `json:"engine_overheat_c"`
	BrakeOverheatC         float32         `json:"brake_overheat_c"`
	BrakeColdC             float32         `json:"brake_cold_c"`
	FuelDeltaLaps          float32         `json:"fuel_delta_laps"`
	UndercutGapSec         float32         `json:"undercut_gap_sec"`
	RivalGapSec            float32         `json:"rival_gap_sec"`
	RivalAheadGapSec       float32         `json:"rival_ahead_gap_sec"`
	QualyCleanAirSec       float32         `json:"qualy_clean_air_sec"`
	QualyTimeWarnSec       float32         `json:"qualy_time_warn_sec"`
	CornerCutWarnThreshold int             `json:"corner_cut_warn_threshold"`
	RainHorizonMin         float32         `json:"rain_horizon_min"`
	RainProbPct            float32         `json:"rain_prob_pct"`
	EnabledCategories      map[string]bool `json:"enabled_categories,omitempty"`
}

// DefaultEngineerConfig returns a default configured EngineerConfig.
func DefaultEngineerConfig() EngineerConfig {
	return EngineerConfig{
		ChatterCooldownMs:      DefaultDirectiveCooldownMs,
		SmartDiscretionEnabled: true,
		TyreWearWarnPct:        40.0,
		TyreWearCritPct:        75.0,
		TyreOverheatC:          OverheatRearTyres2025C,
		TyreColdC:              ColdTyresTargetC,
		WingDamageWarnPct:      20.0,
		WingDamageCritPct:      CriticalWingDamageThresholdPct,
		FloorDamageWarnPct:     25.0,
		EngineWearWarnPct:      70.0,
		ERSLowPct:              15.0,
		EngineOverheatC:        EngineOverheatDefaultC,
		BrakeOverheatC:         BrakeOverheatDefaultC,
		BrakeColdC:             BrakeColdDefaultC,
		FuelDeltaLaps:          FuelDeltaDeficitDefaultLaps,
		UndercutGapSec:         UndercutGapDefaultSec,
		RivalGapSec:            RivalDefendGapDefaultSec,
		RivalAheadGapSec:       RivalAttackGapDefaultSec,
		QualyCleanAirSec:       QualyCleanAirDefaultSec,
		QualyTimeWarnSec:       QualyTimeWarnDefaultSec,
		CornerCutWarnThreshold: CornerCutWarnDefaultThreshold,
		RainHorizonMin:         WeatherRainHorizonMinutes,
		RainProbPct:            WeatherRainTransitionProbPct,
		EnabledCategories:      make(map[string]bool),
	}
}

// IsAlertEnabled returns true if the specified category and sub-alert are enabled.
func (c EngineerConfig) IsAlertEnabled(category, subAlert string) bool {
	if c.EnabledCategories != nil {
		if val, exists := c.EnabledCategories[category]; exists && !val {
			return false
		}
		if val, exists := c.EnabledCategories[subAlert]; exists && !val {
			return false
		}
	}
	return true
}

// EngineerDirective represents an intelligent contextual prompt or alert generated server-side.
type EngineerDirective struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type"` // "directive"
	Category    EngineerDirectiveCategory `json:"category"`
	SubAlert    string                    `json:"sub_alert,omitempty"`
	Title       string                    `json:"title"`
	Message     string                    `json:"message"`
	Urgency     string                    `json:"urgency"` // "low", "medium", "high", "critical"
	Timestamp   int64                     `json:"timestamp"`
	CarIndex    int                       `json:"car_index"`
	SessionTime float32                   `json:"session_time"`
	Metadata    map[string]any            `json:"metadata,omitempty"`
}

// EngineerEngine handles server-side analytical processing and broadcasts directives.
type EngineerEngine struct {
	mu             sync.RWMutex
	hub            *Hub
	repo           storage.Repository
	config         EngineerConfig
	lastDirectives map[string]int64 // Key -> timestamp ms

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
	lastStintLapAge          int
	triggeredWearThresholds  map[float32]bool
	lastPunctured            bool
	lastWingDamageAlert      float32
	lastFloorDamageAlert     bool
	lastEngineWearAlert      bool
	lastDrsFaultAlert        bool
	lastErsFaultAlert        bool
	lastErsLowAlertLap       int
	lastEngineOverheatAlert  int64
	lastBrakeOverheatAlert   int64
	lastBrakeColdAlert       int64
	lastFuelDeltaAlertLap    int
	lastPitWindowWarnedLap   int
	lastUndercutRivalIndex   int
	lastDrsWarningIndex      int
	lastCarAheadWarningIndex int
	lastInvalidLapNum        int
	lastOutLapChecked        int
	lastSessionTimeWarned    bool
	lastElimDangerWarned     bool
	lastSafetyCarStatus      uint8
	lastRedFlagCount         uint8
	lastRainAlert            bool
	lastWeatherAlertOffset   int
	lastCornerCutWarnings    uint8
	lastPenaltiesCount       uint8

	// Sector best times
	bestSector1MS      int
	bestSector2MS      int
	bestSector3MS      int
	lastLapNumber      int
	lastPittedCarIndex int
}

// NewEngineerEngine creates a new EngineerEngine instance.
func NewEngineerEngine(hub *Hub, repo storage.Repository) *EngineerEngine {
	e := &EngineerEngine{
		hub:                      hub,
		repo:                     repo,
		config:                   DefaultEngineerConfig(),
		lastDirectives:           make(map[string]int64),
		stintKeys:                make(map[string]bool),
		phaseKeys:                make(map[string]bool),
		lapKeys:                  make(map[string]int),
		triggeredWearThresholds:  make(map[float32]bool),
		teammateCarIndex:         -1,
		playerTeamID:             -1,
		lastPittedCarIndex:       -1,
		lastUndercutRivalIndex:   -1,
		lastDrsWarningIndex:      -1,
		lastCarAheadWarningIndex: -1,
		lastInvalidLapNum:        -1,
		lastOutLapChecked:        -1,
		lastErsLowAlertLap:       -1,
		lastFuelDeltaAlertLap:    -1,
		lastPitWindowWarnedLap:   -1,
		currentPhase:             PhaseUnknown,
		previousPhase:            PhaseUnknown,
	}
	return e
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
	e.triggeredWearThresholds = make(map[float32]bool)
	e.teammateCarIndex = -1
	e.playerTeamID = -1
	e.bestSector1MS = 0
	e.bestSector2MS = 0
	e.bestSector3MS = 0
	e.lastLapNumber = 0
	e.lastPittedCarIndex = -1
	e.lastStintLapAge = 0
	e.lastPunctured = false
	e.lastWingDamageAlert = 0
	e.lastFloorDamageAlert = false
	e.lastEngineWearAlert = false
	e.lastDrsFaultAlert = false
	e.lastErsFaultAlert = false
	e.lastErsLowAlertLap = -1
	e.lastEngineOverheatAlert = 0
	e.lastBrakeOverheatAlert = 0
	e.lastBrakeColdAlert = 0
	e.lastFuelDeltaAlertLap = -1
	e.lastPitWindowWarnedLap = -1
	e.lastUndercutRivalIndex = -1
	e.lastDrsWarningIndex = -1
	e.lastCarAheadWarningIndex = -1
	e.lastInvalidLapNum = -1
	e.lastOutLapChecked = -1
	e.lastSessionTimeWarned = false
	e.lastElimDangerWarned = false
	e.lastSafetyCarStatus = packets.SafetyCarNone
	e.lastRedFlagCount = 0
	e.lastRainAlert = false
	e.lastWeatherAlertOffset = 0
	e.lastCornerCutWarnings = 0
	e.lastPenaltiesCount = 0
	e.currentPhase = PhaseUnknown
	e.previousPhase = PhaseUnknown
	e.latestSession = nil
	e.latestLapData = nil
	e.latestTelemetry = nil
	e.latestTelemetry2 = nil
	e.latestDamage = nil
	e.latestStatus = nil
	e.latestParticipant = nil
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
	e.mu.Unlock()

	switch p := pkt.(type) {
	case *packets.PacketParticipantsData:
		e.processParticipants(header, p)
	case *packets.PacketSessionData:
		e.processSessionData(header, p)
	case *packets.PacketLapData:
		e.processLapData(header, p)
	case *packets.PacketCarDamageData:
		e.processCarDamageData(header, p)
	case *packets.PacketCarStatusData:
		e.processCarStatusData(header, p)
	case *packets.PacketCarTelemetryData:
		e.processCarTelemetryData(header, p)
	case *packets.PacketCarTelemetry2Data:
		e.processCarTelemetry2Data(header, p)
	}
}

func (e *EngineerEngine) processParticipants(header packets.PacketHeader, p *packets.PacketParticipantsData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestParticipant = p
	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.Participants) {
		return
	}

	playerTeam := int(p.Participants[playerIdx].TeamId)
	e.playerTeamID = playerTeam

	// Find teammate (same team ID, different car index)
	for i := 0; i < int(p.NumActiveCars) && i < len(p.Participants); i++ {
		if i != playerIdx && int(p.Participants[i].TeamId) == playerTeam {
			e.teammateCarIndex = i
			break
		}
	}
}

func (e *EngineerEngine) updateDrivingPhaseLocked() {
	playerLap := e.getPlayerLapDataLocked()
	playerTele := e.getPlayerTelemetryLocked()

	newPhase := e.deriveDrivingPhase(e.latestSession, playerLap, playerTele)
	if newPhase != e.currentPhase {
		e.previousPhase = e.currentPhase
		e.currentPhase = newPhase
		// Reset phase-scoped deduplication keys on phase transition
		e.phaseKeys = make(map[string]bool)
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

	// 9. Racing (only in race sessions or generic OnTrack if session is unspecified)
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

func (e *EngineerEngine) getPlayerTelemetry2Locked() *packets.CarTelemetry2Data {
	if e.latestTelemetry2 == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(e.latestTelemetry2.CarTelemetry2Data) {
		return nil
	}
	return &e.latestTelemetry2.CarTelemetry2Data[e.playerCarIndex]
}

func (e *EngineerEngine) isRaceSessionLocked() bool {
	if e.latestSession == nil {
		return true // default assume racing if session packet not received yet
	}
	return packets.IsRaceSession(e.latestSession.SessionType)
}

func (e *EngineerEngine) isQualifyingSessionLocked() bool {
	if e.latestSession == nil {
		return false
	}
	return packets.IsQualifyingSession(e.latestSession.SessionType)
}

func (e *EngineerEngine) isPracticeSessionLocked() bool {
	if e.latestSession == nil {
		return false
	}
	return packets.IsPracticeSession(e.latestSession.SessionType)
}

func (e *EngineerEngine) canEmitDirectiveLocked(alertKey, category string, isCritical bool) bool {
	// 0. Subsystem & sub-alert enable check
	if !e.config.IsAlertEnabled(category, alertKey) {
		return false
	}

	// 1. Paused game check: Suppress non-critical calls
	if e.latestSession != nil && e.latestSession.GamePaused == 1 && !isCritical {
		return false
	}

	// 2. Driving phase rule validation
	rule, hasRule := alertPhaseRules[alertKey]
	if hasRule {
		// Whitelist check
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

		// Out-lap distance completion guard
		if e.currentPhase == PhaseOutLap && rule.MinLapDistancePct > 0 {
			lapDistPct := e.calculateLapDistancePct(e.latestSession, e.getPlayerLapDataLocked())
			if lapDistPct < rule.MinLapDistancePct {
				return false
			}
		}

		// Post-pit suppression guard
		if rule.SuppressAfterPitForLaps > 0 && e.isRaceSessionLocked() {
			playerLap := e.getPlayerLapDataLocked()
			playerStatus := e.getPlayerCarStatusLocked()
			if playerLap != nil && playerStatus != nil {
				if playerLap.NumPitStops > 0 && int(playerStatus.TyresAgeLaps) <= rule.SuppressAfterPitForLaps {
					return false
				}
			}
		}

		// Contextual deduplication check
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

	// 3. Smart Driving Discretion check (suppress during heavy braking or apex turning)
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

func (e *EngineerEngine) emitDirectiveLocked(header packets.PacketHeader, directive EngineerDirective, alertKey string) {
	isCritical := directive.Urgency == UrgencyCritical || directive.Urgency == UrgencyHigh
	category := string(directive.Category)

	if !e.canEmitDirectiveLocked(alertKey, category, isCritical) {
		return
	}

	now := time.Now().UnixMilli()
	e.lastDirectives[category] = now
	e.lastDirectives[alertKey] = now

	// Record dedup marks
	if rule, hasRule := alertPhaseRules[alertKey]; hasRule {
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

	if e.hub != nil {
		if data, err := json.Marshal(directive); err == nil {
			log.Printf("[Engineer Engine] Proactive Directive emitted [%s / %s] (%s): %s", directive.Category, directive.SubAlert, directive.Urgency, directive.Message)
			e.hub.Broadcast(data)
		}
	}
}

// -----------------------------------------------------------------------------
// Packet Handlers
// -----------------------------------------------------------------------------

func (e *EngineerEngine) processSessionData(header packets.PacketHeader, p *packets.PacketSessionData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestSession = p
	e.updateDrivingPhaseLocked()

	// 1. Flags: Full Safety Car / VSC
	if e.isRaceSessionLocked() {
		scStatus := p.SafetyCarStatus
		if scStatus != e.lastSafetyCarStatus {
			e.lastSafetyCarStatus = scStatus
			switch scStatus {
			case packets.SafetyCarFull:
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryFlags,
					SubAlert: "safety_car",
					Title:    "Safety Car Deployed",
					Message:  "Full Safety Car deployed! Maintain delta positive, stand by for pit stop window.",
					Urgency:  UrgencyCritical,
				}, "flags_sc")
			case packets.SafetyCarVirtual:
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryFlags,
					SubAlert: "vsc",
					Title:    "VSC Deployed",
					Message:  "Virtual Safety Car (VSC) deployed! Maintain delta, no overtaking.",
					Urgency:  UrgencyCritical,
				}, "flags_sc")
			}
		}
	}

	// 2. Flags: Red Flag session halt
	redFlagCount := p.NumRedFlagPeriods
	if redFlagCount > e.lastRedFlagCount {
		e.lastRedFlagCount = redFlagCount
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryFlags,
			SubAlert: "red_flag",
			Title:    "Red Flag Deployed",
			Message:  "Red Flag deployed! Session stopped. Instruct driver to return to pit lane slowly.",
			Urgency:  UrgencyCritical,
		}, "flags_red")
	}

	// 3. Dynamic Weather Progression
	numSamples := int(p.NumWeatherForecastSamples)
	if numSamples > len(p.WeatherForecastSamples) {
		numSamples = len(p.WeatherForecastSamples)
	}
	for i := 0; i < numSamples; i++ {
		sample := p.WeatherForecastSamples[i]
		rainPct := int(sample.RainPercentage)
		timeOffset := int(sample.TimeOffset)
		if rainPct >= int(e.config.RainProbPct) && timeOffset <= int(e.config.RainHorizonMin) && e.lastWeatherAlertOffset != timeOffset {
			e.lastWeatherAlertOffset = timeOffset
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryWeather,
				SubAlert: "weather_rain",
				Title:    "Weather Transition",
				Message:  fmt.Sprintf("Weather radar confirms %d%% chance of rain in the next %d minutes.", rainPct, timeOffset),
				Urgency:  UrgencyHigh,
				Metadata: map[string]any{
					"rain_pct":    rainPct,
					"time_offset": timeOffset,
				},
			}, "flags_rain")
			break
		}
	}

	// 4. Qualifying / Practice Session Clock Countdown
	if (e.isQualifyingSessionLocked() || e.isPracticeSessionLocked()) && p.SessionTimeLeft > 0 {
		if float32(p.SessionTimeLeft) <= e.config.QualyTimeWarnSec && !e.lastSessionTimeWarned {
			e.lastSessionTimeWarned = true
			sessionName := packets.SessionTypeName(p.SessionType)
			minRemaining := int(math.Round(float64(e.config.QualyTimeWarnSec) / 60.0))
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryQualifying,
				SubAlert: "qualy_session_time",
				Title:    "Session Time Warning",
				Message:  fmt.Sprintf("Under %d minutes remaining in %s! Direct driver to leave pit lane now for final flying lap.", minRemaining, sessionName),
				Urgency:  UrgencyCritical,
			}, "qualy_time")
		}
	}

	// 5. Qualifying Elimination Danger Zone
	if e.isQualifyingSessionLocked() && p.SessionTimeLeft > 0 && p.SessionTimeLeft <= uint16(QualyElimDangerTimeSec) && !e.lastElimDangerWarned {
		playerLap := e.getPlayerLapDataLocked()
		if playerLap != nil && playerLap.CarPosition > 0 {
			playerPos := int(playerLap.CarPosition)
			isQ1Danger := (p.SessionType == packets.SessionQ1 || p.SessionType == packets.SessionSprintQ1) && playerPos >= 15
			isQ2Danger := (p.SessionType == packets.SessionQ2 || p.SessionType == packets.SessionSprintQ2) && playerPos >= 10

			if isQ1Danger || isQ2Danger {
				e.lastElimDangerWarned = true
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_elimination_danger",
					Title:    "Elimination Danger Zone",
					Message:  fmt.Sprintf("We are in P%d in the elimination danger zone with under 5 minutes left!", playerPos),
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"position": playerPos,
					},
				}, "qualy_elim")
			}
		}
	}
}

func (e *EngineerEngine) processLapData(header packets.PacketHeader, p *packets.PacketLapData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestLapData = p
	e.updateDrivingPhaseLocked()

	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.LapData) {
		return
	}

	playerLap := p.LapData[playerIdx]
	currentLap := int(playerLap.CurrentLapNum)
	is2026 := header.PacketFormat >= packets.PacketFormat2026
	playerPos := int(playerLap.CarPosition)
	isRace := e.isRaceSessionLocked()
	isQualy := e.isQualifyingSessionLocked()

	// 1. Sector Coaching Analysis (Sector 1 & 2 Delta vs PB)
	e.evalSectorCoachingLocked(header, playerLap, currentLap, isRace)
	e.lastLapNumber = currentLap

	// 2. Teammate Proximity & Teammate Pitting
	e.evalTeammateProximityLocked(header, playerLap, p, playerPos)

	// 3. Lap Invalidation & Qualifying Out-Lap Traffic
	e.evalQualifyingOutLapAndLimitsLocked(header, playerLap, p, playerIdx, currentLap, isQualy)

	// 4. Undercut Threat Detection
	e.evalUndercutThreatLocked(header, playerLap, p, playerIdx, playerPos, isRace)

	// 5. Pit Stop Window Opening
	e.evalPitStopWindowLocked(header, currentLap, playerPos, isRace)

	// 6. Rival Defend & Attack Opportunities
	e.evalRivalsDirectivesLocked(header, playerLap, p, playerIdx, playerPos, isRace, is2026)

	// 7. Track Limits & Steward Penalties
	e.evalTrackLimitsAndPenaltiesLocked(header, playerLap)

	// 8. Clean Air Pit Window (Predictive)
	e.evalCleanAirPitWindowLocked(header, playerLap, p, playerIdx, currentLap, isRace)
}

func (e *EngineerEngine) evalSectorCoachingLocked(header packets.PacketHeader, playerLap packets.LapData, currentLap int, isRace bool) {
	isSectorCoachingPhase := (e.currentPhase == PhaseFlyingLap || (e.currentPhase == PhaseRacing && isRace)) &&
		e.currentPhase != PhaseSafetyCar &&
		e.currentPhase != PhaseInLap &&
		e.currentPhase != PhaseOutLap &&
		e.currentPhase != PhasePitLane &&
		e.currentPhase != PhaseInGarage
	isCompetitiveDriver := playerLap.DriverStatus != packets.DriverStatusInLap &&
		playerLap.DriverStatus != packets.DriverStatusOutLap &&
		playerLap.DriverStatus != packets.DriverStatusInGarage &&
		playerLap.PitStatus == packets.PitStatusNone

	if !isSectorCoachingPhase || !isCompetitiveDriver {
		return
	}

	s1 := int(playerLap.Sector1TimeMSPart) + int(playerLap.Sector1TimeMinutesPart)*packets.MillisPerMinute
	s2 := int(playerLap.Sector2TimeMSPart) + int(playerLap.Sector2TimeMinutesPart)*packets.MillisPerMinute

	if s1 > 0 && (e.bestSector1MS == 0 || s1 < e.bestSector1MS) {
		e.bestSector1MS = s1
	}
	if s2 > 0 && (e.bestSector2MS == 0 || s2 < e.bestSector2MS) {
		e.bestSector2MS = s2
	}

	if int(playerLap.Sector) == 1 && s1 > 0 && e.bestSector1MS > 0 && currentLap == e.lastLapNumber {
		deltaS1 := float64(s1-e.bestSector1MS) / 1000.0
		if deltaS1 >= SectorTimeLossThresholdSec {
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryCoaching,
				SubAlert: "sector_delta",
				Title:    "Sector 1 Delta",
				Message:  fmt.Sprintf("Time lost in Sector 1 (+%.2fs vs personal best). Focus on apex speed and smooth steering input.", deltaS1),
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"sector": 1,
					"delta":  deltaS1,
				},
			}, "coaching_s1")
		}
	}

	if int(playerLap.Sector) == 2 && s2 > 0 && e.bestSector2MS > 0 && currentLap == e.lastLapNumber {
		deltaS2 := float64(s2-e.bestSector2MS) / 1000.0
		if deltaS2 >= SectorTimeLossThresholdSec {
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryCoaching,
				SubAlert: "sector_delta",
				Title:    "Sector 2 Delta",
				Message:  fmt.Sprintf("Time lost in Sector 2 (+%.2fs vs personal best). Prioritize corner exit traction.", deltaS2),
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"sector": 2,
					"delta":  deltaS2,
				},
			}, "coaching_s2")
		}
	}
}

func (e *EngineerEngine) evalTeammateProximityLocked(header packets.PacketHeader, playerLap packets.LapData, p *packets.PacketLapData, playerPos int) {
	if e.teammateCarIndex < 0 || e.teammateCarIndex >= len(p.LapData) {
		return
	}
	teammateLap := p.LapData[e.teammateCarIndex]
	teammatePos := int(teammateLap.CarPosition)

	if playerPos > 0 && teammatePos > 0 && math.Abs(float64(playerPos-teammatePos)) == 1 {
		distDelta := float64(teammateLap.TotalDistance - playerLap.TotalDistance)
		gapSec := distDelta / AverageRaceSpeedMetersPerSec

		if gapSec > 0 && gapSec < TeammateGapThresholdSec {
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryTeammate,
				SubAlert: "teammate_ahead",
				Title:    "Teammate Ahead",
				Message:  fmt.Sprintf("Teammate is P%d, %.1fs ahead. Pace delta is favorable. Free to race, keep it clean.", teammatePos, gapSec),
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"teammate_pos": teammatePos,
					"gap_sec":      gapSec,
				},
			}, "teammate_ahead")
		}
	}

	if teammateLap.PitStatus == packets.PitStatusPitting && e.lastPittedCarIndex != e.teammateCarIndex {
		e.lastPittedCarIndex = e.teammateCarIndex
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryTeammate,
			SubAlert: "teammate_pitting",
			Title:    "Teammate Pitting",
			Message:  fmt.Sprintf("Teammate in P%d is pitting now. Focus on clean in-lap.", teammatePos),
			Urgency:  UrgencyHigh,
		}, "teammate_pitting")
	}
}

func (e *EngineerEngine) evalQualifyingOutLapAndLimitsLocked(header packets.PacketHeader, playerLap packets.LapData, p *packets.PacketLapData, playerIdx, currentLap int, isQualy bool) {
	// Lap Invalidation (Track Limits)
	if playerLap.CurrentLapInvalid == 1 && currentLap != e.lastInvalidLapNum {
		e.lastInvalidLapNum = currentLap
		isPushing := playerLap.DriverStatus == packets.DriverStatusFlyingLap || (isQualy && playerLap.DriverStatus != packets.DriverStatusInLap && playerLap.DriverStatus != packets.DriverStatusOutLap)
		if isPushing {
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryQualifying,
				SubAlert: "qualy_deleted_lap",
				Title:    "Lap Deleted",
				Message:  fmt.Sprintf("Lap %d deleted for track limits! Recharge ERS and reset for next flying attempt.", currentLap),
				Urgency:  UrgencyCritical,
			}, "qualy_invalid")
		}
	}

	// Qualifying Out-Lap Clean Air / Traffic Detection
	if isQualy && playerLap.DriverStatus == packets.DriverStatusOutLap {
		isFinalSector := playerLap.Sector >= 2 || (e.latestSession != nil && e.latestSession.TrackLength > 0 && playerLap.LapDistance > float32(e.latestSession.TrackLength)*0.7)
		if isFinalSector && e.lastOutLapChecked != currentLap {
			playerTrackDist := playerLap.TotalDistance
			var minAheadDelta float32 = MaxTrackDistanceDeltaInitial

			for i, rival := range p.LapData {
				if i == playerIdx || rival.TotalDistance == 0 {
					continue
				}
				deltaDist := rival.TotalDistance - playerTrackDist
				if deltaDist > 10 && deltaDist < minAheadDelta {
					minAheadDelta = deltaDist
				}
			}

			maxCleanAirDist := e.config.QualyCleanAirSec * QualyOutLapSpeedMetersPerSec
			if minAheadDelta < maxCleanAirDist {
				e.lastOutLapChecked = currentLap
				gapEstSec := minAheadDelta / QualyOutLapSpeedMetersPerSec
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_traffic",
					Title:    "Traffic Ahead on Out-Lap",
					Message:  fmt.Sprintf("Traffic ahead before starting hot lap — car ahead is only ~%.1fs away (<%dm). Direct driver to build clean air.", gapEstSec, int(minAheadDelta)),
					Urgency:  UrgencyCritical,
					Metadata: map[string]any{
						"gap_sec":   gapEstSec,
						"gap_meter": minAheadDelta,
					},
				}, "qualy_traffic")
			} else if minAheadDelta >= maxCleanAirDist && minAheadDelta < MaxCleanAirDistanceMeters {
				e.lastOutLapChecked = currentLap
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryQualifying,
					SubAlert: "qualy_clean_air",
					Title:    "Clean Air Window",
					Message:  "Track is clear ahead with clean air gap. Instruct driver to prepare front tyres and launch out of the final turn.",
					Urgency:  UrgencyLow,
				}, "qualy_traffic")
			}
		}
	}
}

func (e *EngineerEngine) evalUndercutThreatLocked(header packets.PacketHeader, playerLap packets.LapData, p *packets.PacketLapData, playerIdx, playerPos int, isRace bool) {
	if !isRace || playerPos <= 0 || e.currentPhase == PhaseSafetyCar || (e.latestSession != nil && e.latestSession.SafetyCarStatus != packets.SafetyCarNone) {
		return
	}

	for i, rival := range p.LapData {
		if i == playerIdx || int(rival.CarPosition) != playerPos+1 {
			continue
		}
		if rival.PitStatus == packets.PitStatusPitting && e.lastUndercutRivalIndex != i {
			distDelta := playerLap.TotalDistance - rival.TotalDistance
			maxUndercutDist := e.config.UndercutGapSec * AverageRaceSpeedMetersPerSec
			if distDelta > 0 && distDelta < maxUndercutDist {
				e.lastUndercutRivalIndex = i
				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryPitStrategy,
					SubAlert: "undercut_window",
					Title:    "Undercut Threat",
					Message:  fmt.Sprintf("Car behind (P%d) has just pitted for an undercut attempt! Push hard now on the in-lap to defend track position.", playerPos+1),
					Urgency:  UrgencyCritical,
				}, "undercut")
			}
		}
	}
}

func (e *EngineerEngine) evalPitStopWindowLocked(header packets.PacketHeader, currentLap, playerPos int, isRace bool) {
	if !isRace || e.currentPhase == PhaseSafetyCar || e.latestSession == nil || e.latestSession.SafetyCarStatus != packets.SafetyCarNone || e.latestSession.PitStopWindowIdealLap <= 0 {
		return
	}

	idealLap := int(e.latestSession.PitStopWindowIdealLap)
	if idealLap == currentLap && e.lastPitWindowWarnedLap != currentLap {
		e.lastPitWindowWarnedLap = currentLap
		rejoinPos := int(e.latestSession.PitStopRejoinPosition)
		if rejoinPos == 0 {
			rejoinPos = playerPos
		}
		if rejoinPos == 0 {
			rejoinPos = 1
		}
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_window_open",
			Title:    "Pit Stop Window",
			Message:  fmt.Sprintf("Pit stop window is now open (Lap %d). Target rejoin position P%d.", currentLap, rejoinPos),
			Urgency:  UrgencyLow,
		}, "pit_window")
	}
}

func (e *EngineerEngine) evalRivalsDirectivesLocked(header packets.PacketHeader, playerLap packets.LapData, p *packets.PacketLapData, playerIdx, playerPos int, isRace, is2026 bool) {
	if !isRace || playerPos <= 0 || e.currentPhase != PhaseRacing || (e.latestSession != nil && e.latestSession.SafetyCarStatus != packets.SafetyCarNone) {
		return
	}

	// Defend: Car Behind (playerPos + 1)
	maxDefendDist := e.config.RivalGapSec * AverageRaceSpeedMetersPerSec
	for i, rival := range p.LapData {
		if i == playerIdx || int(rival.CarPosition) != playerPos+1 {
			continue
		}
		distDelta := playerLap.TotalDistance - rival.TotalDistance
		if distDelta > 0 && distDelta < maxDefendDist && e.lastDrsWarningIndex != i {
			e.lastDrsWarningIndex = i
			gapSec := distDelta / AverageRaceSpeedMetersPerSec

			var extraContext string
			if e.latestStatus != nil && i < len(e.latestStatus.CarStatusData) {
				rivalStatus := e.latestStatus.CarStatusData[i]
				playerStatus := e.getPlayerCarStatusLocked()
				if playerStatus != nil && rivalStatus.ActualTyreCompound > 0 && playerStatus.ActualTyreCompound > 0 && rivalStatus.ActualTyreCompound != playerStatus.ActualTyreCompound {
					extraContext += fmt.Sprintf(" Rival is on different compound (Compound ID: %d, tyre age: %d laps).", rivalStatus.ActualTyreCompound, rivalStatus.TyresAgeLaps)
				}
			}
			if e.latestDamage != nil && i < len(e.latestDamage.CarDamageData) {
				rivalDamage := e.latestDamage.CarDamageData[i]
				rivalWing := float32(rivalDamage.FrontLeftWingDamage + rivalDamage.FrontRightWingDamage)
				if rivalWing > RivalDamageWingThresholdPct {
					extraContext += " Note: Car behind has front wing damage."
				}
			}

			var defendMsg string
			if is2026 {
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within Override/Boost attack threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			} else {
				defendMsg = fmt.Sprintf("Defend! Car behind (P%d) is within DRS threat (%.1fs gap).%s", playerPos+1, gapSec, extraContext)
			}

			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryRivals,
				SubAlert: "rival_defend",
				Title:    "Defend Position",
				Message:  defendMsg,
				Urgency:  UrgencyMedium,
				Metadata: map[string]any{
					"rival_pos": playerPos + 1,
					"gap_sec":   gapSec,
				},
			}, "rival_defend")
		}
	}

	// Attack: Car Ahead (playerPos - 1)
	if playerPos > 1 {
		maxAttackDist := e.config.RivalAheadGapSec * AverageRaceSpeedMetersPerSec
		for i, rival := range p.LapData {
			if i == playerIdx || int(rival.CarPosition) != playerPos-1 {
				continue
			}
			distDelta := rival.TotalDistance - playerLap.TotalDistance
			if distDelta > 0 && distDelta < maxAttackDist && e.lastCarAheadWarningIndex != i {
				e.lastCarAheadWarningIndex = i
				gapSec := distDelta / AverageRaceSpeedMetersPerSec

				var tyreContext string
				if e.latestStatus != nil && i < len(e.latestStatus.CarStatusData) {
					rivalStatus := e.latestStatus.CarStatusData[i]
					tyreContext = fmt.Sprintf(" Car ahead tyre age: %d laps (Compound: %d).", rivalStatus.TyresAgeLaps, rivalStatus.ActualTyreCompound)
				}

				var attackMsg string
				if is2026 {
					telemetry2 := e.getPlayerTelemetry2Locked()
					var boostContext string
					if telemetry2 != nil && telemetry2.OvertakeAvailable == 1 {
						boostContext = " Override Boost is available!"
					}
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s%s Direct driver to prepare overtake using Straight Mode and Boost deployment.", playerPos-1, gapSec, tyreContext, boostContext)
				} else {
					attackMsg = fmt.Sprintf("We are catching car ahead (P%d), gap is %.1fs.%s", playerPos-1, gapSec, tyreContext)
				}

				e.emitDirectiveLocked(header, EngineerDirective{
					Category: DirectiveCategoryRivals,
					SubAlert: "rival_attack",
					Title:    "Attack Opportunity",
					Message:  attackMsg,
					Urgency:  UrgencyMedium,
					Metadata: map[string]any{
						"rival_pos": playerPos - 1,
						"gap_sec":   gapSec,
					},
				}, "rival_attack")
			}
		}
	}
}

func (e *EngineerEngine) evalTrackLimitsAndPenaltiesLocked(header packets.PacketHeader, playerLap packets.LapData) {
	// Track Limits Corner Cutting Warnings
	cutWarnings := playerLap.CornerCuttingWarnings
	if int(cutWarnings) >= e.config.CornerCutWarnThreshold && cutWarnings > e.lastCornerCutWarnings {
		e.lastCornerCutWarnings = cutWarnings
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryFlags,
			SubAlert: "track_limits_warnings",
			Title:    "Track Limits Warning",
			Message:  fmt.Sprintf("Driver has accumulated %d track limits / corner cutting warnings!", cutWarnings),
			Urgency:  UrgencyCritical,
		}, "track_limits")
	}

	// Steward Time Penalties
	penalties := playerLap.Penalties
	if penalties > 0 && penalties > e.lastPenaltiesCount {
		e.lastPenaltiesCount = penalties
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryFlags,
			SubAlert: "penalties_incurred",
			Title:    "Time Penalty Assessed",
			Message:  fmt.Sprintf("Driver has been assessed a %d-second time penalty by the stewards!", penalties),
			Urgency:  UrgencyCritical,
		}, "penalties")
	}
}

func (e *EngineerEngine) evalCleanAirPitWindowLocked(header packets.PacketHeader, playerLap packets.LapData, p *packets.PacketLapData, playerIdx, currentLap int, isRace bool) {
	if !isRace || e.currentPhase != PhaseRacing || (e.latestSession != nil && e.latestSession.SafetyCarStatus != packets.SafetyCarNone) ||
		playerLap.DriverStatus == packets.DriverStatusOutLap || playerLap.DriverStatus == packets.DriverStatusInLap || playerLap.PitStatus != packets.PitStatusNone || currentLap <= 3 {
		return
	}

	playerDist := float64(playerLap.TotalDistance)
	estPitLossMeters := DefaultPitLaneLossSeconds * AverageRaceSpeedMetersPerSec
	rejoinDist := playerDist - estPitLossMeters

	trafficCount := 0
	for i, rival := range p.LapData {
		if i == playerIdx || rival.TotalDistance == 0 {
			continue
		}
		rivalDist := float64(rival.TotalDistance)
		if math.Abs(rivalDist-rejoinDist) < CleanAirTrafficWindowSeconds*AverageRaceSpeedMetersPerSec {
			trafficCount++
		}
	}

	if trafficCount == 0 && currentLap%5 == 0 {
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryPitStrategy,
			SubAlert: "pit_clean_air",
			Title:    "Clean Air Pit Window",
			Message:  "Pit window offers clean air on rejoin. Ideal opportunity for undercut/overcut strategy.",
			Urgency:  UrgencyLow,
		}, "pit_clean_air")
	}
}

func (e *EngineerEngine) processCarDamageData(header packets.PacketHeader, p *packets.PacketCarDamageData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestDamage = p
	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.CarDamageData) {
		return
	}

	dmg := p.CarDamageData[playerIdx]
	is2026 := header.PacketFormat >= packets.PacketFormat2026

	// 1. Tyre Wear & Punctures
	var maxWear float32
	for _, w := range dmg.TyresWear {
		if w > maxWear {
			maxWear = w
		}
	}

	// Critical puncture (Emergency bypass)
	if maxWear >= PunctureWearThresholdPct && !e.lastPunctured {
		e.lastPunctured = true
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_puncture",
			Title:    "Critical Tyre Puncture",
			Message:  fmt.Sprintf("Critical tyre puncture / tyre failure on car! Wear is at %d%%. Order driver to box immediately.", int(math.Round(float64(maxWear)))),
			Urgency:  UrgencyCritical,
		}, "tyre_puncture")
	} else if maxWear < PunctureWearThresholdPct {
		// Wear warning / critical thresholds
		activeThresholds := []float32{e.config.TyreWearWarnPct, e.config.TyreWearCritPct}
		currentTyreAge := 0
		if status := e.getPlayerCarStatusLocked(); status != nil {
			currentTyreAge = int(status.TyresAgeLaps)
		}

		for _, th := range activeThresholds {
			if th <= 0 || maxWear < th || e.triggeredWearThresholds[th] {
				continue
			}
			e.triggeredWearThresholds[th] = true
			urgency := UrgencyLow
			if maxWear >= e.config.TyreWearCritPct {
				urgency = UrgencyHigh
			}
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryTyres,
				SubAlert: "tyre_wear",
				Title:    "Tyre Wear Alert",
				Message:  fmt.Sprintf("Tyre wear reached %d%% (stint age: %d laps).", int(math.Round(float64(maxWear))), currentTyreAge),
				Urgency:  urgency,
				Metadata: map[string]any{
					"wear_pct":  maxWear,
					"tyre_age":  currentTyreAge,
					"threshold": th,
				},
			}, "tyre_wear")
			break
		}
	}

	// 2. Front Wing Damage
	maxWing := float32(dmg.FrontLeftWingDamage)
	if float32(dmg.FrontRightWingDamage) > maxWing {
		maxWing = float32(dmg.FrontRightWingDamage)
	}

	if maxWing >= e.config.WingDamageCritPct && e.lastWingDamageAlert < e.config.WingDamageCritPct {
		e.lastWingDamageAlert = maxWing
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "wing_damage",
			Title:    "Critical Wing Damage",
			Message:  fmt.Sprintf("Severe front wing damage detected (%d%% loss)! Massive aero loss on front axle. Order driver to box for front wing replacement.", int(math.Round(float64(maxWing)))),
			Urgency:  UrgencyCritical,
		}, "damage_wing")
	} else if maxWing >= e.config.WingDamageWarnPct && e.lastWingDamageAlert < e.config.WingDamageWarnPct {
		e.lastWingDamageAlert = maxWing
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "wing_damage",
			Title:    "Front Wing Damage",
			Message:  fmt.Sprintf("Front wing endplate/flap damage detected (%d%%). Expect understeer in medium-to-high speed corners.", int(math.Round(float64(maxWing)))),
			Urgency:  UrgencyMedium,
		}, "damage_wing")
	}

	// 3. Floor & Diffuser Damage
	floorDiffDamage := float32(dmg.FloorDamage + dmg.DiffuserDamage)
	if floorDiffDamage >= e.config.FloorDamageWarnPct && !e.lastFloorDamageAlert {
		e.lastFloorDamageAlert = true
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "floor_damage",
			Title:    "Floor Aero Damage",
			Message:  fmt.Sprintf("Underfloor/diffuser aerodynamic damage confirmed (%d%%). Downforce levels and high-speed stability are compromised.", int(math.Round(float64(floorDiffDamage)))),
			Urgency:  UrgencyMedium,
		}, "damage_floor")
	}

	// 4. Internal Engine / Gearbox Component Wear
	maxEngineWear := float32(dmg.EngineICEWear)
	if float32(dmg.EngineMGUKWear) > maxEngineWear {
		maxEngineWear = float32(dmg.EngineMGUKWear)
	}
	if float32(dmg.EngineTCWear) > maxEngineWear {
		maxEngineWear = float32(dmg.EngineTCWear)
	}
	if float32(dmg.GearBoxDamage) > maxEngineWear {
		maxEngineWear = float32(dmg.GearBoxDamage)
	}

	if maxEngineWear >= e.config.EngineWearWarnPct && !e.lastEngineWearAlert {
		e.lastEngineWearAlert = true
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "engine_wear",
			Title:    "Engine Component Wear",
			Message:  fmt.Sprintf("Power unit / gearbox component wear reached %d%%!", int(math.Round(float64(maxEngineWear)))),
			Urgency:  UrgencyMedium,
		}, "damage_engine")
	}

	// 5. Mechanical Faults (DRS / Active Aero / ERS)
	if dmg.DRSFault == 1 && !e.lastDrsFaultAlert {
		e.lastDrsFaultAlert = true
		var faultMsg string
		if is2026 {
			faultMsg = "Active Aero flap fault detected! Straight mode / aerodynamic wing adjustment unavailable."
		} else {
			faultMsg = "DRS flap fault detected! Rear wing flap cannot deploy."
		}
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "aero_fault",
			Title:    "Aero Flap Fault",
			Message:  faultMsg,
			Urgency:  UrgencyCritical,
		}, "damage_faults")
	}

	if dmg.ERSFault == 1 && !e.lastErsFaultAlert {
		e.lastErsFaultAlert = true
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryDamage,
			SubAlert: "ers_fault",
			Title:    "Hybrid ERS Fault",
			Message:  "Hybrid ERS deployment failure detected on power unit! Electric boost offline.",
			Urgency:  UrgencyCritical,
		}, "damage_faults")
	}
}

func (e *EngineerEngine) processCarStatusData(header packets.PacketHeader, p *packets.PacketCarStatusData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestStatus = p
	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.CarStatusData) {
		return
	}

	status := p.CarStatusData[playerIdx]
	currentTyreAge := int(status.TyresAgeLaps)
	is2026 := header.PacketFormat >= packets.PacketFormat2026
	currentLapNum := 1
	if pLap := e.getPlayerLapDataLocked(); pLap != nil && pLap.CurrentLapNum > 0 {
		currentLapNum = int(pLap.CurrentLapNum)
	}

	// Check if car pitted (tyre age reset) -> clear stint scoped keys and wear tracking
	if currentTyreAge <= 1 && e.lastStintLapAge > 3 {
		e.stintKeys = make(map[string]bool)
		e.triggeredWearThresholds = make(map[float32]bool)
		e.lastPunctured = false
	}
	e.lastStintLapAge = currentTyreAge

	// 1. Low ERS Battery Reserve Alert
	ersPct := (status.ERSStoreEnergy / packets.MaxERSStoreEnergyJoules) * 100.0
	if ersPct <= e.config.ERSLowPct && currentLapNum != e.lastErsLowAlertLap && (e.currentPhase == PhaseFlyingLap || e.isRaceSessionLocked()) {
		e.lastErsLowAlertLap = currentLapNum
		var ersMsg string
		if is2026 {
			ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Advise driver to limit Override/Boost usage and use Lift & Coast for MGU-K regeneration on straights.", int(math.Round(float64(ersPct))))
		} else {
			ersMsg = fmt.Sprintf("ERS battery reserve is low at %d%%! Advise driver to switch deploy mode to None or Harvest on straights.", int(math.Round(float64(ersPct))))
		}
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryERS,
			SubAlert: "ers_low",
			Title:    "Low ERS Battery",
			Message:  ersMsg,
			Urgency:  UrgencyLow,
		}, "ers_low")
	}

	// 2. Fuel Target Deficit & Lift & Coast (Race only)
	if e.isRaceSessionLocked() && status.FuelRemainingLaps <= e.config.FuelDeltaLaps && currentLapNum > 3 && currentLapNum != e.lastFuelDeltaAlertLap {
		e.lastFuelDeltaAlertLap = currentLapNum
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryFuel,
			SubAlert: "fuel_deficit",
			Title:    "Fuel Target Deficit",
			Message:  fmt.Sprintf("Fuel target delta is negative (%.1f laps). Direct driver to introduce Lift & Coast into Turn 1 and heavy braking zones.", status.FuelRemainingLaps),
			Urgency:  UrgencyMedium,
		}, "fuel_delta")
	}
}

func (e *EngineerEngine) processCarTelemetryData(header packets.PacketHeader, p *packets.PacketCarTelemetryData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.latestTelemetry = p
	e.updateDrivingPhaseLocked()

	playerIdx := e.playerCarIndex
	if playerIdx >= len(p.CarTelemetryData) {
		return
	}

	tele := p.CarTelemetryData[playerIdx]
	is2026 := header.PacketFormat >= packets.PacketFormat2026
	now := time.Now().UnixMilli()
	currentTyreAge := 0
	if status := e.getPlayerCarStatusLocked(); status != nil {
		currentTyreAge = int(status.TyresAgeLaps)
	}

	// 1. Tyre Surface Thermal Overheating & Cold Tyre Temperatures
	var maxSurfTemp float32
	var rearMaxTemp float32
	for i, t := range tele.TyresSurfaceTemperature {
		val := float32(t)
		if val > maxSurfTemp {
			maxSurfTemp = val
		}
		if (i == 2 || i == 3) && val > rearMaxTemp { // Rear Left / Rear Right
			rearMaxTemp = val
		}
	}

	overheatLimit := e.config.TyreOverheatC
	if is2026 && overheatLimit == OverheatRearTyres2025C {
		overheatLimit = OverheatRearTyres2026C
	}

	if rearMaxTemp >= overheatLimit {
		var advice string
		if is2026 {
			advice = fmt.Sprintf("Rear tyre surface temperatures are overheating at %d°C (limit: %d°C)! Manage traction out of corners to protect the narrower rear tyres.", int(math.Round(float64(rearMaxTemp))), int(overheatLimit))
		} else {
			advice = fmt.Sprintf("Rear tyre surface temperatures are overheating at %d°C (limit: %d°C)! Advise driver to manage traction out of corners to cool the rears.", int(math.Round(float64(rearMaxTemp))), int(overheatLimit))
		}
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_overheat",
			Title:    "Tyre Overheating",
			Message:  advice,
			Urgency:  UrgencyMedium,
		}, "tyre_overheat")
	} else if maxSurfTemp > 0 && maxSurfTemp <= e.config.TyreColdC && currentTyreAge < 2 {
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryTyres,
			SubAlert: "tyre_cold",
			Title:    "Cold Tyre Temperature",
			Message:  fmt.Sprintf("Tyre temperatures are cold (%d°C, target: >%d°C). Advise driver to weave and build tyre temperature.", int(math.Round(float64(maxSurfTemp))), int(e.config.TyreColdC)),
			Urgency:  UrgencyLow,
		}, "tyre_cold")
	}

	// 2. Engine Core Radiator Overheating
	if float32(tele.EngineTemperature) >= e.config.EngineOverheatC && (now-e.lastEngineOverheatAlert > EngineOverheatCooldownMs) {
		e.lastEngineOverheatAlert = now
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryERS,
			SubAlert: "radiator_overheat",
			Title:    "Engine Radiator Overheating",
			Message:  fmt.Sprintf("Engine core water/oil temperatures are high at %d°C (limit: %d°C)!", tele.EngineTemperature, int(e.config.EngineOverheatC)),
			Urgency:  UrgencyMedium,
		}, "engine_temp")
	}

	// 3. Braking System: Overheat & Cold
	var maxBrakeTemp float32
	for _, bt := range tele.BrakesTemperature {
		val := float32(bt)
		if val > maxBrakeTemp {
			maxBrakeTemp = val
		}
	}

	if maxBrakeTemp >= e.config.BrakeOverheatC && (now-e.lastBrakeOverheatAlert > BrakeOverheatCooldownMs) {
		e.lastBrakeOverheatAlert = now
		e.emitDirectiveLocked(header, EngineerDirective{
			Category: DirectiveCategoryBrakes,
			SubAlert: "brake_overheat",
			Title:    "Brake Disc Overheating",
			Message:  fmt.Sprintf("Brake disc temperatures are critically high at %d°C (fade threshold: %d°C)!", int(maxBrakeTemp), int(e.config.BrakeOverheatC)),
			Urgency:  UrgencyMedium,
		}, "brake_hot")
	} else if maxBrakeTemp > 0 && maxBrakeTemp <= e.config.BrakeColdC && (now-e.lastBrakeColdAlert > BrakeColdCooldownMs) {
		if e.currentPhase == PhaseFormationLap || e.currentPhase == PhaseSafetyCar || e.currentPhase == PhaseOutLap {
			e.lastBrakeColdAlert = now
			e.emitDirectiveLocked(header, EngineerDirective{
				Category: DirectiveCategoryBrakes,
				SubAlert: "brake_cold",
				Title:    "Cold Brakes",
				Message:  fmt.Sprintf("Brake temperatures are cold (%d°C, optimal: >%d°C).", int(maxBrakeTemp), int(e.config.BrakeColdC)),
				Urgency:  UrgencyLow,
			}, "brake_cold")
		}
	}
}

func (e *EngineerEngine) processCarTelemetry2Data(header packets.PacketHeader, p *packets.PacketCarTelemetry2Data) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.latestTelemetry2 = p
}
