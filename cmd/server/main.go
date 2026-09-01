package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/api"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
	"github.com/mgauna/f1game-telemetry-go/internal/system"
	"github.com/mgauna/f1game-telemetry-go/internal/udp"
)

// Build-time variables injected via ldflags during release build
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

const (
	defaultUDPAddr  = "0.0.0.0:20777"
	defaultHTTPAddr = ":8080"
	defaultDBPath   = "f1telemetry.db"
)

// ServerConfig holds the runtime configuration parameters for the server.
type ServerConfig struct {
	UDPAddr      string
	HTTPAddr     string
	DBPath       string
	NoBrowser    bool
	ShowVersion  bool
	GeminiAPIKey string
	OpenAIAPIKey string
	LLMModel     string
	LLMProvider  string
}

// loadServerConfig parses CLI flags and environment variable fallbacks.
func loadServerConfig() ServerConfig {
	udpFlag := flag.String("udp", getEnv("F1T_UDP_ADDR", defaultUDPAddr), "UDP listen address for F1 telemetry packets")
	httpFlag := flag.String("http", getEnv("F1T_HTTP_ADDR", defaultHTTPAddr), "HTTP server address for Web Dashboard and API")
	dbFlag := flag.String("db", getEnv("F1T_DB_PATH", defaultDBPath), "Path to SQLite database file")
	noBrowserFlag := flag.Bool("no-browser", getEnvBool("F1T_NO_BROWSER", false), "Do not automatically launch web browser on startup")
	versionFlag := flag.Bool("version", false, "Print version information and exit")
	flag.Parse()

	return ServerConfig{
		UDPAddr:      *udpFlag,
		HTTPAddr:     *httpFlag,
		DBPath:       *dbFlag,
		NoBrowser:    *noBrowserFlag,
		ShowVersion:  *versionFlag,
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		OpenAIAPIKey: getEnv("OPENAI_API_KEY", ""),
		LLMModel:     getEnv("LLM_MODEL", ""),
		LLMProvider:  getEnv("LLM_PROVIDER", ""),
	}
}

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg := loadServerConfig()

	if cfg.ShowVersion {
		fmt.Printf("F1 Telemetry Analyzer %s (commit: %s, built: %s)\n", version, commit, date)
		os.Exit(0)
	}

	if err := run(cfg); err != nil {
		slog.Error("Fatal application error", "error", err)
		os.Exit(1)
	}
}

func run(cfg ServerConfig) error {
	api.SetAppVersion(version, commit, date)

	// Calculate display URLs
	port := extractPort(cfg.HTTPAddr, "8080")
	localURL := fmt.Sprintf("http://localhost:%s", port)
	lanIP := system.GetLocalIP()
	lanURL := fmt.Sprintf("http://%s:%s", lanIP, port)

	printStartupBanner(version, commit, localURL, lanURL, cfg.UDPAddr, cfg.DBPath)

	// 1. Initialize Database
	repo, err := initDatabase(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("failed to initialize database on %s: %w", cfg.DBPath, err)
	}
	defer repo.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 2. Setup WebSocket Hubs
	telemetryHub := api.NewHub("Telemetry")
	go telemetryHub.Run()

	engineerHub := api.NewHub("Engineer")
	go engineerHub.Run()

	// 3. Setup Input Manager & Engineer Engine
	inputMgr := input.NewManager()
	inputMgr.Start(ctx)

	engineerEngine := engineer.NewEngineerEngine(engineerHub, repo)

	// 4. Initialize HTTP Server with bound TCP listener
	ln, srv, err := initHTTPServer(cfg, repo, telemetryHub, engineerHub, inputMgr, engineerEngine)
	if err != nil {
		return fmt.Errorf("failed to bind HTTP server on %s: %w", cfg.HTTPAddr, err)
	}

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()

	// 5. Auto-launch browser if not disabled (port is guaranteed bound)
	if !cfg.NoBrowser {
		go func() {
			if err := system.OpenBrowser(localURL); err != nil {
				slog.Warn("Could not automatically open browser", "url", localURL, "error", err)
			}
		}()
	}

	// 6. Setup Session Manager and Live Broadcaster
	sessionManager := session.NewSessionManager(repo)
	sessionManager.Start(ctx)

	liveBroadcaster := session.NewLiveBroadcaster(telemetryHub)
	liveBroadcaster.Start(ctx, 100*time.Millisecond)

	// 7. Setup UDP Listener
	listener, err := initUDPListener(ctx, cfg.UDPAddr)
	if err != nil {
		return fmt.Errorf("failed to bind UDP listener on %s: %w", cfg.UDPAddr, err)
	}

	// 8. Start Packet Processing Loop
	startPacketProcessing(ctx, listener, sessionManager, engineerEngine, liveBroadcaster, cfg.UDPAddr)

	// 9. Wait for termination signal and handle graceful shutdown
	runGracefulShutdown(cancel, inputMgr, sessionManager, srv)
	return nil
}

