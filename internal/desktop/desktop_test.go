package desktop

import (
	"bytes"
	"encoding/binary"
	"image/png"
	"strings"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
)

func TestDescribeFeed(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	monzaRace := &session.FeedSession{SessionType: packets.SessionRace, TrackID: 11}
	tests := []struct {
		name   string
		status session.FeedStatus
		want   feedView
	}{
		{
			name: "nothing received",
			want: feedView{Text: "Waiting for the game on UDP port 20777"},
		},
		{
			name:   "packets but no session yet",
			status: session.FeedStatus{LastPacketAt: now},
			want:   feedView{Text: "Waiting for the game on UDP port 20777"},
		},
		{
			name:   "fresh packets",
			status: session.FeedStatus{LastPacketAt: now.Add(-time.Second), Session: monzaRace},
			want:   feedView{Live: true, Text: "Live: Race · Monza"},
		},
		{
			name:   "stopped a moment ago",
			status: session.FeedStatus{LastPacketAt: now.Add(-10 * time.Second), Session: monzaRace},
			want:   feedView{Text: "Telemetry paused"},
		},
		{
			name:   "stopped over a minute ago",
			status: session.FeedStatus{LastPacketAt: now.Add(-2 * time.Minute), Session: monzaRace},
			want:   feedView{Text: "Waiting for the game on UDP port 20777"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := describeFeed(englishText, tt.status, now, 20777); got != tt.want {
				t.Errorf("describeFeed() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestTooltipFitsWindowsLimit(t *testing.T) {
	got := tooltip(feedView{Text: strings.Repeat("x", 300)})
	if n := len([]rune(got)); n > maxTooltipRunes {
		t.Errorf("tooltip has %d characters, want at most %d", n, maxTooltipRunes)
	}
	if !strings.HasPrefix(got, appName+"\n") {
		t.Errorf("tooltip = %q, want it to start with the app name", got)
	}
}

func TestTextFor(t *testing.T) {
	tests := map[string]text{
		"es-AR": spanishText,
		"ES":    spanishText,
		"es":    spanishText,
		"en-US": englishText,
		"pt-BR": englishText,
		"":      englishText,
	}
	for tag, want := range tests {
		if got := textFor(tag); got != want {
			t.Errorf("textFor(%q) = %q, want %q", tag, got.Quit, want.Quit)
		}
	}
}

func TestTextHasEveryString(t *testing.T) {
	for name, tx := range map[string]text{"english": englishText, "spanish": spanishText} {
		fields := []string{tx.ShowWindow, tx.OpenDashboard, tx.OpenLive, tx.UpdateAvailable, tx.StartWithWindows, tx.DevBuildHint,
			tx.OpenDataFolder, tx.OpenLogFile, tx.Quit, tx.Live, tx.Paused, tx.Waiting, tx.StartFailed}
		for i, f := range fields {
			if f == "" {
				t.Errorf("%s text field %d is empty", name, i)
			}
		}
	}
}

// TestIcons checks both embedded icons are ICO files whose PNG frames include the sizes the
// notification area uses (16 px at 100% scaling, 32 px as Windows' default icon size).
func TestIcons(t *testing.T) {
	for name, ico := range map[string][]byte{"app": appIcon, "live": liveIcon} {
		t.Run(name, func(t *testing.T) {
			var header struct{ Reserved, Type, Count uint16 }
			if err := binary.Read(bytes.NewReader(ico), binary.LittleEndian, &header); err != nil {
				t.Fatal(err)
			}
			if header.Type != 1 || header.Count == 0 {
				t.Fatalf("not an icon: %+v", header)
			}

			found := map[int]bool{}
			for i := range int(header.Count) {
				entry := ico[6+16*i : 6+16*(i+1)]
				size := binary.LittleEndian.Uint32(entry[8:12])
				offset := binary.LittleEndian.Uint32(entry[12:16])
				img, err := png.Decode(bytes.NewReader(ico[offset : offset+size]))
				if err != nil {
					t.Fatalf("frame %d: %v", i, err)
				}
				if w := img.Bounds().Dx(); w != int(entry[0]) {
					t.Errorf("frame %d is %d px, its entry says %d", i, w, entry[0])
				}
				found[img.Bounds().Dx()] = true
			}
			for _, size := range []int{16, 32} {
				if !found[size] {
					t.Errorf("no %d px frame", size)
				}
			}
		})
	}
}
