package settings

import "context"

const voiceSettingsKey = "voice_settings"

// Voice is how the race engineer talks: persona, language and speech voice. Volume, radio effects
// and whether alerts play stay on each device, because they depend on the speakers in front of it.
type Voice struct {
	Persona        string  `json:"persona"`
	Language       string  `json:"language"`
	CustomPrompt   string  `json:"custom_prompt"`
	DriverCallsign string  `json:"driver_callsign"`
	NeuralVoice    string  `json:"neural_voice"`
	SpeechRate     float64 `json:"speech_rate"`
	SpeechPitch    float64 `json:"speech_pitch"`
}

// LoadVoice returns the saved voice settings, and false when none were saved yet.
func LoadVoice(ctx context.Context, store Store) (Voice, bool, error) {
	var v Voice
	ok, err := load(ctx, store, voiceSettingsKey, &v)
	return v, ok, err
}

// SaveVoice stores the voice settings.
func SaveVoice(ctx context.Context, store Store, v Voice) error {
	return save(ctx, store, voiceSettingsKey, v)
}
