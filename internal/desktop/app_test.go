package desktop

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// memStore is an in-memory settings.Store.
type memStore struct {
	mu   sync.Mutex
	data map[string]string
}

func (m *memStore) GetSetting(_ context.Context, key string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data[key], nil
}

func (m *memStore) SetSetting(_ context.Context, key, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = value
	return nil
}

func TestAppShowWindowAtStart(t *testing.T) {
	ctx := context.Background()
	app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}, NativeWindow: true})

	state, err := app.State(ctx)
	if err != nil || !state.ShowWindowAtStart || !state.NativeWindow {
		t.Fatalf("State() = %+v, %v; want the window shown at start, the app's own", state, err)
	}

	off := false
	if state, err = app.Update(ctx, DesktopUpdate{ShowWindowAtStart: &off}); err != nil || state.ShowWindowAtStart {
		t.Fatalf("Update(off) = %+v, %v; want the window off", state, err)
	}
	if state, err = app.State(ctx); err != nil || state.ShowWindowAtStart {
		t.Errorf("State() after saving = %+v, %v; want the window still off", state, err)
	}
}

// TestAppStartWithOSUnavailable runs on a test binary, which lives in a temporary folder (and off
// Windows has no sign-in start at all), so starting at sign-in can't be turned on.
func TestAppStartWithOSUnavailable(t *testing.T) {
	ctx := context.Background()
	app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}})

	state, err := app.State(ctx)
	if err != nil || state.StartWithOSAvailable || state.StartWithOS {
		t.Fatalf("State() = %+v, %v; want start with OS unavailable", state, err)
	}
	on := true
	if _, err := app.Update(ctx, DesktopUpdate{StartWithOS: &on}); !errors.Is(err, ErrStartWithOSUnavailable) {
		t.Errorf("Update(start with OS) error = %v, want ErrStartWithOSUnavailable", err)
	}
}

func TestAppQuit(t *testing.T) {
	quit := make(chan struct{})
	NewApp(AppConfig{Quit: func() { close(quit) }}).Quit()
	select {
	case <-quit:
	default:
		t.Error("Quit() didn't call the quit func")
	}
}

// fakeInstall replaces installRelease for a test, recording the versions it installed.
func fakeInstall(t *testing.T, install func(rel *system.UpdateCheckResponse) error) *[]string {
	t.Helper()
	var installed []string
	prev := installRelease
	installRelease = func(_ context.Context, rel *system.UpdateCheckResponse, _ string) error {
		if err := install(rel); err != nil {
			return err
		}
		installed = append(installed, rel.LatestVersion)
		return nil
	}
	t.Cleanup(func() { installRelease = prev })
	return &installed
}

func checker(resp *system.UpdateCheckResponse, err error) func(context.Context) (*system.UpdateCheckResponse, error) {
	return func(context.Context) (*system.UpdateCheckResponse, error) { return resp, err }
}

func TestAppInstallUpdate(t *testing.T) {
	newer := &system.UpdateCheckResponse{UpdateAvailable: true, CurrentVersion: "v1.6.0", LatestVersion: "v1.7.0"}
	errOffline, errDenied := errors.New("offline"), errors.New("permission denied")
	tests := []struct {
		name    string
		check   func(context.Context) (*system.UpdateCheckResponse, error)
		install error
		want    string
		wantErr error
	}{
		{name: "dev build", wantErr: ErrUpdateUnavailable},
		{name: "already latest", check: checker(&system.UpdateCheckResponse{CurrentVersion: "v1.7.0", LatestVersion: "v1.7.0"}, nil), wantErr: ErrNoUpdate},
		{name: "check fails", check: checker(nil, errOffline), wantErr: errOffline},
		{name: "install fails", check: checker(newer, nil), install: errDenied, wantErr: errDenied},
		{name: "installed", check: checker(newer, nil), want: "v1.7.0"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			installed := fakeInstall(t, func(*system.UpdateCheckResponse) error { return tt.install })
			app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}, CheckUpdates: tt.check})

			state, err := app.State(t.Context())
			if err != nil || state.CanUpdate != (tt.check != nil) {
				t.Errorf("State().CanUpdate = %v, %v; want %v", state.CanUpdate, err, tt.check != nil)
			}

			got, err := app.InstallUpdate(t.Context())
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("InstallUpdate() error = %v, want %v", err, tt.wantErr)
				}
				if len(*installed) != 0 {
					t.Errorf("installed %q, want nothing", *installed)
				}
				return
			}
			if err != nil || got != tt.want {
				t.Fatalf("InstallUpdate() = %q, %v; want %q", got, err, tt.want)
			}
			// Installed and waiting for the restart: a second click doesn't download it again
			if _, err := app.InstallUpdate(t.Context()); !errors.Is(err, ErrUpdateInProgress) {
				t.Errorf("second InstallUpdate() error = %v, want ErrUpdateInProgress", err)
			}
		})
	}
}

func TestAppInstallUpdateOneAtATime(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	fakeInstall(t, func(*system.UpdateCheckResponse) error {
		close(started)
		<-release
		return errors.New("offline")
	})
	app := NewApp(AppConfig{CheckUpdates: checker(&system.UpdateCheckResponse{UpdateAvailable: true, LatestVersion: "v1.7.0"}, nil)})

	done := make(chan error)
	go func() {
		_, err := app.InstallUpdate(t.Context())
		done <- err
	}()
	<-started
	if _, err := app.InstallUpdate(t.Context()); !errors.Is(err, ErrUpdateInProgress) {
		t.Errorf("InstallUpdate() while installing error = %v, want ErrUpdateInProgress", err)
	}
	close(release)
	if err := <-done; err == nil {
		t.Fatal("first InstallUpdate() succeeded, want the install error")
	}

	// A failed install can be tried again
	fakeInstall(t, func(*system.UpdateCheckResponse) error { return nil })
	if got, err := app.InstallUpdate(t.Context()); err != nil || got != "v1.7.0" {
		t.Errorf("InstallUpdate() after a failure = %q, %v; want v1.7.0", got, err)
	}
}

func TestAppRestart(t *testing.T) {
	restarted := false
	NewApp(AppConfig{Restart: func() { restarted = true }}).Restart()
	if !restarted {
		t.Error("Restart() didn't call the restart func")
	}
}
