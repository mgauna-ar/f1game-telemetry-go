package api

import (
	"net/http"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// handleGetSystemNetwork reports the UDP port and the addresses the game can send telemetry to.
func (s *Server) handleGetSystemNetwork(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, system.DescribeTelemetryEndpoint(s.config.UDPAddr))
}
