package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

func TestHandleGetSystemNetwork(t *testing.T) {
	server, _ := setupTestServer(t)
	server.config.UDPAddr = "192.168.1.20:20999"

	req := httptest.NewRequest(http.MethodGet, "/api/system/network", http.NoBody)
	rec := httptest.NewRecorder()
	server.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var resp system.TelemetryEndpoint
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.UDPAddr != "192.168.1.20:20999" {
		t.Errorf("udp_addr = %q, want %q", resp.UDPAddr, "192.168.1.20:20999")
	}
	if resp.UDPPort != 20999 {
		t.Errorf("udp_port = %d, want 20999", resp.UDPPort)
	}
	if resp.LocalIP != "192.168.1.20" {
		t.Errorf("local_ip = %q, want %q", resp.LocalIP, "192.168.1.20")
	}
	if len(resp.LANIPs) != 1 || resp.LANIPs[0] != "192.168.1.20" {
		t.Errorf("lan_ips = %v, want [192.168.1.20]", resp.LANIPs)
	}
}

type fakeLiveFeed struct{ status session.FeedStatus }

func (f fakeLiveFeed) FeedStatus() session.FeedStatus { return f.status }

func TestHandleGetSystemStatus(t *testing.T) {
	getStatus := func(t *testing.T, server *Server) SystemStatus {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/system/status", http.NoBody)
		rec := httptest.NewRecorder()
		server.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
		var resp SystemStatus
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		return resp
	}

	t.Run("nothing received yet", func(t *testing.T) {
		server, _ := setupTestServer(t)
		server.config.UDPAddr = "0.0.0.0:20999"
		server.SetLiveFeed(fakeLiveFeed{})

		resp := getStatus(t, server)
		if resp.UDPAddr != "0.0.0.0:20999" || resp.UDPPort != 20999 {
			t.Errorf("udp = %q/%d, want 0.0.0.0:20999/20999", resp.UDPAddr, resp.UDPPort)
		}
		if resp.PacketAgeMs != nil || resp.Session != nil {
			t.Errorf("packet_age_ms = %v, session = %v, want both null", resp.PacketAgeMs, resp.Session)
		}
	})

	t.Run("a session is arriving", func(t *testing.T) {
		server, _ := setupTestServer(t)
		server.SetLiveFeed(fakeLiveFeed{status: session.FeedStatus{
			LastPacketAt: time.Now().Add(-1500 * time.Millisecond),
			Session: &session.FeedSession{
				SessionUID: 0xABC, SessionType: 15, TrackID: 7, PacketFormat: 2025, PlayerCarIndex: 3,
			},
		}})

		resp := getStatus(t, server)
		if resp.PacketAgeMs == nil || *resp.PacketAgeMs < 1500 || *resp.PacketAgeMs > 5000 {
			t.Errorf("packet_age_ms = %v, want about 1500", resp.PacketAgeMs)
		}
		want := ActiveSession{
			SessionUID: "0x0000000000000ABC", SessionType: 15, TrackID: 7, PacketFormat: 2025, PlayerCarIndex: 3,
		}
		if resp.Session == nil || *resp.Session != want {
			t.Errorf("session = %+v, want %+v", resp.Session, want)
		}
	})
}
