package packets

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

// Unit conversion, protocol limits, and buffer defaults
const (
	MillisPerMinute                      = 60_000
	MaxERSStoreEnergyJoules              = 4_000_000.0 // 4 MJ standard F1 ERS store capacity
	DefaultTelemetrySampleCapacity       = 1800        // Default buffer capacity for a single lap (~90s @ 20Hz)
	MaxSessionLapsSanity                 = 120         // Sanity cap for F1 session laps
	InvalidDriverID                      = 255
	UnknownTrackID                       = -1
	LapValidBitFlag                uint8 = 0x01
	MaxTyreStints                        = 8
)
