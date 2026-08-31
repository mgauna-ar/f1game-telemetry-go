package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// MarshalZone contains marshal zone data.
type MarshalZone struct {
	ZoneStart float32 `json:"ZoneStart"`
	ZoneFlag  int8    `json:"ZoneFlag"`
}

// ActiveAeroZone contains active aero zone start and end fractions.
type ActiveAeroZone struct {
	ZoneStart float32 `json:"ZoneStart"`
	ZoneEnd   float32 `json:"ZoneEnd"`
}

// DRSZone contains DRS zone start and end fractions.
type DRSZone struct {
	ZoneStart float32 `json:"ZoneStart"`
	ZoneEnd   float32 `json:"ZoneEnd"`
}

// WeatherForecastSample contains a weather forecast entry.
type WeatherForecastSample struct {
	SessionType            uint8 `json:"SessionType"`
	TimeOffset             uint8 `json:"TimeOffset"`
	Weather                uint8 `json:"Weather"`
	TrackTemperature       int8  `json:"TrackTemperature"`
	TrackTemperatureChange int8  `json:"TrackTemperatureChange"`
	AirTemperature         int8  `json:"AirTemperature"`
	AirTemperatureChange   int8  `json:"AirTemperatureChange"`
	RainPercentage         uint8 `json:"RainPercentage"`
}

const (
	MaxMarshalZonesPerLap     = 21
	MaxActiveAeroZonesPerLap  = 8
	MaxDRSZonesPerLap         = 4
	MaxWeatherForecastSamples = 64
	MaxSessionsInWeekend      = 12
)

