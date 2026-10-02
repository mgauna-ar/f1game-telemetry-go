package desktop

import (
	"context"
	"errors"
	"sync"
	"testing"
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
	app := NewApp(AppConfig{Store: &memStore{data: map[string]string{}}, Tray: true})

	state, err := app.State(ctx)
	if err != nil || !state.ShowWindowAtStart || !state.Tray {
		t.Fatalf("State() = %+v, %v; want the window shown at start, in the tray", state, err)
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
