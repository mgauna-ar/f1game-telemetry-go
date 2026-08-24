package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResolveVoice(t *testing.T) {
	tests := []struct {
		name         string
		voice        string
		persona      string
		language     string
		expectedName string
		expectedLang string
	}{
		{
			name:         "Default Colapinto Argentine Male",
			voice:        "",
			persona:      "colapinto",
			language:     "es",
			expectedName: VoiceColapintoArgentine,
			expectedLang: "es-AR",
		},
		{
			name:         "Colapinto speaking English defaults to British Ryan",
			voice:        "",
			persona:      "colapinto",
			language:     "en",
			expectedName: VoiceBonoBritish,
			expectedLang: "en-GB",
		},
		{
			name:         "Bono speaking Spanish defaults to Argentine Tomas",
			voice:        "",
			persona:      "bono",
			language:     "es",
			expectedName: VoiceColapintoArgentine,
			expectedLang: "es-AR",
		},
		{
			name:         "Bono British Male in English",
			voice:        "",
			persona:      "bono",
			language:     "en",
			expectedName: VoiceBonoBritish,
			expectedLang: "en-GB",
		},
		{
			name:         "Explicit Mexican Voice overrides persona and language",
			voice:        "es-MX-JorgeNeural",
			persona:      "bono",
			language:     "es",
			expectedName: "es-MX-JorgeNeural",
			expectedLang: "es-MX",
		},
		{
			name:         "Explicit Spanish Alvaro Voice",
			voice:        "es-ES-AlvaroNeural",
			persona:      "",
			language:     "",
			expectedName: "es-ES-AlvaroNeural",
			expectedLang: "es-ES",
		},
		{
			name:         "Default fallback without parameters resolves to Bono British",
			voice:        "",
			persona:      "",
			language:     "",
			expectedName: VoiceBonoBritish,
			expectedLang: "en-GB",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vName, lang := resolveVoice(tt.voice, tt.persona, tt.language)
			if vName != tt.expectedName {
				t.Errorf("expected voice %q, got %q", tt.expectedName, vName)
			}
			if lang != tt.expectedLang {
				t.Errorf("expected lang %q, got %q", tt.expectedLang, lang)
			}
		})
	}
}

func TestBuildSSML(t *testing.T) {
	ssml := buildSSML("Radio check, te copio fuerte y claro.", "es-AR-TomasNeural", "es-AR", "+10%", "-5Hz")

	if !strings.Contains(ssml, "<speak version='1.0'") {
		t.Errorf("SSML missing speak tag: %s", ssml)
	}
	if !strings.Contains(ssml, "xml:lang='es-AR'") {
		t.Errorf("SSML missing xml:lang: %s", ssml)
	}
	if !strings.Contains(ssml, "name='es-AR-TomasNeural'") {
		t.Errorf("SSML missing voice name: %s", ssml)
	}
	if !strings.Contains(ssml, "pitch='-5Hz'") || !strings.Contains(ssml, "rate='+10%'") {
		t.Errorf("SSML missing prosody tags: %s", ssml)
	}
	if !strings.Contains(ssml, "Radio check, te copio fuerte y claro.") {
		t.Errorf("SSML missing text: %s", ssml)
	}
}

func TestBuildSSMLEscaping(t *testing.T) {
	ssml := buildSSML("Box & Pit <now> \"fast\"", "es-AR-TomasNeural", "es-AR", "", "")

	if !strings.Contains(ssml, "Box &amp; Pit &lt;now&gt; &#34;fast&#34;") {
		t.Errorf("SSML not XML-escaped properly: %s", ssml)
	}
}

func TestAudioCache(t *testing.T) {
	cache := &AudioCache{
		items: make(map[string][]byte),
		order: make([]string, 0, 3),
		limit: 3,
	}

	cache.Set("key1", []byte("audio1"))
	cache.Set("key2", []byte("audio2"))
	cache.Set("key3", []byte("audio3"))

	if data, ok := cache.Get("key1"); !ok || string(data) != "audio1" {
		t.Errorf("failed to get key1 from cache")
	}

	// Adding 4th item should evict key1 (oldest)
	cache.Set("key4", []byte("audio4"))

	if _, ok := cache.Get("key1"); ok {
		t.Errorf("expected key1 to be evicted from cache")
	}
	if data, ok := cache.Get("key4"); !ok || string(data) != "audio4" {
		t.Errorf("failed to get key4 from cache")
	}
}

func TestGenerateSecMsGec(t *testing.T) {
	token := generateSecMsGec()
	if len(token) != 64 {
		t.Errorf("expected 64-char sha256 hex string, got %d chars: %s", len(token), token)
	}
	if token != strings.ToUpper(token) {
		t.Errorf("expected uppercase hex token, got %s", token)
	}
}

func TestHandleAITTS_Validation(t *testing.T) {
	server := &Server{}

	// 1. Method Not Allowed (GET)
	req := httptest.NewRequest(http.MethodGet, "/api/ai/tts", http.NoBody)
	w := httptest.NewRecorder()
	server.handleAITTS(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}

	// 2. Empty Text
	payload, _ := json.Marshal(AITTSRequest{Text: ""})
	req = httptest.NewRequest(http.MethodPost, "/api/ai/tts", bytes.NewReader(payload))
	w = httptest.NewRecorder()
	server.handleAITTS(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}
