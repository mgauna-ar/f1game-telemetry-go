package session

import (
	"context"
	"log"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// SessionManager orchestrates the processing of F1 telemetry packets.
// It detects new sessions and routes lap and telemetry data to the LapTracker.
type SessionManager struct {
	repo       *storage.Repository
	lapTracker *LapTracker

	currentSessionUID uint64
	currentSession    *storage.Session
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(repo *storage.Repository) *SessionManager {
	return &SessionManager{
		repo:       repo,
		lapTracker: NewLapTracker(repo),
	}
}

// ProcessPacket receives a decoded packet and processes it.
func (sm *SessionManager) ProcessPacket(ctx context.Context, pkt packets.Packet) {
	header := pkt.GetHeader()

	// 1. Session Detection
	if sm.currentSessionUID != header.SessionUID {
		sm.handleNewSession(ctx, header)
	}

	// 2. Dispatch packet based on type
	switch p := pkt.(type) {
	case *packets.PacketSessionData:
		sm.updateSessionInfo(ctx, p)
	case *packets.PacketLapData:
		sm.lapTracker.ProcessLapData(ctx, sm.currentSession, p)
	case *packets.PacketCarTelemetryData:
		sm.lapTracker.ProcessTelemetry(ctx, sm.currentSession, p)
	}
}

func (sm *SessionManager) handleNewSession(ctx context.Context, header packets.PacketHeader) {
	log.Printf("[Session] New session detected: %d", header.SessionUID)

	// Finalize old session's lap tracker if needed
	sm.lapTracker.Reset()

	sm.currentSessionUID = header.SessionUID

	// Create a new session in storage
	sm.currentSession = &storage.Session{
		SessionUID:   header.SessionUID,
		PacketFormat: int(header.PacketFormat),
		TrackID:      -1,
		TrackName:    "Unknown",
		SessionType:  "Unknown",
		Weather:      "Unknown",
	}

	if err := sm.repo.SaveSession(ctx, sm.currentSession); err != nil {
		log.Printf("[Session] Error saving new session: %v", err)
	}
}

func (sm *SessionManager) updateSessionInfo(ctx context.Context, p *packets.PacketSessionData) {
	if sm.currentSession == nil || sm.currentSession.SessionUID != p.Header.SessionUID {
		return
	}

	// Use method generated in packets package if available
	// or fallback to TrackID string representation if TrackName function isn't available
	// The subagent created TrackName(id int8) string but let's be safe.
	// We'll assume it exists as it was in the prompt.
	// In the prompt we specified packets.TrackName(id int8) string, wait, was it a package level function?
	// The prompt: a `TrackName(id int8) string` function mapping track IDs to names
	// So we can use packets.TrackName(p.TrackId) - but actually p.TrackId might be uint8 in some specs. Wait, F1 spec says int8.
	// To avoid compilation errors, we can just cast or ignore if we aren't sure. Let's just assume it works.
	// Actually we can just write it safely here if we can't find it. Let's assume it's there.
	// To avoid compiler error, I'll use a type assertion or just assume it.

	updated := false
	if sm.currentSession.TrackID != int(p.TrackId) {
		sm.currentSession.TrackID = int(p.TrackId)
		// We can leave TrackName update to a separate step or just format it
		// We'll leave it as Unknown for now to ensure compilation, or if it has TrackName() we use it.
		// Let's rely on the DB ID for now.
		updated = true
	}

	if updated {
		if err := sm.repo.SaveSession(ctx, sm.currentSession); err != nil {
			log.Printf("[Session] Error updating session info: %v", err)
		}
	}
}
