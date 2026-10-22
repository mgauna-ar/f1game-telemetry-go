package ai

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/bits"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mgauna/f1game-telemetry-go/internal/locales"
)

const (
	edgeTTSClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	edgeTTSBaseWSS     = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
	edgeTTSHeadURL     = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
	edgeTTSSecVersion  = "2-143.0.3650.75"
	edgeTTSUserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
	edgeTTSOrigin      = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
	defaultAudioFormat = "audio-24khz-48kbitrate-mono-mp3"
	winEpochOffset     = 11644473600

	// edgeTTSReadTimeout is the longest one read of the synthesis stream waits for a frame, and
	// edgeTTSSynthesisTimeout the longest the whole answer takes.
	edgeTTSReadTimeout      = 5 * time.Second
	edgeTTSSynthesisTimeout = 12 * time.Second

	// Default Neural Voices for Personas (aliased from locales)
	VoiceColapintoArgentine = locales.VoiceColapintoArgentine
	VoiceBonoBritish        = locales.VoiceBonoBritish
	VoiceSpanishAlvaro      = locales.VoiceSpanishAlvaro
	VoiceMexicanJorge       = locales.VoiceMexicanJorge
	VoiceAmericanGuy        = locales.VoiceAmericanGuy
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
		slog.Warn("Failed to query Edge TTS server for clock skew", "url", edgeTTSHeadURL, "error", err)
		return
	}
	defer resp.Body.Close()

	if _, err := c.adjustFromDate(resp.Header.Get("Date")); err != nil {
		slog.Warn("Failed to read clock skew from Edge TTS server", "url", edgeTTSHeadURL, "error", err)
	}
}

// adjustFromDate sets the skew from an Edge server's Date header and returns it.
// Upstream edge-tts does the same with a 403's Date (DRM.handle_client_response_error).
func (c *clockSkewTracker) adjustFromDate(dateHeader string) (float64, error) {
	if dateHeader == "" {
		return 0, errors.New("response has no Date header")
	}
	serverTime, err := http.ParseTime(dateHeader)
	if err != nil {
		return 0, fmt.Errorf("parse Date header %q: %w", dateHeader, err)
	}

	now := time.Now().UTC()
	skew := serverTime.Sub(now).Seconds()

	c.mu.Lock()
	c.skewSeconds = skew
	c.lastChecked = now
	c.mu.Unlock()
	return skew, nil
}

// The Sec-MS-GEC v2 token code below (the sha256* and cs64* tables and helpers,
// and generateSecMsGecV2FromTime) is a port of rany2/edge-tts src/edge_tts/drm.py
// and must stay byte-for-byte equal to it: Microsoft answers any other token with
// a 403. When upstream changes drm.py, port the change and update the reference
// vector in TestGenerateSecMsGec.
var (
	sha256Initial = [8]uint32{
		0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
		0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
	}
	sha256State = [8]uint32{
		0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A,
		0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2,
	}
	sha256Schedule = [14]uint32{
		0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA,
		0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6,
		0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33,
		0xD258B060, 0x72766564,
	}
	sha256RoundConstants = [64]uint32{
		0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
		0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
		0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
		0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
		0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
		0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
		0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
		0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
		0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
		0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
		0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
		0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
		0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
		0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
		0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
		0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
	}
)

const (
	sha256Adjustment       uint32 = 0xC9DC06A7
	sha256Sigma0Adjustment uint32 = 0x059C0B80
	sha256Sigma1Adjustment uint32 = 0x000B92C0
	cs64Factor             uint32 = 0x82893933
	cs64Adjustment0        uint32 = 0xF2F90B1A
	cs64Adjustment1        uint32 = 0x0B1A0000
	cs64TermMultiplierEven uint32 = 0xEF0569FB
	cs64TermMultiplierOdd  uint32 = 0xC31713DB
	cs64TMultiplierEven    uint32 = 0x76F50F34
	cs64TMultiplierOdd     uint32 = 0x1881CE3C
	cs64AccMultiplierEven  uint32 = 0xC3EFEA97
	cs64AccMultiplierOdd   uint32 = 0x35BD1EC9
	cs64StateMult1         uint32 = 0xCF98B111
	cs64StateMult2         uint32 = 0x87085B9F
	cs64StateMult3         uint32 = 0x12CEB96D
	cs64StateMult4         uint32 = 0x257E1D83
	cs64StateMult5         uint32 = 0xA27416F5
	cs64StateMult6         uint32 = 0xD38396FF
	cs64StateMult7         uint32 = 0x7C932B89
	cs64StateMult8         uint32 = 0xBFA49F69
)

