package system

import (
	"net"
	"testing"
)

func TestGetLocalIP(t *testing.T) {
	ip := GetLocalIP()
	if ip == "" {
		t.Fatalf("expected non-empty IP string")
	}

	parsed := net.ParseIP(ip)
	if parsed == nil {
		t.Fatalf("expected valid IP address, got %q", ip)
	}
}
