package desktop

import (
	"net/url"
	"slices"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/settings"
)

// The app's own windows on Windows, by the names POST /api/desktop/window takes.
const (
	// WindowMain is the dashboard. Closing it keeps the app running in the notification area, and
	// it's where the radio speaks on this PC.
	WindowMain = "main"
	// WindowRaceControl is Race Control on its own, for a second monitor. It never speaks.
	WindowRaceControl = "race-control"
)

// WindowNames lists every window name; it builds the union for the frontend.
var WindowNames = []string{WindowMain, WindowRaceControl}

// webLinkSchemes are the links OpenExternal opens: web pages, never a scheme that starts another
// program (file:, ms-settings:, javascript:).
var webLinkSchemes = []string{"http", "https"}

const (
	// titleBarHeight is the strip at the top of a window that you drag it by.
	titleBarHeight = 32
	// minTitleBarOnScreen is how much of that strip, across and down, must be on one screen for a
	// window to open where it was: one saved on a monitor that's gone, or mostly off it, opens
	// centred instead.
	minTitleBarOnScreen       = 120
	minTitleBarHeightOnScreen = titleBarHeight / 2
)

// rect is a window's frame or a screen's work area, in Windows' scaled coordinates (DIPs).
type rect struct {
	X, Y, Width, Height int
}

// boundsRect is a saved window place's frame.
func boundsRect(b settings.WindowBounds) rect {
	return rect{X: b.X, Y: b.Y, Width: b.Width, Height: b.Height}
}

// onScreen reports whether a window with this frame can be grabbed by its title bar on one of
// the work areas.
func onScreen(frame rect, workAreas []rect) bool {
	for _, area := range workAreas {
		across := min(frame.X+frame.Width, area.X+area.Width) - max(frame.X, area.X)
		down := min(frame.Y+titleBarHeight, area.Y+area.Height) - max(frame.Y, area.Y)
		if across >= minTitleBarOnScreen && down >= minTitleBarHeightOnScreen {
			return true
		}
	}
	return false
}

// isDashboardPath reports whether path is a page of the dashboard to open in a window, such as
// "/live" or "/history?quick=podiums", or "" for none. Anything that could lead the window to
// another site ("//host", "/\host", "https://host") isn't.
func isDashboardPath(path string) bool {
	if path == "" {
		return true
	}
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.Contains(path, `\`) {
		return false
	}
	u, err := url.Parse(path)
	return err == nil && u.Scheme == "" && u.Host == ""
}

// isWebLink reports whether link is a web page OpenExternal may open.
func isWebLink(link string) bool {
	u, err := url.Parse(link)
	return err == nil && slices.Contains(webLinkSchemes, u.Scheme) && u.Host != ""
}