// PacketSessionData contains session data. Packet ID: 1.
type PacketSessionData struct {
	Header                          PacketHeader                                     `json:"Header"`
	Weather                         uint8                                            `json:"Weather"`
	TrackTemperature                int8                                             `json:"TrackTemperature"`
	AirTemperature                  int8                                             `json:"AirTemperature"`
	TotalLaps                       uint8                                            `json:"TotalLaps"`
	TrackLength                     uint16                                           `json:"TrackLength"`
	SessionType                     uint8                                            `json:"SessionType"`
	TrackId                         int8                                             `json:"TrackId"`
	Formula                         uint8                                            `json:"Formula"`
	SessionTimeLeft                 uint16                                           `json:"SessionTimeLeft"`
	SessionDuration                 uint16                                           `json:"SessionDuration"`
	PitSpeedLimit                   uint8                                            `json:"PitSpeedLimit"`
	GamePaused                      uint8                                            `json:"GamePaused"`
	IsSpectating                    uint8                                            `json:"IsSpectating"`
	SpectatorCarIndex               uint8                                            `json:"SpectatorCarIndex"`
	SliProNativeSupport             uint8                                            `json:"SliProNativeSupport"`
	NumMarshalZones                 uint8                                            `json:"NumMarshalZones"`
	MarshalZones                    [MaxMarshalZonesPerLap]MarshalZone               `json:"MarshalZones"`
	SafetyCarStatus                 uint8                                            `json:"SafetyCarStatus"`
	NetworkGame                     uint8                                            `json:"NetworkGame"`
	NumWeatherForecastSamples       uint8                                            `json:"NumWeatherForecastSamples"`
	WeatherForecastSamples          [MaxWeatherForecastSamples]WeatherForecastSample `json:"WeatherForecastSamples"`
	ForecastAccuracy                uint8                                            `json:"ForecastAccuracy"`
	AIDifficulty                    uint8                                            `json:"AIDifficulty"`
	SeasonLinkIdentifier            uint32                                           `json:"SeasonLinkIdentifier"`
	WeekendLinkIdentifier           uint32                                           `json:"WeekendLinkIdentifier"`
	SessionLinkIdentifier           uint32                                           `json:"SessionLinkIdentifier"`
	PitStopWindowIdealLap           uint8                                            `json:"PitStopWindowIdealLap"`
	PitStopWindowLatestLap          uint8                                            `json:"PitStopWindowLatestLap"`
	PitStopRejoinPosition           uint8                                            `json:"PitStopRejoinPosition"`
	SteeringAssist                  uint8                                            `json:"SteeringAssist"`
	BrakingAssist                   uint8                                            `json:"BrakingAssist"`
	GearboxAssist                   uint8                                            `json:"GearboxAssist"`
	PitAssist                       uint8                                            `json:"PitAssist"`
	PitReleaseAssist                uint8                                            `json:"PitReleaseAssist"`
	ERSAssist                       uint8                                            `json:"ERSAssist"`
	DRSAssist                       uint8                                            `json:"DRSAssist"`
	DynamicRacingLine               uint8                                            `json:"DynamicRacingLine"`
	DynamicRacingLineType           uint8                                            `json:"DynamicRacingLineType"`
	GameMode                        uint8                                            `json:"GameMode"`
	RuleSet                         uint8                                            `json:"RuleSet"`
	TimeOfDay                       uint32                                           `json:"TimeOfDay"`
	SessionLength                   uint8                                            `json:"SessionLength"`
	SpeedUnitsLeadPlayer            uint8                                            `json:"SpeedUnitsLeadPlayer"`
	TemperatureUnitsLeadPlayer      uint8                                            `json:"TemperatureUnitsLeadPlayer"`
	SpeedUnitsSecondaryPlayer       uint8                                            `json:"SpeedUnitsSecondaryPlayer"`
	TemperatureUnitsSecondaryPlayer uint8                                            `json:"TemperatureUnitsSecondaryPlayer"`
	NumSafetyCarPeriods             uint8                                            `json:"NumSafetyCarPeriods"`
	NumVirtualSafetyCarPeriods      uint8                                            `json:"NumVirtualSafetyCarPeriods"`
	NumRedFlagPeriods               uint8                                            `json:"NumRedFlagPeriods"`
	EqualCarPerformance             uint8                                            `json:"EqualCarPerformance"`
	RecoveryMode                    uint8                                            `json:"RecoveryMode"`
	FlashbackLimit                  uint8                                            `json:"FlashbackLimit"`
	SurfaceType                     uint8                                            `json:"SurfaceType"`
	LowFuelMode                     uint8                                            `json:"LowFuelMode"`
	RaceStarts                      uint8                                            `json:"RaceStarts"`
	TyreTemperature                 uint8                                            `json:"TyreTemperature"`
	PitLaneTyreSim                  uint8                                            `json:"PitLaneTyreSim"`
	CarDamage                       uint8                                            `json:"CarDamage"`
	CarDamageRate                   uint8                                            `json:"CarDamageRate"`
	Collisions                      uint8                                            `json:"Collisions"`
	CollisionsOffForFirstLapOnly    uint8                                            `json:"CollisionsOffForFirstLapOnly"`
	MPUnsafePitRelease              uint8                                            `json:"MPUnsafePitRelease"`
	MPOffForGriefing                uint8                                            `json:"MPOffForGriefing"`
	CornerCuttingStringency         uint8                                            `json:"CornerCuttingStringency"`
	ParcFermeRules                  uint8                                            `json:"ParcFermeRules"`
	PitStopExperience               uint8                                            `json:"PitStopExperience"`
	SafetyCar                       uint8                                            `json:"SafetyCar"`
	SafetyCarExperience             uint8                                            `json:"SafetyCarExperience"`
	FormationLap                    uint8                                            `json:"FormationLap"`
	FormationLapExperience          uint8                                            `json:"FormationLapExperience"`
	RedFlags                        uint8                                            `json:"RedFlags"`
	AffectsLicenceLevelSolo         uint8                                            `json:"AffectsLicenceLevelSolo"`
	AffectsLicenceLevelMP           uint8                                            `json:"AffectsLicenceLevelMP"`
	NumSessionsInWeekend            uint8                                            `json:"NumSessionsInWeekend"`
	WeekendStructure                [MaxSessionsInWeekend]uint8                      `json:"WeekendStructure"`
	Sector2LapDistanceStart         float32                                          `json:"Sector2LapDistanceStart"`
	Sector3LapDistanceStart         float32                                          `json:"Sector3LapDistanceStart"`

	// 2026 Aero and DRS Zone extensions
	ActiveAeroTrackStatus        uint8                                    `json:"ActiveAeroTrackStatus"`
	NumActiveAeroZonesFull       uint8                                    `json:"NumActiveAeroZonesFull"`
	ActiveAeroZonesFull          [MaxActiveAeroZonesPerLap]ActiveAeroZone `json:"ActiveAeroZonesFull"`
	NumActiveAeroZonesPartial    uint8                                    `json:"NumActiveAeroZonesPartial"`
	ActiveAeroZonesPartial       [MaxActiveAeroZonesPerLap]ActiveAeroZone `json:"ActiveAeroZonesPartial"`
	NumDRSZones                  uint8                                    `json:"NumDRSZones"`
	DRSZones                     [MaxDRSZonesPerLap]DRSZone               `json:"DRSZones"`
	StartReactionTime            float32                                  `json:"StartReactionTime"`
	AntiLockBrakesAssist         uint8                                    `json:"AntiLockBrakesAssist"`
	TractionControlAssist        uint8                                    `json:"TractionControlAssist"`
	DynamicRacingLineHiVis       uint8                                    `json:"DynamicRacingLineHiVis"`
	DynamicRacingLineColourBlind uint8                                    `json:"DynamicRacingLineColourBlind"`
	RecurringRewindPrompt        uint8                                    `json:"RecurringRewindPrompt"`
}

