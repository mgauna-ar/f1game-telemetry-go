package engineer

import (
	"maps"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// DirectiveBroadcaster abstracts the transport layer for emitting directives (e.g. WebSocket Hub).
type DirectiveBroadcaster interface {
	Broadcast(data []byte)
}

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

// DirectiveCategories lists every directive category, for the generated TypeScript union.
var DirectiveCategories = []EngineerDirectiveCategory{
	DirectiveCategoryPitStrategy,
	DirectiveCategoryCoaching,
	DirectiveCategoryWeather,
	DirectiveCategoryTeammate,
	DirectiveCategoryTyres,
	DirectiveCategoryDamage,
	DirectiveCategoryERS,
	DirectiveCategoryBrakes,
	DirectiveCategoryFuel,
	DirectiveCategoryRivals,
	DirectiveCategoryQualifying,
	DirectiveCategoryFlags,
}

// Urgency levels for directives.
const (
	UrgencyLow      = "low"
	UrgencyMedium   = "medium"
	UrgencyHigh     = "high"
	UrgencyCritical = "critical"
)

// Urgencies lists every urgency level, for the generated TypeScript union.
var Urgencies = []string{UrgencyLow, UrgencyMedium, UrgencyHigh, UrgencyCritical}

// DirectiveMessageType is the type of a directive message on /ws/engineer.
const DirectiveMessageType = "directive"

// DrivingPhase represents the real-time operational context of the driver.
type DrivingPhase string

const (
	PhaseRedFlag      DrivingPhase = "RED_FLAG"
	PhaseInGarage     DrivingPhase = "IN_GARAGE"
	PhasePitLane      DrivingPhase = "PIT_LANE"
	PhaseFormationLap DrivingPhase = "FORMATION_LAP"
	PhaseGrid         DrivingPhase = "GRID"
	PhaseRaceStart    DrivingPhase = "RACE_START"
	PhaseSafetyCar    DrivingPhase = "SAFETY_CAR"
	PhaseOutLap       DrivingPhase = "OUT_LAP"
	PhaseInLap        DrivingPhase = "IN_LAP"
	PhaseFlyingLap    DrivingPhase = "FLYING_LAP"
	PhaseRacing       DrivingPhase = "RACING"
	PhasePostRace     DrivingPhase = "POST_RACE"
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

// AlertKeyConfig defines execution guards and dedup scopes for an alert key.
type AlertKeyConfig struct {
	Category                EngineerDirectiveCategory
	ValidPhases             []DrivingPhase
	MinLapDistancePct       float32
	SuppressAfterPitForLaps int
	DedupScope              DedupScope
	// MaxDelayMs is how long the call stays worth saying while a passing gate holds it back
	// (braking, radio spacing, cooldown, pause). Zero means DefaultMaxDelayMs.
	MaxDelayMs int64
	// MinRepeatMs is the shortest gap before the call is made again, at any urgency. Zero means
	// DefaultMinRepeatMs.
	MinRepeatMs int64
}

// Tuning holds the race engineer values the driver sets in the dashboard: radio spacing and
// every alert threshold. It is the shared part of the engine config and the saved engineer
// settings (settings.Engineer), so both use the same JSON names.
type Tuning struct {
	ChatterCooldownMs      int64   `json:"chatter_cooldown_ms"`
	SmartDiscretionEnabled bool    `json:"smart_discretion_enabled"`
	TyreWearWarnPct        float32 `json:"tyre_wear_warn_pct"`
	TyreWearCritPct        float32 `json:"tyre_wear_crit_pct"`
	// TyreTempMarginC is how far outside the compound's working window the tyre surface must be
	// before the engineer calls it hot or cold.
	TyreTempMarginC        float32 `json:"tyre_temp_margin_c"`
	WingDamageWarnPct      float32 `json:"wing_damage_warn_pct"`
	FloorDamageWarnPct     float32 `json:"floor_damage_warn_pct"`
	EngineWearWarnPct      float32 `json:"engine_wear_warn_pct"`
	ERSLowPct              float32 `json:"ers_low_pct"`
	EngineOverheatC        float32 `json:"engine_overheat_c"`
	BrakeOverheatC         float32 `json:"brake_overheat_c"`
	BrakeColdC             float32 `json:"brake_cold_c"`
	FuelDeltaLaps          float32 `json:"fuel_delta_laps"`
	UndercutGapSec         float32 `json:"undercut_gap_sec"`
	RivalGapSec            float32 `json:"rival_gap_sec"`
	RivalAheadGapSec       float32 `json:"rival_ahead_gap_sec"`
	QualyCleanAirSec       float32 `json:"qualy_clean_air_sec"`
	CornerCutWarnThreshold int     `json:"corner_cut_warn_threshold"`
	RainHorizonMin         float32 `json:"rain_horizon_min"`
	RainProbPct            float32 `json:"rain_prob_pct"`
}

// DefaultTuning returns the built-in radio spacing and alert thresholds.
func DefaultTuning() Tuning {
	return Tuning{
		ChatterCooldownMs:      DefaultDirectiveCooldownMs,
		SmartDiscretionEnabled: true,
		TyreWearWarnPct:        40.0,
		TyreWearCritPct:        75.0,
		TyreTempMarginC:        TyreDegradationTempMarginC,
		WingDamageWarnPct:      20.0,
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
		CornerCutWarnThreshold: CornerCutWarnDefaultThreshold,
		RainHorizonMin:         WeatherRainHorizonMinutes,
		RainProbPct:            WeatherRainTransitionProbPct,
	}
}

// EngineerConfig is what the engine runs with: the driver's tuning plus the values the server
// owns. EnabledCategories is derived from the dashboard's alert switches
// (EnabledCategoriesFromSwitches); clients never send it.
type EngineerConfig struct {
	Tuning
	GlobalChatterCooldownMs int64           `json:"global_chatter_cooldown_ms"`
	WingDamageCritPct       float32         `json:"wing_damage_crit_pct"`
	QualyTimeWarnSec        float32         `json:"qualy_time_warn_sec"`
	EnabledCategories       map[string]bool `json:"enabled_categories,omitempty"`
}

// clone returns a copy of the config that shares no maps with the original.
func (c EngineerConfig) clone() EngineerConfig {
	c.EnabledCategories = maps.Clone(c.EnabledCategories)
	return c
}

// DefaultEngineerConfig returns a default configured EngineerConfig.
func DefaultEngineerConfig() EngineerConfig {
	return EngineerConfig{
		Tuning:                  DefaultTuning(),
		GlobalChatterCooldownMs: GlobalRadioChatterCooldownMs,
		WingDamageCritPct:       CriticalWingDamageThresholdPct,
		QualyTimeWarnSec:        QualyTimeWarnDefaultSec,
		EnabledCategories:       make(map[string]bool),
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
//
// On the wire it carries no text: the dashboard speaks the call from its own phrase catalog,
// picked by SubAlert, in the listener's language and persona. Title and Message stay on the
// server for the log and the AI race history.
type EngineerDirective struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type" tstype:"'directive'"` // always DirectiveMessageType
	Category    EngineerDirectiveCategory `json:"category" tstype:"EngineerDirectiveCategory"`
	SubAlert    string                    `json:"sub_alert" tstype:"EngineerAlertKey"` // one of RadioAlertKeys
	Title       string                    `json:"-"`
	Message     string                    `json:"-"`
	Urgency     string                    `json:"urgency" tstype:"EngineerUrgency"`
	Timestamp   int64                     `json:"timestamp"`
	CarIndex    int                       `json:"car_index"`
	SessionTime float32                   `json:"session_time"`
	// TTLMs is how long after it arrives the call is still worth saying; a dashboard drops it
	// from its speech queue after that.
	TTLMs int64 `json:"ttl_ms"`
}

// Directive is an alias for EngineerDirective for concise usage.
type Directive = EngineerDirective

// EvaluationContext contains the telemetry state snapshot and runtime parameters passed to rules.
type EvaluationContext struct {
	Header           packets.PacketHeader
	Packet           packets.Packet
	Session          *packets.PacketSessionData
	LapData          *packets.PacketLapData
	Telemetry        *packets.PacketCarTelemetryData
	Telemetry2       *packets.PacketCarTelemetry2Data
	Damage           *packets.PacketCarDamageData
	Status           *packets.PacketCarStatusData
	TyreSets         *packets.PacketTyreSetsData
	Participants     *packets.PacketParticipantsData
	Config           EngineerConfig
	Phase            DrivingPhase
	PreviousPhase    DrivingPhase
	PlayerCarIndex   int
	TeammateCarIndex int
	PlayerTeamID     int
	PacketFormat     uint16
	CurrentLap       int
	Now              int64
}

// PlayerLap returns the player car's LapData if available.
func (ctx *EvaluationContext) PlayerLap() *packets.LapData {
	if ctx.LapData == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.LapData.LapData) {
		return nil
	}
	return &ctx.LapData.LapData[ctx.PlayerCarIndex]
}

// PlayerStatus returns the player car's CarStatusData if available.
func (ctx *EvaluationContext) PlayerStatus() *packets.CarStatusData {
	if ctx.Status == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.Status.CarStatusData) {
		return nil
	}
	return &ctx.Status.CarStatusData[ctx.PlayerCarIndex]
}

// PlayerTelemetry returns the player car's CarTelemetryData if available.
func (ctx *EvaluationContext) PlayerTelemetry() *packets.CarTelemetryData {
	if ctx.Telemetry == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.Telemetry.CarTelemetryData) {
		return nil
	}
	return &ctx.Telemetry.CarTelemetryData[ctx.PlayerCarIndex]
}

