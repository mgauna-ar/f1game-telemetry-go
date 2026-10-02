package desktop

import (
	"fmt"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
)

const (
	// feedStaleAfter is how old the last packet may be for the feed to count as live, and
	// feedForgetAfter when a stale feed goes back to waiting. Same as LIVE_STALE_AFTER_MS and
	// LIVE_STALE_FORGET_MS in frontend/src/constants/f1.ts, so the tray agrees with the dashboard.
	feedStaleAfter  = 3 * time.Second
	feedForgetAfter = time.Minute
	// maxTooltipRunes keeps the tooltip inside the 128 characters Windows allows.
	maxTooltipRunes = 120
)

// feedView is what the tray shows about the live feed.
type feedView struct {
	// Live is true while packets arrive, which shows the icon with the status dot.
	Live bool
	// Text is the menu's status line, e.g. "Live: Race · Monza".
	Text string
}

// describeFeed turns the live feed's status into the tray's status line, the same way the
// dashboard's live badge reads GET /api/system/status: live while packets are fresh, paused for a
// minute after they stop, then waiting for the game again.
func describeFeed(t text, status session.FeedStatus, now time.Time, udpPort int) feedView {
	waiting := feedView{Text: fmt.Sprintf(t.Waiting, udpPort)}
	if status.LastPacketAt.IsZero() || status.Session == nil {
		return waiting
	}
	age := now.Sub(status.LastPacketAt)
	switch {
	case age > feedForgetAfter:
		return waiting
	case age > feedStaleAfter:
		return feedView{Text: t.Paused}
	}
	label := packets.SessionTypeName(status.Session.SessionType) + " · " + packets.TrackName(status.Session.TrackID)
	return feedView{Live: true, Text: fmt.Sprintf(t.Live, label)}
}

// tooltip is the text shown when pointing at the tray icon.
func tooltip(view feedView) string {
	tip := []rune(appName + "\n" + view.Text)
	if len(tip) > maxTooltipRunes {
		tip = tip[:maxTooltipRunes]
	}
	return string(tip)
}
