package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/desktop"
)

// fakeDesktopApp records what the handlers asked of the desktop app.
type fakeDesktopApp struct {
	state      desktop.DesktopState
	updateErr  error
	updates    []desktop.DesktopUpdate
	dashboards int
	quit       chan struct{}
}

func (f *fakeDesktopApp) State(context.Context) (desktop.DesktopState, error) { return f.state, nil }

func (f *fakeDesktopApp) Update(_ context.Context, u desktop.DesktopUpdate) (desktop.DesktopState, error) {
	f.updates = append(f.updates, u)
	if f.updateErr != nil {
		return desktop.DesktopState{}, f.updateErr
	}
	if u.ShowWindowAtStart != nil {
		f.state.ShowWindowAtStart = *u.ShowWindowAtStart
	}
	return f.state, nil
}

func (f *fakeDesktopApp) OpenDashboard() error { f.dashboards++; return nil }
func (f *fakeDesktopApp) Quit()                { close(f.quit) }

const loopbackRemoteAddr = "127.0.0.1:52100"

func desktopRequest(t *testing.T, server *Server, method, path, body, remoteAddr string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.RemoteAddr = remoteAddr
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)
	return rec
}

func TestDesktopRoutes(t *testing.T) {
	server, _ := setupTestServer(t)
	app := &fakeDesktopApp{state: desktop.DesktopState{ShowWindowAtStart: true, Tray: true}, quit: make(chan struct{})}
	server.SetDesktopApp(app)

	rec := desktopRequest(t, server, http.MethodGet, "/api/desktop", "", loopbackRemoteAddr)
	var state desktop.DesktopState
	if rec.Code != http.StatusOK || json.NewDecoder(rec.Body).Decode(&state) != nil || state != app.state {
		t.Fatalf("GET /api/desktop = %d %+v, want 200 %+v", rec.Code, state, app.state)
	}

	rec = desktopRequest(t, server, http.MethodPut, "/api/desktop", `{"show_window_at_start":false}`, loopbackRemoteAddr)
	if rec.Code != http.StatusOK || json.NewDecoder(rec.Body).Decode(&state) != nil || state.ShowWindowAtStart {
		t.Fatalf("PUT /api/desktop = %d %+v, want 200 with the window off", rec.Code, state)
	}
	if len(app.updates) != 1 || app.updates[0].StartWithOS != nil {
		t.Errorf("updates = %+v, want one leaving start_with_os untouched", app.updates)
	}

	if rec = desktopRequest(t, server, http.MethodPost, "/api/desktop/open-dashboard", "", loopbackRemoteAddr); rec.Code != http.StatusOK || app.dashboards != 1 {
		t.Errorf("open-dashboard = %d (opened %d times), want 200 once", rec.Code, app.dashboards)
	}

	if rec = desktopRequest(t, server, http.MethodPost, "/api/desktop/quit", "", "[::1]:52100"); rec.Code != http.StatusAccepted {
		t.Fatalf("quit = %d, want 202", rec.Code)
	}
	select {
	case <-app.quit:
	case <-time.After(time.Second):
		t.Fatal("quit was answered but the app wasn't stopped")
	}
}

func TestDesktopRoutesRejectOtherDevices(t *testing.T) {
	server, _ := setupTestServer(t)
	app := &fakeDesktopApp{quit: make(chan struct{})}
	server.SetDesktopApp(app)

	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/desktop"},
		{http.MethodPut, "/api/desktop"},
		{http.MethodPost, "/api/desktop/open-dashboard"},
		{http.MethodPost, "/api/desktop/quit"},
	} {
		if rec := desktopRequest(t, server, tc.method, tc.path, "{}", "192.168.1.30:40000"); rec.Code != http.StatusForbidden {
			t.Errorf("%s %s from the LAN = %d, want 403", tc.method, tc.path, rec.Code)
		}
	}
	if app.dashboards != 0 || len(app.updates) != 0 {
		t.Error("a LAN request reached the desktop app")
	}
}

func TestDesktopRoutesWithoutApp(t *testing.T) {
	server, _ := setupTestServer(t)
	if rec := desktopRequest(t, server, http.MethodGet, "/api/desktop", "", loopbackRemoteAddr); rec.Code != http.StatusNotFound {
		t.Errorf("GET /api/desktop without an app = %d, want 404", rec.Code)
	}
}

func TestPutDesktopStartWithOSUnavailable(t *testing.T) {
	server, _ := setupTestServer(t)
	server.SetDesktopApp(&fakeDesktopApp{updateErr: desktop.ErrStartWithOSUnavailable, quit: make(chan struct{})})

	rec := desktopRequest(t, server, http.MethodPut, "/api/desktop", `{"start_with_os":true}`, loopbackRemoteAddr)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("PUT start_with_os where unavailable = %d, want 400", rec.Code)
	}
}