var cs64Coefficients = [14][2]uint32{
	{0xE82E91B1, 0xB32700D0},
	{0x44DE24C6, 0x88DFF51D},
	{0x3BEB65BC, 0x29514038},
	{0xC89C5933, 0xB328CBDF},
	{0x8D1EC211, 0xD405B4D5},
	{0x314EF5D5, 0x26E55F3C},
	{0xE92491B1, 0x607801C6},
	{0xF0A5B9D5, 0x82B2C1FB},
	{0x06064CF3, 0xFA51A3DA},
	{0xDA79FA60, 0x207CC464},
	{0xBED20560, 0x3C3C74F3},
	{0x89F9C9F8, 0xD2D14B61},
	{0x35FA38C6, 0xBB04A2C1},
	{0xCB49E3C6, 0xC5626167},
}

var sha256BlockConstants [64]uint32

func init() {
	copy(sha256BlockConstants[:], sha256RoundConstants[:])
	sha256BlockConstants[14] = sha256Adjustment
}

func rol16(v uint32) uint32 {
	return (v << 16) | (v >> 16)
}

func sigma0(v uint32) uint32 {
	return bits.RotateLeft32(v, -7) ^ bits.RotateLeft32(v, -18) ^ (v >> 3)
}

func sigma1(v uint32) uint32 {
	return bits.RotateLeft32(v, -17) ^ bits.RotateLeft32(v, -19) ^ (v >> 10)
}

func expandSha256Schedule(words []uint32, firstWord int) {
	for i := firstWord; i < 64; i++ {
		s1 := sigma1(words[i-2])
		s0 := sigma0(words[i-15])
		words[i] = s1 + words[i-7] + s0 + words[i-16]
	}
}

func sha256Rounds(state [8]uint32, words []uint32, firstRound int) [8]uint32 {
	a, b, c, d, e, f, g, h := state[0], state[1], state[2], state[3], state[4], state[5], state[6], state[7]
	constants := sha256RoundConstants
	if firstRound == 14 {
		constants = sha256BlockConstants
	}

	for i := firstRound; i < 64; i++ {
		s1 := bits.RotateLeft32(e, -6) ^ bits.RotateLeft32(e, -11) ^ bits.RotateLeft32(e, -25)
		ch := (e & f) ^ (^e & g)
		t1 := h + s1 + ch + constants[i] + words[i]

		s0 := bits.RotateLeft32(a, -2) ^ bits.RotateLeft32(a, -13) ^ bits.RotateLeft32(a, -22)
		maj := (a & b) ^ (a & c) ^ (b & c)
		t2 := s0 + maj

		h = g
		g = f
		f = e
		e = d + t1
		d = c
		c = b
		b = a
		a = t1 + t2
	}
	return [8]uint32{a, b, c, d, e, f, g, h}
}

func sha256Init(data []byte) [8]uint32 {
	words := make([]uint32, 64)
	words[14] = (uint32(data[0]) << 16) | (uint32(data[1]) << 8) | uint32(data[2])
	words[15] = binary.BigEndian.Uint32(data[3:7])

	for i := 16; i < 30; i++ {
		val := sha256Schedule[i-16]
		if i-2 >= 14 {
			s1 := sigma1(words[i-2])
			if i == 16 {
				s1 ^= sha256Sigma1Adjustment
			}
			val += s1
		}
		if i-7 >= 14 {
			val += words[i-7]
		}
		if i-15 >= 14 {
			s0 := sigma0(words[i-15])
			if i == 29 {
				s0 ^= sha256Sigma0Adjustment
			}
			val += s0
		}
		words[i] = val
	}

	words[30] = sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + sha256Adjustment - sha256RoundConstants[14]
	expandSha256Schedule(words, 31)

	working := sha256Rounds(sha256State, words, 14)
	var res [8]uint32
	for i := 0; i < 8; i++ {
		res[i] = sha256Initial[i] + working[i]
	}
	return res
}

