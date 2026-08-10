package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// Session type constants.
const (
	SessionUnknown   uint8 = 0
	SessionP1        uint8 = 1
	SessionP2        uint8 = 2
	SessionP3        uint8 = 3
	SessionShortP    uint8 = 4
	SessionQ1        uint8 = 5
	SessionQ2        uint8 = 6
	SessionQ3        uint8 = 7
	SessionShortQ    uint8 = 8
	SessionOSQ       uint8 = 9
	SessionRace      uint8 = 10
	SessionRace2     uint8 = 11
	SessionRace3     uint8 = 12
	SessionTimeTrial uint8 = 13
)

// trackNames maps track ID to track name.
var trackNames = map[int8]string{
	0: "Melbourne", 1: "Paul Ricard", 2: "Shanghai", 3: "Sakhir (Bahrain)",
	4: "Catalunya", 5: "Monaco", 6: "Montreal", 7: "Silverstone",
	8: "Hockenheim", 9: "Hungaroring", 10: "Spa", 11: "Monza",
	12: "Singapore", 13: "Suzuka", 14: "Abu Dhabi", 15: "Austin",
	16: "Interlagos", 17: "Red Bull Ring", 18: "Sochi", 19: "Mexico City",
	20: "Baku", 21: "Sakhir Short", 22: "Silverstone Short", 23: "Austin Short",
	24: "Suzuka Short", 25: "Hanoi", 26: "Zandvoort", 27: "Imola",
	28: "Portimão", 29: "Jeddah", 30: "Miami", 31: "Las Vegas",
	32: "Losail", 33: "Lusail",
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
	SessionUnknown:   "Unknown",
	SessionP1:        "Practice 1",
	SessionP2:        "Practice 2",
	SessionP3:        "Practice 3",
	SessionShortP:    "Short Practice",
	SessionQ1:        "Qualifying 1",
	SessionQ2:        "Qualifying 2",
	SessionQ3:        "Qualifying 3",
	SessionShortQ:    "Short Qualifying",
	SessionOSQ:       "One-Shot Qualifying",
	SessionRace:      "Race",
	SessionRace2:     "Race 2",
	SessionRace3:     "Race 3",
	SessionTimeTrial: "Time Trial",
}

// SessionTypeName returns the human-readable name for the given session type.
func SessionTypeName(sessionType uint8) string {
	if name, ok := sessionTypeNames[sessionType]; ok {
		return name
	}
	return fmt.Sprintf("Unknown Session (%d)", sessionType)
}

var weatherNames = map[uint8]string{
	0: "Clear",
	1: "Light Cloud",
	2: "Overcast",
	3: "Light Rain",
	4: "Heavy Rain",
	5: "Storm",
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
	ZoneStart float32
	ZoneFlag  int8
}

// WeatherForecastSample contains a weather forecast entry.
type WeatherForecastSample struct {
	SessionType            uint8
	TimeOffset             uint8
	Weather                uint8
	TrackTemperature       int8
	TrackTemperatureChange int8
	AirTemperature         int8
	AirTemperatureChange   int8
	RainPercentage         uint8
}

// PacketSessionData contains session data. Packet ID: 1.
type PacketSessionData struct {
	Header                          PacketHeader
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
	MarshalZones                    [21]MarshalZone
	SafetyCarStatus                 uint8
	NetworkGame                     uint8
	NumWeatherForecastSamples       uint8
	WeatherForecastSamples          [56]WeatherForecastSample
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
	TyreLockMode                    uint8
	PitLaneTyreSim                  uint8
	NumDisqualifications            uint8
}

func (p PacketSessionData) GetHeader() PacketHeader { return p.Header }

// DecodeSession decodes a PacketSessionData from raw bytes.
func DecodeSession(data []byte) (*PacketSessionData, error) {
	header, headerLen, err := DecodeHeaderWithOffset(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode header in session: %w", err)
	}

	var pkt PacketSessionData
	pkt.Header = header

	payload := data[headerLen:]
	r := bytes.NewReader(payload)

	if err := binary.Read(r, binary.LittleEndian, &pkt.Weather); err != nil {
		return nil, fmt.Errorf("failed to decode session payload: %w", err)
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
	_ = binary.Read(r, binary.LittleEndian, &pkt.TyreLockMode)
	_ = binary.Read(r, binary.LittleEndian, &pkt.PitLaneTyreSim)
	_ = binary.Read(r, binary.LittleEndian, &pkt.NumDisqualifications)

	return &pkt, nil
}
