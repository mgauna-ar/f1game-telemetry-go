//go:build !windows

package desktop

import "github.com/mgauna/f1game-telemetry-go/internal/system"

// The app window's size: a small panel, not a second dashboard. On macOS the page gives the window
// this size itself (APP_WINDOW_SIZE in frontend/src/desktop/useFitWindowToContent.ts).
const (
	windowWidth  = 440
	windowHeight = 720
	// windowPath is the dashboard page the app window shows.
	windowPath = "/desktop"
)

// Supported reports whether this platform has the app's own window and tray: only Windows.
func Supported() bool { return false }

// HasConsole reports whether the process can write to a console.
func HasConsole() bool { return true }

// ShowError shows message in an error dialog.
func ShowError(string) {}

// Run has no window or tray to show here: it runs onExit and returns.
func Run(_ Options, onExit func()) { onExit() }

// Quit closes the app's windows and tray, making Run return.
func Quit() {}

// allowSetForeground lets another app bring its window to the front (Windows).
func allowSetForeground() {}

// OpenWindow opens the app window: the /desktop page in a small browser window of its own.
func (a *App) OpenWindow() error {
	return system.OpenAppWindow(a.cfg.DashboardURL+windowPath, windowWidth, windowHeight)
}

// OpenDashboard opens the dashboard in the user's browser.
func (a *App) OpenDashboard() error {
	return system.OpenBrowser(a.cfg.DashboardURL)
}

// Starting at sign-in is a Windows feature.
func canAutostart(string) bool                  { return false }
func autostartEnabled(string) bool              { return false }
func setAutostart(bool, string, []string) error { return ErrStartWithOSUnavailable }
