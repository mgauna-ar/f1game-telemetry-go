package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/mgauna/f1game-telemetry-go/frontend"
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
	// ZipMagicHeader represents the 4-byte magic header for standard ZIP archives (PK\x03\x04).
	ZipMagicHeader = []byte{0x50, 0x4B, 0x03, 0x04}
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
		r.Post("/sessions/batch-delete", s.handleBatchDeleteSessions)
		r.Get("/sessions/{id}/participants", s.handleGetParticipants)
		r.Get("/sessions/{id}/laps", s.handleGetLaps)
		r.Get("/sessions/{id}/export", s.handleExportSession)
		r.Post("/sessions/export-batch", s.handleExportSessionBatch)
		r.Get("/sessions/export-batch", s.handleExportSessionBatch)
		r.Post("/sessions/import", s.handleImportSession)
		r.Post("/sessions/batch-tags", s.handleBatchAssignTags)
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

		// System & Version Updates routes
		r.Get("/system/version", s.handleGetSystemVersion)
		r.Get("/system/check-updates", s.handleCheckUpdates)
	})

	// Serve static files from embedded frontend with SPA fallback
	distFS := frontend.DistFS()
	fileServer := http.FileServer(http.FS(distFS))

	s.router.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		reqPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		// 1. Try opening requested path in embedded filesystem
		if f, err := distFS.Open(reqPath); err == nil {
			stat, statErr := f.Stat()
			f.Close()
			if statErr == nil && !stat.IsDir() {
				if strings.HasPrefix(reqPath, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// 2. Try disk fallback (useful during active frontend development)
		diskPath := filepath.Join("./frontend/dist", filepath.FromSlash(reqPath))
		if stat, err := os.Stat(diskPath); err == nil && !stat.IsDir() {
			http.ServeFile(w, r, diskPath)
			return
		}

		// 3. SPA Fallback: Serve embedded index.html
		if indexData, err := fs.ReadFile(distFS, "index.html"); err == nil && len(indexData) > 0 {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(indexData)
			return
		}

		// 4. Disk index.html fallback
		if _, err := os.Stat("./frontend/dist/index.html"); err == nil {
			http.ServeFile(w, r, "./frontend/dist/index.html")
			return
		}

		http.Error(w, "F1 Telemetry Dashboard not found. Build the frontend with 'npm run build' inside frontend/ directory.", http.StatusNotFound)
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

// ExportBatchRequest defines the payload for batch session export.
type ExportBatchRequest struct {
	SessionIDs []int64 `json:"session_ids"`
}

func (s *Server) handleExportSessionBatch(w http.ResponseWriter, r *http.Request) {
	var sessionIDs []int64

	if r.Method == http.MethodPost && strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		var req ExportBatchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			sessionIDs = req.SessionIDs
		}
	}

	if len(sessionIDs) == 0 {
		idsParam := r.URL.Query().Get("ids")
		if idsParam == "" {
			idsParam = r.URL.Query().Get("session_ids")
		}
		if idsParam != "" {
			parts := strings.Split(idsParam, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if id, err := strconv.ParseInt(p, 10, 64); err == nil {
					sessionIDs = append(sessionIDs, id)
				}
			}
		}
	}

	if len(sessionIDs) == 0 {
		http.Error(w, "No session IDs provided for export", http.StatusBadRequest)
		return
	}

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	exportedCount := 0
	for _, id := range sessionIDs {
		pkg, err := s.repo.ExportSession(r.Context(), id)
		if err != nil {
			log.Printf("ExportBatch: skipping session %d: %v", id, err)
			continue
		}

		rawJSON, err := json.Marshal(pkg)
		if err != nil {
			log.Printf("ExportBatch: failed to marshal session %d: %v", id, err)
			continue
		}

		compressed := storage.CompressRaw(rawJSON)
		entryName := fmt.Sprintf("%s_%s_%s_%d.f1session",
			sanitizeFilename(pkg.Session.TrackName),
			sanitizeFilename(pkg.Session.SessionType),
			pkg.Session.CreatedAt.Format("2006-01-02"),
			pkg.Session.ID,
		)

		fWriter, err := zipWriter.Create(entryName)
		if err != nil {
			log.Printf("ExportBatch: failed to create zip entry for session %d: %v", id, err)
			continue
		}

		if _, err := fWriter.Write(compressed); err != nil {
			log.Printf("ExportBatch: failed to write zip entry for session %d: %v", id, err)
			continue
		}
		exportedCount++
	}

	if err := zipWriter.Close(); err != nil {
		http.Error(w, "Failed to build zip archive", http.StatusInternalServerError)
		return
	}

	if exportedCount == 0 {
		http.Error(w, "No valid sessions found to export", http.StatusNotFound)
		return
	}

	zipBytes := buf.Bytes()
	filename := fmt.Sprintf("f1_sessions_export_%s.zip", time.Now().Format("2006-01-02"))

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(zipBytes)))
	w.WriteHeader(http.StatusOK)
	w.Write(zipBytes)
}

