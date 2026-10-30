package desktop

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"slices"
	"sync"
	"sync/atomic"

	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// ErrStartWithOSUnavailable is returned when starting at sign-in can't be changed: only the
// Windows app has it, and not for a `go run` build.
var ErrStartWithOSUnavailable = errors.New("starting at sign-in is not available here")

// Errors from InstallUpdate.
var (
	// ErrUpdateUnavailable: this build can't update itself (a dev build).
	ErrUpdateUnavailable = errors.New("this build can't update itself; download the new version from the release page")
	// ErrNoUpdate: no newer release is out.
	ErrNoUpdate = errors.New("this is already the latest version")
	// ErrUpdateInProgress: an update is being installed, or is installed and waits for the restart.
	ErrUpdateInProgress = errors.New("the update is already being installed")
)

// Errors from ShowWindow and OpenExternal.
var (
	// ErrNoWindow: the app has no window of its own here (macOS, Linux, or Windows with -no-tray).
	ErrNoWindow = errors.New("the app has no window of its own here")
	// ErrUnknownWindow: the request names none of WindowNames.
	ErrUnknownWindow = errors.New("unknown window")
	// ErrWindowPath: the page to open isn't one of the dashboard's.
	ErrWindowPath = errors.New("the page must be a path on the dashboard, such as /live")
	// ErrExternalURL: only web pages open in the browser.
	ErrExternalURL = errors.New("only http and https links open in the browser")
)

// installRelease puts a release in place of the executable (a var so tests don't download).
var installRelease = system.InstallRelease

// openBrowser opens a link in the default browser (a var so tests don't open one).
var openBrowser = system.OpenBrowser

// DesktopState is GET /api/desktop: how the app behaves on the PC it runs on.
type DesktopState struct {
	// ShowWindowAtStart is whether a start (not at sign-in) opens the app's window.
	ShowWindowAtStart bool `json:"show_window_at_start"`
	// StartWithOS is whether the app starts when the user signs in to Windows.
	StartWithOS bool `json:"start_with_os"`
	// StartWithOSAvailable is whether StartWithOS can be changed here (the Windows app).
	StartWithOSAvailable bool `json:"start_with_os_available"`
	// NativeWindow is whether the app runs its own window and notification-area icon (Windows):
	// closing the window keeps it running, and its main window is where the radio speaks on this
	// PC. Otherwise the app runs in a terminal and its small window is a browser's.
	NativeWindow bool `json:"native_window"`
	// CanUpdate is whether the app can install a newer release itself (a release build).
	CanUpdate bool `json:"can_update"`
}

// InstallUpdateResponse is POST /api/desktop/update: the version the app restarts into.
type InstallUpdateResponse struct {
	Version string `json:"version"`
}

// DesktopUpdate is PUT /api/desktop: the settings to change; the ones left out stay as they are.
type DesktopUpdate struct {
	ShowWindowAtStart *bool `json:"show_window_at_start,omitempty"`
	StartWithOS       *bool `json:"start_with_os,omitempty"`
}

// WindowRequest is POST /api/desktop/window: one of the app's own windows to bring up, and the
// dashboard page to open in it ("" keeps the page it shows).
type WindowRequest struct {
	Window string `json:"window" tstype:"DesktopWindowName"`
	Path   string `json:"path,omitempty"`
}

// ExternalLinkRequest is POST /api/desktop/open: a web page to open in the default browser.
type ExternalLinkRequest struct {
	URL string `json:"url"`
}

// AppConfig is what NewApp needs.
type AppConfig struct {
	// Store keeps the desktop settings (the app's database).
	Store settings.Store
	// DashboardURL is the dashboard on this PC, e.g. "http://localhost:8080".
	DashboardURL string
	// AutostartArgs are the arguments starting at sign-in runs the executable with.
	AutostartArgs []string
	// NativeWindow is whether the app runs its own window and notification-area icon (Windows).
	NativeWindow bool
	// Quit stops the app.
	Quit func()
	// CheckUpdates looks for a newer release; nil (dev builds) turns updating off.
	CheckUpdates func(ctx context.Context) (*system.UpdateCheckResponse, error)
	// Restart stops the app and starts its executable again, after an update.
	Restart func()
}

// windowShell is the app's own windows on Windows, attached while they run.
type windowShell interface {
	// show brings a window up, opening the dashboard page path in it when it isn't "".
	show(name, path string)
}