func initDatabase(dbPath string) (storage.Repository, error) {
	return storage.NewSQLiteRepository(dbPath)
}

func initHTTPServer(
	cfg ServerConfig,
	repo storage.Repository,
	telemetryHub, engineerHub *api.Hub,
	inputMgr input.Manager,
	engineerEngine *engineer.EngineerEngine,
) (net.Listener, *http.Server, error) {
	apiConfig := api.ServerConfig{
		GeminiAPIKey: cfg.GeminiAPIKey,
		OpenAIAPIKey: cfg.OpenAIAPIKey,
		LLMModel:     cfg.LLMModel,
		LLMProvider:  cfg.LLMProvider,
	}

	apiServer := api.NewServer(repo, telemetryHub, engineerHub, apiConfig)
	apiServer.SetInputManager(inputMgr)
	apiServer.SetEngineerEngine(engineerEngine)

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: apiServer.Router(),
	}

	ln, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return nil, nil, err
	}

	return ln, srv, nil
}

func initUDPListener(ctx context.Context, udpAddr string) (*udp.Listener, error) {
	listener := udp.NewListener(udpAddr, udp.DefaultBufferSize)
	go func() {
		if err := listener.Listen(ctx); err != nil {
			slog.Error("UDP listener error", "addr", udpAddr, "error", err)
		}
	}()
	<-listener.Ready() // Wait for socket to bind
	return listener, nil
}

func startPacketProcessing(
	ctx context.Context,
	listener *udp.Listener,
	sessionManager *session.SessionManager,
	engineerEngine *engineer.EngineerEngine,
	liveBroadcaster *session.LiveBroadcaster,
	udpAddr string,
) {
	go func() {
		slog.Info("Ready to receive telemetry", "udpAddr", udpAddr, "format", "F1 2025/2026")
		for {
			select {
			case <-ctx.Done():
				return
			case rawPkt, ok := <-listener.Packets():
				if !ok {
					return
				}
				pkt, err := packets.Decode(rawPkt.Data)
				if err != nil {
					continue
				}

				sessionManager.ProcessPacket(ctx, pkt)
				engineerEngine.ProcessPacket(ctx, pkt)
				liveBroadcaster.ProcessPacket(pkt)
			}
		}
	}()
}

func runGracefulShutdown(
	cancel context.CancelFunc,
	inputMgr input.Manager,
	sessionManager *session.SessionManager,
	srv *http.Server,
) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println()
	slog.Info("Shutting down F1 Telemetry Analyzer...")

	cancel() // Stop UDP listener and packet loop
	inputMgr.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	// Flush remaining in-flight telemetry batches
	sessionManager.Close(shutdownCtx)

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("Shutdown complete. See you on track!")
}

func printStartupBanner(ver, cmt, localURL, lanURL, udpAddr, dbPath string) {
	fmt.Println()
	fmt.Println("  ========================================================")
	fmt.Println("  🏎️   F1 TELEMETRY ANALYZER  -  Official Telemetry Hub")
	fmt.Printf("      Version: %s (%s)\n", ver, cmt)
	fmt.Println("  ========================================================")
	fmt.Println()
	fmt.Println("  🌐  DASHBOARD ACCESS:")
	fmt.Printf("      Local Browser:   %s\n", localURL)
	fmt.Printf("      Network/Tablet:  %s\n", lanURL)
	fmt.Println()
	fmt.Println("  🎮  IN-GAME TELEMETRY SETTINGS (F1 2025 / 2026):")
	fmt.Println("      1. Options -> Game Options -> Settings -> Telemetry Settings")
	fmt.Println("      2. UDP Telemetry:         ON")
	fmt.Printf("      3. UDP IP Address:        127.0.0.1 (or %s for consoles)\n", system.GetLocalIP())
	fmt.Printf("      4. UDP Port:              %s\n", extractPort(udpAddr, "20777"))
	fmt.Println("      5. UDP Send Rate:         20Hz (or 30Hz / 60Hz)")
	fmt.Println("      6. UDP Format:            2026 (or 2025)")
	fmt.Println()
	fmt.Printf("  📁  Database: %s\n", dbPath)
	fmt.Println("  🛑  Press Ctrl+C at any time to stop.")
	fmt.Println("  ========================================================")
	fmt.Println()
}

func extractPort(addr, fallback string) string {
	if strings.Contains(addr, ":") {
		_, port, err := net.SplitHostPort(addr)
		if err == nil && port != "" {
			return port
		}
		parts := strings.Split(addr, ":")
		if len(parts) > 1 && parts[len(parts)-1] != "" {
			return parts[len(parts)-1]
		}
	}
	return fallback
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if value, ok := os.LookupEnv(key); ok {
		lower := strings.ToLower(strings.TrimSpace(value))
		return lower == "true" || lower == "1" || lower == "yes"
	}
	return fallback
}
