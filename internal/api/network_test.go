package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