// PlayerTelemetry2 returns the player car's CarTelemetry2Data if available.
func (ctx *EvaluationContext) PlayerTelemetry2() *packets.CarTelemetry2Data {
	if ctx.Telemetry2 == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.Telemetry2.CarTelemetry2Data) {
		return nil
	}
	return &ctx.Telemetry2.CarTelemetry2Data[ctx.PlayerCarIndex]
}

// PlayerDamage returns the player car's CarDamageData if available.
func (ctx *EvaluationContext) PlayerDamage() *packets.CarDamageData {
	if ctx.Damage == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.Damage.CarDamageData) {
		return nil
	}
	return &ctx.Damage.CarDamageData[ctx.PlayerCarIndex]
}

// PlayerTyreSets returns the player car's PacketTyreSetsData if available and matching playerCarIndex.
func (ctx *EvaluationContext) PlayerTyreSets() *packets.PacketTyreSetsData {
	if ctx.TyreSets == nil || int(ctx.TyreSets.CarIdx) != ctx.PlayerCarIndex {
		return nil
	}
	return ctx.TyreSets
}

// IsRaceSession returns true if the session is a confirmed race session.
func (ctx *EvaluationContext) IsRaceSession() bool {
	if ctx.Session == nil {
		return false
	}
	return packets.IsRaceSession(ctx.Session.SessionType)
}

