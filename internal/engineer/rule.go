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
	// SkipCategoryCooldown lets the call through right after another of its category: a step of
	// the pit stop, said when it happens.
	SkipCategoryCooldown bool
	// BreaksRadioSilence lets the call through the radio silence of a flying lap and of the race
	// start at any urgency: what the driver must hear right then (a yellow flag, a slow car ahead).
	BreaksRadioSilence bool
	// NotWhileBoxDue drops the call while a call to box is open: news of a stop to come, or the
	// option of one, is moot once the driver was told to box.
	NotWhileBoxDue bool
	// LapBound drops the call once the player starts another lap while a passing gate holds it:
	// what it says ("box next lap") is only true on the lap it was made for.
	LapBound bool
	// PitLaneCall lets the call through while the player is in the pit box or on the pit limiter:
	// it is about the stop being made.
	PitLaneCall bool
	// OutlastsSilence holds the call through radio silence (the grid, the start, a flying lap) and
	// the phases that pass with it (the formation lap) instead of dropping it: a condition of the
	// car (damage, wear, a temperature) is still true once the radio is open. Its MaxDelayMs counts
	// from the end of the silence, for at most SilenceMaxHoldMs in all.
	OutlastsSilence bool
	// SpeechMs is about how long the call takes to say; the next routine call waits for it. Zero
	// means DefaultSpeechMs.
	SpeechMs int64
	// CooldownGroup is the chatter cooldown the call starts and waits for instead of its
	// category's: a report or a 2026 aero zone call doesn't hold back the battle calls after it.
	CooldownGroup string
	// WaitsForSCToSettle holds the call for the first SCColdCallDelayMs of a Safety Car or VSC,
	// so the deployment's own calls come first.
	WaitsForSCToSettle bool
}

// Cooldown groups of the calls that don't share their category's chatter cooldown.
const (
	cooldownReports      = "reports"
	cooldownAeroZones    = "aero_zones"
	cooldownFormationLap = "formation_lap"
)

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
	// PitCallLeadM is how far before the pit entry a call to box this lap must come; later than
	// that the call says to box next lap.
	PitCallLeadM float32 `json:"pit_call_lead_m"`
	// GapReportLaps is how many laps apart the gap reports come in a race.
	GapReportLaps int `json:"gap_report_laps"`
	// QualyCarBehindSec is how far back, in seconds at its pace, a car on a push lap is called to a
	// player who isn't pushing.
	QualyCarBehindSec float32 `json:"qualy_car_behind_sec"`
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
		PitCallLeadM:           DefaultPitCallLeadM,
		GapReportLaps:          DefaultGapReportLaps,
		QualyCarBehindSec:      QualyCarBehindDefaultSec,
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
	// Box is when the driver can pit, on a call that asks them to (BoxCall).
	Box BoxTiming `json:"box,omitempty" tstype:"EngineerBoxTiming"`
	// BoxCall says whether the call asks the driver to pit; the rule sets it.
	BoxCall BoxCall `json:"-"`
	// Values are the numbers a report says (gap report, tyre life); the dashboard speaks them.
	Values *DirectiveValues `json:"values,omitempty"`
	// lapDistance is where the player was on the lap when the call was made, for the log.
	lapDistance float32
}

// DirectiveValues are the numbers a report call says. Only the fields of its report are set.
type DirectiveValues struct {
	// Position is the player's position (gap report, elimination danger, lap result, finish).
	Position int `json:"position,omitempty"`
	// Ahead and Behind are the cars close in front and behind: in the gap report, nil when there
	// is no car within GapReportMaxGapSec; in qualifying traffic calls, the car the call is about.
	Ahead  *GapToCar `json:"ahead,omitempty"`
	Behind *GapToCar `json:"behind,omitempty"`
	// TyreLapsLeft is about how many laps the tyres have before the wear limit (tyre life).
	TyreLapsLeft int `json:"tyre_laps_left,omitempty"`
	// Minutes is how many minutes are left in the session, rounded up (session clock).
	Minutes int `json:"minutes,omitempty"`
	// PoleGapSec is how far a qualifying lap is off P1's best, or, on provisional pole, how far
	// ahead of P2's, to a thousandth; 0 while unknown (lap result).
	PoleGapSec float64 `json:"pole_gap_sec,omitempty"`
	// Elimination says the lap result leaves the player on the last place through or in the drop
	// zone of Q1 or Q2; empty when safe or nobody is knocked out (lap result).
	Elimination EliminationStatus `json:"elimination,omitempty" tstype:"EngineerElimination"`
	// Count is how many track limits warnings the player has (track limits).
	Count int `json:"count,omitempty"`
	// PenaltySec is the time penalty just given, in seconds (penalties).
	PenaltySec int `json:"penalty_sec,omitempty"`
	// StopSec is how long the car stood in the pit box, to a tenth (pit stop time).
	StopSec float64 `json:"stop_sec,omitempty"`
}

// EliminationStatus is where a qualifying position stands against the cut line.
type EliminationStatus string

const (
	EliminationLastThrough EliminationStatus = "last_through"
	EliminationDropZone    EliminationStatus = "drop_zone"
)

// EliminationStatuses lists every EliminationStatus, for the generated TypeScript union.
var EliminationStatuses = []string{string(EliminationLastThrough), string(EliminationDropZone)}

