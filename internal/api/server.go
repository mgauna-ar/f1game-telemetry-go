package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// Server handles HTTP requests for the API and serves the frontend.
type Server struct {
	router *chi.Mux
	repo   *storage.Repository
	hub    *Hub
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local dev
	},
}

// NewServer creates a new API server.
func NewServer(repo *storage.Repository, hub *Hub) *Server {
	s := &Server{
		router: chi.NewRouter(),
		repo:   repo,
		hub:    hub,
	}

	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)

	s.routes()

	return s
}

// Router returns the underlying Chi router.
func (s *Server) Router() *chi.Mux {
	return s.router
}

func (s *Server) routes() {
	s.router.Get("/ws", s.handleWebSocket)

	// API routes
	s.router.Route("/api", func(r chi.Router) {
		r.Get("/sessions", s.handleGetSessions)
		// r.Get("/sessions/{id}/laps", s.handleGetLaps)
		// r.Get("/laps/{id}/telemetry", s.handleGetTelemetry)
	})

	// Serve static files from the frontend directory (created in Phase 4)
	fs := http.FileServer(http.Dir("./frontend/dist"))
	s.router.Handle("/*", http.StripPrefix("/", fs))
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error: %v", err)
		return
	}

	s.hub.register <- conn

	// Keep connection alive and handle disconnection
	go func() {
		defer func() {
			s.hub.unregister <- conn
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

func (s *Server) handleGetSessions(w http.ResponseWriter, r *http.Request) {
	// For now, return empty or implement repo.GetSessions()
	// To keep it compiling quickly, we return a mock response.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Sessions endpoint stub"})
}
