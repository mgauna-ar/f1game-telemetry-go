package system

import (
	"net"
	"slices"
	"testing"
)

func TestDescribeTelemetryEndpoint(t *testing.T) {
	tests := []struct {
		name        string
		udpAddr     string
		wantPort    int
		wantLocalIP string
		wantLANIPs  []string
		// wantDetectLAN expects this machine's own LAN addresses instead of wantLANIPs.
		wantDetectLAN bool
	}{
		{name: "all interfaces IPv4", udpAddr: "0.0.0.0:20777", wantPort: 20777, wantLocalIP: LoopbackIPv4, wantDetectLAN: true},
		{name: "empty host", udpAddr: ":20778", wantPort: 20778, wantLocalIP: LoopbackIPv4, wantDetectLAN: true},
		{name: "all interfaces IPv6", udpAddr: "[::]:20777", wantPort: 20777, wantLocalIP: LoopbackIPv4, wantDetectLAN: true},
		{name: "loopback only", udpAddr: "127.0.0.1:20777", wantPort: 20777, wantLocalIP: "127.0.0.1", wantLANIPs: []string{}},
		{name: "single LAN address", udpAddr: "192.168.1.20:20777", wantPort: 20777, wantLocalIP: "192.168.1.20", wantLANIPs: []string{"192.168.1.20"}},
		{name: "unparseable address", udpAddr: "not-an-address", wantPort: 0, wantLocalIP: LoopbackIPv4, wantDetectLAN: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DescribeTelemetryEndpoint(tt.udpAddr)

			if got.UDPAddr != tt.udpAddr {
				t.Errorf("UDPAddr = %q, want %q", got.UDPAddr, tt.udpAddr)
			}
			if got.UDPPort != tt.wantPort {
				t.Errorf("UDPPort = %d, want %d", got.UDPPort, tt.wantPort)
			}
			if got.LocalIP != tt.wantLocalIP {
				t.Errorf("LocalIP = %q, want %q", got.LocalIP, tt.wantLocalIP)
			}
			if got.LANIPs == nil {
				t.Fatalf("LANIPs is nil, want a non-nil slice so it serializes as []")
			}
			if tt.wantDetectLAN {
				if want := LANIPv4Addresses(); !slices.Equal(got.LANIPs, want) {
					t.Errorf("LANIPs = %v, want detected addresses %v", got.LANIPs, want)
				}
				return
			}
			if !slices.Equal(got.LANIPs, tt.wantLANIPs) {
				t.Errorf("LANIPs = %v, want %v", got.LANIPs, tt.wantLANIPs)
			}
		})
	}
}

func TestLANIPv4Addresses(t *testing.T) {
	ips := LANIPv4Addresses()
	if ips == nil {
		t.Fatalf("expected a non-nil slice")
	}

	seen := map[string]bool{}
	for _, ip := range ips {
		parsed := net.ParseIP(ip)
		if parsed == nil || parsed.To4() == nil {
			t.Errorf("expected an IPv4 address, got %q", ip)
			continue
		}
		if parsed.IsLoopback() {
			t.Errorf("expected no loopback address, got %q", ip)
		}
		if seen[ip] {
			t.Errorf("address %q listed twice", ip)
		}
		seen[ip] = true
	}
}
