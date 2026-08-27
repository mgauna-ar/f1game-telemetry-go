package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/api"
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
	UDPAddr     string
	HTTPAddr    string
	DBPath      string
	NoBrowser   bool
	ShowVersion bool
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
		UDPAddr:     *udpFlag,
		HTTPAddr:    *httpFlag,
		DBPath:      *dbFlag,
		NoBrowser:   *noBrowserFlag,
		ShowVersion: *versionFlag,
	}
}

func main() {
	cfg := loadServerConfig()

	if cfg.ShowVersion {
		fmt.Printf("F1 Telemetry Analyzer %s (commit: %s, built: %s)\n", version, commit, date)
		os.Exit(0)
	}

	api.SetAppVersion(version, commit, date)

	// Calculate display URLs
	port := extractPort(cfg.HTTPAddr, "8080")
	localURL := fmt.Sprintf("http://localhost:%s", port)
	lanIP := system.GetLocalIP()
	lanURL := fmt.Sprintf("http://%s:%s", lanIP, port)

	printStartupBanner(version, commit, localURL, lanURL, cfg.UDPAddr, cfg.DBPath)

	// 2. Setup Storage
	repo, err := storage.NewSQLiteRepository(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer repo.Close()

	// 3. Setup Context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4. Setup WebSocket Hubs
	telemetryHub := api.NewHub("Telemetry")
	go telemetryHub.Run()

	engineerHub := api.NewHub("Engineer")
	go engineerHub.Run()

	// 5. Setup API Server, Global Input Manager & Engineer Engine
	inputMgr := input.NewManager()
	inputMgr.Start(ctx)

	engineerEngine := api.NewEngineerEngine(engineerHub, repo)

	apiServer := api.NewServer(repo, telemetryHub, engineerHub)
	apiServer.SetInputManager(inputMgr)
	apiServer.SetEngineerEngine(engineerEngine)

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: apiServer.Router(),
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 6. Auto-launch browser if not disabled
	if !cfg.NoBrowser {
		go func() {
			// Small delay to allow HTTP server socket bind
			time.Sleep(350 * time.Millisecond)
			if err := system.OpenBrowser(localURL); err != nil {
				log.Printf("Note: Could not automatically open browser: %v. Please open %s manually.", err, localURL)
			}
		}()
	}

	// 7. Setup Session Manager
	sessionManager := session.NewSessionManager(repo)
	sessionManager.Start(ctx)

	// 8. Setup 10Hz Live Telemetry Snapshot Broadcaster
	liveBroadcaster := session.NewLiveBroadcaster(telemetryHub)
	liveBroadcaster.Start(ctx, 100*time.Millisecond)

	// 9. Setup UDP Listener
	listener := udp.NewListener(cfg.UDPAddr, udp.DefaultBufferSize)
	go func() {
		if err := listener.Listen(ctx); err != nil {
			log.Fatalf("UDP listener error: %v", err)
		}
	}()
	<-listener.Ready() // Wait for socket to bind

	// 10. Packet Processing Loop
	go func() {
		log.Printf("Ready to receive telemetry on UDP %s (F1 2025/2026)...", cfg.UDPAddr)
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
					// Ignore unknown packets or decode errors to avoid log spam
					continue
				}

				// Process packet for storage/state
				sessionManager.ProcessPacket(ctx, pkt)

				// Process packet for proactive insights
				engineerEngine.ProcessPacket(ctx, pkt)

				// Process packet for 10Hz live snapshot WebSocket broadcasting
				liveBroadcaster.ProcessPacket(pkt)
			}
		}
	}()

	// 10. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println()
	log.Println("Shutting down F1 Telemetry Analyzer...")

	cancel() // Stop UDP listener and packet loop
	inputMgr.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	// Flush remaining in-flight telemetry batches
	sessionManager.Close(shutdownCtx)

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	log.Println("Shutdown complete. See you on track!")
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
