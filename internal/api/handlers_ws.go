package api

import (
	"log/slog"
	"net/http"
)

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade error", "hub", "telemetry", "error", err)
		return
	}

	client := NewClient(s.telemetryHub, conn)
	s.telemetryHub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}

func (s *Server) handleEngineerWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade error", "hub", "engineer", "error", err)
		return
	}

	client := NewClient(s.engineerHub, conn)
	s.engineerHub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
