package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"math"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/api"
	"github.com/mgauna/f1game-telemetry-go/internal/desktop"
	"github.com/mgauna/f1game-telemetry-go/internal/engineer"
	"github.com/mgauna/f1game-telemetry-go/internal/input"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/settings"
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
	defaultUDPAddr           = "0.0.0.0:20777"
	defaultHTTPAddr          = ":8080"
	defaultDBPath            = "f1telemetry.db"
	defaultUDPStartupTimeout = 5 * time.Second
)

// ServerConfig holds the runtime configuration parameters for the server.
type ServerConfig struct {
	UDPAddr      string
	HTTPAddr     string
	DBPath       string
	OpenBrowser  bool
	NoTray       bool
	Autostart    bool
	ShowVersion  bool
	GeminiAPIKey string
	OpenAIAPIKey string
	ClaudeAPIKey string
	LLMModel     string
	LLMProvider  string
}

// loadServerConfig parses CLI flags, falling back to environment variables (including any loaded
// from a .env file) and then to built-in defaults.
func loadServerConfig() ServerConfig {
	udpFlag := flag.String("udp", getEnv("F1T_UDP_ADDR", defaultUDPAddr), "UDP listen address for F1 telemetry packets")
	httpFlag := flag.String("http", getEnv("F1T_HTTP_ADDR", defaultHTTPAddr), "HTTP server address for Web Dashboard and API")
	dbFlag := flag.String(flagDB, getEnv("F1T_DB_PATH", defaultDBPath), "Path to SQLite database file")
	openBrowserFlag := flag.Bool(flagOpenBrowser, getEnvBool("F1T_OPEN_BROWSER", false), "Open the dashboard in the browser on startup")
	// Kept so older scripts and shortcuts passing it still start: not opening is now the default
	flag.Bool(flagNoBrowser, false, "Deprecated: the browser no longer opens on startup unless -open-browser is set")
	noTrayFlag := flag.Bool("no-tray", getEnvBool("F1T_NO_TRAY", false), "Windows: run without the notification-area icon")
	autostartFlag := flag.Bool(flagAutostart, false, "Set by Start with Windows: start without the startup notification")
	versionFlag := flag.Bool(flagVersion, false, "Print version information and exit")
	flag.Parse()

	return ServerConfig{
		UDPAddr:      *udpFlag,
		HTTPAddr:     *httpFlag,
		DBPath:       *dbFlag,
		OpenBrowser:  *openBrowserFlag,
		NoTray:       *noTrayFlag,
		Autostart:    *autostartFlag,
		ShowVersion:  *versionFlag,
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		OpenAIAPIKey: getEnv("OPENAI_API_KEY", ""),
		ClaudeAPIKey: getEnv("ANTHROPIC_API_KEY", ""),
		LLMModel:     getEnv("LLM_MODEL", ""),
		LLMProvider:  llmProviderFromEnv(getEnv("LLM_PROVIDER", "")),
	}
}

// llmProviderFromEnv normalizes LLM_PROVIDER, dropping a value no chat provider matches so the
// default provider is picked from the API keys instead.
func llmProviderFromEnv(raw string) string {
	provider := settings.NormalizeProvider(raw)
	if provider == "" || settings.IsProvider(provider) {
		return provider
	}
	slog.Warn("Ignoring unknown LLM_PROVIDER", "value", raw, "known", strings.Join(settings.Providers, ", "))
	return ""
}

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})))

	// Must run before loadServerConfig, which reads the environment for flag defaults. They are
	// logged once logging is set up, which may be to a file.
	envFiles := loadDotEnv(dotEnvPaths()...)

	cfg := loadServerConfig()

	if cfg.ShowVersion {
		fmt.Printf("F1 Telemetry Analyzer %s (commit: %s, built: %s)\n", version, commit, date)
		os.Exit(0)
	}

	if err := run(cfg, envFiles); err != nil {
		fatal(err)
	}
}

// fatal logs err and exits. A build without a console (the Windows release) shows it in a dialog
// too, since nobody would see the log otherwise.
func fatal(err error) {
	slog.Error("Fatal application error", "error", err)
	if !desktop.HasConsole() {
		desktop.ShowError(err.Error())
	}
	os.Exit(1)
}

