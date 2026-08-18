package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	// DefaultGitHubRepo is the upstream repository to check for releases.
	DefaultGitHubRepo = "mgauna/f1game-telemetry-go"
	// ReleaseCacheTTL is the duration release check responses are cached in-memory.
	ReleaseCacheTTL = 1 * time.Hour
)

// AppVersion holds global build-time metadata populated by cmd/server/main.go.
type AppVersion struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildDate string `json:"build_date"`
	IsDev     bool   `json:"is_dev"`
	IsBeta    bool   `json:"is_beta"`
}

var (
	currentAppVersion = AppVersion{
		Version:   "dev",
		Commit:    "none",
		BuildDate: "unknown",
		IsDev:     true,
		IsBeta:    false,
	}

	releaseCacheMutex sync.RWMutex
	cachedReleases    []GitHubRelease
	cacheExpiry       time.Time

	// Client used for outgoing GitHub API requests with reasonable timeout
	httpClient = &http.Client{Timeout: 10 * time.Second}
)

// SetAppVersion sets the active running application version metadata.
func SetAppVersion(ver, commit, date string) {
	v := strings.TrimSpace(ver)
	if v == "" {
		v = "dev"
	}
	isDev := v == "dev" || strings.HasPrefix(v, "dev-") || v == ""
	isBeta := strings.Contains(strings.ToLower(v), "beta") || strings.Contains(strings.ToLower(v), "rc") || strings.Contains(strings.ToLower(v), "alpha")

	currentAppVersion = AppVersion{
		Version:   v,
		Commit:    commit,
		BuildDate: date,
		IsDev:     isDev,
		IsBeta:    isBeta,
	}
}

// GetAppVersion returns the current running application version metadata.
func GetAppVersion() AppVersion {
	return currentAppVersion
}

// GitHubRelease represents a release object returned by GitHub API.
type GitHubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Body        string        `json:"body"`
	HTMLURL     string        `json:"html_url"`
	Draft       bool          `json:"draft"`
	Prerelease  bool          `json:"prerelease"`
	PublishedAt string        `json:"published_at"`
	Assets      []GitHubAsset `json:"assets"`
}

// GitHubAsset represents a downloadable binary or archive attached to a GitHub release.
type GitHubAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// ReleaseAssetInfo represents a simplified asset for frontend consumption.
type ReleaseAssetInfo struct {
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	DownloadURL string `json:"download_url"`
	Platform    string `json:"platform"` // "windows", "macos", "linux", "checksums"
}

// UpdateCheckResponse represents the response sent to the frontend for update checks.
type UpdateCheckResponse struct {
	UpdateAvailable bool               `json:"update_available"`
	CurrentVersion  string             `json:"current_version"`
	LatestVersion   string             `json:"latest_version"`
	ReleaseName     string             `json:"release_name"`
	ReleaseNotes    string             `json:"release_notes"`
	HTMLURL         string             `json:"html_url"`
	PublishedAt     string             `json:"published_at"`
	IsPrerelease    bool               `json:"is_prerelease"`
	Assets          []ReleaseAssetInfo `json:"assets"`
}

// FetchGitHubReleases fetches releases from GitHub or returns cached response.
func FetchGitHubReleases(ctx context.Context, repo string) ([]GitHubRelease, error) {
	releaseCacheMutex.RLock()
	if cachedReleases != nil && time.Now().Before(cacheExpiry) {
		releases := cachedReleases
		releaseCacheMutex.RUnlock()
		return releases, nil
	}
	releaseCacheMutex.RUnlock()

	if repo == "" {
		repo = DefaultGitHubRepo
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/releases?per_page=10", repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "F1Telemetry-Updater")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch releases from GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("failed to decode GitHub releases: %w", err)
	}

	// Update cache
	releaseCacheMutex.Lock()
	cachedReleases = releases
	cacheExpiry = time.Now().Add(ReleaseCacheTTL)
	releaseCacheMutex.Unlock()

	return releases, nil
}

