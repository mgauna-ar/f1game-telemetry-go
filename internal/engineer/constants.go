package engineer

import "github.com/mgauna/f1game-telemetry-go/internal/packets"

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
	PunctureWearThresholdPct   = 95.0
	TyreDegradationTempMarginC = 5.0
	OverheatRearTyres2025C     = 115.0
	OverheatRearTyres2026C     = 110.0
	ColdTyresTargetC           = 85.0
	ColdTyresMaxAgeLaps        = 2
	TyreIndexRL                = 2
	TyreIndexRR                = 3

	// Mechanical & Aero damage thresholds
	CriticalWingDamageThresholdPct = 40.0
	RivalDamageWingThresholdPct    = 20.0

	// Power Unit & Brakes thresholds
	EngineOverheatDefaultC = 125.0
	EnginePowerWarnTempC   = 135.0
	EnginePowerCritTempC   = 145.0
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

// TyreThermalWindow represents the optimal operating temperature range (°C) for a compound.
type TyreThermalWindow struct {
	CompoundName string
	MinTemp      float32
	MaxTemp      float32
}

// CompoundThermalWindows contains the optimal operating temperature range (°C) by compound.
var CompoundThermalWindows = map[string]TyreThermalWindow{
	"C1":           {CompoundName: "C1", MinTemp: 95.0, MaxTemp: 115.0},
	"C2":           {CompoundName: "C2", MinTemp: 85.0, MaxTemp: 115.0},
	"C3":           {CompoundName: "C3", MinTemp: 85.0, MaxTemp: 95.0},
	"C4":           {CompoundName: "C4", MinTemp: 75.0, MaxTemp: 95.0},
	"C5":           {CompoundName: "C5", MinTemp: 75.0, MaxTemp: 85.0},
	"C6":           {CompoundName: "C6", MinTemp: 65.0, MaxTemp: 85.0},
	"INTERMEDIATE": {CompoundName: "INTERMEDIATE", MinTemp: 55.0, MaxTemp: 75.0},
	"WET":          {CompoundName: "WET", MinTemp: 55.0, MaxTemp: 65.0},
}

// EngineThermalStep represents a point on the engine thermal derate curve.
type EngineThermalStep struct {
	TempC    float32
	PowerPct float32
}

// EngineThermalDerateCurve maps engine temperature (°C) to power output percentage (%).
var EngineThermalDerateCurve = []EngineThermalStep{
	{TempC: 65.0, PowerPct: 96.0},
	{TempC: 75.0, PowerPct: 97.0},
	{TempC: 85.0, PowerPct: 98.0},
	{TempC: 95.0, PowerPct: 99.0},
	{TempC: 105.0, PowerPct: 99.7},
	{TempC: 115.0, PowerPct: 100.0},
	{TempC: 125.0, PowerPct: 100.0},
	{TempC: 135.0, PowerPct: 98.5},
	{TempC: 145.0, PowerPct: 94.0},
	{TempC: 155.0, PowerPct: 91.0},
	{TempC: 165.0, PowerPct: 88.5},
	{TempC: 175.0, PowerPct: 85.0},
}

// GetTyreThermalWindow returns the optimal thermal operating window for a tyre given actual and visual compound IDs.
func GetTyreThermalWindow(actualCompound, visualCompound uint8) TyreThermalWindow {
	switch actualCompound {
	case packets.ActualCompoundC1:
		return CompoundThermalWindows["C1"]
	case packets.ActualCompoundC2:
		return CompoundThermalWindows["C2"]
	case packets.ActualCompoundC3:
		return CompoundThermalWindows["C3"]
	case packets.ActualCompoundC4:
		return CompoundThermalWindows["C4"]
	case packets.ActualCompoundC5:
		return CompoundThermalWindows["C5"]
	case packets.CompoundInter:
		return CompoundThermalWindows["INTERMEDIATE"]
	case packets.CompoundWet:
		return CompoundThermalWindows["WET"]
	}

	// Visual compound fallbacks agreed in design: Soft -> C4, Medium -> C3, Hard -> C2
	switch visualCompound {
	case packets.CompoundSoft:
		return CompoundThermalWindows["C4"]
	case packets.CompoundMedium:
		return CompoundThermalWindows["C3"]
	case packets.CompoundHard:
		return CompoundThermalWindows["C2"]
	case packets.CompoundInter:
		return CompoundThermalWindows["INTERMEDIATE"]
	case packets.CompoundWet:
		return CompoundThermalWindows["WET"]
	default:
		// Default conservative F1 dry slick fallback (C3 window)
		return CompoundThermalWindows["C3"]
	}
}

// CalculateEnginePowerPct calculates current power percentage and power loss percentage based on engine temperature.
func CalculateEnginePowerPct(tempC float32) (powerPct, powerLossPct float32) {
	if len(EngineThermalDerateCurve) == 0 {
		return 100.0, 0.0
	}
	if tempC <= EngineThermalDerateCurve[0].TempC {
		powerPct = EngineThermalDerateCurve[0].PowerPct
		return powerPct, 100.0 - powerPct
	}
	lastIdx := len(EngineThermalDerateCurve) - 1
	if tempC >= EngineThermalDerateCurve[lastIdx].TempC {
		powerPct = EngineThermalDerateCurve[lastIdx].PowerPct
		return powerPct, 100.0 - powerPct
	}

	// Piecewise linear interpolation between curve steps
	for i := 0; i < lastIdx; i++ {
		p1 := EngineThermalDerateCurve[i]
		p2 := EngineThermalDerateCurve[i+1]
		if tempC >= p1.TempC && tempC <= p2.TempC {
			if p2.TempC == p1.TempC {
				powerPct = p1.PowerPct
				return powerPct, 100.0 - powerPct
			}
			ratio := (tempC - p1.TempC) / (p2.TempC - p1.TempC)
			powerPct = p1.PowerPct + ratio*(p2.PowerPct-p1.PowerPct)
			return powerPct, 100.0 - powerPct
		}
	}

	return 100.0, 0.0
}
