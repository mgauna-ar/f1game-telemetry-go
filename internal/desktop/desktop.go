// Package desktop is the desktop side of the app on Windows: the notification-area (tray) icon
// and its menu, starting with Windows, and error dialogs for a build that has no console. On
// other platforms the app keeps running in the terminal and these are no-ops.
package desktop

import (
	"context"

	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// Options is what the tray shows and what its menu opens.
type Options struct {
	// Version is the running app version, shown in the menu header.
	Version string
	// DashboardURL is the dashboard on this PC, e.g. "http://localhost:8080".
	DashboardURL string
	// LiveURL is the live view, e.g. "http://localhost:8080/live".
	LiveURL string
	// UDPPort is the port the game sends telemetry to, shown while waiting for it.
	UDPPort int
	// DBPath is the absolute path of the database; "Open data folder" selects it.
	DBPath string
	// LogPath is the absolute path of the log file, or "" when the app doesn't write one.
	LogPath string
	// AutostartArgs are the arguments "Start with Windows" runs the executable with.
	AutostartArgs []string
	// Feed reports what the live feed last received.
	Feed func() session.FeedStatus
	// CheckUpdates looks for a newer release; nil turns the update notice off (dev builds).
	CheckUpdates func(ctx context.Context) (*system.UpdateCheckResponse, error)
	// StartupNotice shows the "running in the tray" notification once the icon is up: on a start
	// by hand, not at sign-in.
	StartupNotice bool
}
