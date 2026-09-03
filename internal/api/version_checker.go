package api

import (
	"log/slog"
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// Re-export system types and helpers for backwards compatibility.
type AppVersion = system.AppVersion
type GitHubRelease = system.GitHubRelease
type GitHubAsset = system.GitHubAsset
type ReleaseAssetInfo = system.ReleaseAssetInfo
type UpdateCheckResponse = system.UpdateCheckResponse

const (
	DefaultGitHubRepo = system.DefaultGitHubRepo
	ReleaseCacheTTL   = system.ReleaseCacheTTL
)

var (
	SetAppVersion       = system.SetAppVersion
	GetAppVersion       = system.GetAppVersion
	CheckForUpdates     = system.CheckForUpdates
	FetchGitHubReleases = system.FetchGitHubReleases
)

// HTTP Handlers

func (s *Server) handleGetSystemVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, system.GetAppVersion())
}

func (s *Server) handleCheckUpdates(w http.ResponseWriter, r *http.Request) {
	ver := system.GetAppVersion()
	includePrerelease := ver.IsBeta

	if incParam := r.URL.Query().Get("include_prerelease"); incParam != "" {
		includePrerelease = incParam == "true" || incParam == "1"
	}

	repo := r.URL.Query().Get("repo")
	if repo == "" {
		repo = system.DefaultGitHubRepo
	}

	resp, err := system.CheckForUpdates(r.Context(), repo, ver.Version, includePrerelease)
	if err != nil {
		slog.Warn("Update check failed", "repo", repo, "error", err)
		// Return 200 with update_available: false on network/offline errors to avoid breaking UI
		writeJSON(w, http.StatusOK, system.UpdateCheckResponse{
			UpdateAvailable: false,
			CurrentVersion:  ver.Version,
		})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