func (p PacketSessionData) GetHeader() PacketHeader { return p.Header }

// sessionData2025 represents the binary payload structure for universal 2025/2026 base fields.
type sessionData2025 struct {
	Weather                         uint8
	TrackTemperature                int8
	AirTemperature                  int8
	TotalLaps                       uint8
	TrackLength                     uint16
	SessionType                     uint8
	TrackId                         int8
	Formula                         uint8
	SessionTimeLeft                 uint16
	SessionDuration                 uint16
	PitSpeedLimit                   uint8
	GamePaused                      uint8
	IsSpectating                    uint8
	SpectatorCarIndex               uint8
	SliProNativeSupport             uint8
	NumMarshalZones                 uint8
	MarshalZones                    [MaxMarshalZonesPerLap]MarshalZone
	SafetyCarStatus                 uint8
	NetworkGame                     uint8
	NumWeatherForecastSamples       uint8
	WeatherForecastSamples          [MaxWeatherForecastSamples]WeatherForecastSample
	ForecastAccuracy                uint8
	AIDifficulty                    uint8
	SeasonLinkIdentifier            uint32
	WeekendLinkIdentifier           uint32
	SessionLinkIdentifier           uint32
	PitStopWindowIdealLap           uint8
	PitStopWindowLatestLap          uint8
	PitStopRejoinPosition           uint8
	SteeringAssist                  uint8
	BrakingAssist                   uint8
	GearboxAssist                   uint8
	PitAssist                       uint8
	PitReleaseAssist                uint8
	ERSAssist                       uint8
	DRSAssist                       uint8
	DynamicRacingLine               uint8
	DynamicRacingLineType           uint8
	GameMode                        uint8
	RuleSet                         uint8
	TimeOfDay                       uint32
	SessionLength                   uint8
	SpeedUnitsLeadPlayer            uint8
	TemperatureUnitsLeadPlayer      uint8
	SpeedUnitsSecondaryPlayer       uint8
	TemperatureUnitsSecondaryPlayer uint8
	NumSafetyCarPeriods             uint8
	NumVirtualSafetyCarPeriods      uint8
	NumRedFlagPeriods               uint8
	EqualCarPerformance             uint8
	RecoveryMode                    uint8
	FlashbackLimit                  uint8
	SurfaceType                     uint8
	LowFuelMode                     uint8
	RaceStarts                      uint8
	TyreTemperature                 uint8
	PitLaneTyreSim                  uint8
	CarDamage                       uint8
	CarDamageRate                   uint8
	Collisions                      uint8
	CollisionsOffForFirstLapOnly    uint8
	MPUnsafePitRelease              uint8
	MPOffForGriefing                uint8
	CornerCuttingStringency         uint8
	ParcFermeRules                  uint8
	PitStopExperience               uint8
	SafetyCar                       uint8
	SafetyCarExperience             uint8
	FormationLap                    uint8
	FormationLapExperience          uint8
	RedFlags                        uint8
	AffectsLicenceLevelSolo         uint8
	AffectsLicenceLevelMP           uint8
	NumSessionsInWeekend            uint8
	WeekendStructure                [MaxSessionsInWeekend]uint8
	Sector2LapDistanceStart         float32
	Sector3LapDistanceStart         float32
}

