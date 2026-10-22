package ai

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
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
			vName, lang := ResolveVoice(tt.voice, tt.persona, tt.language)
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
	ssml := BuildSSML("Radio check, te copio fuerte y claro.", "es-AR-TomasNeural", "es-AR", "+10%", "-5Hz")

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
	ssml := BuildSSML("Box & Pit <now> \"fast\"", "es-AR-TomasNeural", "es-AR", "", "")

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

	// A 4th item evicts the one used longest ago: key2, since key1 was just read.
	cache.Set("key4", []byte("audio4"))

	if _, ok := cache.Get("key2"); ok {
		t.Errorf("expected key2 to be evicted from cache")
	}
	for _, key := range []string{"key1", "key3", "key4"} {
		if _, ok := cache.Get(key); !ok {
			t.Errorf("expected %s to stay in the cache", key)
		}
	}

	// Setting a key again counts as a use too.
	cache.Set("key1", []byte("audio1b"))
	cache.Set("key5", []byte("audio5"))
	if _, ok := cache.Get("key3"); ok {
		t.Errorf("expected key3 to be evicted from cache")
	}
	if data, ok := cache.Get("key1"); !ok || string(data) != "audio1b" {
		t.Errorf("failed to get the new key1 from cache")
	}
}

func TestGenerateSecMsGec(t *testing.T) {
	token := generateSecMsGec(globalClockTracker)
	// v2 token format: <16 hex CS64>-<64 hex SHA256> = 81 characters
	if len(token) != 81 {
		t.Errorf("expected 81-char v2 token (<16 hex>-<64 hex>), got %d chars: %s", len(token), token)
	}
	parts := strings.Split(token, "-")
	if len(parts) != 2 || len(parts[0]) != 16 || len(parts[1]) != 64 {
		t.Fatalf("unexpected token format: %s", token)
	}
	if parts[0] != strings.ToUpper(parts[0]) || parts[1] != strings.ToUpper(parts[1]) {
		t.Errorf("expected uppercase hex token parts, got %s", token)
	}

	// Verify exact reference vector
	fixed := time.Unix(1728900000, 0)
	expected := "92C8D7882125BC88-81B24303C1D417D273CFA2F2169A7659C747B85AD526EAB202B6C611A24E2950"
	got := generateSecMsGecV2FromTime(fixed)
	if got != expected {
		t.Errorf("v2 token mismatch for fixed timestamp:\nexpected: %s\ngot:      %s", expected, got)
	}
}

func TestClockSkewTracker_RefreshSkew(t *testing.T) {
	tracker := &clockSkewTracker{}
	// Calling refreshSkew directly should execute cleanly and handle any network timeout/warnings without panicking
	tracker.refreshSkew()
}

// edgeTTSTestServer stands in for the Edge TTS websocket. handle answers the
// nth handshake (from 1); it returns false to upgrade the connection instead.
type edgeTTSTestServer struct {
	*httptest.Server
	mu     sync.Mutex
	tokens []string // Sec-MS-GEC of each handshake
}

func newEdgeTTSTestServer(t *testing.T, handle func(n int, w http.ResponseWriter) bool) *edgeTTSTestServer {
	t.Helper()
	s := &edgeTTSTestServer{}
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.tokens = append(s.tokens, r.URL.Query().Get("Sec-MS-GEC"))
		n := len(s.tokens)
		s.mu.Unlock()
		if handle(n, w) {
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		conn.Close()
	}))
	t.Cleanup(s.Close)
	return s
}

func (s *edgeTTSTestServer) wsURL() string {
	return "ws" + strings.TrimPrefix(s.URL, "http")
}

func (s *edgeTTSTestServer) handshakeTokens() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.tokens...)
}

// rejectToken answers like Edge does to a bad Sec-MS-GEC token.
func rejectToken(w http.ResponseWriter, serverDate time.Time) {
	w.Header().Set("Date", serverDate.Format(http.TimeFormat))
	http.Error(w, "token rejected", http.StatusForbidden)
}

