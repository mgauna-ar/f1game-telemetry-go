package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	edgeTTSClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	edgeTTSBaseWSS     = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
	edgeTTSHeadURL     = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
	edgeTTSSecVersion  = "1-143.0.3650.75"
	edgeTTSUserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
	edgeTTSOrigin      = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
	defaultAudioFormat = "audio-24khz-48kbitrate-mono-mp3"
	winEpochOffset     = 11644473600

	// Default Neural Voices for Personas
	VoiceColapintoArgentine = "es-AR-TomasNeural"
	VoiceBonoBritish        = "en-GB-RyanNeural"
	VoiceSpanishAlvaro      = "es-ES-AlvaroNeural"
	VoiceMexicanJorge       = "es-MX-JorgeNeural"
	VoiceAmericanGuy        = "en-US-GuyNeural"
)

// AITTSRequest represents the incoming JSON payload for synthesis.
type AITTSRequest struct {
	Text     string `json:"text"`
	Voice    string `json:"voice,omitempty"`
	Persona  string `json:"persona,omitempty"`
	Language string `json:"language,omitempty"`
	Rate     string `json:"rate,omitempty"`  // e.g. "+0%", "+10%"
	Pitch    string `json:"pitch,omitempty"` // e.g. "+0Hz"
}

// AudioCache holds cached synthesized MP3 chunks in memory for instant replay.
type AudioCache struct {
	mu    sync.RWMutex
	items map[string][]byte
	order []string
	limit int
}

var globalTTSCache = &AudioCache{
	items: make(map[string][]byte),
	order: make([]string, 0, 200),
	limit: 200,
}

func (c *AudioCache) Get(key string) ([]byte, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	data, ok := c.items[key]
	return data, ok
}

func (c *AudioCache) Set(key string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.items[key]; exists {
		c.items[key] = data
		return
	}

	if len(c.order) >= c.limit {
		evictKey := c.order[0]
		c.order = c.order[1:]
		delete(c.items, evictKey)
	}

	c.items[key] = data
	c.order = append(c.order, key)
}

// Clock skew manager to ensure Sec-MS-GEC is accurate even if the host clock drifts.
type clockSkewTracker struct {
	mu          sync.RWMutex
	skewSeconds float64
	lastChecked time.Time
}

var globalClockTracker = &clockSkewTracker{}

func (c *clockSkewTracker) getCorrectedTime() time.Time {
	c.mu.RLock()
	skew := c.skewSeconds
	last := c.lastChecked
	c.mu.RUnlock()

	// Re-check clock skew against Edge server every 30 minutes
	if time.Since(last) > 30*time.Minute {
		go c.refreshSkew()
	}

	return time.Now().UTC().Add(time.Duration(skew * float64(time.Second)))
}

func (c *clockSkewTracker) refreshSkew() {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Head(edgeTTSHeadURL)
	if err != nil || resp == nil {
		return
	}
	defer resp.Body.Close()

	dateHeader := resp.Header.Get("Date")
	if dateHeader == "" {
		return
	}

	serverTime, err := http.ParseTime(dateHeader)
	if err != nil {
		return
	}

	now := time.Now().UTC()
	skew := serverTime.Sub(now).Seconds()

	c.mu.Lock()
	c.skewSeconds = skew
	c.lastChecked = now
	c.mu.Unlock()
}

// generateSecMsGec generates the timestamp-based token required by Microsoft Edge TTS.
func generateSecMsGec() string {
	t := globalClockTracker.getCorrectedTime()
	unixSec := t.Unix()
	ticks := unixSec + winEpochOffset
	rounded := ticks - (ticks % 300)
	fileTimeTicks := rounded * 10000000
	tokenStr := fmt.Sprintf("%d%s", fileTimeTicks, edgeTTSClientToken)
	hash := sha256.Sum256([]byte(tokenStr))
	return strings.ToUpper(hex.EncodeToString(hash[:]))
}

// generateUUID returns a random 32-character hex UUID.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// resolveVoice determines the appropriate neural voice name based on voice, persona, language, or defaults.
func resolveVoice(voice, persona, language string) (voiceName, lang string) {
	v := strings.TrimSpace(voice)
	p := strings.ToLower(strings.TrimSpace(persona))
	l := strings.ToLower(strings.TrimSpace(language))

	if v != "" {
		// Infer lang from voice name prefix (e.g. es-AR-TomasNeural -> es-AR)
		parts := strings.Split(v, "-")
		if len(parts) >= 2 {
			return v, fmt.Sprintf("%s-%s", parts[0], parts[1])
		}
		return v, "es-AR"
	}

	if strings.HasPrefix(l, "en") {
		return VoiceBonoBritish, "en-GB"
	}
	if strings.HasPrefix(l, "es") {
		return VoiceColapintoArgentine, "es-AR"
	}

	if p == "colapinto" {
		return VoiceColapintoArgentine, "es-AR"
	}
	if p == "bono" {
		return VoiceBonoBritish, "en-GB"
	}

	// Default to Bono (British Male)
	return VoiceBonoBritish, "en-GB"
}