// sessionData2026Ext represents the binary payload structure for 2026 regulation extensions.
type sessionData2026Ext struct {
	ActiveAeroTrackStatus        uint8
	NumActiveAeroZonesFull       uint8
	ActiveAeroZonesFull          [MaxActiveAeroZonesPerLap]ActiveAeroZone
	NumActiveAeroZonesPartial    uint8
	ActiveAeroZonesPartial       [MaxActiveAeroZonesPerLap]ActiveAeroZone
	NumDRSZones                  uint8
	DRSZones                     [MaxDRSZonesPerLap]DRSZone
	StartReactionTime            float32
	AntiLockBrakesAssist         uint8
	TractionControlAssist        uint8
	DynamicRacingLineHiVis       uint8
	DynamicRacingLineColourBlind uint8
	RecurringRewindPrompt        uint8
}

// DecodeSession decodes a PacketSessionData from header and payload bytes (supporting both 2025 and 2026 formats).
func DecodeSession(header PacketHeader, payload []byte) (*PacketSessionData, error) {
	r := bytes.NewReader(payload)

	var base sessionData2025
	if err := binary.Read(r, binary.LittleEndian, &base); err != nil {
		return nil, fmt.Errorf("failed to decode session payload: %w", err)
	}

	pkt := PacketSessionData{
		Header:                          header,
		Weather:                         base.Weather,
		TrackTemperature:                base.TrackTemperature,
		AirTemperature:                  base.AirTemperature,
		TotalLaps:                       base.TotalLaps,
		TrackLength:                     base.TrackLength,
		SessionType:                     base.SessionType,
		TrackId:                         base.TrackId,
		Formula:                         base.Formula,
		SessionTimeLeft:                 base.SessionTimeLeft,
		SessionDuration:                 base.SessionDuration,
		PitSpeedLimit:                   base.PitSpeedLimit,
		GamePaused:                      base.GamePaused,
		IsSpectating:                    base.IsSpectating,
		SpectatorCarIndex:               base.SpectatorCarIndex,
		SliProNativeSupport:             base.SliProNativeSupport,
		NumMarshalZones:                 base.NumMarshalZones,
		MarshalZones:                    base.MarshalZones,
		SafetyCarStatus:                 base.SafetyCarStatus,
		NetworkGame:                     base.NetworkGame,
		NumWeatherForecastSamples:       base.NumWeatherForecastSamples,
		WeatherForecastSamples:          base.WeatherForecastSamples,
		ForecastAccuracy:                base.ForecastAccuracy,
		AIDifficulty:                    base.AIDifficulty,
		SeasonLinkIdentifier:            base.SeasonLinkIdentifier,
		WeekendLinkIdentifier:           base.WeekendLinkIdentifier,
		SessionLinkIdentifier:           base.SessionLinkIdentifier,
		PitStopWindowIdealLap:           base.PitStopWindowIdealLap,
		PitStopWindowLatestLap:          base.PitStopWindowLatestLap,
		PitStopRejoinPosition:           base.PitStopRejoinPosition,
		SteeringAssist:                  base.SteeringAssist,
		BrakingAssist:                   base.BrakingAssist,
		GearboxAssist:                   base.GearboxAssist,
		PitAssist:                       base.PitAssist,
		PitReleaseAssist:                base.PitReleaseAssist,
		ERSAssist:                       base.ERSAssist,
		DRSAssist:                       base.DRSAssist,
		DynamicRacingLine:               base.DynamicRacingLine,
		DynamicRacingLineType:           base.DynamicRacingLineType,
		GameMode:                        base.GameMode,
		RuleSet:                         base.RuleSet,
		TimeOfDay:                       base.TimeOfDay,
		SessionLength:                   base.SessionLength,
		SpeedUnitsLeadPlayer:            base.SpeedUnitsLeadPlayer,
		TemperatureUnitsLeadPlayer:      base.TemperatureUnitsLeadPlayer,
		SpeedUnitsSecondaryPlayer:       base.SpeedUnitsSecondaryPlayer,
		TemperatureUnitsSecondaryPlayer: base.TemperatureUnitsSecondaryPlayer,
		NumSafetyCarPeriods:             base.NumSafetyCarPeriods,
		NumVirtualSafetyCarPeriods:      base.NumVirtualSafetyCarPeriods,
		NumRedFlagPeriods:               base.NumRedFlagPeriods,
		EqualCarPerformance:             base.EqualCarPerformance,
		RecoveryMode:                    base.RecoveryMode,
		FlashbackLimit:                  base.FlashbackLimit,
		SurfaceType:                     base.SurfaceType,
		LowFuelMode:                     base.LowFuelMode,
		RaceStarts:                      base.RaceStarts,
		TyreTemperature:                 base.TyreTemperature,
		PitLaneTyreSim:                  base.PitLaneTyreSim,
		CarDamage:                       base.CarDamage,
		CarDamageRate:                   base.CarDamageRate,
		Collisions:                      base.Collisions,
		CollisionsOffForFirstLapOnly:    base.CollisionsOffForFirstLapOnly,
		MPUnsafePitRelease:              base.MPUnsafePitRelease,
		MPOffForGriefing:                base.MPOffForGriefing,
		CornerCuttingStringency:         base.CornerCuttingStringency,
		ParcFermeRules:                  base.ParcFermeRules,
		PitStopExperience:               base.PitStopExperience,
		SafetyCar:                       base.SafetyCar,
		SafetyCarExperience:             base.SafetyCarExperience,
		FormationLap:                    base.FormationLap,
		FormationLapExperience:          base.FormationLapExperience,
		RedFlags:                        base.RedFlags,
		AffectsLicenceLevelSolo:         base.AffectsLicenceLevelSolo,
		AffectsLicenceLevelMP:           base.AffectsLicenceLevelMP,
		NumSessionsInWeekend:            base.NumSessionsInWeekend,
		WeekendStructure:                base.WeekendStructure,
		Sector2LapDistanceStart:         base.Sector2LapDistanceStart,
		Sector3LapDistanceStart:         base.Sector3LapDistanceStart,
	}

	// Decode 2026 additional extensions if present in payload
	if r.Len() > 0 {
		var ext sessionData2026Ext
		if err := binary.Read(r, binary.LittleEndian, &ext); err != nil {
			return nil, fmt.Errorf("failed to decode session 2026 extensions: %w", err)
		}
		pkt.ActiveAeroTrackStatus = ext.ActiveAeroTrackStatus
		pkt.NumActiveAeroZonesFull = ext.NumActiveAeroZonesFull
		pkt.ActiveAeroZonesFull = ext.ActiveAeroZonesFull
		pkt.NumActiveAeroZonesPartial = ext.NumActiveAeroZonesPartial
		pkt.ActiveAeroZonesPartial = ext.ActiveAeroZonesPartial
		pkt.NumDRSZones = ext.NumDRSZones
		pkt.DRSZones = ext.DRSZones
		pkt.StartReactionTime = ext.StartReactionTime
		pkt.AntiLockBrakesAssist = ext.AntiLockBrakesAssist
		pkt.TractionControlAssist = ext.TractionControlAssist
		pkt.DynamicRacingLineHiVis = ext.DynamicRacingLineHiVis
		pkt.DynamicRacingLineColourBlind = ext.DynamicRacingLineColourBlind
		pkt.RecurringRewindPrompt = ext.RecurringRewindPrompt
	}

	return &pkt, nil
}
