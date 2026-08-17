package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/api"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
	"github.com/mgauna/f1game-telemetry-go/internal/udp"
)

const (
	defaultUDPAddr  = "0.0.0.0:20777"
	defaultHTTPAddr = ":8080"
	dbPath          = "f1telemetry.db"
)

func main() {
	udpAddr := getEnv("F1T_UDP_ADDR", defaultUDPAddr)
	httpAddr := getEnv("F1T_HTTP_ADDR", defaultHTTPAddr)

	fmt.Println("🏎️  f1game-telemetry-go")
	fmt.Println("========================")
	fmt.Printf("UDP Listener: %s\n", udpAddr)
	fmt.Printf("HTTP Server:  %s\n", httpAddr)
	fmt.Printf("Database:     %s\n", dbPath)
	fmt.Println()

	// 1. Setup Context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 2. Setup Storage
	repo, err := storage.NewRepository(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer repo.Close()

	// 3. Setup WebSocket Hub
	hub := api.NewHub()
	go hub.Run()

	// 4. Setup API Server
	apiServer := api.NewServer(repo, hub)
	srv := &http.Server{
		Addr:    httpAddr,
		Handler: apiServer.Router(),
	}

	go func() {
		log.Printf("Starting HTTP server on %s", httpAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 5. Setup Session Manager
	sessionManager := session.NewSessionManager(repo)

	// 6. Setup UDP Listener
	listener := udp.NewListener(udpAddr, udp.DefaultBufferSize)
	go func() {
		if err := listener.Listen(ctx); err != nil {
			log.Fatalf("UDP listener error: %v", err)
		}
	}()
	<-listener.Ready() // Wait for socket to bind

	// 7. Packet Processing Loop
	go func() {
		log.Println("Ready to receive telemetry...")
		for {
			select {
			case <-ctx.Done():
				return
			case rawPkt := <-listener.Packets():
				pkt, err := packets.Decode(rawPkt.Data)
				if err != nil {
					// Ignore unknown packets or decode errors to avoid log spam
					continue
				}

				// Process packet for storage/state
				sessionManager.ProcessPacket(ctx, pkt)

				// Broadcast relevant real-time telemetry packets to WebSockets
				if shouldBroadcastPacket(pkt.GetHeader().PacketId) {
					if js, err := json.Marshal(pkt); err == nil {
						hub.Broadcast(js)
					}
				}
			}
		}
	}()

	// 8. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")

	cancel() // Stop UDP listener and packet loop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	log.Println("Shutdown complete")
}

// shouldBroadcastPacket returns true if the packet should be broadcast over WebSockets to live clients.
func shouldBroadcastPacket(pktID uint8) bool {
	switch pktID {
	case packets.PacketIDMotion,
		packets.PacketIDSession,
		packets.PacketIDLapData,
		packets.PacketIDEvent,
		packets.PacketIDParticipants,
		packets.PacketIDCarTelemetry,
		packets.PacketIDCarStatus,
		packets.PacketIDCarDamage:
		return true
	default:
		return false
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