// buildSSML constructs a valid W3C SSML payload.
func buildSSML(text, voice, lang, rate, pitch string) string {
	if rate == "" {
		rate = "+0%"
	}
	if pitch == "" {
		pitch = "+0Hz"
	}

	var buf bytes.Buffer
	_ = xml.EscapeText(&buf, []byte(text))
	escapedText := buf.String()

	return fmt.Sprintf(
		`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='%s'><voice name='%s'><prosody pitch='%s' rate='%s'>%s</prosody></voice></speak>`,
		lang,
		voice,
		pitch,
		rate,
		escapedText,
	)
}

// SynthesizeEdgeNeuralTTS performs speech synthesis using Microsoft Edge Neural TTS over WebSocket.
func SynthesizeEdgeNeuralTTS(ctx context.Context, text, voice, rate, pitch string) ([]byte, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil, errors.New("empty text for synthesis")
	}

	voiceName, lang := resolveVoice(voice, "", "")
	cacheKey := fmt.Sprintf("%s|%s|%s|%s", voiceName, rate, pitch, trimmed)

	if cached, ok := globalTTSCache.Get(cacheKey); ok && len(cached) > 0 {
		return cached, nil
	}

	connID := generateUUID()
	reqID := generateUUID()
	secMsGec := generateSecMsGec()

	wssURL := fmt.Sprintf(
		"%s?TrustedClientToken=%s&ConnectionId=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s",
		edgeTTSBaseWSS,
		edgeTTSClientToken,
		connID,
		secMsGec,
		edgeTTSSecVersion,
	)

	headers := http.Header{}
	headers.Set("User-Agent", edgeTTSUserAgent)
	headers.Set("Origin", edgeTTSOrigin)
	headers.Set("Pragma", "no-cache")
	headers.Set("Cache-Control", "no-cache")
	headers.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	headers.Set("Accept-Language", "en-US,en;q=0.9")

	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, wssURL, headers)
	if err != nil {
		return nil, fmt.Errorf("websocket dial failed: %w", err)
	}
	defer conn.Close()

	// 1. Send speech.config message
	configMsg := fmt.Sprintf(
		"Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},\"outputFormat\":%q}}}}",
		defaultAudioFormat,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(configMsg)); err != nil {
		return nil, fmt.Errorf("failed to send speech config: %w", err)
	}

	// 2. Send SSML message
	ssml := buildSSML(trimmed, voiceName, lang, rate, pitch)
	ssmlMsg := fmt.Sprintf(
		"X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n%s",
		reqID,
		ssml,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(ssmlMsg)); err != nil {
		return nil, fmt.Errorf("failed to send ssml: %w", err)
	}

	// 3. Read loop collecting binary MP3 frames
	var audioData []byte
	readCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	for {
		select {
		case <-readCtx.Done():
			return nil, fmt.Errorf("tts synthesis timed out: %w", readCtx.Err())
		default:
		}

		msgType, message, err := conn.ReadMessage()
		if err != nil {
			if len(audioData) > 0 {
				break
			}
			return nil, fmt.Errorf("failed reading from tts stream: %w", err)
		}

		if msgType == websocket.BinaryMessage {
			if len(message) > 2 {
				headerLen := binary.BigEndian.Uint16(message[:2])
				dataOffset := 2 + int(headerLen)
				if len(message) > dataOffset {
					audioData = append(audioData, message[dataOffset:]...)
				}
			}
		} else if msgType == websocket.TextMessage {
			textStr := string(message)
			if strings.Contains(textStr, "Path:turn.end") {
				break
			}
		}
	}

	if len(audioData) == 0 {
		return nil, errors.New("tts synthesis returned empty audio")
	}

	globalTTSCache.Set(cacheKey, audioData)
	return audioData, nil
}

// handleAITTS handles POST /api/ai/tts HTTP requests and streams back the synthesized MP3 audio.
func (s *Server) handleAITTS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AITTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		http.Error(w, "Field 'text' is required", http.StatusBadRequest)
		return
	}

	voiceName, _ := resolveVoice(req.Voice, req.Persona, req.Language)

	audioBytes, err := SynthesizeEdgeNeuralTTS(r.Context(), req.Text, voiceName, req.Rate, req.Pitch)
	if err != nil {
		log.Printf("[AI TTS] Synthesis error: %v", err)
		http.Error(w, fmt.Sprintf("Speech synthesis failed: %v", err), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(audioBytes)))
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audioBytes)
}