// newTestClock returns a tracker that won't refresh itself from the real Edge server.
func newTestClock() *clockSkewTracker {
	return &clockSkewTracker{lastChecked: time.Now()}
}

func (c *clockSkewTracker) skew() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.skewSeconds
}

// A minute into a 5-minute token window, so the token stays the same while the test runs.
var edgeTTSServerDate = time.Date(2030, time.January, 1, 12, 1, 0, 0, time.UTC)

func TestDialEdgeTTSRetriesOnceWithServerClock(t *testing.T) {
	srv := newEdgeTTSTestServer(t, func(n int, w http.ResponseWriter) bool {
		if n == 1 {
			rejectToken(w, edgeTTSServerDate)
			return true
		}
		return false
	})
	clock := newTestClock()

	conn, err := dialEdgeTTS(context.Background(), srv.wsURL(), clock)
	if err != nil {
		t.Fatalf("expected the retry to connect, got %v", err)
	}
	conn.Close()

	tokens := srv.handshakeTokens()
	if len(tokens) != 2 {
		t.Fatalf("expected 2 handshakes (one retry), got %d", len(tokens))
	}
	wantSkew := time.Until(edgeTTSServerDate).Seconds()
	if got := clock.skew(); math.Abs(got-wantSkew) > 5 {
		t.Errorf("expected skew from the 403's Date header (~%.0fs), got %.0fs", wantSkew, got)
	}
	if want := generateSecMsGecV2FromTime(edgeTTSServerDate); tokens[1] != want {
		t.Errorf("retry should use a token for the server's clock:\nwant %s\ngot  %s", want, tokens[1])
	}
	if tokens[0] == tokens[1] {
		t.Errorf("retry reused the rejected token %s", tokens[0])
	}
}

func TestDialEdgeTTSReportsTokenRejectedAfterRetry(t *testing.T) {
	srv := newEdgeTTSTestServer(t, func(_ int, w http.ResponseWriter) bool {
		rejectToken(w, edgeTTSServerDate)
		return true
	})

	_, err := dialEdgeTTS(context.Background(), srv.wsURL(), newTestClock())
	if err == nil {
		t.Fatal("expected an error when every handshake gets a 403")
	}
	if n := len(srv.handshakeTokens()); n != 2 {
		t.Errorf("expected exactly one retry (2 handshakes), got %d", n)
	}
	for _, want := range []string{"403 Forbidden", "token rejected"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q should include %q", err, want)
		}
	}
	if !errors.Is(err, websocket.ErrBadHandshake) {
		t.Errorf("error %q should wrap websocket.ErrBadHandshake", err)
	}
}

func TestDialEdgeTTSDoesNotRetryWithoutServerDate(t *testing.T) {
	srv := newEdgeTTSTestServer(t, func(_ int, w http.ResponseWriter) bool {
		w.Header()["Date"] = nil // stop net/http from adding one
		http.Error(w, "token rejected", http.StatusForbidden)
		return true
	})
	clock := newTestClock()

	_, err := dialEdgeTTS(context.Background(), srv.wsURL(), clock)
	if err == nil || !strings.Contains(err.Error(), "403 Forbidden") {
		t.Fatalf("expected a 403 error, got %v", err)
	}
	if n := len(srv.handshakeTokens()); n != 1 {
		t.Errorf("expected no retry without a Date header, got %d handshakes", n)
	}
	if got := clock.skew(); got != 0 {
		t.Errorf("expected skew to stay 0, got %v", got)
	}
}

