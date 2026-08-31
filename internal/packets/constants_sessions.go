package packets

import "fmt"

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
