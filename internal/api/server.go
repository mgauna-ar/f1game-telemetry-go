package api

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/mgauna/f1game-telemetry-go/frontend"
	"github.com/mgauna/f1game-telemetry-go/internal/analytics"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// ServerConfig holds the runtime configuration parameters for the API server.
type ServerConfig struct {
	GeminiAPIKey string
	OpenAIAPIKey string
	ClaudeAPIKey string
	LLMModel     string
	LLMProvider  string
	// UDPAddr is the address the telemetry listener is bound to, shown to users setting up the game.
	UDPAddr string
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
	inputMu         sync.Mutex
	inputCancel     context.CancelFunc
	pttMu           sync.Mutex
	isLearning      bool
	pttLearnTimeout time.Duration
	settingsMu      sync.Mutex
	staticFS        fs.FS
	comparatorCache *analytics.ComparatorLRUCache
}

// MaxJSONBodyBytes caps JSON request bodies on the API routes. Session import has its own,
// larger limit (MaxImportPayloadSize).
const MaxJSONBodyBytes = 2 << 20

// upgrader keeps gorilla's default origin check: a handshake is accepted when its Origin host
// equals the request's Host (the dashboard opened by localhost or LAN address, or through the Vite
// dev proxy, which keeps the browser's Host) or when it sends no Origin (non-browser clients).
// Other websites open in the same browser cannot read the telemetry or radio streams.
var upgrader = websocket.Upgrader{}

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
		pttLearnTimeout: PTTLearningTimeout,
	}

	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	// The API is for the dashboard this server hosts. Other websites open in the same browser must
	// not change settings or spend the saved AI keys, so cross-site writes are rejected and no CORS
	// headers are sent. Cross-site WebSocket reads are rejected by the upgrader's origin check.
	s.router.Use(http.NewCrossOriginProtection().Handler)

	s.routes()

	return s
}

// SetEngineerEngine attaches the EngineerEngine instance to the API server and applies the saved
// race engineer settings, if any.
func (s *Server) SetEngineerEngine(engine *engineer.EngineerEngine) {
	s.engineerEngine = engine
	if s.repo == nil || engine == nil {
		return
	}
	saved, ok, err := settings.LoadEngineer(context.Background(), s.repo)
	if err != nil {
		slog.Error("Failed to load race engineer settings, using defaults", "error", err)
		return
	}
	if ok {
		engine.SetConfig(saved.EngineConfig())
	}
}

// SetInputManager configures the global input manager and forwards PTT state events to engineerHub.
func (s *Server) SetInputManager(mgr input.Manager) {
	s.inputMu.Lock()
	defer s.inputMu.Unlock()

	if s.inputCancel != nil {
		s.inputCancel()
		s.inputCancel = nil
	}

	s.inputManager = mgr
	s.restorePTTSettings(context.Background(), mgr)
	if mgr != nil && s.engineerHub != nil {
		ctx, cancel := context.WithCancel(context.Background())
		s.inputCancel = cancel
		events := mgr.Events()

		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case evt, ok := <-events:
					if !ok {
						return
					}
					s.broadcastEngineer(newPTTEventMessage(evt))
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
		// Session import reads up to MaxImportPayloadSize itself, so it sits outside the JSON limit.
		r.Post("/sessions/import", s.handleImportSession)

		r.Group(func(r chi.Router) {
			r.Use(limitJSONBody)
			s.setupSessionRoutes(r)
			s.setupComparatorRoutes(r)
			s.setupAIRoutes(r)
			s.setupPTTRoutes(r)
			s.setupSettingsRoutes(r)
			s.setupSystemRoutes(r)
		})
	})

	s.setupStaticRoutes()
}

// limitJSONBody makes reading more than MaxJSONBodyBytes of a request body fail, so decoding an
// oversized payload is answered with 400 instead of being buffered.
func limitJSONBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, MaxJSONBodyBytes)
		next.ServeHTTP(w, r)
	})
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
	r.Get("/sessions/{id}/detail", s.handleGetSessionDetail)
	r.Get("/sessions/{id}/export", s.handleExportSession)
	r.Post("/sessions/export-batch", s.handleExportSessionBatch)
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
	r.Post("/ai/models", s.handleAIFetchModels)
	r.Post("/ai/tts", s.handleAITTS)
	r.Get("/ai/engineer/race-context", s.handleRaceContext)
}

func (s *Server) setupPTTRoutes(r chi.Router) {
	// Global Push-to-Talk (PTT) routes
	r.Get("/ai/ptt/config", s.handleGetPTTConfig)
	r.Post("/ai/ptt/learn", s.handleStartPTTLearn)
	r.Post("/ai/ptt/learn/cancel", s.handleCancelPTTLearn)
}

func (s *Server) setupSystemRoutes(r chi.Router) {
	r.Get("/system/version", s.handleGetSystemVersion)
	r.Get("/system/check-updates", s.handleCheckUpdates)
	r.Get("/system/network", s.handleGetSystemNetwork)
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
					w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", SecondsPerYear))
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

		writeJSONError(w, "f1 telemetry dashboard not found. build the frontend with 'npm run build' inside frontend/ directory.", http.StatusNotFound)
	})
}
