package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
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
		r.Get("/sessions/{id}/laps", s.handleGetLaps)
		r.Get("/laps/{id}/telemetry", s.handleGetTelemetry)

		// Tag routes
		r.Get("/tags", s.handleGetTags)
		r.Post("/tags", s.handleCreateTag)
		r.Put("/tags/{id}", s.handleUpdateTag)
		r.Delete("/tags/{id}", s.handleDeleteTag)

		// Session-Tag routes
		r.Get("/sessions/{id}/tags", s.handleGetSessionTags)
		r.Post("/sessions/{id}/tags", s.handleAddSessionTag)
		r.Put("/sessions/{id}/tags", s.handleSetSessionTags)
		r.Delete("/sessions/{id}/tags/{tagId}", s.handleRemoveSessionTag)

		// AI Race Engineer routes
		r.Post("/ai/chat", s.handleAIChat)
		r.Get("/ai/config-status", s.handleAIConfigStatus)
		r.Post("/ai/models", s.handleAIFetchModels)
	})

	// Serve static files from frontend with SPA fallback
	frontendDir := "./frontend/dist"
	fs := http.FileServer(http.Dir(frontendDir))
	s.router.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(frontendDir, r.URL.Path)
		if info, err := os.Stat(path); os.IsNotExist(err) || (err == nil && info.IsDir()) {
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	})
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error: %v", err)
		return
	}

	client := NewClient(s.hub, conn)
	s.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
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

// Tag request payloads
type createTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type addSessionTagRequest struct {
	TagID int64  `json:"tag_id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type setSessionTagsRequest struct {
	TagIDs []int64 `json:"tag_ids"`
}

func (s *Server) handleGetTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.repo.GetAllTags(r.Context())
	if err != nil {
		http.Error(w, "Failed to get tags", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	var req createTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	color := strings.TrimSpace(req.Color)
	if name == "" {
		http.Error(w, "Tag name is required", http.StatusBadRequest)
		return
	}
	if color == "" {
		color = "#06b6d4" // Default cyan
	}

	tag := storage.Tag{
		Name:  name,
		Color: color,
	}

	if err := s.repo.CreateTag(r.Context(), &tag); err != nil {
		log.Printf("Error creating tag: %v", err)
		http.Error(w, "Failed to create tag", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tag)
}

func (s *Server) handleUpdateTag(w http.ResponseWriter, r *http.Request) {
	tagIDStr := chi.URLParam(r, "id")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	var req createTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	color := strings.TrimSpace(req.Color)
	if name == "" {
		http.Error(w, "Tag name is required", http.StatusBadRequest)
		return
	}
	if color == "" {
		color = "#06b6d4"
	}

	tag := storage.Tag{
		ID:    tagID,
		Name:  name,
		Color: color,
	}

	if err := s.repo.UpdateTag(r.Context(), &tag); err != nil {
		if err.Error() == "tag not found" {
			http.Error(w, "Tag not found", http.StatusNotFound)
			return
		}
		log.Printf("Error updating tag %d: %v", tagID, err)
		http.Error(w, "Failed to update tag", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tag)
}

func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	tagIDStr := chi.URLParam(r, "id")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.DeleteTag(r.Context(), tagID); err != nil {
		if err.Error() == "tag not found" {
			http.Error(w, "Tag not found", http.StatusNotFound)
			return
		}
		log.Printf("Error deleting tag %d: %v", tagID, err)
		http.Error(w, "Failed to delete tag", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) handleGetSessionTags(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		log.Printf("Error getting session tags: %v", err)
		http.Error(w, "Failed to get session tags", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

func (s *Server) handleAddSessionTag(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req addSessionTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	tagID := req.TagID
	if tagID == 0 {
		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, "Tag ID or Tag Name is required", http.StatusBadRequest)
			return
		}
		color := strings.TrimSpace(req.Color)
		if color == "" {
			color = "#06b6d4"
		}
		tag := storage.Tag{
			Name:  name,
			Color: color,
		}
		if err := s.repo.CreateTag(r.Context(), &tag); err != nil {
			log.Printf("Error creating tag on demand: %v", err)
			http.Error(w, "Failed to create tag", http.StatusInternalServerError)
			return
		}
		tagID = tag.ID
	}

	if err := s.repo.AddTagToSession(r.Context(), sessionID, tagID); err != nil {
		log.Printf("Error adding tag to session: %v", err)
		http.Error(w, "Failed to add tag to session", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(tags)
}

func (s *Server) handleSetSessionTags(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var req setSessionTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.TagIDs == nil {
		req.TagIDs = []int64{}
	}

	if err := s.repo.SetSessionTags(r.Context(), sessionID, req.TagIDs); err != nil {
		log.Printf("Error setting session tags: %v", err)
		http.Error(w, "Failed to set session tags", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

func (s *Server) handleRemoveSessionTag(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	tagIDStr := chi.URLParam(r, "tagId")
	tagID, err := strconv.ParseInt(tagIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid tag ID", http.StatusBadRequest)
		return
	}

	if err := s.repo.RemoveTagFromSession(r.Context(), sessionID, tagID); err != nil {
		log.Printf("Error removing tag %d from session %d: %v", tagID, sessionID, err)
		http.Error(w, "Failed to remove tag from session", http.StatusInternalServerError)
		return
	}

	tags, err := s.repo.GetTagsBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated tags", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}