// App is the app on the PC it runs on, behind /api/desktop and the notification-area icon: its
// window, whether a start opens it, starting at sign-in, updating and quitting.
type App struct {
	cfg AppConfig
	exe string
	// startWithOSChanged tells the tray the window changed StartWithOS, so its checkbox follows.
	startWithOSChanged chan bool
	// updating is set while an update is installed, and stays set once it is, until the restart.
	updating atomic.Bool
	// settingsMu keeps one change of the saved desktop settings at a time.
	settingsMu sync.Mutex

	shellMu sync.Mutex
	shell   windowShell
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
		NativeWindow:         a.cfg.NativeWindow,
		CanUpdate:            a.canUpdate(),
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
		err := a.changeDesktop(ctx, func(d *settings.Desktop) { d.ShowWindowAtStart = *u.ShowWindowAtStart })
		if err != nil {
			return DesktopState{}, err
		}
	}
	return a.State(ctx)
}

// changeDesktop saves a change to the desktop settings.
func (a *App) changeDesktop(ctx context.Context, change func(*settings.Desktop)) error {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()
	d, err := settings.LoadDesktop(ctx, a.cfg.Store)
	if err != nil {
		return err
	}
	change(&d)
	return settings.SaveDesktop(ctx, a.cfg.Store, d)
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

// ShowWindow brings one of the app's own windows up, opening a dashboard page in it when path
// isn't "". It returns before the window is up, so a request asking for it never waits on the
// window, even while the app is quitting.
func (a *App) ShowWindow(name, path string) error {
	if !slices.Contains(WindowNames, name) {
		return ErrUnknownWindow
	}
	if !isDashboardPath(path) {
		return ErrWindowPath
	}
	s := a.currentShell()
	if s == nil {
		return ErrNoWindow
	}
	s.show(name, path)
	return nil
}

// OpenExternal opens a web page from outside the dashboard, such as release notes, in the default
// browser: the app's own window shows only the dashboard.
func (a *App) OpenExternal(link string) error {
	if !isWebLink(link) {
		return ErrExternalURL
	}
	return openBrowser(link)
}

// attachShell hands the App the windows to show; nil once they are gone.
func (a *App) attachShell(s windowShell) {
	a.shellMu.Lock()
	defer a.shellMu.Unlock()
	a.shell = s
}

func (a *App) currentShell() windowShell {
	a.shellMu.Lock()
	defer a.shellMu.Unlock()
	return a.shell
}

// windowPlace is where a window opens: its saved frame when one of the work areas still shows
// its title bar (frame), and whether it was maximised.
func (a *App) windowPlace(ctx context.Context, name string, workAreas []rect) (place settings.WindowBounds, frame bool) {
	d, err := settings.LoadDesktop(ctx, a.cfg.Store)
	if err != nil {
		slog.Warn("Could not read where the window was", "window", name, "error", err)
		return settings.WindowBounds{}, false
	}
	place = d.Windows[name]
	return place, place.Width > 0 && place.Height > 0 && onScreen(boundsRect(place), workAreas)
}

// saveWindowPlace remembers where a window is, so it opens there next time. A maximised window
// keeps the frame it had before it was maximised (frame nil), to go back to when it's restored.
func (a *App) saveWindowPlace(ctx context.Context, name string, frame *rect, maximised bool) error {
	return a.changeDesktop(ctx, func(d *settings.Desktop) {
		place := d.Windows[name]
		if frame != nil {
			place = settings.WindowBounds{X: frame.X, Y: frame.Y, Width: frame.Width, Height: frame.Height}
		}
		place.Maximised = maximised
		if d.Windows == nil {
			d.Windows = map[string]settings.WindowBounds{}
		}
		d.Windows[name] = place
	})
}

// Quit stops the app.
func (a *App) Quit() {
	a.cfg.Quit()
}

func (a *App) canUpdate() bool {
	return a.cfg.CheckUpdates != nil && a.exe != ""
}

// InstallUpdate puts the newest release in place of this executable and reports its version. The
// app keeps running the old version until Restart.
func (a *App) InstallUpdate(ctx context.Context) (string, error) {
	if !a.canUpdate() {
		return "", ErrUpdateUnavailable
	}
	if !a.updating.CompareAndSwap(false, true) {
		return "", ErrUpdateInProgress
	}
	version, err := a.installUpdate(ctx)
	if err != nil {
		a.updating.Store(false)
	}
	return version, err
}

func (a *App) installUpdate(ctx context.Context) (string, error) {
	resp, err := a.cfg.CheckUpdates(ctx)
	if err != nil {
		return "", err
	}
	if !resp.UpdateAvailable {
		return "", ErrNoUpdate
	}
	slog.Info("Installing update", "from", resp.CurrentVersion, "to", resp.LatestVersion)
	if err := installRelease(ctx, resp, a.exe); err != nil {
		return "", err
	}
	return resp.LatestVersion, nil
}

// Restart stops the app and starts the executable again, running the update just installed.
func (a *App) Restart() {
	a.cfg.Restart()
}
