package locales

import (
	"strings"
	"sync"
)

const (
	// Locale codes
	LocaleCodeEN = "en"
	LocaleCodeES = "es"

	// Canonical Neural Voices for Microsoft Edge TTS
	VoiceBonoBritish        = "en-GB-RyanNeural"
	VoiceColapintoArgentine = "es-AR-TomasNeural"
	VoiceSpanishAlvaro      = "es-ES-AlvaroNeural"
	VoiceMexicanJorge       = "es-MX-JorgeNeural"
	VoiceAmericanGuy        = "en-US-GuyNeural"
)

// PromptCatalog defines the contract for localized AI race engineer prompts and TTS voices.
type PromptCatalog interface {
	// LocaleCode returns the BCP-47 / ISO language code (e.g. "en", "es").
	LocaleCode() string

	// PersonaPrompt returns the base persona instructions.
	PersonaPrompt(persona, customPrompt string) string

	// DriverCallsignDirective formats how the engineer addresses the driver.
	DriverCallsignDirective(callsign string) string

	// CriticalRadioConstraints returns the mandatory pit-to-car radio protocols.
	CriticalRadioConstraints() string

	// UrgencyDirective returns the contextual prompt injection for urgent situations.
	UrgencyDirective(level string) string

	// IncidentDirective returns the track incident directive (Safety Car, VSC, Red Flag).
	IncidentDirective(status string) string

	// F12026RegulationMandate returns the prompt rules enforcing 2026 active aero & override boost.
	F12026RegulationMandate() string

	// DrivingPhaseDirective returns protocol instructions for operational driving phases.
	DrivingPhaseDirective(phase string) string

	// ThermalOperatingWindows returns the optimal tyre thermal operating ranges.
	ThermalOperatingWindows() string

	// EngineThermalDerateCurve returns the engine temperature and power loss guidelines.
	EngineThermalDerateCurve() string

	// SessionProtocolDirective returns tactical directives for Qualifying, Practice, or Race.
	SessionProtocolDirective(sessionType, trackName string, isQualy, isPractice bool) string

	// GeneralAssistantDirectives returns language-specific instructions for general telemetry questions.
	GeneralAssistantDirectives() string

	// DefaultTTSVoice returns the canonical default voice for this locale.
	DefaultTTSVoice() string

	// DefaultTTSLocale returns the TTS locale tag (e.g. "en-GB", "es-AR").
	DefaultTTSLocale() string

	// DefaultPersonaTTSVoice returns the voice name and locale tag for a specific persona.
	DefaultPersonaTTSVoice(persona string) (voiceName, ttsLocale string)
}

var (
	registryMu sync.RWMutex
	registry   = make(map[string]PromptCatalog)
	defaultCat PromptCatalog
)

// Register registers a PromptCatalog instance in the global registry.
func Register(catalog PromptCatalog) {
	if catalog == nil {
		return
	}
	registryMu.Lock()
	defer registryMu.Unlock()
	code := NormalizeLocale(catalog.LocaleCode())
	registry[code] = catalog
	if code == LocaleCodeEN || defaultCat == nil {
		defaultCat = catalog
	}
}

// NormalizeLocale standardizes a language tag into a registered base subtag (e.g. "en-US" -> "en", "es_AR" -> "es").
func NormalizeLocale(tag string) string {
	cleaned := strings.ToLower(strings.TrimSpace(tag))
	if cleaned == "" {
		return ""
	}
	sep := "-"
	if strings.Contains(cleaned, "_") {
		sep = "_"
	}
	parts := strings.Split(cleaned, sep)
	return parts[0]
}

// Get returns the registered PromptCatalog for the given locale, falling back to English.
func Get(locale string) PromptCatalog {
	norm := NormalizeLocale(locale)
	registryMu.RLock()
	cat, exists := registry[norm]
	def := defaultCat
	registryMu.RUnlock()

	if exists && cat != nil {
		return cat
	}
	if def != nil {
		return def
	}
	return defaultEnglishCatalog
}

// Resolve identifies and returns the best PromptCatalog for a given request, fallback, and persona.
func Resolve(reqLang, fallbackLang, persona string) PromptCatalog {
	lang := NormalizeLocale(reqLang)
	if lang == "" {
		lang = NormalizeLocale(fallbackLang)
	}
	if lang == "" {
		p := strings.ToLower(strings.TrimSpace(persona))
		if p == "colapinto" {
			lang = LocaleCodeES
		} else {
			lang = LocaleCodeEN
		}
	}
	return Get(lang)
}
