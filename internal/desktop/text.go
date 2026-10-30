package desktop

import "strings"

// appName is the name the windows, the tray, its tooltip and dialogs show.
const appName = "F1 Telemetry"

// text is what the tray, the windows' titles and dialogs say, in the user's Windows display
// language.
type text struct {
	Open             string
	LiveView         string
	RaceControl      string
	RaceControlTitle string // the Race Control window's title
	UpdateAvailable  string // %s: the new version
	StartWithWindows string
	DevBuildHint     string
	OpenDataFolder   string
	OpenLogFile      string
	Quit             string
	Live             string // %s: session type and track
	Paused           string
	Waiting          string // %d: the UDP port
	StartFailed      string
}

var englishText = text{
	Open:             "Open F1 Telemetry",
	LiveView:         "Live view",
	RaceControl:      "Race Control in a new window",
	RaceControlTitle: "F1 Telemetry · Race Control",
	UpdateAvailable:  "Update available: %s",
	StartWithWindows: "Start with Windows",
	DevBuildHint:     "Not available for a build run with go run",
	OpenDataFolder:   "Open data folder",
	OpenLogFile:      "Open log file",
	Quit:             "Quit",
	Live:             "Live: %s",
	Paused:           "Telemetry paused",
	Waiting:          "Waiting for the game on UDP port %d",
	StartFailed:      "F1 Telemetry could not start",
}

var spanishText = text{
	Open:             "Abrir F1 Telemetry",
	LiveView:         "Vista en vivo",
	RaceControl:      "Control de Carrera en otra ventana",
	RaceControlTitle: "F1 Telemetry · Control de Carrera",
	UpdateAvailable:  "Actualización disponible: %s",
	StartWithWindows: "Iniciar con Windows",
	DevBuildHint:     "No disponible al ejecutar con go run",
	OpenDataFolder:   "Abrir carpeta de datos",
	OpenLogFile:      "Abrir archivo de registro",
	Quit:             "Salir",
	Live:             "En vivo: %s",
	Paused:           "Telemetría en pausa",
	Waiting:          "Esperando al juego en el puerto UDP %d",
	StartFailed:      "F1 Telemetry no pudo iniciar",
}

// textFor picks the strings for a language tag such as "es-AR": Spanish for any Spanish
// locale, English otherwise (the dashboard's two languages).
func textFor(languageTag string) text {
	lang, _, _ := strings.Cut(strings.ToLower(languageTag), "-")
	if lang == "es" {
		return spanishText
	}
	return englishText
}
