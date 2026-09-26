package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

func TestHandleGetSystemVersion(t *testing.T) {
	server, _ := setupTestServer(t)
	system.SetAppVersion("v1.2.0", "fedcba9", "2026-08-18")

	req := httptest.NewRequest(http.MethodGet, "/api/system/version", http.NoBody)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var resp system.AppVersion
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Version != "v1.2.0" || resp.Commit != "fedcba9" {
		t.Errorf("unexpected version response: %+v", resp)
	}
}

// recordingTransport answers every outgoing request with an empty release list and remembers
// which URLs were requested.
type recordingTransport struct {
	mu   sync.Mutex
	urls []string
}

func (rt *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.mu.Lock()
	rt.urls = append(rt.urls, req.URL.String())
	rt.mu.Unlock()
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader("[]")),
		Request:    req,
	}, nil
}

// The update check always asks GitHub about this app's repository: a repo query parameter would
// otherwise go unescaped into the api.github.com path.
func TestHandleCheckUpdates_IgnoresRepoParameter(t *testing.T) {
	server, _ := setupTestServer(t)

	rt := &recordingTransport{}
	previous := http.DefaultTransport
	http.DefaultTransport = rt
	system.SetCachedReleasesForTest(nil, 0)
	t.Cleanup(func() {
		http.DefaultTransport = previous
		system.SetCachedReleasesForTest(nil, 0)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/system/check-updates?repo=attacker%2Fother%2F..%2F..%2Fusers", http.NoBody)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	want := "https://api.github.com/repos/" + system.DefaultGitHubRepo + "/releases?per_page=10"
	if len(rt.urls) != 1 || rt.urls[0] != want {
		t.Fatalf("GitHub requests = %v, want [%s]", rt.urls, want)
	}
}