// GapToCar is the gap to a car close ahead or behind and how it is moving.
type GapToCar struct {
	// GapSec is the gap in seconds, to a tenth.
	GapSec float64 `json:"gap_sec"`
	// Trend is how the gap moved over the last laps; empty until it can be measured.
	Trend GapTrendDirection `json:"trend,omitempty" tstype:"EngineerGapTrend"`
	// PerLapSec is how much the gap changes each lap, to a tenth; 0 when stable.
	PerLapSec float64 `json:"per_lap_sec,omitempty"`
}

// GapTrendDirection says whether a gap is shrinking, growing or holding.
type GapTrendDirection string

const (
	GapClosing GapTrendDirection = "closing"
	GapOpening GapTrendDirection = "opening"
	GapStable  GapTrendDirection = "stable"
)

// GapTrendDirections lists every GapTrendDirection, for the generated TypeScript union.
var GapTrendDirections = []string{string(GapClosing), string(GapOpening), string(GapStable)}

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
	// PitEntryM is the track's pit entry as a lap distance, learned from the cars that pit; 0
	// while unknown.
	PitEntryM float32
	// PlayerLaps are the player's completed laps this session, oldest first. Read only.
	PlayerLaps []LapRecord
	// CallLaps is the lap each alert key was last said on. Read only.
	CallLaps map[string]int
	// BoxDueLap is the lap a call told the player to box on; 0 when none is open.
	BoxDueLap int
	// PitPlan is the game's plan for the player's next pit stop in a race.
	PitPlan PitPlanState
	// CarHistory is each car's latest session history packet (nil until one came). Read only.
	CarHistory *[packets.MaxCars]*packets.PacketSessionHistoryData
	// PitEntries marks the cars whose pit status went from none to pitting on this lap data
	// packet: each stop shows once, whatever phase the player was in.
	PitEntries [packets.MaxCars]bool
	// ChequeredFlag is whether the leader has taken the chequered flag in this race.
	ChequeredFlag bool
	// TrackProfile is what was learned about the track (pit lane, quiet stretches); nil when
	// nothing was. Read only.
	TrackProfile *trackProfile
	// LastSaid is when each alert key was last said, unix ms. Read only.
	LastSaid map[string]int64
}

// CallLost reports whether the call a rule made under alertKey at madeAt never got on the radio
// and is past its useful life (maxDelayMs): a gate held it until it went stale, or dropped it. A
// rule that makes a call once can make it again then.
func (ctx *EvaluationContext) CallLost(alertKey string, madeAt, maxDelayMs int64) bool {
	return alertKey != "" && ctx.Now-madeAt > maxDelayMs && ctx.LastSaid[alertKey] < madeAt
}

// PitLossSec is what a stop costs at this track against staying out, in seconds: learned from
// the race stops timed here, else DefaultPitLaneLossSeconds.
func (ctx *EvaluationContext) PitLossSec() float64 {
	if loss, ok := ctx.TrackProfile.pitLossSec(ctx.TrackLengthM(), racePaceMps(ctx)); ok {
		return loss
	}
	return DefaultPitLaneLossSeconds
}

// PlayerLap returns the player car's LapData if available.
func (ctx *EvaluationContext) PlayerLap() *packets.LapData {
	if ctx.LapData == nil || ctx.PlayerCarIndex < 0 || ctx.PlayerCarIndex >= len(ctx.LapData.LapData) {
		return nil
	}
	return &ctx.LapData.LapData[ctx.PlayerCarIndex]
}

// BoxTiming is when the player could pit if told to now.
func (ctx *EvaluationContext) BoxTiming() BoxTiming {
	lap := ctx.PlayerLap()
	if lap == nil || ctx.Session == nil {
		return BoxASAP
	}
	return boxTimingAt(lap.LapDistance, float32(ctx.Session.TrackLength), ctx.PitEntryM, ctx.Config.PitCallLeadM)
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

// TrackLengthM is the track's length in metres, or DefaultTrackLengthMeters while unknown.
func (ctx *EvaluationContext) TrackLengthM() float32 {
	if ctx.Session == nil || ctx.Session.TrackLength == 0 {
		return DefaultTrackLengthMeters
	}
	return float32(ctx.Session.TrackLength)
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

// Is2026 reports whether the player's car runs the 2026 regulations (Override and Straight Mode,
// no DRS). The 2026 packet format also carries older cars, so the car's own flag decides; until
// it arrives, the packet format does.
func (ctx *EvaluationContext) Is2026() bool {
	if ctx.Header.PacketFormat < packets.PacketFormat2026 && ctx.PacketFormat < packets.PacketFormat2026 {
		return false
	}
	tele2 := ctx.PlayerTelemetry2()
	return tele2 == nil || tele2.Regulations2026 == 1
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

// conditionSpell is how long a condition (rain, a hot brake) has held.
type conditionSpell struct {
	on    bool
	since int64 // unix ms the condition last became true
}

func (s *conditionSpell) update(on bool, now int64) {
	if on && !s.on {
		s.since = now
	}
	s.on = on
}

// heldFor reports whether the condition has lasted at least ms by now.
func (s conditionSpell) heldFor(now, ms int64) bool {
	return s.on && now-s.since >= ms
}

func isPacketType[T packets.Packet](p packets.Packet) bool {
	if p == nil {
		return false
	}
	_, ok := p.(T)
	return ok
}
