package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCompareSemVer(t *testing.T) {
	tests := []struct {
		v1   string
		v2   string
		want int
	}{
		{"v1.0.0", "v1.0.0", 0},
		{"1.0.0", "1.0.0", 0},
		{"v1.1.0", "v1.0.0", 1},
		{"v1.0.1", "v1.0.0", 1},
		{"v2.0.0", "v1.9.9", 1},
		{"v1.0.0", "v1.1.0", -1},
		{"v1.0.0", "v1.0.1", -1},
		{"v1.0.0", "v1.0.0-beta.1", 1},        // Stable > Pre-release
		{"v1.0.0-beta.1", "v1.0.0", -1},       // Pre-release < Stable
		{"v1.0.0-beta.2", "v1.0.0-beta.1", 1}, // Beta 2 > Beta 1
		{"v1.0.0-beta.1", "v1.0.0-beta.2", -1},
		{"v1.0.0-rc.1", "v1.0.0-beta.5", 1}, // rc > beta
		{"v0.9.0", "v1.0.0-beta.1", -1},     // Major version overrides pre-release
	}

	for _, tt := range tests {
		t.Run(tt.v1+"_vs_"+tt.v2, func(t *testing.T) {
			got := CompareSemVer(tt.v1, tt.v2)
			if got != tt.want {
				t.Errorf("CompareSemVer(%q, %q) = %d, want %d", tt.v1, tt.v2, got, tt.want)
			}
		})
	}
}

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
