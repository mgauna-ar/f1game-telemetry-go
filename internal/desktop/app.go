package desktop

import (
	"context"
	"errors"
	"log/slog"
	"os"

	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// The app window's size: a small panel, not a second dashboard.
const (
	windowWidth  = 440
	windowHeight = 720
	// windowPath is the dashboard page the app window shows.
	windowPath = "/desktop"
)

// ErrStartWithOSUnavailable is returned when starting at sign-in can't be changed: only the
// Windows app has it, and not for a `go run` build.
var ErrStartWithOSUnavailable = errors.New("starting at sign-in is not available here")

// DesktopState is GET /api/desktop: how the app behaves on the PC it runs on.
type DesktopState struct {
	// ShowWindowAtStart is whether a start (not at sign-in) opens the app window.
	ShowWindowAtStart bool `json:"show_window_at_start"`
	// StartWithOS is whether the app starts when the user signs in to Windows.
	StartWithOS bool `json:"start_with_os"`
	// StartWithOSAvailable is whether StartWithOS can be changed here (the Windows app).
	StartWithOSAvailable bool `json:"start_with_os_available"`
	// Tray is whether the app keeps running in the notification area once its window is closed;
	// otherwise it runs in a terminal.
	Tray bool `json:"tray"`
}

// DesktopUpdate is PUT /api/desktop: the settings to change; the ones left out stay as they are.
type DesktopUpdate struct {
	ShowWindowAtStart *bool `json:"show_window_at_start,omitempty"`
	StartWithOS       *bool `json:"start_with_os,omitempty"`
}

// AppConfig is what NewApp needs.
type AppConfig struct {
	// Store keeps the desktop settings (the app's database).
	Store settings.Store
	// DashboardURL is the dashboard on this PC, e.g. "http://localhost:8080".
	DashboardURL string
	// AutostartArgs are the arguments starting at sign-in runs the executable with.
	AutostartArgs []string
	// Tray is whether the tray runs.
	Tray bool
	// Quit stops the app.
	Quit func()
}

// App is the app on the PC it runs on, behind /api/desktop and the tray: its small window, whether
// a start opens it, starting at sign-in, and quitting.
type App struct {
	cfg AppConfig
	exe string
	// startWithOSChanged tells the tray the window changed StartWithOS, so its checkbox follows.
	startWithOSChanged chan bool
}

// NewApp returns the desktop app.
func NewApp(cfg AppConfig) *App {
	exe, err := os.Executable()
	if err != nil {
		slog.Warn("Could not find the executable; starting at sign-in is off", "error", err)
	}
	return &App{cfg: cfg, exe: exe, startWithOSChanged: make(chan bool, 1)}
}

// State reports the desktop settings.
func (a *App) State(ctx context.Context) (DesktopState, error) {
	d, err := settings.LoadDesktop(ctx, a.cfg.Store)
	if err != nil {
		return DesktopState{}, err
	}
	available := a.startWithOSAvailable()
	return DesktopState{
		ShowWindowAtStart:    d.ShowWindowAtStart,
		StartWithOS:          available && autostartEnabled(a.exe),
		StartWithOSAvailable: available,
		Tray:                 a.cfg.Tray,
	}, nil
}

// Update changes the settings u names and reports them all.
func (a *App) Update(ctx context.Context, u DesktopUpdate) (DesktopState, error) {
	if u.StartWithOS != nil {
		if err := a.SetStartWithOS(*u.StartWithOS); err != nil {
			return DesktopState{}, err
		}
		select {
		case a.startWithOSChanged <- *u.StartWithOS:
		default:
		}
	}
	if u.ShowWindowAtStart != nil {
		d, err := settings.LoadDesktop(ctx, a.cfg.Store)
		if err != nil {
			return DesktopState{}, err
		}
		d.ShowWindowAtStart = *u.ShowWindowAtStart
		if err := settings.SaveDesktop(ctx, a.cfg.Store, d); err != nil {
			return DesktopState{}, err
		}
	}
	return a.State(ctx)
}

// SetStartWithOS turns starting at sign-in on or off.
func (a *App) SetStartWithOS(enable bool) error {
	if !a.startWithOSAvailable() {
		return ErrStartWithOSUnavailable
	}
	if err := setAutostart(enable, a.exe, a.cfg.AutostartArgs); err != nil {
		return err
	}
	slog.Info("Start with Windows changed", "enabled", enable)
	return nil
}

// StartWithOS reports whether the app starts at sign-in.
func (a *App) StartWithOS() bool {
	return a.startWithOSAvailable() && autostartEnabled(a.exe)
}

func (a *App) startWithOSAvailable() bool {
	return a.exe != "" && canAutostart(a.exe)
}

// OpenWindow opens the app window: a small browser window of its own on the /desktop page.
func (a *App) OpenWindow() error {
	return system.OpenAppWindow(a.cfg.DashboardURL+windowPath, windowWidth, windowHeight)
}

// OpenDashboard opens the dashboard in the user's browser.
func (a *App) OpenDashboard() error {
	return system.OpenBrowser(a.cfg.DashboardURL)
}

// Quit stops the app.
func (a *App) Quit() {
	a.cfg.Quit()
}
