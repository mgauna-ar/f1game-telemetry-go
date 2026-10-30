package desktop

import (
	"context"
	"errors"
	"slices"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/settings"
)

// Two screens side by side: a 1920x1080 laptop panel with a 40 px taskbar, and a monitor to its
// right.
var testWorkAreas = []rect{
	{X: 0, Y: 0, Width: 1920, Height: 1040},
	{X: 1920, Y: 0, Width: 2560, Height: 1400},
}

func TestOnScreen(t *testing.T) {
	tests := []struct {
		name  string
		frame rect
		want  bool
	}{
		{name: "on the first screen", frame: rect{X: 100, Y: 100, Width: 1280, Height: 800}, want: true},
		{name: "on the second screen", frame: rect{X: 2200, Y: 200, Width: 1280, Height: 800}, want: true},
		{name: "across both", frame: rect{X: 1500, Y: 100, Width: 1280, Height: 800}, want: true},
		{name: "monitor gone", frame: rect{X: 4600, Y: 100, Width: 1280, Height: 800}, want: false},
		{name: "title bar above the screens", frame: rect{X: 100, Y: -500, Width: 1280, Height: 800}, want: false},
		{name: "title bar half on", frame: rect{X: 100, Y: -titleBarHeight / 2, Width: 1280, Height: 800}, want: true},
		{name: "only a sliver left of the screen", frame: rect{X: -1200, Y: 100, Width: 1280, Height: 800}, want: false},
		{name: "enough left to grab", frame: rect{X: -1100, Y: 100, Width: 1280, Height: 800}, want: true},
		{name: "below the taskbar", frame: rect{X: 100, Y: 1030, Width: 1280, Height: 800}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := onScreen(tt.frame, testWorkAreas); got != tt.want {
				t.Errorf("onScreen(%+v) = %v, want %v", tt.frame, got, tt.want)
			}
		})
	}
	if onScreen(rect{X: 100, Y: 100, Width: 1280, Height: 800}, nil) {
		t.Error("onScreen with no screens = true, want false")
	}
}

func TestIsDashboardPath(t *testing.T) {
	for _, path := range []string{"", "/", "/live", "/engineer", "/history?quick=podiums"} {
		if !isDashboardPath(path) {
			t.Errorf("isDashboardPath(%q) = false, want true", path)
		}
	}
	for _, path := range []string{"live", "//evil.example", `/\evil.example`, "https://evil.example/", "javascript:alert(1)"} {
		if isDashboardPath(path) {
			t.Errorf("isDashboardPath(%q) = true, want false", path)
		}
	}
}

func TestIsWebLink(t *testing.T) {
	for _, link := range []string{"https://github.com/mgauna-ar/f1game-telemetry-go/releases", "http://192.168.1.20:8080/"} {
		if !isWebLink(link) {
			t.Errorf("isWebLink(%q) = false, want true", link)
		}
	}
	for _, link := range []string{"", "file:///C:/Windows/notepad.exe", "ms-settings:privacy", "javascript:alert(1)", "https://", "/live"} {
		if isWebLink(link) {
			t.Errorf("isWebLink(%q) = true, want false", link)
		}
	}
}

// fakeShell records the windows the App asked for.
type fakeShell struct {
	mu    sync.Mutex
	shown []string
}

func (f *fakeShell) show(name, path string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.shown = append(f.shown, name+" "+path)
}

func TestAppShowWindow(t *testing.T) {
	app := NewApp(AppConfig{})
	if err := app.ShowWindow(WindowMain, ""); !errors.Is(err, ErrNoWindow) {
		t.Fatalf("ShowWindow() with no windows of its own = %v, want ErrNoWindow", err)
	}

	shell := &fakeShell{}
	app.attachShell(shell)
	if err := app.ShowWindow("settings", ""); !errors.Is(err, ErrUnknownWindow) {
		t.Errorf("ShowWindow(unknown) = %v, want ErrUnknownWindow", err)
	}
	if err := app.ShowWindow(WindowMain, "//evil.example"); !errors.Is(err, ErrWindowPath) {
		t.Errorf("ShowWindow(other site) = %v, want ErrWindowPath", err)
	}
	if err := app.ShowWindow(WindowMain, "/live"); err != nil {
		t.Fatalf("ShowWindow(main, /live) = %v", err)
	}
	if err := app.ShowWindow(WindowEngineer, ""); err != nil {
		t.Fatalf("ShowWindow(engineer) = %v", err)
	}
	if want := []string{"main /live", "engineer "}; !slices.Equal(shell.shown, want) {
		t.Errorf("shown = %q, want %q", shell.shown, want)
	}

	app.attachShell(nil)
	if err := app.ShowWindow(WindowMain, ""); !errors.Is(err, ErrNoWindow) {
		t.Errorf("ShowWindow() once the windows are gone = %v, want ErrNoWindow", err)
	}
}

