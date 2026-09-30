package api

import (
	"net/http"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

// LiveFeed reports what the live feed last received (session.LiveBroadcaster).
type LiveFeed interface {
	FeedStatus() session.FeedStatus
}

// SystemStatus is GET /api/system/status: whether telemetry is arriving and from which session.
// The dashboard polls it on pages that don't open /ws, so the live badge is right everywhere.
type SystemStatus struct {
	// UDPAddr is the telemetry listen address as configured, e.g. "0.0.0.0:20777".
	UDPAddr string `json:"udp_addr"`
	// UDPPort is the port the game has to send to, or 0 when UDPAddr can't be parsed.
	UDPPort int `json:"udp_port"`
	// PacketAgeMs is how long ago the last packet arrived; null when none has since the server started.
	PacketAgeMs *int64 `json:"packet_age_ms"`
	// Session is the last session the game reported; null before the first one.
	Session *ActiveSession `json:"session"`
}

// ActiveSession identifies the session the game is (or was last) sending.
type ActiveSession struct {
	SessionUID     string `json:"session_uid"`
	SessionType    uint8  `json:"session_type"`
	TrackID        int8   `json:"track_id"`
	PacketFormat   uint16 `json:"packet_format"`
	PlayerCarIndex uint8  `json:"player_car_index"`
}

// SetLiveFeed attaches the live feed that GET /api/system/status reports on. Call it before serving.
func (s *Server) SetLiveFeed(feed LiveFeed) {
	s.liveFeed = feed
}

// handleGetSystemStatus reports the UDP address, how long ago the last packet arrived and the session.
func (s *Server) handleGetSystemStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.systemStatus(time.Now()))
}

func (s *Server) systemStatus(now time.Time) SystemStatus {
	status := SystemStatus{UDPAddr: s.config.UDPAddr, UDPPort: system.ListenPort(s.config.UDPAddr)}
	if s.liveFeed == nil {
		return status
	}
	feed := s.liveFeed.FeedStatus()
	if !feed.LastPacketAt.IsZero() {
		age := max(now.Sub(feed.LastPacketAt).Milliseconds(), 0)
		status.PacketAgeMs = &age
	}
	if feed.Session != nil {
		status.Session = &ActiveSession{
			SessionUID:     packets.FormatSessionUID(feed.Session.SessionUID),
			SessionType:    feed.Session.SessionType,
			TrackID:        feed.Session.TrackID,
			PacketFormat:   feed.Session.PacketFormat,
			PlayerCarIndex: feed.Session.PlayerCarIndex,
		}
	}
	return status
}
