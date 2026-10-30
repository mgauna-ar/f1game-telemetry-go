//go:build windows

package desktop

import (
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"golang.org/x/sys/windows"
)

const (
	// windowClass names the app's windows for Windows. The installer finds a running copy by it
	// (build/windows/installer.nsi): change both together.
	windowClass = "F1TelemetryWindow"
	// speechServiceFeature sends WebView2's speech recognition to Microsoft's newer service, which
	// answers 403 since WebView2 runtime 153, so push-to-talk hears nothing. Turned off, recognition
	// goes through the service Edge itself uses. Drop it once
	// https://github.com/MicrosoftEdge/WebView2Feedback/issues/5724 is fixed.
	speechServiceFeature = "msSpeechRecognitionServiceUseCetoService"
	// autoplayPolicy lets the engineer speak in a window nobody clicked in yet, such as after Start
	// with Windows: otherwise the page's sound waits for a click (frontend/src/utils/radioAudio.ts).
	autoplayPolicy = "--autoplay-policy=no-user-gesture-required"

	// livePath is the page the tray's Live view opens.
	livePath = "/live"
	// appSettingsPath is Settings → App, with the version and Update now: the tray's update notice
	// opens it, and so does the first start after an update.
	appSettingsPath = "/settings/app"
	// engineerPath is the race engineer's page, the only one the engineer window shows
	// (frontend/src/components/engineer/EngineerPage.tsx): the radio speaks and listens there.
	engineerPath = "/engineer"

	// The app's folder under %LOCALAPPDATA% holds the windows' WebView2 data. 1.x's small window
	// kept a browser profile next to it, which nothing uses now.
	webviewFolder      = "webview"
	oldAppWindowFolder = "app-window"

	// asfwAny lets any app bring its window to the front (AllowSetForegroundWindow's ASFW_ANY).
	asfwAny = uintptr(^uint32(0))
)

// pageBackground is the dashboard's --bg-dark (frontend/src/styles/base/variables.css), shown
// while a page loads.
var pageBackground = application.NewRGB(9, 14, 26)

// windowSize is a window's size before it was ever moved, and the smallest it gets.
type windowSize struct {
	width, height, minWidth, minHeight int
}

// windowSizes: the dashboard's window, and the engineer's narrow one.
var windowSizes = map[string]windowSize{
	WindowMain:     {width: 1280, height: 800, minWidth: 960, minHeight: 600},
	WindowEngineer: {width: 560, height: 760, minWidth: 400, minHeight: 520},
}

var procAllowSetForegroundWindow = windows.NewLazySystemDLL("user32.dll").NewProc("AllowSetForegroundWindow")

// running is the shell while Run runs, for Quit.
var running atomic.Pointer[shell]

// shell is the app on Windows: its own windows, which show the dashboard the app serves, and its
// notification-area icon. Windows are opened and shown on the main thread only.
type shell struct {
	opts Options
	text text
	app  *application.App
	tray tray

	mu       sync.Mutex
	main     *application.WebviewWindow
	engineer *application.WebviewWindow
}

// Run opens the app's window (unless opts.ShowWindow is off) and its notification-area icon, and
// runs until Quit, the menu's Quit, or Windows ending the session. onExit runs before Run returns,
// also when Windows ends the session.
func Run(opts Options, onExit func()) {
	s := &shell{opts: opts, text: userText()}
	s.app = application.New(application.Options{
		Name:   appName,
		Icon:   appIcon,
		Logger: slog.Default(),
		// main.go stops the app on Ctrl+C itself
		DisableDefaultSignalHandler: true,
		OnShutdown: func() {
			s.savePlaces()
			onExit()
		},
		Windows: application.WindowsOptions{
			WndClass:              windowClass,
			WebviewUserDataPath:   filepath.Join(localDataDir(), webviewFolder),
			DisabledFeatures:      []string{speechServiceFeature},
			AdditionalBrowserArgs: []string{autoplayPolicy},
			// Closing the windows keeps the app running in the notification area
			DisableQuitOnLastWindowClosed: true,
		},
	})
	s.addTray()
	// The windows open once the app runs: then it knows the screens they were on
	s.app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		application.InvokeSync(s.start)
	})

	running.Store(s)
	defer running.Store(nil)
	defer opts.App.attachShell(nil)
	if err := s.app.Run(); err != nil {
		slog.Error("The app's window stopped", "error", err)
	}
}

// Quit closes the app's windows and tray, making Run return.
func Quit() {
	if s := running.Load(); s != nil {
		s.app.Quit()
	}
}

// start opens the windows and lets the App show them.
func (s *shell) start() {
	path := "/"
	if s.opts.AfterUpdate {
		path = appSettingsPath
	}
	main := s.newWindow(WindowMain, path, s.opts.ShowWindow)
	// The engineer runs from the start, hidden unless it was showing when the app quit: the radio
	// speaks and listens in its window, whatever page the main window shows
	engineerShown := s.opts.ShowWindow && s.opts.App.windowShown(context.Background(), WindowEngineer)
	engineer := s.newWindow(WindowEngineer, engineerPath, engineerShown)
	s.hideOnClose(WindowMain, main)
	s.hideOnClose(WindowEngineer, engineer)
	s.mu.Lock()
	s.main, s.engineer = main, engineer
	s.mu.Unlock()

	s.opts.App.attachShell(s)
	go s.watch()
	go removeOldAppWindowProfile()
}

