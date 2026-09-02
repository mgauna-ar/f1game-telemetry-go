package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestWebSocket_Endpoints(t *testing.T) {
	telemetryHub := NewHub("TelemetryTest")
	go telemetryHub.Run()

	engineerHub := NewHub("EngineerTest")
	go engineerHub.Run()

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
