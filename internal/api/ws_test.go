package api

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestWebSocket_Endpoints(t *testing.T) {
	telemetryHub := NewHub("TelemetryTest")
	go telemetryHub.Run(t.Context())

	engineerHub := NewHub("EngineerTest")
	go engineerHub.Run(t.Context())

	server, _ := setupTestServer(t)
	server.telemetryHub = telemetryHub
	server.engineerHub = engineerHub

	ts := httptest.NewServer(server.router)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")

	t.Run("telemetry WebSocket connection and message delivery", func(t *testing.T) {
		dialer := websocket.Dialer{
			HandshakeTimeout: 2 * time.Second,
		}
		conn, resp, err := dialer.Dial(wsURL+"/ws", nil)
		if err != nil {
			t.Fatalf("failed to connect to /ws: %v (status: %v)", err, resp)
		}
		defer conn.Close()

		deadline := time.Now().Add(500 * time.Millisecond)
		for telemetryHub.ClientCount() < 1 && time.Now().Before(deadline) {
			time.Sleep(10 * time.Millisecond)
		}
		if telemetryHub.ClientCount() != 1 {
			t.Fatalf("expected telemetryHub to have 1 client, got %d", telemetryHub.ClientCount())
		}

		testPayload := []byte(`{"type":"snapshot","data":"test"}`)
		telemetryHub.Broadcast(testPayload)

		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message from /ws: %v", err)
		}
		if string(msg) != string(testPayload) {
			t.Errorf("got %s; want %s", string(msg), string(testPayload))
		}

		conn.Close()
		deadline = time.Now().Add(500 * time.Millisecond)
		for telemetryHub.ClientCount() > 0 && time.Now().Before(deadline) {
			time.Sleep(10 * time.Millisecond)
		}
		if telemetryHub.ClientCount() != 0 {
			t.Errorf("expected 0 clients after close, got %d", telemetryHub.ClientCount())
		}
	})

	t.Run("engineer WebSocket connection and message delivery", func(t *testing.T) {
		dialer := websocket.Dialer{
			HandshakeTimeout: 2 * time.Second,
		}
		conn, resp, err := dialer.Dial(wsURL+"/ws/engineer", nil)
		if err != nil {
			t.Fatalf("failed to connect to /ws/engineer: %v (status: %v)", err, resp)
		}
		defer conn.Close()

		deadline := time.Now().Add(500 * time.Millisecond)
		for engineerHub.ClientCount() < 1 && time.Now().Before(deadline) {
			time.Sleep(10 * time.Millisecond)
		}
		if engineerHub.ClientCount() != 1 {
			t.Fatalf("expected engineerHub to have 1 client, got %d", engineerHub.ClientCount())
		}

		testPayload := []byte(`{"type":"directive","id":"tyre_wear"}`)
		engineerHub.Broadcast(testPayload)

		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message from /ws/engineer: %v", err)
		}
		if string(msg) != string(testPayload) {
			t.Errorf("got %s; want %s", string(msg), string(testPayload))
		}

		conn.Close()
		deadline = time.Now().Add(500 * time.Millisecond)
		for engineerHub.ClientCount() > 0 && time.Now().Before(deadline) {
			time.Sleep(10 * time.Millisecond)
		}
		if engineerHub.ClientCount() != 0 {
			t.Errorf("expected 0 clients after close, got %d", engineerHub.ClientCount())
		}
	})

	t.Run("WebSocket plain HTTP upgrade rejection", func(t *testing.T) {
		resp, err := http.Get(ts.URL + "/ws")
		if err != nil {
			t.Fatalf("unexpected GET error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400 Bad Request for non-WS GET, got %d", resp.StatusCode)
		}
	})
}

// Other websites open in the same browser must not read the telemetry or radio streams, while the
// dashboard itself (served by this server, opened by localhost or LAN address, or through the Vite
// dev proxy) and non-browser clients without an Origin header still connect.
func TestWebSocket_OriginCheck(t *testing.T) {
	server, _ := setupTestServer(t)
	hub := NewHub("OriginTest")
	go hub.Run(t.Context())
	server.telemetryHub = hub
	server.engineerHub = hub

	ts := httptest.NewServer(server.router)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	serverHost := strings.TrimPrefix(ts.URL, "http://")
	_, serverPort, err := net.SplitHostPort(serverHost)
	if err != nil {
		t.Fatalf("split test server address: %v", err)
	}

	tests := []struct {
		name       string
		host       string // Host header sent with the handshake; empty keeps the dialed address
		origin     string // Origin header; empty sends none
		wantStatus int
	}{
		{name: "foreign origin", origin: "http://evil.example", wantStatus: http.StatusForbidden},
		{name: "foreign origin on the same port", origin: "http://evil.example:" + serverPort, wantStatus: http.StatusForbidden},
		{name: "same host origin", origin: "http://" + serverHost, wantStatus: http.StatusSwitchingProtocols},
		{name: "LAN address origin", host: "192.168.1.20:8080", origin: "http://192.168.1.20:8080", wantStatus: http.StatusSwitchingProtocols},
		{name: "LAN host with foreign origin", host: "192.168.1.20:8080", origin: "http://192.168.1.99:8080", wantStatus: http.StatusForbidden},
		{name: "Vite dev proxy origin", host: "localhost:5173", origin: "http://localhost:5173", wantStatus: http.StatusSwitchingProtocols},
		{name: "no origin header", wantStatus: http.StatusSwitchingProtocols},
	}

	for _, path := range []string{"/ws", "/ws/engineer"} {
		for _, tt := range tests {
			t.Run(path+" "+tt.name, func(t *testing.T) {
				header := http.Header{}
				if tt.host != "" {
					header.Set("Host", tt.host)
				}
				if tt.origin != "" {
					header.Set("Origin", tt.origin)
				}
				dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
				conn, resp, err := dialer.Dial(wsURL+path, header)
				if conn != nil {
					defer conn.Close()
				}
				if resp == nil {
					t.Fatalf("no handshake response: %v", err)
				}
				defer resp.Body.Close()
				if resp.StatusCode != tt.wantStatus {
					t.Fatalf("status = %d, want %d (err %v)", resp.StatusCode, tt.wantStatus, err)
				}
			})
		}
	}
}