// hideOnClose makes closing a window hide it: the app keeps running in the tray, and the engineer
// talking.
func (s *shell) hideOnClose(name string, w *application.WebviewWindow) {
	w.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		// The app is quitting, which closes its windows: where they were is saved by then
		if s.app.Context().Err() != nil {
			return
		}
		s.savePlace(name, w)
		w.Hide()
		e.Cancel()
	})
}

// newWindow opens one of the app's windows on a dashboard page, where it was last if that's still
// on a screen.
func (s *shell) newWindow(name, path string, show bool) *application.WebviewWindow {
	size := windowSizes[name]
	opts := application.WebviewWindowOptions{
		Name:             name,
		Title:            s.title(name),
		Width:            size.width,
		Height:           size.height,
		MinWidth:         size.minWidth,
		MinHeight:        size.minHeight,
		Hidden:           !show,
		BackgroundColour: pageBackground,
		URL:              s.opts.DashboardURL + path,
		// No browser menu (Back, Reload, Print, Inspect) on a right click
		DefaultContextMenuDisabled: true,
		// Push-to-talk listens through the microphone without asking
		Permissions: map[application.PermissionType]application.Permission{
			application.PermissionMicrophone: application.PermissionAllow,
		},
		Windows: application.WindowsWindow{Theme: application.Dark},
	}
	place, frame := s.opts.App.windowPlace(context.Background(), name, s.workAreas())
	if frame {
		opts.InitialPosition = application.WindowXY
		opts.X, opts.Y, opts.Width, opts.Height = place.X, place.Y, place.Width, place.Height
	}
	if place.Maximised {
		opts.StartState = application.WindowStateMaximised
	}
	return s.app.Window.NewWithOptions(opts)
}

func (s *shell) title(name string) string {
	if name == WindowEngineer {
		return s.text.EngineerTitle
	}
	return appName
}

// show brings a window up in front, first moving the main window to path when that isn't "": the
// engineer's always shows the engineer. It returns at once: the windows change on the main thread.
func (s *shell) show(name, path string) {
	application.InvokeAsync(func() {
		w := s.window(name)
		if w == nil {
			return // the app is still starting
		}
		if path != "" && name == WindowMain {
			w.SetURL(s.opts.DashboardURL + path)
		}
		w.Show()
		w.UnMinimise()
		w.Focus()
	})
}

// window is the named window, nil while the app starts.
func (s *shell) window(name string) *application.WebviewWindow {
	s.mu.Lock()
	defer s.mu.Unlock()
	if name == WindowEngineer {
		return s.engineer
	}
	return s.main
}

// savePlace remembers where a window is. A minimised window's frame is the spot Windows parks it
// in, so it isn't saved.
func (s *shell) savePlace(name string, w *application.WebviewWindow) {
	if w == nil || w.IsMinimised() {
		return
	}
	maximised := w.IsMaximised()
	var frame *rect
	if !maximised {
		b := w.Bounds()
		frame = &rect{X: b.X, Y: b.Y, Width: b.Width, Height: b.Height}
	}
	if err := s.opts.App.saveWindowPlace(context.Background(), name, frame, maximised); err != nil {
		slog.Warn("Could not save where the window is", "window", name, "error", err)
	}
}

// savePlaces remembers where the windows are as the app quits, and whether the engineer's shows,
// to show it again at the next start.
func (s *shell) savePlaces() {
	s.mu.Lock()
	main, engineer := s.main, s.engineer
	s.mu.Unlock()
	s.savePlace(WindowMain, main)
	s.savePlace(WindowEngineer, engineer)
	if engineer == nil {
		return
	}
	if err := s.opts.App.saveWindowShown(context.Background(), WindowEngineer, engineer.IsVisible()); err != nil {
		slog.Warn("Could not save whether the window shows", "window", WindowEngineer, "error", err)
	}
}

// workAreas are the screens' areas a window can be on, without the taskbar.
func (s *shell) workAreas() []rect {
	screens := s.app.Screen.GetAll()
	areas := make([]rect, 0, len(screens))
	for _, screen := range screens {
		a := screen.WorkArea
		areas = append(areas, rect{X: a.X, Y: a.Y, Width: a.Width, Height: a.Height})
	}
	return areas
}

// localDataDir is the app's folder under %LOCALAPPDATA%.
func localDataDir() string {
	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, appName)
}

// removeOldAppWindowProfile deletes the browser profile 1.x's small window used. Files an old
// window still holds open go at a later start.
func removeOldAppWindowProfile() {
	dir := filepath.Join(localDataDir(), oldAppWindowFolder)
	if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
		return
	}
	if err := os.RemoveAll(dir); err != nil {
		slog.Info("Could not remove the old app window's browser profile yet", "path", dir, "error", err)
		return
	}
	slog.Info("Removed the old app window's browser profile", "path", dir)
}

// allowSetForeground lets the running copy bring its window to the front: Windows lets only the
// app in front do that, which a second launch is.
func allowSetForeground() {
	_, _, _ = procAllowSetForegroundWindow.Call(asfwAny)
}

// OpenWindow brings the app's window up.
func (a *App) OpenWindow() error {
	return a.ShowWindow(WindowMain, "")
}

// OpenDashboard brings the app's window up: on Windows the dashboard is the app's own window.
func (a *App) OpenDashboard() error {
	return a.ShowWindow(WindowMain, "")
}
