package engineer

import "github.com/mgauna/f1game-telemetry-go/internal/packets"

// Analytical thresholds, timing constants, and heuristic parameters for the AI Race Engineer Engine.
const (
	// DefaultDirectiveCooldownMs is the default cooldown between non-critical directives in the same category.
	DefaultDirectiveCooldownMs = 45_000
	// GlobalRadioChatterCooldownMs is the gap after a call is spoken before the next routine one.
	GlobalRadioChatterCooldownMs = 1_500

	// Smart Driving Discretion thresholds
	SmartDiscretionBrakeThreshold = 0.30
	SmartDiscretionSteerThreshold = 0.35

	// Radio delivery: how long a call held back by a passing gate (braking, radio spacing, cooldown,
	// pause) stays worth saying, the shortest gap before the same call is made again, and how long
	// a dashboard may keep a call queued behind other speech.
	DefaultMaxDelayMs     = 20_000
	MomentMaxDelayMs      = 5_000  // gaps, aero zones and sector times go stale fast
	ConditionMaxDelayMs   = 60_000 // wear, damage and similar conditions stay true
	DefaultMinRepeatMs    = 10_000
	CollisionMinRepeatMs  = 15_000
	BlueFlagMinRepeatMs   = 20_000
	EngineTempMinRepeatMs = 60_000
	TrafficMinRepeatMs    = 1_500 // a second car on a push lap gets its own call
	TrafficMaxDelayMs     = 2_500 // a traffic call says when a car arrives: a few seconds later it is wrong
	BattleMinRepeatMs     = 3_000 // a new car right behind gets its defend call; the same car is called once per approach
	MaxSpeechTTLMs        = 15_000
	MinSpeechTTLMs        = 2_000
	SilenceMaxHoldMs      = 180_000 // the longest a condition call waits out radio silence (a formation lap and the start)

	// Radio timing: how long a call takes from the server to the driver's ears and to say, so the
	// next routine call waits for it to end. A critical call (Safety Car, red flag, a crash) gets a
	// breather after it. Cold tyre and brake calls wait for a Safety Car deployment's own calls.
	RadioDeliveryLatencyMs = 1_000 // From the server to speech starting: phrase, synthesis, beep
	DefaultSpeechMs        = 4_500
	LongSpeechMs           = 7_000 // A report with several numbers
	TrafficSpeechMs        = 2_500 // "Push-lap car behind, with you in 8 seconds."
	CriticalBreatherMs     = 4_000
	SCColdCallDelayMs      = 20_000
	// RadioHeardKeptCalls: the latest calls the dashboards reported on (RecordRadioHeard) are
	// remembered, so a second dashboard's report of the same call doesn't count again.
	RadioHeardKeptCalls = 32
	// Delivery lead: how long a traffic call takes from the server to its first word, the
	// TrafficLeadPercentile of the latest TrafficLeadSamples traffic calls said at once (none
	// waiting behind other speech), clamped to [TrafficLeadMinMs, TrafficLeadMaxMs].
	// RadioDeliveryLatencyMs stands in until TrafficLeadMinSamples were reported.
	TrafficLeadSamples    = 20
	TrafficLeadMinSamples = 5
	TrafficLeadPercentile = 0.8
	TrafficLeadMinMs      = 300
	TrafficLeadMaxMs      = 3_000
	// PauseDetectMs: a session clock standing still this long is a pause; held calls don't age
	// through it.
	PauseDetectMs = 1_000

	// AI-worded calls: a routine call that stays worth saying for RadioLineMinTTLMs may be worded
	// by the AI. Wording takes about RadioLineLeadMs, so the call goes out that much earlier for a
	// straight and keeps the radio busy that much longer. The AI is shown the last
	// RadioLineRecentLines lines said for the call, so it words it differently.
	RadioLineMinTTLMs    = 6_000
	RadioLineLeadMs      = 1_500
	RadioLineRecentLines = 3

	// Quiet stretches: where on the lap the player is flat out, off the brakes and straight, learned
	// in QuietBinM bins over QuietLearnMinLaps whole laps at racing pace (QuietMinCoverage of the
	// bins sampled). A routine call waits for one long enough to say it, for up to QuietWaitShare
	// of its useful life.
	QuietBinM            = 50.0
	QuietThrottleMin     = 0.95
	QuietBrakeMax        = 0.05
	QuietSteerMax        = 0.10
	QuietMinSpeedKmh     = 150.0
	QuietMinCoverage     = 0.90
	QuietLapWeight       = 0.3 // Weight of the latest lap in each bin's average
	QuietLearnMinLaps    = 3
	QuietBinMinShare     = 0.7 // A bin is quiet when the player is flat out and straight there this often
	QuietUnknownSpeedMps = 50.0
	QuietWaitShare       = 0.5

	// Stint & Pit stop tracking heuristics
	PitStopDetectionMaxTyreAgeLaps = 1
	MinStintLapsForReset           = 3
	StintResetMinGapMs             = 60_000 // One stop's signals (stop count, new set, tyre age) start one stint
	MinServiceStopSec              = 1.0    // A stop shorter than this once a stop-go is taken off was only the penalty
	PostPitSuppressionLaps         = 1
	TyreCrossoverMinStintLaps      = 2

	// Race start & pit stop procedure heuristics
	GridApproachDistanceFraction  = 0.92   // Within final 8% of track on formation lap
	RaceStartPhaseDistanceM       = 1000.0 // Lap 1 distance after which the start's radio silence ends
	RaceStartReactionMaxDistanceM = 3000.0 // Lap 1 distance after which the launch reaction is too old to report
	MinValidReactionTimeSeconds   = 0.05
	MaxValidReactionTimeSeconds   = 1.50
	FastReactionTimeThresholdSec  = 0.25
	SlowReactionTimeThresholdSec  = 0.40
	FastPitStopDurationSec        = 2.8
	SlowPitStopDurationSec        = 4.0

	// Speed and distance estimations. AverageRaceSpeedMetersPerSec is also the push-lap pace
	// qualifying traffic gaps are measured at before anyone has set a lap.
	AverageRaceSpeedMetersPerSec = 65.0
	SpeedGarageMaxKmh            = 5.0
	SpeedGridMaxKmh              = 10.0
	MaxGridTrackDistanceMeters   = 300.0
	DefaultTrackLengthMeters     = 5000.0

	// Lap progress & sector midpoint approximations
	SectorMidpointFractionS1       = 0.15
	SectorMidpointFractionS2       = 0.50
	SectorMidpointFractionS3       = 0.85
	MinOutLapDistanceCompletionPct = 0.30
	MinQualyOutLapDistancePct      = 0.50

	// Tyre & Thermal thresholds
	TyreWornOutPct             = 95.0 // A tyre this worn is finished: box
	TyreDegradationTempMarginC = 5.0
	ColdTyresMaxAgeLaps        = 2

	// Puncture: a tyre whose damage jumps this much within the window, or whose pressure falls
	// this far below the other tyre on its axle. Damage and pressure changes this big are logged
	// so a real puncture can be checked against them.
	PunctureDamageJumpPct    = 30.0
	PunctureWindowMs         = 2_000
	PuncturePressureDropPSI  = 4.0
	PunctureLogDamageJumpPct = 10.0

	// Wet/dry crossover: how long the weather must hold before the tyre change is called. Heavy
	// rain is called at once.
	CrossoverRainConfirmMs = 60_000
	CrossoverDryConfirmMs  = 120_000

	// Mechanical & Aero damage thresholds
	CriticalWingDamageThresholdPct = 40.0
	RivalDamageWingThresholdPct    = 20.0
	DamageRearmDropPct             = 10.0 // Damage this far back down (flashback, repair) can be called again

	// Power Unit & Brakes thresholds
	EngineOverheatDefaultC            = 125.0
	EnginePowerWarnTempC              = 135.0
	EnginePowerCritTempC              = 145.0
	BrakeOverheatDefaultC             = 900.0
	BrakeColdDefaultC                 = 200.0
	BrakeHotSustainMs                 = 5_000 // A brake must stay over the limit this long: one big stop isn't overheating
	BrakeBiasOverheatThresholdC       = 800.0
	BrakeBiasImbalanceDeltaThresholdC = 400.0
	BrakeBiasEqualizedDeltaThresholdC = 150.0
	BrakeZoneMinPedal                 = 0.5 // Brake pedal from which a braking zone counts for the bias check
	BrakeBiasZones                    = 5   // Braking zones whose peak axle temperatures the bias check averages

	// Fuel & Pit strategy thresholds
	FuelDeltaDeficitDefaultLaps  = -0.5
	FuelDeltaRecallStepLaps      = 0.5 // The fuel deficit is said again once a stint only this much worse
	MinFuelAlertLapNum           = 3
	DefaultPitLaneLossSeconds    = 21.0
	CleanAirTrafficWindowSeconds = 3.0
	UndercutGapDefaultSec        = 2.5
	CleanAirMinTyreAgeLaps       = 3 // Tyres younger than this were just fitted: no clean air call

	// Coaching & Sector delta thresholds
	SectorTimeLossThresholdSec     = 0.35
	SectorTimeLossMaxThresholdSec  = 3.0
	TeammateGapThresholdSec        = 2.5
	ERSPushLapDistanceFraction     = 0.85
	ERSClippingThresholdJoules     = 3800000.0
	ERSLowRecallStepPct            = 5.0     // The low battery call is said again in a stint only this much lower...
	ERSLowRecallMinMs              = 120_000 // ...and this long after the last one
	ERSClippingMaxDistanceFraction = 0.85

	// Rivals & Overtake thresholds
	RivalDefendGapDefaultSec = 1.0
	RivalAttackGapDefaultSec = 1.2
	RivalRearmHysteresisSec  = 0.5 // Gap beyond the threshold before the same rival can be called again
	// A car closing into battle range, ahead or behind, is called once on its way from this far...
	RivalClosingWindowSec = 4.0
	// ...when the gap comes down by this much a lap or more, and it gets there within this many
	// laps and before the flag. It is called again once it drops back this far past the window.
	RivalClosingMinSecPerLap = 0.2
	RivalClosingMaxLaps      = 10
	RivalClosingRearmSec     = 1.0
	// RivalClosingMaxSecPerLap: a gap coming down faster than this a lap isn't race pace: a stop
	// or a Safety Car falls in the laps it was measured over.
	RivalClosingMaxSecPerLap = 2.0
	// RivalPenaltyMaxGapSec: a time penalty given to the car right ahead or behind is said while
	// it is this close.
	RivalPenaltyMaxGapSec = 10.0
	// NearbyPitGapSec: a car this close ahead or behind that pits is news.
	NearbyPitGapSec = 10.0
	// RejoinTrafficSec: the plan's heads-up says the car a stop would rejoin behind when it is this
	// close ahead of the rejoin.
	RejoinTrafficSec = 2.0

	// Pit entry and box calls
	DefaultPitCallLeadM = 500.0 // How far before the pit entry a "box this lap" call must come
	PitEntryMaxSamples  = 9     // Pit entry samples kept per track; the entry is their median
	// The pit lane's cost: timed race stops kept per track, the shortest time in the lane that is a
	// stop, and the range a learned cost must fall in (else DefaultPitLaneLossSeconds is used).
	PitLaneMaxSamples = 9
	PitLaneMinMs      = 5_000
	PitLossMinSec     = 5.0
	PitLossMaxSec     = 60.0
	// PitEntryReminderMinGapMs: no pit entry reminder this soon after the call to box.
	PitEntryReminderMinGapMs = 15_000

	// The game's pit plan (its ideal and latest lap to pit)
	PitPlanMinLapsToGo    = 2    // No call to box on the plan in the race's last laps
	PitPlanMinTyreAgeLaps = 3    // Tyres younger than this were just fitted: no call to box on the plan
	PitPlanHeadsUpFromPct = 0.10 // The "box next lap" heads-up comes early in the lap before the plan's, from here...
	PitPlanHeadsUpToPct   = 0.40 // ...to here, well before the pit entry
	// PitPlanEarlyLaps: a stop up to this many laps before the plan's lap is the plan's stop, and a
	// Safety Car that early is the time to take it. A VSC saves less of the stop's time loss, so it
	// is worth it only closer to the plan's lap.
	PitPlanEarlyLaps = 8
	VSCStopEarlyLaps = 3

	// FinalLapCallToPct: the "last lap" call comes from the line to here; later, the lap is
	// half done. A lapped player's last lap starts when the leader takes the flag, so it is called
	// then, up to FinalLapLappedCallToPct: later, their own line is too near.
	FinalLapCallToPct       = 0.30
	FinalLapLappedCallToPct = 0.80

	// Gap and tyre life reports
	DefaultGapReportLaps   = 3    // Laps between gap reports
	GapReportFirstLap      = 3    // No gap report before this race lap: the order is still settling
	GapReportMaxGapSec     = 10.0 // A car further away than this isn't part of the gap report
	GapReportFromLapPct    = 0.05 // The gap report comes early in the lap, from here...
	GapReportToLapPct      = 0.40 // ...to here
	GapReportMaxDelayMs    = 15_000
	TyreLifeMinStintLaps   = 3    // Lap ends on the set before its life is projected
	TyreLifeWarnLaps       = 8.0  // First tyre life call when the projection drops to this many laps
	TyreLifeLastLaps       = 3.0  // Second tyre life call
	TyreLifeEndCallMaxLaps = 20.0 // "These tyres make the end" only with this many laps or fewer to go

	// Qualifying & Shootout thresholds
	QualyCleanAirDefaultSec             = 4.0
	QualyTimeWarnDefaultSec             = 180.0
	QualyElimDangerTimeSec              = 300.0
	FinalSectorTrackDistanceFraction    = 0.70
	QualyTrafficWarnDefaultSec          = 8.0   // A push-lap car behind, or a slow car ahead on a push lap, is called this long before the player meets it
	PushPaceMaxOffBest                  = 1.07  // A car's best lap more than this times the session's best isn't its push pace
	QualyLapResultSettleMs              = 2_000 // The lap result waits this long after the line for the positions to settle
	InLapCooldownFromLapPct             = 0.10  // The in-lap cool-down call comes this far into the lap, after the lap result
	QualyQ1EliminationPositionThreshold = 15    // Last safe Q1 place on a 20-car grid, when the car count is unknown
	QualyQ2EliminationPositionThreshold = 10
	QualyQ3Cars                         = 10 // Cars in Q3; Q1 and Q2 knock out half of the rest each

	// Push-lap traffic timing. Each car's pace share is how fast it runs against the track's pace
	// profile, measured over the last PaceWindowShortMs and PaceWindowLongMs of lap data. A step
	// faster than MaxCarSpeedMps is a teleport (the garage, a flashback), not driving.
	PaceWindowShortMs = 500
	PaceWindowLongMs  = 3_000
	MaxCarSpeedMps    = 110.0
	// A pushing car is taken at its push pace unless it runs AbortMarginShare slower (backing
	// off). The player on an in-lap is taken at their in-lap pace at most, since they are about to
	// slow down: InLapPaceShare until their own was measured, from InLapLearnFromLapPct into an
	// in-lap. Two cars whose shares differ by less than MinClosingShare of the faster one's aren't
	// closing.
	AbortMarginShare     = 0.15
	InLapPaceShare       = 0.65
	InLapLearnFromLapPct = 0.20
	InLapLearnSamples    = 200 // The learned pace averages about this many lap data packets
	MinClosingShare      = 0.04
	// The number in a traffic call is heard about TrafficNumberHeardMs after its first word, so it
	// is said for then. Closer than TrafficNowRoadSec on the road, or a number under
	// TrafficNowMinSec, the call says the car is right there instead.
	TrafficNumberHeardMs = 2_000
	TrafficNowRoadSec    = 1.0
	TrafficNowMinSec     = 2.0
	// A warned car that falls back to TrafficRearmSec past the warning time for TrafficRearmMs (the
	// player sped up, it backed off) is warned again when it comes back.
	TrafficRearmSec = 4.0
	TrafficRearmMs  = 3_000
	// A car on its out-lap within PrePushToLineM of the line at PrePushShare of its push pace is
	// about to start a push lap.
	PrePushToLineM = 1_000.0
	PrePushShare   = 0.97
	// Follow-ups: "on you now" is heard QualyTrafficCloseSec before the car arrives (its words
	// heard TrafficKeyHeardMs in), only after a warning that said TrafficCloseMinSaidSec or more.
	// "Clear" comes once the car is QualyClearAheadM ahead, within TrafficClearWithinMs of the pass.
	// A second push-lap car reaching the player within QualyTrainSec after the first is named in
	// the warning.
	QualyTrafficCloseSec   = 3.0
	TrafficKeyHeardMs      = 800
	TrafficCloseMinSaidSec = 6
	QualyClearAheadM       = 30.0
	TrafficClearWithinMs   = 10_000
	QualyTrainSec          = 3.0
	TrafficCloseSpeechMs   = 2_000
	// The pit exit: a push-lap car reaching the pit exit between PitExitWindowBeforeSec before and
	// PitExitWindowSec after the player leaving the pit lane is warned of. The player is taken at
	// the pit speed limit (DefaultPitSpeedLimitKmh when the game sends none) from at most
	// PitExitMaxDistM before the exit. "Push now" isn't said within PitExitCallFreshMs after it.
	PitExitWindowBeforeSec  = 1.0
	PitExitWindowSec        = 4.0
	DefaultPitSpeedLimitKmh = 80
	PitExitMaxDistM         = 1_000.0
	PitExitCallFreshMs      = 15_000

	// The track's push-lap speeds are learned from every car on a push lap: the mean of a QuietBinM
	// bin's first PushSpeedMeanSamples steps, then each step weighing PushSpeedWeight. They are used
	// once PushMinCoverage of the bins were seen.
	PushSpeedMeanSamples = 50
	PushSpeedWeight      = 0.1
	PushMinCoverage      = 0.9

	// Race results
	PodiumPositions       = 3
	RacePointsPositions   = 10 // Places scoring points in a Grand Prix
	SprintPointsPositions = 8  // Places scoring points in a sprint
	// FinishClassificationWaitMs: with a time penalty, the finish call waits this long for the
	// final classification, which applies it, before going by the track position.
	FinishClassificationWaitMs = 60_000

	// Flags & Weather thresholds
	WeatherRainTransitionProbPct   = 50
	WeatherRainHorizonMinutes      = 5
	WeatherHeavyRainWetThreshold   = 75
	WeatherLightRainInterThreshold = 35
	CornerCutWarnDefaultThreshold  = 2
	// RainRearmPct: the rain forecast is said again when its chance rises this much, and once it
	// falls this far below the threshold, the next rain spell is a new call.
	RainRearmPct = 15
	// WeatherStepHoldMs: rain getting heavier or easing, or stopping, is said once it held this long.
	WeatherStepHoldMs = 20_000
	// TrackTempSwingC: the track temperature moving this much in a stint is said.
	TrackTempSwingC = 6
	// Blue flags: a car a lap up (half a lap or more ahead on the race distance) behind the player
	// on the road within BlueFlagRoadSec is the one the flag is for; another within
	// BlueFlagTrainSec behind it is said in the same call.
	BlueFlagRoadSec  = 3.0
	BlueFlagTrainSec = 2.0
	// LastLapMaxShare: a car's last lap at more than this share of the pace profile's isn't a whole
	// lap (it joined part way round), so its race pace isn't taken from it.
	LastLapMaxShare = 1.15
	// Race traffic: a car ahead on the road is slow when both its pace windows are at or under
	// RaceSlowShare of the pace profile, at least RaceTrafficMinClosingShare under the player's
	// race pace, and stopped under RaceStoppedShare over the short window. A car called slow is
	// forgotten once it runs over RaceSlowClearShare again. A car slow within PitEntryGuardM
	// before the pit entry may be pitting, so isn't called unless it stopped.
	RaceSlowShare              = 0.7
	RaceSlowClearShare         = 0.85
	RaceStoppedShare           = 0.1
	RaceTrafficMinClosingShare = 0.25
	PitEntryGuardM             = 300.0
	// Race speeds: the slow car check runs on how fast the field runs each QuietBinM bin in this
	// race, the median of the bin's last RaceSpeedPasses passes (a pass counts when the car drove
	// RaceSpeedMinPassShare of the bin), once PushMinCoverage of the bins have RaceSpeedMinPasses.
	// Until then only a stopped car is called.
	RaceSpeedPasses       = 10
	RaceSpeedMinPasses    = 5
	RaceSpeedMinPassShare = 0.8
	// MaxStepBackM: a car's lap distance stepping back by up to this much (a spin, a stopped car's
	// jitter) is standing still, not nearly a lap driven.
	MaxStepBackM = 25.0
	// A lap of the player's on which they dropped under QuietSpoilKmh, or under QuietSpoilShare
	// of the learned speed in a bin (a spin, an off, limping), isn't learned from.
	QuietSpoilKmh   = 30.0
	QuietSpoilShare = 0.5

	// 2026 Active Aero & Override thresholds
	ActiveAeroAnticipationDistanceM    = 100 // Metres before Straight Mode zone to alert driver
	OvertakeBoostAnticipationDistanceM = 100 // Metres before Override Boost zone to alert driver

	// Pit Entry & Limiter thresholds
	PitLimiterOverspeedDeltaKmh = 12 // Speed over pit limit triggering warning before limiter line

	// Tyre Blistering & Pressure thresholds
	TyreBlisterWarnPct            = 35   // Tyre blistering % triggering alert
	TyrePressureMaxFrontPSI       = 25.5 // Front tyre pressure threshold for high pressure warning
	TyrePressureMaxRearPSI        = 24.5 // Rear tyre pressure threshold for high pressure warning
	TyrePressureAsymmetryDeltaPSI = 1.5  // Axle pressure delta triggering asymmetry alert

	// Powertrain Component Degradation thresholds
	GearBoxDamageWarnPct = 70 // Gearbox wear % triggering shift sync warning
	EngineICEWearWarnPct = 75 // ICE wear % triggering top speed loss advisory

	// Live race context for the AI race engineer (voice radio and chat)
	LiveRaceContextMaxAgeMs = 30_000 // Telemetry older than this is treated as no live session
	MaxPlayerLapRecords     = 120    // Completed player laps kept for pace, wear and fuel trends
	MaxRaceEventRecords     = 12     // Recent race events kept (pit stops, penalties, retirements...)
	MaxRadioCallRecords     = 8      // Recent proactive pit wall calls kept
	RecentPaceLaps          = 3      // Laps averaged for "recent pace"
	GapTrendLaps            = 3      // Laps used to measure whether a gap is closing or opening
	GapTrendStableSecPerLap = 0.05   // Gap change per lap below which a gap is reported as stable
	FuelTrendLaps           = 5      // Laps used to average fuel burn
	SummaryRadioCalls       = 3      // Proactive calls repeated in the prompt summary
	SummaryRaceEvents       = 4      // Race events repeated in the prompt summary
	SummaryForecastSamples  = 4      // Forecast samples repeated in the prompt summary
	DefaultLapHistoryLimit  = 5      // Laps returned by the lap history tool by default
	MaxLapHistoryLimit      = 20     // Most laps the lap history tool returns
	DriverToolRecentLaps    = 5      // Recent laps the driver lookup tool returns for a car
	JoulesPerMegajoule      = 1e6    // ERS energy is reported in joules, spoken in MJ
)

// Penalty type codes carried by the PENA event (see the UDP spec appendix).
const (
	PenaltyTypeDriveThrough uint8 = 0
	PenaltyTypeStopGo       uint8 = 1
	PenaltyTypeTimePenalty  uint8 = 4
	PenaltyTypeWarning      uint8 = 5
	PenaltyTypeDisqualified uint8 = 6
)

// TyreThermalWindow represents the optimal operating temperature range (°C) for a compound.
type TyreThermalWindow struct {
	CompoundName string
	MinTemp      float32
	MaxTemp      float32
}

// CompoundThermalWindows contains the optimal operating temperature range (°C) by compound.
var CompoundThermalWindows = map[string]TyreThermalWindow{
	"C0":           {CompoundName: "C0", MinTemp: 95.0, MaxTemp: 115.0},
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
	case packets.ActualCompoundC0:
		return CompoundThermalWindows["C0"]
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
	case packets.ActualCompoundC6:
		return CompoundThermalWindows["C6"]
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