// ImportDetail represents the outcome for a single imported session file.
type ImportDetail struct {
	Filename  string `json:"filename,omitempty"`
	Status    string `json:"status"` // "imported", "skipped", "failed"
	SessionID int64  `json:"session_id,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

// ImportBatchResponse represents the outcome summary for batch or single session import.
type ImportBatchResponse struct {
	Status     string         `json:"status"`
	Total      int            `json:"total"`
	Imported   int            `json:"imported"`
	Skipped    int            `json:"skipped"`
	Failed     int            `json:"failed"`
	SessionIDs []int64        `json:"session_ids"`
	SessionID  int64          `json:"session_id,omitempty"`
	Details    []ImportDetail `json:"details"`
}

func parseSessionPackage(data []byte) (*storage.ExportedSessionPackage, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty session payload")
	}
	if bytes.HasPrefix(data, ZstdMagicHeader) {
		decompressed, err := storage.DecompressRaw(data)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress .f1session file: %w", err)
		}
		data = decompressed
	}
	var pkg storage.ExportedSessionPackage
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("invalid session package format: %w", err)
	}
	return &pkg, nil
}

func (s *Server) handleImportSession(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxImportPayloadSize)

	type fileItem struct {
		name string
		data []byte
	}
	var items []fileItem

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(MaxImportPayloadSize); err != nil {
			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}
		if r.MultipartForm != nil && r.MultipartForm.File != nil {
			for _, fileHeaders := range r.MultipartForm.File {
				for _, fh := range fileHeaders {
					file, err := fh.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(file)
					file.Close()
					if err != nil || len(data) == 0 {
						continue
					}
					items = append(items, fileItem{name: fh.Filename, data: data})
				}
			}
		}
	} else {
		data, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		if len(data) > 0 {
			items = append(items, fileItem{name: "upload.f1session", data: data})
		}
	}

	if len(items) == 0 {
		http.Error(w, "Empty file payload", http.StatusBadRequest)
		return
	}

	// Expand any ZIP files into individual .f1session items
	var sessionFiles []fileItem
	for _, item := range items {
		if bytes.HasPrefix(item.data, ZipMagicHeader) || strings.HasSuffix(strings.ToLower(item.name), ".zip") {
			zr, err := zip.NewReader(bytes.NewReader(item.data), int64(len(item.data)))
			if err != nil {
				log.Printf("Error opening zip archive %s: %v", item.name, err)
				continue
			}
			for _, zf := range zr.File {
				if zf.FileInfo().IsDir() {
					continue
				}
				if !strings.HasSuffix(strings.ToLower(zf.Name), ".f1session") && !strings.HasSuffix(strings.ToLower(zf.Name), ".json") {
					continue
				}
				rc, err := zf.Open()
				if err != nil {
					continue
				}
				zData, err := io.ReadAll(rc)
				rc.Close()
				if err == nil && len(zData) > 0 {
					sessionFiles = append(sessionFiles, fileItem{name: zf.Name, data: zData})
				}
			}
		} else {
			sessionFiles = append(sessionFiles, item)
		}
	}

	if len(sessionFiles) == 0 {
		http.Error(w, "No valid session files found in payload", http.StatusBadRequest)
		return
	}

	resp := ImportBatchResponse{
		Status:     "success",
		Total:      len(sessionFiles),
		SessionIDs: make([]int64, 0),
		Details:    make([]ImportDetail, 0, len(sessionFiles)),
	}

	for _, sf := range sessionFiles {
		pkg, err := parseSessionPackage(sf.data)
		if err != nil {
			resp.Failed++
			resp.Details = append(resp.Details, ImportDetail{
				Filename: sf.name,
				Status:   "failed",
				Reason:   err.Error(),
			})
			continue
		}

		newID, err := s.repo.ImportSession(r.Context(), pkg)
		if err != nil {
			if errors.Is(err, storage.ErrSessionAlreadyExists) {
				resp.Skipped++
				resp.Details = append(resp.Details, ImportDetail{
					Filename:  sf.name,
					Status:    "skipped",
					SessionID: newID,
					Reason:    "Session already exists",
				})
			} else {
				resp.Failed++
				resp.Details = append(resp.Details, ImportDetail{
					Filename: sf.name,
					Status:   "failed",
					Reason:   err.Error(),
				})
			}
			continue
		}

		resp.Imported++
		resp.SessionIDs = append(resp.SessionIDs, newID)
		resp.Details = append(resp.Details, ImportDetail{
			Filename:  sf.name,
			Status:    "imported",
			SessionID: newID,
		})
	}

	if len(resp.SessionIDs) > 0 {
		resp.SessionID = resp.SessionIDs[0]
	}

	w.Header().Set("Content-Type", "application/json")
	if resp.Total == 1 && resp.Imported == 1 {
		w.WriteHeader(http.StatusCreated)
	} else if resp.Imported > 0 {
		w.WriteHeader(http.StatusOK)
	} else if resp.Skipped > 0 {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusBadRequest)
	}
	json.NewEncoder(w).Encode(resp)
}

// BatchDeleteRequest defines payload for deleting multiple sessions.
type BatchDeleteRequest struct {
	SessionIDs []int64 `json:"session_ids"`
}

func (s *Server) handleBatchDeleteSessions(w http.ResponseWriter, r *http.Request) {
	var req BatchDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if len(req.SessionIDs) == 0 {
		http.Error(w, "No session IDs specified for deletion", http.StatusBadRequest)
		return
	}

	deletedCount, err := s.repo.DeleteSessions(r.Context(), req.SessionIDs)
	if err != nil {
		log.Printf("Error deleting sessions batch: %v", err)
		http.Error(w, "Failed to delete sessions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"status":        "success",
		"deleted_count": deletedCount,
	})
}

// BatchTagsRequest defines payload for assigning a tag to multiple sessions.
type BatchTagsRequest struct {
	SessionIDs []int64 `json:"session_ids"`
	TagID      int64   `json:"tag_id"`
}

func (s *Server) handleBatchAssignTags(w http.ResponseWriter, r *http.Request) {
	var req BatchTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if len(req.SessionIDs) == 0 || req.TagID <= 0 {
		http.Error(w, "Session IDs and valid Tag ID are required", http.StatusBadRequest)
		return
	}

	if err := s.repo.AddTagToSessions(r.Context(), req.SessionIDs, req.TagID); err != nil {
		log.Printf("Error assigning tag %d to sessions: %v", req.TagID, err)
		http.Error(w, "Failed to assign tags to sessions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"status": "success",
	})
}