func TestDialEdgeTTSDoesNotRetryOtherStatuses(t *testing.T) {
	longBody := strings.Repeat("x", 1000)
	srv := newEdgeTTSTestServer(t, func(_ int, w http.ResponseWriter) bool {
		http.Error(w, longBody, http.StatusInternalServerError)
		return true
	})
	clock := newTestClock()

	_, err := dialEdgeTTS(context.Background(), srv.wsURL(), clock)
	if err == nil || !strings.Contains(err.Error(), "500 Internal Server Error") {
		t.Fatalf("expected a 500 error, got %v", err)
	}
	if n := len(srv.handshakeTokens()); n != 1 {
		t.Errorf("expected no retry on a 500, got %d handshakes", n)
	}
	if got := clock.skew(); got != 0 {
		t.Errorf("expected skew to stay 0, got %v", got)
	}
	if !strings.Contains(err.Error(), strings.Repeat("x", handshakeBodyLimit)) ||
		strings.Contains(err.Error(), strings.Repeat("x", handshakeBodyLimit+1)) {
		t.Errorf("expected the body cut to %d bytes, got %q", handshakeBodyLimit, err)
	}
}

// newEdgeTTSStreamServer stands in for the Edge TTS websocket once connected: it reads the
// speech config and the SSML, then serve answers on the connection.
func newEdgeTTSStreamServer(t *testing.T, serve func(conn *websocket.Conn)) *edgeTTSTestServer {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	s := &edgeTTSTestServer{}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		for range 2 {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
		serve(conn)
	}))
	t.Cleanup(s.Close)
	return s
}

// edgeAudioFrame is a binary Edge TTS frame: a 2-byte header length, the header, then MP3 bytes.
func edgeAudioFrame(audio string) []byte {
	header := "Path:audio\r\n"
	frame := []byte{byte(len(header) >> 8), byte(len(header))}
	frame = append(frame, header...)
	return append(frame, audio...)
}

func TestReadEdgeTTSAudioGivesUpOnAStalledStream(t *testing.T) {
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	srv := newEdgeTTSStreamServer(t, func(conn *websocket.Conn) {
		_ = conn.WriteMessage(websocket.BinaryMessage, edgeAudioFrame("mp3-part"))
		<-release // the stream stalls
	})
	conn, _, err := websocket.DefaultDialer.Dial(srv.wsURL(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	for _, msg := range []string{"config", "ssml"} {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
			t.Fatal(err)
		}
	}

	start := time.Now()
	audio, complete, err := readEdgeTTSAudio(context.Background(), conn, 100*time.Millisecond)
	if err != nil {
		t.Fatalf("audio received before the stall should be returned, got %v", err)
	}
	if string(audio) != "mp3-part" || complete {
		t.Errorf("got %q (complete %v), want the partial audio, not complete", audio, complete)
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("a stalled stream held the read for %v", elapsed)
	}
}

func TestSynthesizeEdgeTTSCachesOnlyWholeAnswers(t *testing.T) {
	voiceName, _ := ResolveVoice("", "", "")
	cached := func(text string) bool {
		_, ok := globalTTSCache.Get(voiceName + "|||" + text)
		return ok
	}

	whole := newEdgeTTSStreamServer(t, func(conn *websocket.Conn) {
		_ = conn.WriteMessage(websocket.BinaryMessage, edgeAudioFrame("mp3-whole"))
		_ = conn.WriteMessage(websocket.TextMessage, []byte("X-RequestId:1\r\nPath:turn.end\r\n\r\n{}"))
	})
	text := "Push-lap car behind, whole answer " + generateUUID()
	audio, err := synthesizeEdgeTTS(context.Background(), whole.wsURL(), newTestClock(), text, "", "", "")
	if err != nil || string(audio) != "mp3-whole" {
		t.Fatalf("got %q, %v; want the whole answer", audio, err)
	}
	if !cached(text) {
		t.Error("a whole answer should be cached")
	}

	brokenOff := newEdgeTTSStreamServer(t, func(conn *websocket.Conn) {
		_ = conn.WriteMessage(websocket.BinaryMessage, edgeAudioFrame("mp3-half"))
		// The connection closes before the turn ends.
	})
	text = "Push-lap car behind, broken off " + generateUUID()
	audio, err = synthesizeEdgeTTS(context.Background(), brokenOff.wsURL(), newTestClock(), text, "", "", "")
	if err != nil || string(audio) != "mp3-half" {
		t.Fatalf("got %q, %v; want the audio that came", audio, err)
	}
	if cached(text) {
		t.Error("audio that broke off midway should not be cached")
	}
}
