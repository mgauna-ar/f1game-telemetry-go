package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

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
	s.router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

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
		r.Delete("/sessions/{id}", s.handleDeleteSession)
		r.Get("/sessions/{id}/participants", s.handleGetParticipants)
		r.Get("/sessions/{id}/setups", s.handleGetSetups)
		r.Get("/sessions/{id}/laps", s.handleGetLaps)
		r.Get("/laps/{id}/telemetry", s.handleGetTelemetry)

		// AI Race Engineer routes
		r.Post("/ai/chat", s.handleAIChat)
		r.Get("/ai/config-status", s.handleAIConfigStatus)
		r.Post("/ai/models", s.handleAIFetchModels)
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
	sessions, err := s.repo.GetSessions(r.Context())
	if err != nil {
		http.Error(w, "Failed to get sessions", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.DeleteSession(r.Context(), sessionID); err != nil {
		if err.Error() == "session not found" {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		log.Printf("Error deleting session %d: %v", sessionID, err)
		http.Error(w, "Failed to delete session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) handleGetParticipants(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	participants, err := s.repo.GetParticipantsBySession(r.Context(), sessionID)
	if err != nil {
		log.Printf("Error getting participants: %v", err)
		http.Error(w, "Failed to get participants", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participants)
}

func (s *Server) handleGetSetups(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	setups, err := s.repo.GetCarSetupsBySession(r.Context(), sessionID)
	if err != nil {
		log.Printf("Error getting car setups: %v", err)
		http.Error(w, "Failed to get car setups", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(setups)
}

func (s *Server) handleGetLaps(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	laps, err := s.repo.GetLapsBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Failed to get laps", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(laps)
}

func (s *Server) handleGetTelemetry(w http.ResponseWriter, r *http.Request) {
	lapIDStr := chi.URLParam(r, "id")
	lapID, err := strconv.ParseInt(lapIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid lap ID", http.StatusBadRequest)
		return
	}

	telemetry, err := s.repo.GetTelemetryByLap(r.Context(), lapID)
	if err != nil {
		http.Error(w, "Failed to get telemetry", http.StatusInternalServerError)
		return
	}

	// Clean out-laps and aborted attempts to isolate the final completed lap attempt
	telemetry = TrimTelemetryToLastLapAttempt(telemetry)

	if maxPointsStr := r.URL.Query().Get("maxPoints"); maxPointsStr != "" {
		if maxPoints, err := strconv.Atoi(maxPointsStr); err == nil && maxPoints > 0 {
			telemetry = DownsampleTelemetry(telemetry, maxPoints)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(telemetry)
}
