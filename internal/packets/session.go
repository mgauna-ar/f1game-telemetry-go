package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// Session type constants.
const (
	SessionUnknown         uint8 = 0
	SessionP1              uint8 = 1
	SessionP2              uint8 = 2
	SessionP3              uint8 = 3
	SessionShortP          uint8 = 4
	SessionQ1              uint8 = 5
	SessionQ2              uint8 = 6
	SessionQ3              uint8 = 7
	SessionShortQ          uint8 = 8
	SessionOSQ             uint8 = 9
	SessionSprintQ1        uint8 = 10
	SessionSprintQ2        uint8 = 11
	SessionSprintQ3        uint8 = 12
	SessionShortSprintQ    uint8 = 13
	SessionOSSprintQ       uint8 = 14
	SessionRace            uint8 = 15
	SessionRace2           uint8 = 16
	SessionRace3           uint8 = 17
	SessionTimeTrial       uint8 = 18
	SessionSprintRace      uint8 = 19
	SessionEqualSprintRace uint8 = 20
)

// trackNames maps track ID to track name.
var trackNames = map[int8]string{
	0: "Melbourne", 1: "Paul Ricard", 2: "Shanghai", 3: "Sakhir (Bahrain)",
	4: "Catalunya", 5: "Monaco", 6: "Montreal", 7: "Silverstone",
	8: "Hockenheim", 9: "Hungaroring", 10: "Spa", 11: "Monza",
	12: "Singapore", 13: "Suzuka", 14: "Abu Dhabi", 15: "Texas",
	16: "Brazil", 17: "Austria", 18: "Sochi", 19: "Mexico",
	20: "Baku (Azerbaijan)", 21: "Sakhir Short", 22: "Silverstone Short", 23: "Texas Short",
	24: "Suzuka Short", 25: "Hanoi", 26: "Zandvoort", 27: "Imola",
	28: "Portimão", 29: "Jeddah", 30: "Miami", 31: "Las Vegas",
	32: "Losail", 33: "Lusail", 39: "Silverstone (Reverse)",
	40: "Austria (Reverse)", 41: "Zandvoort (Reverse)", 42: "Madrid",
}

// TrackName returns the track name for the given track ID.
func TrackName(id int8) string {
	if name, ok := trackNames[id]; ok {
		return name
	}
	return fmt.Sprintf("Unknown Track (%d)", id)
}

// sessionTypeNames maps session type to human-readable name.
var sessionTypeNames = map[uint8]string{
	SessionUnknown:         "Unknown",
	SessionP1:              "Practice 1",
	SessionP2:              "Practice 2",
	SessionP3:              "Practice 3",
	SessionShortP:          "Short Practice",
	SessionQ1:              "Qualifying 1",
	SessionQ2:              "Qualifying 2",
	SessionQ3:              "Qualifying 3",
	SessionShortQ:          "Short Qualifying",
	SessionOSQ:             "One-Shot Qualifying",
	SessionSprintQ1:        "Sprint Shootout 1",
	SessionSprintQ2:        "Sprint Shootout 2",
	SessionSprintQ3:        "Sprint Shootout 3",
	SessionShortSprintQ:    "Short Sprint Shootout",
	SessionOSSprintQ:       "One-Shot Sprint Shootout",
	SessionRace:            "Race",
	SessionRace2:           "Race 2",
	SessionRace3:           "Race 3",
	SessionTimeTrial:       "Time Trial",
	SessionSprintRace:      "Sprint Race",
	SessionEqualSprintRace: "Equal Sprint Race",
}

// SessionTypeName returns the human-readable name for the given session type.
func SessionTypeName(sessionType uint8) string {
	if name, ok := sessionTypeNames[sessionType]; ok {
		return name
	}
	return fmt.Sprintf("Unknown Session (%d)", sessionType)
}

// IsRaceSession returns true if the given session type is any race session variant.
func IsRaceSession(sessionType uint8) bool {
	return sessionType == SessionRace ||
		sessionType == SessionRace2 ||
		sessionType == SessionRace3 ||
		sessionType == SessionSprintRace ||
		sessionType == SessionEqualSprintRace
}

