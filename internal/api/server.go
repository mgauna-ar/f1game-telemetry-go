package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

const (
	// DefaultTagColor is the default accent color used when creating tags without a color.
	DefaultTagColor = "#06b6d4"
	// MaxImportPayloadSize is the maximum size allowed for importing session files (100 MB).
	MaxImportPayloadSize = 100 << 20
)

var (
	// ZstdMagicHeader represents the 4-byte standard magic header for Zstandard compressed streams (0xFD2FB528 in little-endian).
	ZstdMagicHeader = []byte{0x28, 0xB5, 0x2F, 0xFD}
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
		// Session routes
		r.Get("/sessions", s.handleGetSessions)
		r.Delete("/sessions/{id}", s.handleDeleteSession)
		r.Get("/sessions/{id}/participants", s.handleGetParticipants)
		r.Get("/sessions/{id}/laps", s.handleGetLaps)
		r.Get("/sessions/{id}/export", s.handleExportSession)
		r.Post("/sessions/import", s.handleImportSession)
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

	var carIndex *int
	if carIndexStr := r.URL.Query().Get("carIndex"); carIndexStr != "" {
		if ci, err := strconv.Atoi(carIndexStr); err == nil && ci >= 0 {
			carIndex = &ci
		}
	}

	laps, err := s.repo.GetLapsBySession(r.Context(), sessionID, carIndex)
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
		color = DefaultTagColor
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
		color = DefaultTagColor
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
			color = DefaultTagColor
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

func sanitizeFilename(s string) string {
	var result []rune
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			result = append(result, r)
		} else if r == ' ' {
			result = append(result, '_')
		}
	}
	if len(result) == 0 {
		return "session"
	}
	return string(result)
}

func (s *Server) handleExportSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	pkg, err := s.repo.ExportSession(r.Context(), sessionID)
	if err != nil {
		log.Printf("Error exporting session %d: %v", sessionID, err)
		http.Error(w, "Failed to export session", http.StatusInternalServerError)
		return
	}

	rawJSON, err := json.Marshal(pkg)
	if err != nil {
		http.Error(w, "Failed to encode session package", http.StatusInternalServerError)
		return
	}

	compressed := storage.CompressRaw(rawJSON)

	filename := fmt.Sprintf("%s_%s_%s.f1session",
		sanitizeFilename(pkg.Session.TrackName),
		sanitizeFilename(pkg.Session.SessionType),
		pkg.Session.CreatedAt.Format("2006-01-02"),
	)

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(compressed)))
	w.WriteHeader(http.StatusOK)
	w.Write(compressed)
}

func (s *Server) handleImportSession(w http.ResponseWriter, r *http.Request) {
	// Limit request size to MaxImportPayloadSize
	r.Body = http.MaxBytesReader(w, r.Body, MaxImportPayloadSize)

	var data []byte
	var err error

	// Check if multipart form
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		err := r.ParseMultipartForm(MaxImportPayloadSize)
		if err != nil {
			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "File is required", http.StatusBadRequest)
			return
		}
		defer file.Close()
		data, err = io.ReadAll(file)
		if err != nil {
			http.Error(w, "Failed to read uploaded file", http.StatusBadRequest)
			return
		}
	} else {
		data, err = io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
	}

	if len(data) == 0 {
		http.Error(w, "Empty file payload", http.StatusBadRequest)
		return
	}

	// Decompress if zstd compressed
	if bytes.HasPrefix(data, ZstdMagicHeader) {
		decompressed, err := storage.DecompressRaw(data)
		if err != nil {
			http.Error(w, "Failed to decompress .f1session file", http.StatusBadRequest)
			return
		}
		data = decompressed
	}

	var pkg storage.ExportedSessionPackage
	if err := json.Unmarshal(data, &pkg); err != nil {
		log.Printf("Error unmarshaling import session: %v", err)
		http.Error(w, "Invalid session package format", http.StatusBadRequest)
		return
	}

	newSessionID, err := s.repo.ImportSession(r.Context(), &pkg)
	if err != nil {
		log.Printf("Error importing session: %v", err)
		http.Error(w, fmt.Sprintf("Failed to import session: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"status":     "success",
		"session_id": newSessionID,
	})
}
