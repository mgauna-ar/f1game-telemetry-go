package api

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/mgauna/f1game-telemetry-go/frontend"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// ServerConfig holds the runtime configuration parameters for the API server.
type ServerConfig struct {
	GeminiAPIKey string
	OpenAIAPIKey string
	LLMModel     string
	LLMProvider  string
}

// Server handles HTTP requests for the API and serves the frontend.
type Server struct {
	config          ServerConfig
	router          *chi.Mux
	repo            storage.Repository
	telemetryHub    *Hub
	engineerHub     *Hub
	engineerEngine  *engineer.EngineerEngine
	inputManager    input.Manager
	staticFS        fs.FS
	comparatorCache *analytics.ComparatorLRUCache
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local dev
	},
}

// NewServer creates a new API server with the default embedded frontend filesystem.
func NewServer(repo storage.Repository, telemetryHub, engineerHub *Hub, config ServerConfig) *Server {
	return NewServerWithFS(repo, telemetryHub, engineerHub, frontend.DistFS(), config)
}

// NewServerWithFS creates a new API server with a custom static filesystem (useful for testing).
func NewServerWithFS(repo storage.Repository, telemetryHub, engineerHub *Hub, staticFS fs.FS, config ServerConfig) *Server {
	s := &Server{
		config:          config,
		router:          chi.NewRouter(),
		repo:            repo,
		telemetryHub:    telemetryHub,
		engineerHub:     engineerHub,
		staticFS:        staticFS,
		comparatorCache: analytics.NewComparatorLRUCache(analytics.ComparatorCacheCapacity),
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

// SetEngineerEngine attaches the EngineerEngine instance to the API server and restores persisted settings if available.
func (s *Server) SetEngineerEngine(engine *engineer.EngineerEngine) {
	s.engineerEngine = engine
	if s.repo != nil && engine != nil {
		if cfg, err := engineer.LoadEngineerConfig(context.Background(), s.repo); err == nil && cfg != nil {
			engine.SetConfig(*cfg)
		}
	}
}

// SetInputManager configures the global input manager and forwards PTT state events to engineerHub.
func (s *Server) SetInputManager(mgr input.Manager) {
	s.inputManager = mgr
	if mgr != nil && s.engineerHub != nil {
		go func() {
			for evt := range mgr.Events() {
				payload, err := json.Marshal(map[string]any{
					"type":      "ptt_event",
					"state":     evt.State,
					"mapping":   evt.Mapping,
					"timestamp": evt.Timestamp,
				})
				if err == nil && s.engineerHub != nil {
					s.engineerHub.Broadcast(payload)
				}
			}
		}()
	}
}

// Router returns the underlying Chi router.
func (s *Server) Router() *chi.Mux {
	return s.router
}

func (s *Server) routes() {
	s.setupWebSocketRoutes()

	// API routes
	s.router.Route("/api", func(r chi.Router) {
		s.setupSessionRoutes(r)
		s.setupComparatorRoutes(r)
		s.setupAIRoutes(r)
		s.setupPTTRoutes(r)
		s.setupSystemRoutes(r)
	})

	s.setupStaticRoutes()
}

func (s *Server) setupWebSocketRoutes() {
	s.router.Get("/ws", s.handleWebSocket)
	s.router.Get("/ws/engineer", s.handleEngineerWebSocket)
}

func (s *Server) setupSessionRoutes(r chi.Router) {
	// Session routes
	r.Get("/sessions", s.handleGetSessions)
	r.Delete("/sessions/{id}", s.handleDeleteSession)
	r.Post("/sessions/batch-delete", s.handleBatchDeleteSessions)
	r.Get("/sessions/{id}/participants", s.handleGetParticipants)
	r.Get("/sessions/{id}/laps", s.handleGetLaps)
	r.Get("/sessions/{id}/classification", s.handleGetSessionClassification)
	r.Get("/sessions/{id}/progression", s.handleGetSessionProgression)
	r.Get("/sessions/{id}/stints", s.handleGetSessionStints)
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
}

func (s *Server) setupComparatorRoutes(r chi.Router) {
	r.Get("/comparator/merge", s.handleComparatorMerge)
}

func (s *Server) setupAIRoutes(r chi.Router) {
	// AI Race Engineer routes
	r.Post("/ai/chat", s.handleAIChat)
	r.Get("/ai/config-status", s.handleAIConfigStatus)
	r.Post("/ai/models", s.handleAIFetchModels)
	r.Post("/ai/tts", s.handleAITTS)
	r.Get("/ai/engineer/config", s.handleGetEngineerConfig)
	r.Post("/ai/engineer/config", s.handleSetEngineerConfig)
}

func (s *Server) setupPTTRoutes(r chi.Router) {
	// Global Push-to-Talk (PTT) routes
	r.Get("/ai/ptt/config", s.handleGetPTTConfig)
	r.Post("/ai/ptt/config", s.handleSetPTTConfig)
	r.Post("/ai/ptt/learn", s.handleStartPTTLearn)
	r.Post("/ai/ptt/learn/cancel", s.handleCancelPTTLearn)
}

func (s *Server) setupSystemRoutes(r chi.Router) {
	r.Get("/system/version", s.handleGetSystemVersion)
	r.Get("/system/check-updates", s.handleCheckUpdates)
}

func (s *Server) setupStaticRoutes() {
	// Serve static files from embedded frontend (or custom staticFS) with SPA fallback
	var distFS fs.FS
	if s.staticFS != nil {
		distFS = s.staticFS
	} else {
		distFS = frontend.DistFS()
	}
	fileServer := http.FileServer(http.FS(distFS))

	s.router.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		reqPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		// 1. Try opening requested path in static filesystem
		if f, err := distFS.Open(reqPath); err == nil {
			stat, statErr := f.Stat()
			_ = f.Close()
			if statErr == nil && !stat.IsDir() {
				if strings.HasPrefix(reqPath, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// 2. Try disk fallback (useful during active frontend development)
		diskPath := filepath.Join("frontend", "dist", filepath.FromSlash(reqPath))
		if stat, err := os.Stat(diskPath); err == nil && !stat.IsDir() {
			http.ServeFile(w, r, diskPath)
			return
		}

		// 3. SPA Fallback: Serve embedded/mock index.html
		if indexData, err := fs.ReadFile(distFS, "index.html"); err == nil && len(indexData) > 0 {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(indexData)
			return
		}

		// 4. Disk index.html fallback
		if _, err := os.Stat("./frontend/dist/index.html"); err == nil {
			http.ServeFile(w, r, "./frontend/dist/index.html")
			return
		}

		writeJSONError(w, "F1 Telemetry Dashboard not found. Build the frontend with 'npm run build' inside frontend/ directory.", http.StatusNotFound)
	})
}