func sha256Digest(data []byte) []byte {
	length := 57 + len(data)
	padZeroCount := ((55-length)%64 + 64) % 64
	padded := make([]byte, 0, len(data)-7+1+padZeroCount+8)
	padded = append(padded, data[7:]...)
	padded = append(padded, 0x80)
	padded = append(padded, make([]byte, padZeroCount)...)
	var lenBuf [8]byte
	binary.BigEndian.PutUint64(lenBuf[:], uint64(length*8))
	padded = append(padded, lenBuf[:]...)

	state := sha256Init(data[:7])
	words := make([]uint32, 64)
	for offset := 0; offset < len(padded); offset += 64 {
		for j := 0; j < 16; j++ {
			words[j] = binary.BigEndian.Uint32(padded[offset+j*4 : offset+j*4+4])
		}
		expandSha256Schedule(words, 16)
		working := sha256Rounds(state, words, 0)
		for j := 0; j < 8; j++ {
			state[j] += working[j]
		}
	}

	out := make([]byte, 32)
	for i := 0; i < 8; i++ {
		binary.BigEndian.PutUint32(out[i*4:i*4+4], state[i])
	}
	return out
}

func wordsLE4Even(data []byte) []uint32 {
	rem := len(data) % 4
	padded := data
	if rem != 0 {
		padded = append(append([]byte(nil), data...), make([]byte, 4-rem)...)
	}
	count := len(padded) / 4
	words := make([]uint32, count)
	for i := 0; i < count; i++ {
		words[i] = binary.LittleEndian.Uint32(padded[i*4 : i*4+4])
	}
	if len(words)%2 != 0 {
		words = append(words, 0)
	}
	return words
}

func cs64Digest(data, digest []byte) (r0, r1 uint32) {
	keyA := binary.LittleEndian.Uint32(digest[0:4]) | 1
	keyB := binary.LittleEndian.Uint32(digest[4:8]) | 1
	factors := [2]uint32{keyA * cs64Factor, keyB * cs64Factor}

	terms := make([]uint32, 0, 14+32)
	offsets := make([]uint32, 0, 14+32)
	for i, coeff := range cs64Coefficients {
		terms = append(terms, coeff[0]*factors[i%2])
		offsets = append(offsets, coeff[1])
	}

	zeroPrefixed := append([]byte{0x00}, data...)
	leWords := wordsLE4Even(zeroPrefixed)
	for i, word := range leWords {
		k := keyA
		m := cs64TermMultiplierEven
		if i%2 != 0 {
			k = keyB
			m = cs64TermMultiplierOdd
		}
		term := word * k
		offset := rol16(word) * m
		if i == 0 {
			term += cs64Adjustment0 * factors[0]
			offset += cs64Adjustment1
		}
		terms = append(terms, term)
		offsets = append(offsets, offset)
	}

	var swapAcc, swapLast, state, acc uint32
	for i := 0; i < len(terms); i += 2 {
		x, y := terms[i], terms[i+1]
		t := rol16(offsets[i] + x)
		q := t * cs64TMultiplierEven
		swapAcc += rol16(q)*cs64AccMultiplierEven + q

		t = rol16(offsets[i+1] + y)
		q = t * cs64TMultiplierOdd
		swapLast = rol16(q)*cs64AccMultiplierOdd + q
		swapAcc += swapLast

		state = state*keyA + x
		state = rol16(state) * cs64StateMult1
		state = rol16(state) * cs64StateMult2
		state = rol16(state) * cs64StateMult3
		state = rol16(state) * cs64StateMult4
		acc += state

		t = state*keyB + y
		t = rol16(t) * cs64StateMult5
		t = rol16(t) * cs64StateMult6
		state = rol16(rol16(t)*cs64StateMult7) * cs64StateMult8
		acc += state
	}

	return swapLast ^ state, swapAcc ^ acc
}

// generateSecMsGecV2FromTime is drm.py's DRM.generate_sec_ms_gec for time t.
func generateSecMsGecV2FromTime(t time.Time) string {
	unixSec := t.Unix()
	ticks := unixSec + winEpochOffset
	rounded := ticks - (ticks % 300)
	fileTimeTicks := rounded * 10000000
	strToHash := fmt.Sprintf("%d%s", fileTimeTicks, edgeTTSClientToken)

	data := []byte(strToHash)
	digest := sha256Digest(data)
	r0, r1 := cs64Digest(data, digest)

	var cs64Buf [8]byte
	binary.LittleEndian.PutUint32(cs64Buf[0:4], r0)
	binary.LittleEndian.PutUint32(cs64Buf[4:8], r1)

	cs64Hex := strings.ToUpper(hex.EncodeToString(cs64Buf[:]))
	sha256Hex := strings.ToUpper(hex.EncodeToString(digest))
	return fmt.Sprintf("%s-%s", cs64Hex, sha256Hex)
}

