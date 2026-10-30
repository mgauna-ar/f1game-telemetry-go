package settings

import "context"

const desktopSettingsKey = "desktop"

// Desktop is how the app behaves on the PC it runs on: whether a start opens its window, and where
// its own windows were last. It is this PC's own preference, so it isn't one of the dashboard's
// shared Sections; the window reads and changes it through /api/desktop.
type Desktop struct {
	ShowWindowAtStart bool `json:"show_window_at_start"`
	// Windows are the app's own windows' last places by window name (Windows), so each opens
	// where it was, on the same monitor.
	Windows map[string]WindowBounds `json:"windows,omitempty"`
}

// WindowBounds is where a window was: its frame in Windows' scaled coordinates (DIPs) while it was
// neither maximised nor minimised, and whether it was maximised.
type WindowBounds struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised"`
}

// DefaultDesktop is the setup before anything was saved: a start opens the window.
func DefaultDesktop() Desktop {
	return Desktop{ShowWindowAtStart: true}
}

// LoadDesktop returns the saved desktop settings, or the defaults when none were saved.
func LoadDesktop(ctx context.Context, store Store) (Desktop, error) {
	d := DefaultDesktop()
	_, err := load(ctx, store, desktopSettingsKey, &d)
	return d, err
}

// SaveDesktop stores the desktop settings.
func SaveDesktop(ctx context.Context, store Store, d Desktop) error {
	return save(ctx, store, desktopSettingsKey, d)
}
