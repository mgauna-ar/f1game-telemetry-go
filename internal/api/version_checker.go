package api

import (
	"log/slog"
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
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

	// Always this app's repository: the name goes into an api.github.com path unescaped.
	resp, err := system.CheckForUpdates(r.Context(), system.DefaultGitHubRepo, ver.Version, includePrerelease)
	if err != nil {
		slog.Warn("Update check failed", "repo", system.DefaultGitHubRepo, "error", err)
		// Return 200 with update_available: false on network/offline errors to avoid breaking UI
		writeJSON(w, http.StatusOK, system.UpdateCheckResponse{
			UpdateAvailable: false,
			CurrentVersion:  ver.Version,
		})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