func run(cfg ServerConfig, envFiles []string) error {
	system.SetAppVersion(version, commit, date)

	// Calculate display URLs
	port := extractPort(cfg.HTTPAddr, "8080")
	localURL := fmt.Sprintf("http://localhost:%s", port)
	lanIP := system.GetLocalIP()
	lanURL := fmt.Sprintf("http://%s:%s", lanIP, port)
	dbPath := absolutePath(cfg.DBPath)
	tray := desktop.Supported() && !cfg.NoTray

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Bind the HTTP port first: when this app already runs there, open it instead of starting
	// a second copy (before touching the database or the running copy's log file)
	ln, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return openRunningInstance(ctx, localURL, port, cfg.OpenBrowser, err)
	}

	logPath, closeLog := setupLogging(dbPath, tray || !desktop.HasConsole(), desktop.HasConsole())
	defer closeLog()
	for _, path := range envFiles {
		slog.Info("Loaded settings from .env file", "path", path)
	}

	printStartupBanner(version, commit, localURL, lanURL, cfg.UDPAddr, dbPath, tray)
	slog.Info("Starting F1 Telemetry Analyzer", "version", version, "dashboard", localURL, "network", lanURL,
		"udpAddr", cfg.UDPAddr, "db", dbPath, "log", logPath)

	// 2. Initialize Database
	repo, err := initDatabase(cfg.DBPath)
	if err != nil {
		_ = ln.Close()
		return fmt.Errorf("failed to initialize database on %s: %w", dbPath, err)
	}
	defer repo.Close()

	// 3. Setup WebSocket Hubs
	telemetryHub := api.NewHub("Telemetry")
	go telemetryHub.Run(ctx)

	engineerHub := api.NewHub("Engineer")
	go engineerHub.Run(ctx)

	// 4. Setup Input Manager & Engineer Engine
	inputMgr := input.NewManager()
	inputMgr.Start(ctx)

	engineerEngine := engineer.NewEngineerEngine(engineerHub)
	// Pit entries learned in earlier races time the calls to box from the first lap.
	if err := engineerEngine.UsePitLaneStore(ctx, repo); err != nil {
		slog.Warn("Could not load the learned pit lanes", "error", err)
	}
	liveBroadcaster := session.NewLiveBroadcaster(telemetryHub)

	// 5. Serve the dashboard and API on the bound TCP listener
	srv := initHTTPServer(cfg, repo, telemetryHub, engineerHub, inputMgr, engineerEngine, liveBroadcaster)

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()

	// 6. Open the dashboard in the browser if asked to (port is guaranteed bound)
	if cfg.OpenBrowser {
		go func() {
			if err := system.OpenBrowser(localURL); err != nil {
				slog.Warn("Could not automatically open browser", "url", localURL, "error", err)
			}
		}()
	}

	// 7. Setup Session Manager and Live Broadcaster
	sessionManager := session.NewSessionManager(repo)
	sessionManager.Start(ctx)

	// The race-control feed rows the dashboards get are stored with the session too
	liveBroadcaster.SetGapTrendSource(gapTrendSource(engineerEngine))
	liveBroadcaster.SetFeedEventSink(func(sessionUID uint64, events []session.FeedEvent) {
		sessionManager.RecordFeedEvents(ctx, sessionUID, events)
	})
	liveBroadcaster.Start(ctx, 100*time.Millisecond)

	// 8. Setup UDP Listener
	listener, err := initUDPListener(ctx, cfg.UDPAddr)
	if err != nil {
		return fmt.Errorf("%w. If another telemetry app (such as SimHub) uses UDP port %s, close it or pick "+
			"another port with -udp or F1T_UDP_ADDR (and set the same port in the game)", err, extractPort(cfg.UDPAddr, "20777"))
	}

	// 9. Start Packet Processing Loop
	startPacketProcessing(ctx, listener, sessionManager, engineerEngine, liveBroadcaster, cfg.UDPAddr)

	// 10. Run until a termination signal (or the tray's Quit), then shut down gracefully
	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() { gracefulShutdown(cancel, inputMgr, sessionManager, srv) })
	}

	if !tray {
		waitForSignal()
		shutdown()
		return nil
	}

	go func() {
		waitForSignal()
		desktop.Quit()
	}()
	// The tray runs shutdown before RunTray returns, also when Windows ends the session
	desktop.RunTray(desktop.Options{
		Version:       version,
		DashboardURL:  localURL,
		LiveURL:       localURL + "/live",
		UDPPort:       system.ListenPort(cfg.UDPAddr),
		DBPath:        dbPath,
		LogPath:       logPath,
		AutostartArgs: autostartArgs(flag.CommandLine, dbPath),
		Feed:          liveBroadcaster.FeedStatus,
		CheckUpdates:  updateChecker(),
		StartupNotice: !cfg.Autostart,
	}, shutdown)
	shutdown()
	return nil
}

