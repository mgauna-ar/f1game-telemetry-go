package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAppVersionState(t *testing.T) {
	SetAppVersion("v1.0.0-beta.1", "abc1234", "2026-08-18")
	ver := GetAppVersion()

	if ver.Version != "v1.0.0-beta.1" {
		t.Errorf("expected version v1.0.0-beta.1, got %s", ver.Version)
	}
	if ver.Commit != "abc1234" {
		t.Errorf("expected commit abc1234, got %s", ver.Commit)
	}
	if !ver.IsBeta {
		t.Errorf("expected IsBeta = true for v1.0.0-beta.1")
	}
	if ver.IsDev {
		t.Errorf("expected IsDev = false for v1.0.0-beta.1")
	}

	SetAppVersion("dev", "none", "unknown")
	verDev := GetAppVersion()
	if !verDev.IsDev {
		t.Errorf("expected IsDev = true for dev version")
	}

	SetAppVersion("v1.0.1-35-g48f0b96", "48f0b96", "2026-08-24")
	verGitDesc := GetAppVersion()
	if !verGitDesc.IsDev {
		t.Errorf("expected IsDev = true for git describe post-tag version")
	}
	if verGitDesc.IsBeta {
		t.Errorf("expected IsBeta = false for git describe dev build")
	}
}

func TestHandleGetSystemVersion(t *testing.T) {
	server, _ := setupTestServer(t)
	SetAppVersion("v1.2.0", "fedcba9", "2026-08-18")

	req := httptest.NewRequest(http.MethodGet, "/api/system/version", http.NoBody)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var resp AppVersion
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Version != "v1.2.0" || resp.Commit != "fedcba9" {
		t.Errorf("unexpected version response: %+v", resp)
	}
}

func TestCheckForUpdatesWithMockReleases(t *testing.T) {
	mockReleases := []GitHubRelease{
		{
			TagName:     "v1.0.0",
			Name:        "F1 Telemetry Analyzer v1.0.0",
			Body:        "Initial stable release",
			HTMLURL:     "https://github.com/mgauna-ar/f1game-telemetry-go/releases/tag/v1.0.0",
			Draft:       false,
			Prerelease:  false,
			PublishedAt: "2026-08-18T20:00:00Z",
			Assets: []GitHubAsset{
				{Name: "f1telemetry_v1.0.0_windows_amd64.zip", Size: 1024, BrowserDownloadURL: "https://example.com/win.zip"},
				{Name: "f1telemetry_v1.0.0_darwin_arm64.zip", Size: 1024, BrowserDownloadURL: "https://example.com/mac.zip"},
			},
		},
	}

	// Prime cache
	releaseCacheMutex.Lock()
	cachedReleases = mockReleases
	cacheExpiry = time.Now().Add(1 * time.Hour)
	releaseCacheMutex.Unlock()

	ctx := context.Background()
	res, err := CheckForUpdates(ctx, "mgauna-ar/f1game-telemetry-go", "v0.9.0", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !res.UpdateAvailable {
		t.Errorf("expected update_available = true when running v0.9.0 against v1.0.0")
	}
	if res.LatestVersion != "v1.0.0" {
		t.Errorf("expected latest version v1.0.0, got %s", res.LatestVersion)
	}
	if len(res.Assets) != 2 {
		t.Errorf("expected 2 assets, got %d", len(res.Assets))
	}
}
