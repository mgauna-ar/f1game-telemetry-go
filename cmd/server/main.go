package main

import (
	"context"
	"errors"
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
	"sync/atomic"
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
	AfterUpdate  bool
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
	autostartFlag := flag.Bool(flagAutostart, false, "Set by Start with Windows: start without opening the app window")
	versionFlag := flag.Bool(flagVersion, false, "Print version information and exit")
	flag.Parse()

	// Set by the restart after an update. Cleared once read, so programs the app opens don't get it.
	afterUpdate := getEnvBool(system.UpdatedEnv, false)
	_ = os.Unsetenv(system.UpdatedEnv)

	return ServerConfig{
		UDPAddr:      *udpFlag,
		HTTPAddr:     *httpFlag,
		DBPath:       *dbFlag,
		OpenBrowser:  *openBrowserFlag,
		NoTray:       *noTrayFlag,
		Autostart:    *autostartFlag,
		AfterUpdate:  afterUpdate,
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

	// Read before an update can move the running executable aside (Windows)
	exe, err := os.Executable()
	if err != nil {
		slog.Warn("Could not find the executable", "error", err)
	}

	restart, err := run(cfg, envFiles, exe)
	if err != nil {
		fatal(err)
	}
	if restart {
		if err := system.Restart(exe, restartArgs(flag.CommandLine)); err != nil {
			fatal(fmt.Errorf("the update is installed, but the app didn't start again (%w): start it again", err))
		}
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

// run runs the app until it quits. restart reports that it stopped to run the update it installed.
func run(cfg ServerConfig, envFiles []string, exe string) (restart bool, err error) {
	system.SetAppVersion(version, commit, date)

	// Calculate display URLs
	port := extractPort(cfg.HTTPAddr, "8080")
	localURL := fmt.Sprintf("http://localhost:%s", port)
	lanIP := system.GetLocalIP()
	lanURL := fmt.Sprintf("http://%s:%s", lanIP, port)
	dbPath := absolutePath(cfg.DBPath)
	// On Windows the app has its own window and notification-area icon, unless -no-tray
	native := desktop.Supported() && !cfg.NoTray

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Bind the HTTP port first: when this app already runs there, open it instead of starting
	// a second copy (before touching the database or the running copy's log file)
	ln, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return false, openRunningInstance(ctx, localURL, port, native, cfg.OpenBrowser, err)
	}

	logPath, closeLog := setupLogging(dbPath, native || !desktop.HasConsole(), desktop.HasConsole())
	defer closeLog()
	for _, path := range envFiles {
		slog.Info("Loaded settings from .env file", "path", path)
	}

	printStartupBanner(version, commit, localURL, lanURL, cfg.UDPAddr, dbPath, native)
	slog.Info("Starting F1 Telemetry Analyzer", "version", version, "dashboard", localURL, "network", lanURL,
		"udpAddr", cfg.UDPAddr, "db", dbPath, "log", logPath, "afterUpdate", cfg.AfterUpdate)
	if exe != "" {
		if err := system.RemoveReplacedExecutable(exe); err != nil {
			slog.Warn("Could not remove the version an update replaced", "error", err)
		}
	}

	// 2. Initialize Database
	repo, err := initDatabase(cfg.DBPath)
	if err != nil {
		_ = ln.Close()
		return false, fmt.Errorf("failed to initialize database on %s: %w", dbPath, err)
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
	// What earlier races taught about each track (pit lane, quiet stretches) is used from the first lap.
	if err := engineerEngine.UseTrackProfileStore(ctx, repo); err != nil {
		slog.Warn("Could not load the learned track profiles", "error", err)
	}
	liveBroadcaster := session.NewLiveBroadcaster(telemetryHub)

	// The app on this PC: its window, starting at sign-in, updating, and Quit from the window
	quitRequested := make(chan struct{})
	var quitOnce sync.Once
	quit := func() {
		if native {
			desktop.Quit()
			return
		}
		quitOnce.Do(func() { close(quitRequested) })
	}
	var restartRequested atomic.Bool
	checkUpdates := updateChecker()
	desktopApp := desktop.NewApp(desktop.AppConfig{
		Store:         repo,
		DashboardURL:  localURL,
		AutostartArgs: autostartArgs(flag.CommandLine, dbPath),
		NativeWindow:  native,
		Quit:          quit,
		CheckUpdates:  checkUpdates,
		Restart: func() {
			slog.Info("Restarting into the new version")
			restartRequested.Store(true)
			quit()
		},
	})

	// 5. Serve the dashboard and API on the bound TCP listener
	srv := initHTTPServer(cfg, repo, telemetryHub, engineerHub, inputMgr, engineerEngine, liveBroadcaster, desktopApp)

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()

	// 6. Open the dashboard in the browser if asked to (port is guaranteed bound). Windows opens no
	// browser: the dashboard is the app's own window.
	if cfg.OpenBrowser && !desktop.Supported() {
		go func() {
			if err := system.OpenBrowser(localURL); err != nil {
				slog.Warn("Could not automatically open browser", "url", localURL, "error", err)
			}
		}()
	}

	// 7. Laps saved before the compact telemetry format are converted once, in the background; the
	// next start gives the space they free back to the disk (a VACUUM of a few seconds, once)
	if err := repo.ReclaimFreeSpace(ctx); err != nil {
		slog.Warn("Could not give the database's free space back to the disk", "error", err)
	}
	upgradeDone := make(chan struct{})
	go func() {
		defer close(upgradeDone)
		if err := repo.UpgradeLapTelemetry(ctx); err != nil && !errors.Is(err, context.Canceled) {
			slog.Warn("Could not convert the saved laps to the compact telemetry format", "error", err)
		}
	}()
	// The conversion stops between laps, before the database closes
	defer func() {
		cancel()
		<-upgradeDone
	}()

	// 8. Setup Session Manager and Live Broadcaster
	sessionManager := session.NewSessionManager(repo)
	sessionManager.Start(ctx)

	// The race-control feed rows the dashboards get are stored with the session too
	liveBroadcaster.SetGapTrendSource(gapTrendSource(engineerEngine))
	liveBroadcaster.SetFeedEventSink(func(sessionUID uint64, events []session.FeedEvent) {
		sessionManager.RecordFeedEvents(ctx, sessionUID, events)
	})
	liveBroadcaster.Start(ctx, 100*time.Millisecond)

	// 9. Setup UDP Listener
	listener, err := initUDPListener(ctx, cfg.UDPAddr)
	if err != nil {
		return false, fmt.Errorf("%w. If another telemetry app (such as SimHub) uses UDP port %s, close it or pick "+
			"another port with -udp or F1T_UDP_ADDR (and set the same port in the game)", err, extractPort(cfg.UDPAddr, "20777"))
	}

	// 10. Start Packet Processing Loop
	startPacketProcessing(ctx, listener, sessionManager, engineerEngine, liveBroadcaster, cfg.UDPAddr)

	// 11. On macOS and Linux, open the small browser window (Windows' own window opens with the tray)
	showWindow := windowAtStart(ctx, desktopApp, cfg)
	if showWindow && !desktop.Supported() {
		go openWindow(desktopApp)
	}

	// 12. Run until a termination signal or Quit (tray or app window), then shut down gracefully
	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() { gracefulShutdown(cancel, inputMgr, sessionManager, srv) })
	}

	if !native {
		waitForSignal(quitRequested)
		shutdown()
		return restartRequested.Load(), nil
	}

	go func() {
		waitForSignal(nil)
		desktop.Quit()
	}()
	// The window and tray run shutdown before Run returns, also when Windows ends the session
	desktop.Run(desktop.Options{
		Version:      version,
		DashboardURL: localURL,
		UDPPort:      system.ListenPort(cfg.UDPAddr),
		DBPath:       dbPath,
		LogPath:      logPath,
		Feed:         liveBroadcaster.FeedStatus,
		CheckUpdates: checkUpdates,
		App:          desktopApp,
		ShowWindow:   showWindow,
	}, shutdown)
	shutdown()
	return restartRequested.Load(), nil
}

// openRunningInstance handles a busy HTTP port: when this app is the one answering there, a second
// launch on Windows brings the running copy's window up, and elsewhere exits quietly (opening the
// running copy's dashboard only with -open-browser). Otherwise it explains which port is busy and
// how to pick another.
func openRunningInstance(ctx context.Context, localURL, port string, native, openBrowser bool, bindErr error) error {
	ver, running := system.FindRunningInstance(ctx, localURL)
	if !running {
		return fmt.Errorf("HTTP port %s is not available (%w). Close the program using it, or pick another "+
			"port with -http or F1T_HTTP_ADDR (for example :8090)", port, bindErr)
	}

	slog.Info("F1 Telemetry Analyzer is already running", "url", localURL, "version", ver.Version)
	if native {
		if err := desktop.ShowRunningWindow(ctx, localURL); err != nil {
			return fmt.Errorf("F1 Telemetry %s is already running but didn't show its window (%w). Quit it from "+
				"its icon in the notification area and start it again", ver.Version, err)
		}
		return nil
	}
	if !openBrowser {
		return nil
	}
	if err := system.OpenBrowser(localURL); err != nil {
		return fmt.Errorf("F1 Telemetry Analyzer is already running at %s, but the browser didn't open: %w", localURL, err)
	}
	return nil
}

// windowAtStart reports whether a start opens the app's window. After an update it does on
// Windows, where the window closed with the old copy, while elsewhere the browser window that asked
// for the update reloads itself. Otherwise it does unless the app started at sign-in or the window
// was turned off.
func windowAtStart(ctx context.Context, app *desktop.App, cfg ServerConfig) bool {
	if cfg.AfterUpdate {
		return desktop.Supported()
	}
	if cfg.Autostart {
		return false
	}
	state, err := app.State(ctx)
	if err != nil {
		slog.Warn("Could not read the desktop settings", "error", err)
		return false
	}
	return state.ShowWindowAtStart
}

// openWindow opens the small browser window (macOS and Linux).
func openWindow(app *desktop.App) {
	if err := app.OpenWindow(); err != nil {
		slog.Warn("Could not open the app window", "error", err)
	}
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

func initDatabase(dbPath string) (*storage.SQLiteRepository, error) {
	return storage.NewSQLiteRepository(dbPath)
}

func initHTTPServer(
	cfg ServerConfig,
	repo storage.Repository,
	telemetryHub, engineerHub *api.Hub,
	inputMgr input.Manager,
	engineerEngine *engineer.EngineerEngine,
	liveFeed api.LiveFeed,
	desktopApp api.DesktopApp,
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
	apiServer.SetDesktopApp(desktopApp)

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

// waitForSignal blocks until Ctrl+C, a termination signal, or quitRequested closes (nil waits
// for signals only).
func waitForSignal(quitRequested <-chan struct{}) {
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sig:
		fmt.Println()
	case <-quitRequested:
	}
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

func printStartupBanner(ver, cmt, localURL, lanURL, udpAddr, dbPath string, native bool) {
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
	if native {
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