// IsQualifyingSession returns true if the given session type is any qualifying or shootout session variant.
func IsQualifyingSession(sessionType uint8) bool {
	return sessionType == SessionQ1 ||
		sessionType == SessionQ2 ||
		sessionType == SessionQ3 ||
		sessionType == SessionShortQ ||
		sessionType == SessionOSQ ||
		sessionType == SessionSprintQ1 ||
		sessionType == SessionSprintQ2 ||
		sessionType == SessionSprintQ3 ||
		sessionType == SessionShortSprintQ ||
		sessionType == SessionOSSprintQ
}

// IsPracticeSession returns true if the given session type is any practice session variant.
func IsPracticeSession(sessionType uint8) bool {
	return sessionType == SessionP1 ||
		sessionType == SessionP2 ||
		sessionType == SessionP3 ||
		sessionType == SessionShortP
}

var weatherNames = map[uint8]string{
	WeatherClear:      "Clear",
	WeatherLightCloud: "Light Cloud",
	WeatherOvercast:   "Overcast",
	WeatherLightRain:  "Light Rain",
	WeatherHeavyRain:  "Heavy Rain",
	WeatherStorm:      "Storm",
}

// WeatherName returns the human-readable string for weather state.
func WeatherName(weather uint8) string {
	if name, ok := weatherNames[weather]; ok {
		return name
	}
	return "Unknown"
}

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