func TestAppOpenExternal(t *testing.T) {
	var opened []string
	prev := openBrowser
	openBrowser = func(link string) error { opened = append(opened, link); return nil }
	t.Cleanup(func() { openBrowser = prev })

	app := NewApp(AppConfig{})
	const notes = "https://github.com/mgauna-ar/f1game-telemetry-go/releases/tag/v2.0.0"
	if err := app.OpenExternal(notes); err != nil {
		t.Fatalf("OpenExternal(release notes) = %v", err)
	}
	if err := app.OpenExternal("file:///C:/Windows/System32/cmd.exe"); !errors.Is(err, ErrExternalURL) {
		t.Errorf("OpenExternal(file) = %v, want ErrExternalURL", err)
	}
	if !slices.Equal(opened, []string{notes}) {
		t.Errorf("opened %q, want only the release notes", opened)
	}
}

func TestAppWindowPlace(t *testing.T) {
	ctx := context.Background()
	app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}})

	if _, frame := app.windowPlace(ctx, WindowMain, testWorkAreas); frame {
		t.Fatal("windowPlace() before anything was saved has a frame, want the default")
	}

	moved := rect{X: 2200, Y: 200, Width: 1400, Height: 900}
	if err := app.saveWindowPlace(ctx, WindowMain, &moved, false); err != nil {
		t.Fatal(err)
	}
	place, frame := app.windowPlace(ctx, WindowMain, testWorkAreas)
	if !frame || boundsRect(place) != moved || place.Maximised {
		t.Fatalf("windowPlace() = %+v, %v; want %+v, not maximised", place, frame, moved)
	}

	// Maximised, it keeps the frame it goes back to
	if err := app.saveWindowPlace(ctx, WindowMain, nil, true); err != nil {
		t.Fatal(err)
	}
	if place, frame = app.windowPlace(ctx, WindowMain, testWorkAreas); !frame || boundsRect(place) != moved || !place.Maximised {
		t.Errorf("windowPlace() after maximising = %+v, %v; want %+v, maximised", place, frame, moved)
	}

	// The second monitor is unplugged: it opens at the default place, still maximised
	place, frame = app.windowPlace(ctx, WindowMain, testWorkAreas[:1])
	if frame || !place.Maximised {
		t.Errorf("windowPlace() on one screen = %+v, %v; want no frame, maximised", place, frame)
	}

	// Each window has its own place, and the other desktop settings stay
	engineer := rect{X: 0, Y: 0, Width: 560, Height: 760}
	if err := app.saveWindowPlace(ctx, WindowEngineer, &engineer, false); err != nil {
		t.Fatal(err)
	}
	d, err := settings.LoadDesktop(ctx, app.cfg.Store)
	if err != nil || !d.ShowWindowAtStart || len(d.Windows) != len(WindowNames) {
		t.Errorf("saved desktop settings = %+v, %v; want the window shown at start and both windows' places", d, err)
	}
}

func TestAppWindowShown(t *testing.T) {
	ctx := context.Background()
	app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}})
	if app.windowShown(ctx, WindowEngineer) {
		t.Fatal("windowShown() before anything was saved = true, want false")
	}

	if err := app.saveWindowShown(ctx, WindowEngineer, true); err != nil {
		t.Fatal(err)
	}
	// Moving or maximising it keeps that it shows, and leaves the other window as it was
	moved := rect{X: 2200, Y: 200, Width: 600, Height: 800}
	if err := app.saveWindowPlace(ctx, WindowEngineer, &moved, false); err != nil {
		t.Fatal(err)
	}
	if err := app.saveWindowPlace(ctx, WindowEngineer, nil, true); err != nil {
		t.Fatal(err)
	}
	if !app.windowShown(ctx, WindowEngineer) || app.windowShown(ctx, WindowMain) {
		t.Errorf("windowShown(engineer, main) = %v, %v; want true, false",
			app.windowShown(ctx, WindowEngineer), app.windowShown(ctx, WindowMain))
	}
	place, frame := app.windowPlace(ctx, WindowEngineer, testWorkAreas)
	if !frame || boundsRect(place) != moved || !place.Maximised {
		t.Errorf("windowPlace() = %+v, %v; want %+v, maximised", place, frame, moved)
	}

	if err := app.saveWindowShown(ctx, WindowEngineer, false); err != nil {
		t.Fatal(err)
	}
	if app.windowShown(ctx, WindowEngineer) {
		t.Error("windowShown() after it was hidden = true, want false")
	}
}
