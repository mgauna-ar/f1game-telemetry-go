package api

import (
	"log/slog"
	"net/http"
)

func (s *Server) handleWebSocketForHub(w http.ResponseWriter, r *http.Request, hub *Hub, hubName string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade error", "hub", hubName, "error", err)
		return
	}

	client := NewClient(hub, conn)
	hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	s.handleWebSocketForHub(w, r, s.telemetryHub, "telemetry")
}

func (s *Server) handleEngineerWebSocket(w http.ResponseWriter, r *http.Request) {
	s.handleWebSocketForHub(w, r, s.engineerHub, "engineer")
}