// IsQualifyingSession returns true if the session is qualifying or shootout.
func (ctx *EvaluationContext) IsQualifyingSession() bool {
	if ctx.Session == nil {
		return false
	}
	return packets.IsQualifyingSession(ctx.Session.SessionType)
}

// IsPracticeSession returns true if the session is practice.
func (ctx *EvaluationContext) IsPracticeSession() bool {
	if ctx.Session == nil {
		return false
	}
	return packets.IsPracticeSession(ctx.Session.SessionType)
}

// Is2026 returns true if the packet format is F1 2026 or newer.
func (ctx *EvaluationContext) Is2026() bool {
	return ctx.Header.PacketFormat >= packets.PacketFormat2026 || ctx.PacketFormat >= packets.PacketFormat2026
}

// CalculateLapDistanceFraction estimates progress along the track [0.0, 1.0] from session and player lap data.
func CalculateLapDistanceFraction(session *packets.PacketSessionData, playerLap *packets.LapData) float32 {
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
			return SectorMidpointFractionS1
		case 1:
			return SectorMidpointFractionS2
		case 2:
			return SectorMidpointFractionS3
		}
	}
	return 0
}

// CalculateLapDistancePct returns estimated progress along the track [0.0, 1.0].
func (ctx *EvaluationContext) CalculateLapDistancePct() float32 {
	return CalculateLapDistanceFraction(ctx.Session, ctx.PlayerLap())
}

// EngineerRule defines the strategy interface for AI Race Engineer rule evaluation.
type EngineerRule interface {
	// Name returns a unique identifier for this rule.
	Name() string

	// Category returns the primary category for grouping and chatter cooldowns.
	Category() string

	// ValidPhases returns the driving phases in which this rule can emit directives.
	ValidPhases() []DrivingPhase

	// AlertKeys returns configuration for all alert keys emitted by this rule.
	AlertKeys() map[string]AlertKeyConfig

	// Evaluate inspects the context snapshot and returns zero or more directives.
	Evaluate(ctx *EvaluationContext) []Directive

	// Reset clears internal state according to the given deduplication scope.
	Reset(scope DedupScope)
}

func isPacketType[T packets.Packet](p packets.Packet) bool {
	if p == nil {
		return false
	}
	_, ok := p.(T)
	return ok
}