// CheckForUpdates evaluates available releases against currentVersion.
func CheckForUpdates(ctx context.Context, repo string, currentVer string, includePrerelease bool) (*UpdateCheckResponse, error) {
	releases, err := FetchGitHubReleases(ctx, repo)
	if err != nil {
		return nil, err
	}

	res := &UpdateCheckResponse{
		UpdateAvailable: false,
		CurrentVersion:  currentVer,
		Assets:          make([]ReleaseAssetInfo, 0),
	}

	if len(releases) == 0 {
		return res, nil
	}

	// Find the latest qualifying release
	var targetRelease *GitHubRelease
	for i := range releases {
		rel := &releases[i]
		if rel.Draft {
			continue
		}
		if rel.Prerelease && !includePrerelease {
			continue
		}
		targetRelease = rel
		break
	}

	if targetRelease == nil {
		return res, nil
	}

	res.LatestVersion = targetRelease.TagName
	res.ReleaseName = targetRelease.Name
	res.ReleaseNotes = targetRelease.Body
	res.HTMLURL = targetRelease.HTMLURL
	res.PublishedAt = targetRelease.PublishedAt
	res.IsPrerelease = targetRelease.Prerelease

	for _, a := range targetRelease.Assets {
		platform := "other"
		lower := strings.ToLower(a.Name)
		if strings.Contains(lower, "windows") || strings.HasSuffix(lower, ".exe") {
			platform = "windows"
		} else if strings.Contains(lower, "darwin") || strings.Contains(lower, "mac") {
			platform = "macos"
		} else if strings.Contains(lower, "linux") {
			platform = "linux"
		} else if strings.Contains(lower, "checksum") {
			platform = "checksums"
		}

		res.Assets = append(res.Assets, ReleaseAssetInfo{
			Name:        a.Name,
			Size:        a.Size,
			DownloadURL: a.BrowserDownloadURL,
			Platform:    platform,
		})
	}

	// Compare versions: if dev, update is always available if any release exists
	if currentVer == "dev" || currentVer == "" {
		res.UpdateAvailable = true
		return res, nil
	}

	// Compare semantic versions
	if CompareSemVer(targetRelease.TagName, currentVer) > 0 {
		res.UpdateAvailable = true
	}

	return res, nil
}

// CompareSemVer compares two semantic version strings (e.g. "v1.0.0", "v1.0.0-beta.2").
// Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if v1 == v2.
func CompareSemVer(v1, v2 string) int {
	v1 = strings.TrimPrefix(strings.TrimSpace(v1), "v")
	v2 = strings.TrimPrefix(strings.TrimSpace(v2), "v")

	if v1 == v2 {
		return 0
	}

	core1, pre1 := splitVersionAndPre(v1)
	core2, pre2 := splitVersionAndPre(v2)

	// Compare core numeric segments
	nums1 := parseNumbers(core1)
	nums2 := parseNumbers(core2)

	for i := 0; i < 3; i++ {
		n1 := 0
		if i < len(nums1) {
			n1 = nums1[i]
		}
		n2 := 0
		if i < len(nums2) {
			n2 = nums2[i]
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}

	// If core versions are identical, a release WITHOUT a pre-release tag is greater than one WITH a pre-release tag
	if pre1 == "" && pre2 != "" {
		return 1
	}
	if pre1 != "" && pre2 == "" {
		return -1
	}
	if pre1 != "" && pre2 != "" {
		return comparePreRelease(pre1, pre2)
	}

	return 0
}

func splitVersionAndPre(v string) (string, string) {
	if idx := strings.Index(v, "-"); idx != -1 {
		return v[:idx], v[idx+1:]
	}
	return v, ""
}

func parseNumbers(core string) []int {
	parts := strings.Split(core, ".")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(p); err == nil {
			nums = append(nums, n)
		} else {
			nums = append(nums, 0)
		}
	}
	return nums
}

func comparePreRelease(pre1, pre2 string) int {
	if pre1 == pre2 {
		return 0
	}

	// Extract numeric counter if present (e.g. beta.1 vs beta.2)
	re := regexp.MustCompile(`^([a-zA-Z]+)(?:\.([0-9]+))?`)
	m1 := re.FindStringSubmatch(pre1)
	m2 := re.FindStringSubmatch(pre2)

	if len(m1) > 1 && len(m2) > 1 {
		name1 := m1[1]
		name2 := m2[1]
		if name1 != name2 {
			return strings.Compare(name1, name2)
		}
		num1, _ := strconv.Atoi(m1[2])
		num2, _ := strconv.Atoi(m2[2])
		if num1 > num2 {
			return 1
		}
		if num1 < num2 {
			return -1
		}
	}

	return strings.Compare(pre1, pre2)
}

// HTTP Handlers

func (s *Server) handleGetSystemVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GetAppVersion())
}

func (s *Server) handleCheckUpdates(w http.ResponseWriter, r *http.Request) {
	ver := GetAppVersion()
	includePrerelease := ver.IsBeta

	if incParam := r.URL.Query().Get("include_prerelease"); incParam != "" {
		includePrerelease = incParam == "true" || incParam == "1"
	}

	repo := r.URL.Query().Get("repo")
	if repo == "" {
		repo = DefaultGitHubRepo
	}

	resp, err := CheckForUpdates(r.Context(), repo, ver.Version, includePrerelease)
	if err != nil {
		// Return 200 with update_available: false on network/offline errors to avoid breaking UI
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(UpdateCheckResponse{
			UpdateAvailable: false,
			CurrentVersion:  ver.Version,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