// openRunningInstance handles a busy HTTP port: when this app is the one answering there, the
// second launch exits quietly (opening the running copy's dashboard only with -open-browser).
// Otherwise it explains which port is busy and how to pick another.
func openRunningInstance(ctx context.Context, localURL, port string, openBrowser bool, bindErr error) error {
	ver, running := system.FindRunningInstance(ctx, localURL)
	if !running {
		return fmt.Errorf("HTTP port %s is not available (%w). Close the program using it, or pick another "+
			"port with -http or F1T_HTTP_ADDR (for example :8090)", port, bindErr)
	}

	slog.Info("F1 Telemetry Analyzer is already running", "url", localURL, "version", ver.Version)
	if !openBrowser {
		return nil
	}
	if err := system.OpenBrowser(localURL); err != nil {
		return fmt.Errorf("F1 Telemetry Analyzer is already running at %s, but the browser didn't open: %w", localURL, err)
	}
	return nil
}

// updateChecker looks for a newer release for the tray, or is nil for a dev build.
func updateChecker() func(ctx context.Context) (*system.UpdateCheckResponse, error) {
	ver := system.GetAppVersion()
	if ver.IsDev {
		return nil
	}
	return func(ctx context.Context) (*system.UpdateCheckResponse, error) {
		return system.CheckForUpdates(ctx, system.DefaultGitHubRepo, ver.Version, ver.IsBeta)
	}
}

// absolutePath is path made absolute, or path itself if that fails.
func absolutePath(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

// gapTrendSource hands the race engineer's gap trends to the live snapshot.
func gapTrendSource(engine *engineer.EngineerEngine) session.GapTrendSource {
	return func() (ahead, behind *session.LiveGapTrend) {
		a, b := engine.GapTrends()
		return liveGapTrend(a), liveGapTrend(b)
	}
}

// liveGapTrend is an engine gap trend in the snapshot's units (milliseconds per lap).
func liveGapTrend(t *engineer.GapTrend) *session.LiveGapTrend {
	if t == nil {
		return nil
	}
	return &session.LiveGapTrend{
		CarIndex:       uint8(t.CarIdx),
		ChangePerLapMS: int32(math.Round(t.PerLapSec * packets.MillisPerSecond)),
		Laps:           uint8(min(t.Laps, math.MaxUint8)),
	}
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
	liveFeed api.LiveFeed,
) *http.Server {
	apiConfig := api.ServerConfig{
		GeminiAPIKey: cfg.GeminiAPIKey,
		OpenAIAPIKey: cfg.OpenAIAPIKey,
		ClaudeAPIKey: cfg.ClaudeAPIKey,
		LLMModel:     cfg.LLMModel,
		LLMProvider:  cfg.LLMProvider,
		UDPAddr:      cfg.UDPAddr,
	}

	apiServer := api.NewServer(repo, telemetryHub, engineerHub, apiConfig)
	apiServer.SetInputManager(inputMgr)
	apiServer.SetEngineerEngine(engineerEngine)
	apiServer.SetLiveFeed(liveFeed)

	return &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: apiServer.Router(),
	}
}

func initUDPListener(ctx context.Context, udpAddr string) (*udp.Listener, error) {
	listener := udp.NewListener(udpAddr, udp.DefaultBufferSize)
	go func() {
		if err := listener.Listen(ctx); err != nil {
			slog.Error("UDP listener error", "addr", udpAddr, "error", err)
		}
	}()

	select {
	case <-listener.Ready():
		if err := listener.Err(); err != nil {
			return nil, fmt.Errorf("failed to bind UDP listener on %s: %w", udpAddr, err)
		}
		return listener, nil
	case <-time.After(defaultUDPStartupTimeout):
		return nil, fmt.Errorf("timed out waiting for UDP listener to bind on %s", udpAddr)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
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

// waitForSignal blocks until Ctrl+C or a termination signal.
func waitForSignal() {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println()
}

func gracefulShutdown(
	cancel context.CancelFunc,
	inputMgr input.Manager,
	sessionManager *session.SessionManager,
	srv *http.Server,
) {
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

func printStartupBanner(ver, cmt, localURL, lanURL, udpAddr, dbPath string, tray bool) {
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
	if tray {
		fmt.Println("  🖥️   Running in the system tray: quit from its menu.")
	}
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
