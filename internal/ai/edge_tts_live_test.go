package ai

import (
	"context"
	"os"
	"testing"
	"time"
)

// TestLiveEdgeNeuralTTS calls Microsoft's real Edge TTS endpoint, so it only runs with
// EDGE_TTS_LIVE=1. The daily Edge TTS canary workflow runs it to catch the endpoint
// rejecting our requests (e.g. a new Sec-MS-GEC version) before the engineer goes silent.
func TestLiveEdgeNeuralTTS(t *testing.T) {
	if os.Getenv("EDGE_TTS_LIVE") != "1" {
		t.Skip("set EDGE_TTS_LIVE=1 to call the real Edge TTS endpoint")
	}

	// Start from an empty cache so the request really goes over the network
	globalTTSCache.mu.Lock()
	globalTTSCache.items = make(map[string][]byte)
	globalTTSCache.order = globalTTSCache.order[:0]
	globalTTSCache.mu.Unlock()

	voice, _ := ResolveVoice("", "", "")
	t.Logf("voice %s, Sec-MS-GEC-Version %s", voice, edgeTTSSecVersion)

	// A rejected token fails every attempt; the retries only ride out a network blip
	const attempts = 3
	var audio []byte
	var err error
	for i := 1; i <= attempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		audio, err = SynthesizeEdgeNeuralTTS(ctx, "Radio check, box this lap.", "", "", "")
		cancel()
		if err == nil {
			break
		}
		t.Logf("attempt %d/%d failed: %v", i, attempts, err)
		if i < attempts {
			time.Sleep(5 * time.Second)
		}
	}
	if err != nil {
		t.Fatalf("Edge TTS rejected our request after %d attempts: %v", attempts, err)
	}

	if len(audio) < 1024 {
		t.Fatalf("expected at least 1 KB of MP3 audio, got %d bytes", len(audio))
	}
	// Each MP3 frame starts with an 11-bit sync word
	if audio[0] != 0xFF || audio[1]&0xE0 != 0xE0 {
		t.Fatalf("audio doesn't start with an MP3 frame sync: % X", audio[:4])
	}
	t.Logf("got %d bytes of MP3 audio", len(audio))
}
