package engineer

// Analytical thresholds, timing constants, and heuristic parameters for the AI Race Engineer Engine.
const (
	// DefaultDirectiveCooldownMs is the default cooldown between non-critical directives in the same category.
	DefaultDirectiveCooldownMs = 45_000

	// Smart Driving Discretion thresholds
	SmartDiscretionBrakeThreshold = 0.30
	SmartDiscretionSteerThreshold = 0.35

	// Stint & Pit stop tracking heuristics
	PitStopDetectionMaxTyreAgeLaps = 1
	MinStintLapsForReset           = 3
	PostPitSuppressionLaps         = 1

	// Speed and distance estimations
	AverageRaceSpeedMetersPerSec   = 65.0
	QualyOutLapSpeedMetersPerSec   = 60.0
	SpeedGarageMaxKmh              = 5.0
	SpeedGridMaxKmh                = 10.0
	MaxGridTrackDistanceMeters     = 300.0
	InLapFastCarBehindGapSec       = 3.5
	InLapFastCarBehindSpeedDiffKmh = 40.0
	DefaultTrackLengthMeters       = 5000.0
	MaxCleanAirDistanceMeters      = 9000.0
	MaxTrackDistanceDeltaInitial   = 99999.0

	// Lap progress & sector midpoint approximations
	SectorMidpointFractionS1       = 0.15
	SectorMidpointFractionS2       = 0.50
	SectorMidpointFractionS3       = 0.85
	MinOutLapDistanceCompletionPct = 0.30
	MinQualyOutLapDistancePct      = 0.50

	// Tyre & Thermal thresholds
	PunctureWearThresholdPct = 95.0
	OverheatRearTyres2025C   = 115.0
	OverheatRearTyres2026C   = 110.0
	ColdTyresTargetC         = 85.0
	ColdTyresMaxAgeLaps      = 2
	TyreIndexRL              = 2
	TyreIndexRR              = 3

	// Mechanical & Aero damage thresholds
	CriticalWingDamageThresholdPct = 40.0
	RivalDamageWingThresholdPct    = 20.0

	// Power Unit & Brakes thresholds
	EngineOverheatDefaultC = 125.0
	BrakeOverheatDefaultC  = 900.0
	BrakeColdDefaultC      = 200.0

	// Fuel & Pit strategy thresholds
	FuelDeltaDeficitDefaultLaps  = -0.5
	MinFuelAlertLapNum           = 3
	DefaultPitLaneLossSeconds    = 21.0
	CleanAirTrafficWindowSeconds = 3.0
	UndercutGapDefaultSec        = 2.5
	CleanAirPeriodicLapModulo    = 5

	// Coaching & Sector delta thresholds
	SectorTimeLossThresholdSec = 0.35
	TeammateGapThresholdSec    = 2.5

	// Rivals & Overtake thresholds
	RivalDefendGapDefaultSec = 1.0
	RivalAttackGapDefaultSec = 1.2

	// Qualifying & Shootout thresholds
	QualyCleanAirDefaultSec             = 4.0
	QualyTimeWarnDefaultSec             = 180.0
	QualyElimDangerTimeSec              = 300.0
	FinalSectorTrackDistanceFraction    = 0.70
	MinTrafficAheadDistanceMeters       = 10.0
	QualyQ1EliminationPositionThreshold = 15
	QualyQ2EliminationPositionThreshold = 10

	// Flags & Weather thresholds
	WeatherRainTransitionProbPct  = 50
	WeatherRainHorizonMinutes     = 5
	CornerCutWarnDefaultThreshold = 2
)
