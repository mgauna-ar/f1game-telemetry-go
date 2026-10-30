// Package desktop is the app on the PC it runs on. On Windows that's the app's own window, which
// shows the dashboard the app serves, a Race Control window for a second monitor, the
// notification-area (tray) icon and its menu, starting with Windows, and error dialogs for a build
// that has no console. On macOS and Linux the app runs in a terminal and its small window is a
// browser's (/desktop).
package desktop

import (
	"context"

	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// Options is what the app's windows and tray show and open.
type Options struct {
	// Version is the running app version, shown in the menu header.
	Version string
	// DashboardURL is the dashboard on this PC, e.g. "http://localhost:8080", which the windows show.
	DashboardURL string
	// UDPPort is the port the game sends telemetry to, shown while waiting for it.
	UDPPort int
	// DBPath is the absolute path of the database; "Open data folder" selects it.
	DBPath string
	// LogPath is the absolute path of the log file, or "" when the app doesn't write one.
	LogPath string
	// Feed reports what the live feed last received.
	Feed func() session.FeedStatus
	// CheckUpdates looks for a newer release; nil turns the update notice off (dev builds).
	CheckUpdates func(ctx context.Context) (*system.UpdateCheckResponse, error)
	// App shows the windows for /api/desktop and owns "Start with Windows", shared with the
	// dashboard's switch.
	App *App
	// ShowWindow is whether the window opens at start; otherwise the app starts in the tray.
	ShowWindow bool
	// AfterUpdate is set when the app restarted on a version it just installed: the window opens on
	// Settings → App, which shows it.
	AfterUpdate bool
}
