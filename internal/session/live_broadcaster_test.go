package session

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

type mockHub struct {
	mu          sync.Mutex
	messages    [][]byte
	clientCount int
}

func (m *mockHub) Broadcast(msg []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, msg)
}

func (m *mockHub) ClientCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.clientCount
}

func (m *mockHub) MessageCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.messages)
}

func TestLiveBroadcaster_ProcessPacketAndSnapshot(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	header := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDSession,
		SessionUID:     0x1234567890ABCDEF,
		SessionTime:    42.5,
		PlayerCarIndex: 0,
	}

	sessionPkt := &packets.PacketSessionData{
		Header:  header,
		TrackId: 3,
		Weather: packets.WeatherClear,
	}

	lapHeader := header
	lapHeader.PacketId = packets.PacketIDLapData
	var laps [packets.MaxCars]packets.LapData
	laps[0] = packets.LapData{CurrentLapNum: 5, PitStatus: packets.PitStatusNone}
	lapPkt := &packets.PacketLapData{
		Header:  lapHeader,
		LapData: laps,
	}

	// 1. Process session and lap packets
	broadcaster.ProcessPacket(sessionPkt)
	broadcaster.ProcessPacket(lapPkt)

	// Since broadcast is aggregated, message count should still be 0 before ticker/broadcast call
	if hub.MessageCount() != 0 {
		t.Fatalf("expected 0 broadcast messages before snapshot, got %d", hub.MessageCount())
	}

	// 2. Trigger snapshot broadcast
	broadcaster.BroadcastSnapshot()

	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 broadcast snapshot message, got %d", hub.MessageCount())
	}

	// Inspect decoded snapshot
	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot JSON: %v", err)
	}

	if snapshot.Header.PacketId != packets.PacketIDLiveSnapshot {
		t.Errorf("expected PacketId %d, got %d", packets.PacketIDLiveSnapshot, snapshot.Header.PacketId)
	}
	if snapshot.Session == nil || snapshot.Session.TrackId != 3 {
		t.Errorf("expected Session with TrackId 3, got %+v", snapshot.Session)
	}
	if snapshot.LapData == nil || snapshot.LapData.LapData[0].CurrentLapNum != 5 {
		t.Errorf("expected LapData with LapNum 5, got %+v", snapshot.LapData)
	}

	// 3. Second broadcast when not dirty should be a no-op
	broadcaster.BroadcastSnapshot()
	if hub.MessageCount() != 1 {
		t.Errorf("expected still 1 broadcast message (dirty was false), got %d", hub.MessageCount())
	}
}

func TestLiveBroadcaster_NoClients(t *testing.T) {
	hub := &mockHub{clientCount: 0}
	broadcaster := NewLiveBroadcaster(hub)

	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header: packets.PacketHeader{PacketId: packets.PacketIDSession},
	})

	broadcaster.BroadcastSnapshot()
	if hub.MessageCount() != 0 {
		t.Errorf("expected 0 messages when no clients connected, got %d", hub.MessageCount())
	}
}

func TestLiveBroadcaster_ImmediateEvents(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	eventPkt := &packets.PacketEventData{
		Header:          packets.PacketHeader{PacketId: packets.PacketIDEvent, SessionTime: 100.0},
		EventStringCode: [4]uint8{'F', 'T', 'L', 'P'},
	}

	broadcaster.ProcessPacket(eventPkt)

	// Events must be broadcast immediately without waiting for ticker
	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 immediate event broadcast, got %d", hub.MessageCount())
	}

	var parsed struct {
		EventCode string
	}
	if err := json.Unmarshal(hub.messages[0], &parsed); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}
	if parsed.EventCode != "FTLP" {
		t.Errorf("expected event code FTLP, got %s", parsed.EventCode)
	}
}

func TestLiveBroadcaster_StartLoop(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	ctx, cancel := context.WithCancel(context.Background())
	broadcaster.Start(ctx, 10*time.Millisecond)

	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:  packets.PacketHeader{PacketId: packets.PacketIDSession},
		TrackId: 7,
	})

	time.Sleep(35 * time.Millisecond)
	cancel()

	if hub.MessageCount() < 1 {
		t.Errorf("expected periodic broadcast from ticker, got %d", hub.MessageCount())
	}
}