// generateSecMsGec generates the timestamp-based token required by Microsoft Edge TTS.
func generateSecMsGec(clock *clockSkewTracker) string {
	t := clock.getCorrectedTime()
	return generateSecMsGecV2FromTime(t)
}

// generateUUID returns a random 32-character hex UUID.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ResolveVoice determines the appropriate neural voice name based on voice, persona, language, or defaults.
func ResolveVoice(voice, persona, language string) (voiceName, lang string) {
	v := strings.TrimSpace(voice)
	if v != "" {
		// Infer lang from voice name prefix (e.g. es-AR-TomasNeural -> es-AR)
		parts := strings.Split(v, "-")
		if len(parts) >= 2 {
			return v, fmt.Sprintf("%s-%s", parts[0], parts[1])
		}
		return v, "es-AR"
	}

	cat := locales.Resolve(language, "", persona)
	return cat.DefaultPersonaTTSVoice(persona)
}

// BuildSSML constructs a valid W3C SSML payload.
func BuildSSML(text, voice, lang, rate, pitch string) string {
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

// handshakeBodyLimit caps how much of a failed handshake's body goes into errors and logs.
const handshakeBodyLimit = 200

// handshakeFailure is what the server answered to a failed websocket handshake.
type handshakeFailure struct {
	statusCode int    // 0 when no HTTP response came back (DNS, TLS, timeout)
	status     string // e.g. "403 Forbidden"
	body       string // start of the body, whitespace collapsed
	date       string // the Date header
}

func readHandshakeFailure(resp *http.Response) handshakeFailure {
	if resp == nil {
		return handshakeFailure{}
	}
	f := handshakeFailure{
		statusCode: resp.StatusCode,
		status:     resp.Status,
		date:       resp.Header.Get("Date"),
	}
	if resp.Body != nil {
		// gorilla/websocket has already buffered up to 1 KB of the body.
		b, _ := io.ReadAll(io.LimitReader(resp.Body, handshakeBodyLimit))
		resp.Body.Close()
		f.body = strings.Join(strings.Fields(strings.ToValidUTF8(string(b), "?")), " ")
	}
	return f
}

// wrap turns a dial error into one that says what the server answered,
// e.g. "websocket dial failed: 403 Forbidden: websocket: bad handshake".
func (f handshakeFailure) wrap(err error) error {
	switch {
	case f.statusCode == 0:
		return fmt.Errorf("websocket dial failed: %w", err)
	case f.body == "":
		return fmt.Errorf("websocket dial failed: %s: %w", f.status, err)
	default:
		return fmt.Errorf("websocket dial failed: %s (%q): %w", f.status, f.body, err)
	}
}

// dialEdgeTTS opens the synthesis websocket at baseURL with a fresh Sec-MS-GEC
// token from clock. A 403 means Microsoft rejected the token. Like upstream
// edge-tts (DRM.handle_client_response_error), it then takes the clock from the
// 403's Date header, makes a new token and dials once more.
func dialEdgeTTS(ctx context.Context, baseURL string, clock *clockSkewTracker) (*websocket.Conn, error) {
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
	dial := func() (*websocket.Conn, handshakeFailure, error) {
		wssURL := fmt.Sprintf(
			"%s?TrustedClientToken=%s&ConnectionId=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s",
			baseURL,
			edgeTTSClientToken,
			generateUUID(),
			generateSecMsGec(clock),
			edgeTTSSecVersion,
		)
		conn, resp, err := dialer.DialContext(ctx, wssURL, headers)
		if err != nil {
			return nil, readHandshakeFailure(resp), err
		}
		return conn, handshakeFailure{}, nil
	}

	conn, failure, err := dial()
	if err == nil {
		return conn, nil
	}
	if failure.statusCode != http.StatusForbidden {
		return nil, failure.wrap(err)
	}

	skew, skewErr := clock.adjustFromDate(failure.date)
	if skewErr != nil {
		slog.Warn("Edge TTS rejected the Sec-MS-GEC token and its clock could not be read, not retrying",
			"status", failure.status, "body", failure.body, "error", skewErr)
		return nil, failure.wrap(err)
	}
	slog.Warn("Edge TTS rejected the Sec-MS-GEC token, retrying with the server's clock",
		"status", failure.status, "body", failure.body, "skewSeconds", skew)

	conn, failure, err = dial()
	if err == nil {
		return conn, nil
	}
	if failure.statusCode == http.StatusForbidden {
		slog.Warn("Edge TTS rejected the Sec-MS-GEC token even with the server's clock: Microsoft most likely changed the token algorithm, compare generateSecMsGecV2FromTime with rany2/edge-tts src/edge_tts/drm.py",
			"status", failure.status, "body", failure.body, "skewSeconds", skew, "secMsGecVersion", edgeTTSSecVersion)
	}
	return nil, failure.wrap(err)
}

// SynthesizeEdgeNeuralTTS performs speech synthesis using Microsoft Edge Neural TTS over WebSocket.
func SynthesizeEdgeNeuralTTS(ctx context.Context, text, voice, rate, pitch string) ([]byte, error) {
	return synthesizeEdgeTTS(ctx, edgeTTSBaseWSS, globalClockTracker, text, voice, rate, pitch)
}

// synthesizeEdgeTTS speaks text through the Edge TTS WebSocket at baseURL, signing with clock's
// time. Only a whole answer is cached: audio that broke off midway is said once, not kept.
func synthesizeEdgeTTS(ctx context.Context, baseURL string, clock *clockSkewTracker, text, voice, rate, pitch string) ([]byte, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil, errors.New("empty text for synthesis")
	}

	voiceName, lang := ResolveVoice(voice, "", "")
	cacheKey := fmt.Sprintf("%s|%s|%s|%s", voiceName, rate, pitch, trimmed)

	if cached, ok := globalTTSCache.Get(cacheKey); ok && len(cached) > 0 {
		return cached, nil
	}

	reqID := generateUUID()

	conn, err := dialEdgeTTS(ctx, baseURL, clock)
	if err != nil {
		return nil, err
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
	ssml := BuildSSML(trimmed, voiceName, lang, rate, pitch)
	ssmlMsg := fmt.Sprintf(
		"X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n%s",
		reqID,
		ssml,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(ssmlMsg)); err != nil {
		return nil, fmt.Errorf("failed to send ssml: %w", err)
	}

	// 3. Collect the MP3 frames
	audioData, complete, err := readEdgeTTSAudio(ctx, conn, edgeTTSReadTimeout)
	if err != nil {
		return nil, err
	}
	if complete {
		globalTTSCache.Set(cacheKey, audioData)
	}
	return audioData, nil
}

// readEdgeTTSAudio collects the MP3 frames of one synthesis until the turn ends. Each read waits at
// most readTimeout, so a stream that stalls fails instead of holding the driver's radio. complete
// is false when the stream broke off after some audio: that audio is still returned.
func readEdgeTTSAudio(ctx context.Context, conn *websocket.Conn, readTimeout time.Duration) (audio []byte, complete bool, err error) {
	readCtx, cancel := context.WithTimeout(ctx, edgeTTSSynthesisTimeout)
	defer cancel()

	for {
		if err := readCtx.Err(); err != nil {
			return nil, false, fmt.Errorf("tts synthesis timed out: %w", err)
		}
		deadline := time.Now().Add(readTimeout)
		if d, ok := readCtx.Deadline(); ok && d.Before(deadline) {
			deadline = d
		}
		if err := conn.SetReadDeadline(deadline); err != nil {
			return nil, false, fmt.Errorf("failed to set the tts read deadline: %w", err)
		}

		msgType, message, err := conn.ReadMessage()
		if err != nil {
			if len(audio) > 0 {
				return audio, false, nil
			}
			return nil, false, fmt.Errorf("failed reading from tts stream: %w", err)
		}

		switch msgType {
		case websocket.BinaryMessage:
			if len(message) > 2 {
				headerLen := binary.BigEndian.Uint16(message[:2])
				dataOffset := 2 + int(headerLen)
				if len(message) > dataOffset {
					audio = append(audio, message[dataOffset:]...)
				}
			}
		case websocket.TextMessage:
			if strings.Contains(string(message), "Path:turn.end") {
				if len(audio) == 0 {
					return nil, false, errors.New("tts synthesis returned empty audio")
				}
				return audio, true, nil
			}
		}
	}
}