// DecodeSession decodes a PacketSessionData from raw bytes (supporting both 2025 and 2026 formats).
func DecodeSession(data []byte) (*PacketSessionData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in session: %w", err)
	}

	var pkt PacketSessionData
	pkt.Header = header

	payload := data[headerLen:]
	r := bytes.NewReader(payload)

	// Decode universal 2025/2026 fields
	if err := binary.Read(r, binary.LittleEndian, &pkt.Weather); err != nil {
		return nil, fmt.Errorf("failed to decode session weather: %w", err)
	}
	_ = binary.Read(r, binary.LittleEndian, &pkt.TrackTemperature)
	_ = binary.Read(r, binary.LittleEndian, &pkt.AirTemperature)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TotalLaps)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TrackLength)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SessionType)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TrackId)
	_ = binary.Read(r, binary.LittleEndian, &pkt.Formula)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SessionTimeLeft)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SessionDuration)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitSpeedLimit)
	_ = binary.Read(r, binary.LittleEndian, &pkt.GamePaused)
	_ = binary.Read(r, binary.LittleEndian, &pkt.IsSpectating)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SpectatorCarIndex)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SliProNativeSupport)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumMarshalZones)
	_ = binary.Read(r, binary.LittleEndian, &pkt.MarshalZones)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SafetyCarStatus)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NetworkGame)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumWeatherForecastSamples)
	_ = binary.Read(r, binary.LittleEndian, &pkt.WeatherForecastSamples)
	_ = binary.Read(r, binary.LittleEndian, &pkt.ForecastAccuracy)
	_ = binary.Read(r, binary.LittleEndian, &pkt.AIDifficulty)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SeasonLinkIdentifier)
	_ = binary.Read(r, binary.LittleEndian, &pkt.WeekendLinkIdentifier)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SessionLinkIdentifier)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitStopWindowIdealLap)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitStopWindowLatestLap)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitStopRejoinPosition)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SteeringAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.BrakingAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.GearboxAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitReleaseAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.ERSAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.DRSAssist)
	_ = binary.Read(r, binary.LittleEndian, &pkt.DynamicRacingLine)
	_ = binary.Read(r, binary.LittleEndian, &pkt.DynamicRacingLineType)
	_ = binary.Read(r, binary.LittleEndian, &pkt.GameMode)
	_ = binary.Read(r, binary.LittleEndian, &pkt.RuleSet)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TimeOfDay)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SessionLength)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SpeedUnitsLeadPlayer)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TemperatureUnitsLeadPlayer)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SpeedUnitsSecondaryPlayer)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TemperatureUnitsSecondaryPlayer)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumSafetyCarPeriods)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumVirtualSafetyCarPeriods)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumRedFlagPeriods)
	_ = binary.Read(r, binary.LittleEndian, &pkt.EqualCarPerformance)
	_ = binary.Read(r, binary.LittleEndian, &pkt.RecoveryMode)
	_ = binary.Read(r, binary.LittleEndian, &pkt.FlashbackLimit)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SurfaceType)
	_ = binary.Read(r, binary.LittleEndian, &pkt.LowFuelMode)
	_ = binary.Read(r, binary.LittleEndian, &pkt.RaceStarts)
	_ = binary.Read(r, binary.LittleEndian, &pkt.TyreTemperature)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitLaneTyreSim)
	_ = binary.Read(r, binary.LittleEndian, &pkt.CarDamage)
	_ = binary.Read(r, binary.LittleEndian, &pkt.CarDamageRate)
	_ = binary.Read(r, binary.LittleEndian, &pkt.Collisions)
	_ = binary.Read(r, binary.LittleEndian, &pkt.CollisionsOffForFirstLapOnly)
	_ = binary.Read(r, binary.LittleEndian, &pkt.MPUnsafePitRelease)
	_ = binary.Read(r, binary.LittleEndian, &pkt.MPOffForGriefing)
	_ = binary.Read(r, binary.LittleEndian, &pkt.CornerCuttingStringency)
	_ = binary.Read(r, binary.LittleEndian, &pkt.ParcFermeRules)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitStopExperience)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SafetyCar)
	_ = binary.Read(r, binary.LittleEndian, &pkt.SafetyCarExperience)
	_ = binary.Read(r, binary.LittleEndian, &pkt.FormationLap)
	_ = binary.Read(r, binary.LittleEndian, &pkt.FormationLapExperience)
	_ = binary.Read(r, binary.LittleEndian, &pkt.RedFlags)
	_ = binary.Read(r, binary.LittleEndian, &pkt.AffectsLicenceLevelSolo)
	_ = binary.Read(r, binary.LittleEndian, &pkt.AffectsLicenceLevelMP)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumSessionsInWeekend)
	_ = binary.Read(r, binary.LittleEndian, &pkt.WeekendStructure)
	_ = binary.Read(r, binary.LittleEndian, &pkt.Sector2LapDistanceStart)
	_ = binary.Read(r, binary.LittleEndian, &pkt.Sector3LapDistanceStart)

	// Decode 2026 additional extensions if present
	if r.Len() > 0 {
		_ = binary.Read(r, binary.LittleEndian, &pkt.ActiveAeroTrackStatus)
		_ = binary.Read(r, binary.LittleEndian, &pkt.NumActiveAeroZonesFull)
		_ = binary.Read(r, binary.LittleEndian, &pkt.ActiveAeroZonesFull)
		_ = binary.Read(r, binary.LittleEndian, &pkt.NumActiveAeroZonesPartial)
		_ = binary.Read(r, binary.LittleEndian, &pkt.ActiveAeroZonesPartial)
		_ = binary.Read(r, binary.LittleEndian, &pkt.NumDRSZones)
		_ = binary.Read(r, binary.LittleEndian, &pkt.DRSZones)
		_ = binary.Read(r, binary.LittleEndian, &pkt.StartReactionTime)
		_ = binary.Read(r, binary.LittleEndian, &pkt.AntiLockBrakesAssist)
		_ = binary.Read(r, binary.LittleEndian, &pkt.TractionControlAssist)
		_ = binary.Read(r, binary.LittleEndian, &pkt.DynamicRacingLineHiVis)
		_ = binary.Read(r, binary.LittleEndian, &pkt.DynamicRacingLineColourBlind)
		_ = binary.Read(r, binary.LittleEndian, &pkt.RecurringRewindPrompt)
	}

	return &pkt, nil
}
