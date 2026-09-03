package packets

import (
	"strconv"
	"strings"
)

// Packet IDs
const (
	PacketIDMotion              uint8 = 0
	PacketIDSession             uint8 = 1
	PacketIDLapData             uint8 = 2
	PacketIDEvent               uint8 = 3
	PacketIDParticipants        uint8 = 4
	PacketIDCarSetup            uint8 = 5
	PacketIDCarTelemetry        uint8 = 6
	PacketIDCarStatus           uint8 = 7
	PacketIDFinalClassification uint8 = 8
	PacketIDLobbyInfo           uint8 = 9
	PacketIDCarDamage           uint8 = 10
	PacketIDSessionHistory      uint8 = 11
	PacketIDTyreSets            uint8 = 12
	PacketIDMotionEx            uint8 = 13
	PacketIDTimeTrial           uint8 = 14
	PacketIDLapPositions        uint8 = 15
	PacketIDCarTelemetry2       uint8 = 16
	PacketIDLiveSnapshot        uint8 = 255
)

// Tyre compound constants
const (
	CompoundInter     uint8 = 7
	CompoundWet       uint8 = 8
	CompoundSoft      uint8 = 16
	CompoundMedium    uint8 = 17
	CompoundHard      uint8 = 18
	CompoundSuperSoft uint8 = 19
	CompoundClassicS  uint8 = 20
	CompoundClassicM  uint8 = 21
	CompoundClassicH  uint8 = 22
)

// Result status constants (Car / Lap classification status)
const (
	ResultStatusInvalid       uint8 = 0
	ResultStatusInactive      uint8 = 1
	ResultStatusActive        uint8 = 2
	ResultStatusFinished      uint8 = 3
	ResultStatusDNF           uint8 = 4
	ResultStatusDSQ           uint8 = 5
	ResultStatusNotClassified uint8 = 6
	ResultStatusRetired       uint8 = 7
)

// Pit status constants
const (
	PitStatusNone      uint8 = 0
	PitStatusPitting   uint8 = 1
	PitStatusInPitArea uint8 = 2
)

// Driver status constants
const (
	DriverStatusInGarage  uint8 = 0
	DriverStatusFlyingLap uint8 = 1
	DriverStatusInLap     uint8 = 2
	DriverStatusOutLap    uint8 = 3
	DriverStatusOnTrack   uint8 = 4
)

// Safety car status constants
const (
	SafetyCarNone         uint8 = 0
	SafetyCarFull         uint8 = 1
	SafetyCarVirtual      uint8 = 2
	SafetyCarFormationLap uint8 = 3
)

// Weather status constants
const (
	WeatherClear      uint8 = 0
	WeatherLightCloud uint8 = 1
	WeatherOvercast   uint8 = 2
	WeatherLightRain  uint8 = 3
	WeatherHeavyRain  uint8 = 4
	WeatherStorm      uint8 = 5
)

// Actual tyre compound identifiers (C0 through C5 Pirelli dry slick compounds)
const (
	ActualCompoundC5 uint8 = 16
	ActualCompoundC4 uint8 = 17
	ActualCompoundC3 uint8 = 18
	ActualCompoundC2 uint8 = 19
	ActualCompoundC1 uint8 = 20
	ActualCompoundC0 uint8 = 21
)

// Active Aero mode constants (2026 Regulations)
const (
	ActiveAeroCornerMode   uint8 = 0
	ActiveAeroStraightMode uint8 = 1
)

// Result reason constants
const (
	ResultReasonInvalid           uint8 = 0
	ResultReasonRetired           uint8 = 1
	ResultReasonFinished          uint8 = 2
	ResultReasonTerminalDamage    uint8 = 3
	ResultReasonInactive          uint8 = 4
	ResultReasonNotEnoughLaps     uint8 = 5
	ResultReasonBlackFlagged      uint8 = 6
	ResultReasonRedFlagged        uint8 = 7
	ResultReasonMechanicalFailure uint8 = 8
	ResultReasonSessionSkipped    uint8 = 9
	ResultReasonSessionSimulated  uint8 = 10
)

// Tyre compound name constants
const (
	CompoundNameSoft         = "SOFT"
	CompoundNameMedium       = "MEDIUM"
	CompoundNameHard         = "HARD"
	CompoundNameIntermediate = "INTERMEDIATE"
	CompoundNameWet          = "WET"
	CompoundNameUnknown      = "UNKNOWN"
)

// Unit conversion, protocol limits, and buffer defaults
const (
	MillisPerSecond                          = 1000
	SecondsPerMinute                         = 60
	MillisPerMinute                          = 60_000
	KmhToMps                                 = 1000.0 / 3600.0 // Conversion factor from km/h to m/s
	MaxERSStoreEnergyJoules                  = 4_000_000.0     // 4 MJ standard F1 ERS store capacity
	DefaultTelemetrySampleCapacity           = 1800            // Default buffer capacity for a single lap (~90s @ 20Hz)
	MaxSessionLapsSanity                     = 120             // Sanity cap for F1 session laps
	DefaultSessionDurationLimitSeconds       = 7200            // 2-hour default F1 session duration limit emitted by UDP telemetry
	InvalidDriverID                          = 255
	ActiveStintEndLap                  uint8 = 255       // Sentinel indicating active/open-ended stint
	UnknownValue                             = "Unknown" // Fallback string for uninitialized session/track values
	UnknownTrackID                           = -1
	LapValidBitFlag                    uint8 = 0x01
	Sector1ValidBitFlag                uint8 = 0x02
	Sector2ValidBitFlag                uint8 = 0x04
	Sector3ValidBitFlag                uint8 = 0x08
	MaxTyreStints                            = 8
)

// NormalizeCompoundName normalizes raw or visual tyre compound string/ID to standard uppercase compound name.
func NormalizeCompoundName(raw string) string {
	if raw == "" {
		return CompoundNameUnknown
	}
	s := strings.ToUpper(strings.TrimSpace(raw))
	switch {
	case s == strconv.Itoa(int(CompoundSoft)) || strings.Contains(s, "SOFT") || s == "S":
		return CompoundNameSoft
	case s == strconv.Itoa(int(CompoundMedium)) || strings.Contains(s, "MEDIUM") || strings.Contains(s, "MED") || s == "M":
		return CompoundNameMedium
	case s == strconv.Itoa(int(CompoundHard)) || strings.Contains(s, "HARD") || s == "H":
		return CompoundNameHard
	case s == strconv.Itoa(int(CompoundInter)) || strings.Contains(s, "INTER") || s == "I":
		return CompoundNameIntermediate
	case s == strconv.Itoa(int(CompoundWet)) || strings.Contains(s, "WET") || s == "W":
		return CompoundNameWet
	default:
		return s
	}
}
