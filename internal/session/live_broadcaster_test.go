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

func TestLiveBroadcaster_SafetyCarEvents(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	header := packets.PacketHeader{
		PacketFormat: 2026,
		PacketId:     packets.PacketIDSession,
		SessionUID:   0xABC123,
		SessionTime:  10.0,
	}

	// 1. Initial session: Green flag (SafetyCarNone)
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header,
		SafetyCarStatus: packets.SafetyCarNone,
	})

	// 2. SC Deployed (SafetyCarFull)
	header.SessionTime = 12.0
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header,
		SafetyCarStatus: packets.SafetyCarFull,
	})

	broadcaster.BroadcastSnapshot()
	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 snapshot, got %d", hub.MessageCount())
	}

	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}

	if len(snapshot.Events) != 1 {
		t.Fatalf("expected 1 synthetic event, got %d", len(snapshot.Events))
	}
	evt := snapshot.Events[0]
	if evt.EventCode != packets.EventSafetyCarStatus || evt.Type != "flag" || evt.Severity != "warning" {
		t.Errorf("unexpected event: %+v", evt)
	}
	if evt.Description != "Full Safety Car Deployed" {
		t.Errorf("unexpected description: %s", evt.Description)
	}

	// 3. VSC transition
	header.SessionTime = 15.0
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header,
		SafetyCarStatus: packets.SafetyCarVirtual,
	})
	broadcaster.BroadcastSnapshot()

	if hub.MessageCount() != 2 {
		t.Fatalf("expected 2 snapshots, got %d", hub.MessageCount())
	}
	if err := json.Unmarshal(hub.messages[1], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}
	if len(snapshot.Events) != 1 || snapshot.Events[0].Description != "Virtual Safety Car Deployed" {
		t.Errorf("expected VSC event, got %+v", snapshot.Events)
	}
}

func TestLiveBroadcaster_PitPenaltyAndRetirementEvents(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	header := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDParticipants,
		SessionUID:     0xDEF456,
		SessionTime:    50.0,
		PlayerCarIndex: 0,
	}

	// Setup participants
	var participants [packets.MaxCars]packets.ParticipantData
	copy(participants[0].Name[:], "Franco Colapinto")
	participants[0].RaceNumber = 43
	copy(participants[1].Name[:], "Max Verstappen")
	participants[1].RaceNumber = 1

	broadcaster.ProcessPacket(&packets.PacketParticipantsData{
		Header:        header,
		NumActiveCars: 2,
		Participants:  participants,
	})

	// Initial lap state
	lapHeader := header
	lapHeader.PacketId = packets.PacketIDLapData
	var laps1 [packets.MaxCars]packets.LapData
	laps1[0] = packets.LapData{
		CurrentLapNum: 5,
		PitStatus:     packets.PitStatusNone,
		Penalties:     0,
		ResultStatus:  packets.ResultStatusActive,
		CarPosition:   1,
	}
	laps1[1] = packets.LapData{
		CurrentLapNum: 5,
		PitStatus:     packets.PitStatusNone,
		Penalties:     0,
		ResultStatus:  packets.ResultStatusActive,
		CarPosition:   2,
	}

	broadcaster.ProcessPacket(&packets.PacketLapData{
		Header:  lapHeader,
		LapData: laps1,
	})

	// Subsequent lap state: car 0 enters pit lane & gets penalty; car 1 retires
	var laps2 [packets.MaxCars]packets.LapData
	laps2[0] = packets.LapData{
		CurrentLapNum: 6,
		PitStatus:     packets.PitStatusPitting,
		Penalties:     5,
		ResultStatus:  packets.ResultStatusActive,
		CarPosition:   1,
	}
	laps2[1] = packets.LapData{
		CurrentLapNum: 5,
		PitStatus:     packets.PitStatusNone,
		Penalties:     0,
		ResultStatus:  packets.ResultStatusRetired,
		CarPosition:   2,
	}

	broadcaster.ProcessPacket(&packets.PacketLapData{
		Header:  lapHeader,
		LapData: laps2,
	})

	broadcaster.BroadcastSnapshot()

	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 snapshot, got %d", hub.MessageCount())
	}

	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}

	// Should have 3 events: Pit entry for Colapinto, Penalty for Colapinto, Retirement for Verstappen
	if len(snapshot.Events) != 3 {
		t.Fatalf("expected 3 synthetic events, got %d: %+v", len(snapshot.Events), snapshot.Events)
	}

	// 1. Pit event
	pitEvt := snapshot.Events[0]
	if pitEvt.EventCode != packets.EventTeamMateInPits || pitEvt.Type != "pit" || *pitEvt.VehicleIdx != 0 {
		t.Errorf("unexpected pit event: %+v", pitEvt)
	}

	// 2. Penalty event
	penEvt := snapshot.Events[1]
	if penEvt.EventCode != packets.EventPenaltyIssued || penEvt.Type != "penalty" || *penEvt.PenaltyTime != 5 {
		t.Errorf("unexpected penalty event: %+v", penEvt)
	}

	// 3. Retirement event
	retEvt := snapshot.Events[2]
	if retEvt.EventCode != packets.EventRetirement || retEvt.Type != "retirement" || *retEvt.VehicleIdx != 1 {
		t.Errorf("unexpected retirement event: %+v", retEvt)
	}
}

func TestLiveBroadcaster_ActiveCarCount(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	header := packets.PacketHeader{
		PacketFormat:   2026,
		PacketId:       packets.PacketIDParticipants,
		SessionUID:     0x999,
		PlayerCarIndex: 0,
	}

	var participants [packets.MaxCars]packets.ParticipantData
	copy(participants[0].Name[:], "Player Driver")
	copy(participants[1].Name[:], "Lando Norris")
	participants[1].DriverId = 10
	participants[1].RaceNumber = 4
	participants[1].AIControlled = 1

	broadcaster.ProcessPacket(&packets.PacketParticipantsData{
		Header:        header,
		NumActiveCars: 2,
		Participants:  participants,
	})

	var laps [packets.MaxCars]packets.LapData
	laps[0] = packets.LapData{CarPosition: 1, ResultStatus: packets.ResultStatusActive}
	laps[1] = packets.LapData{CarPosition: 2, ResultStatus: packets.ResultStatusActive}

	lapHeader := header
	lapHeader.PacketId = packets.PacketIDLapData
	broadcaster.ProcessPacket(&packets.PacketLapData{
		Header:  lapHeader,
		LapData: laps,
	})

	broadcaster.BroadcastSnapshot()

	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}

	if snapshot.ActiveCarCount != 2 {
		t.Errorf("expected ActiveCarCount 2, got %d", snapshot.ActiveCarCount)
	}
}

func TestLiveBroadcaster_SessionReset(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	header1 := packets.PacketHeader{
		PacketFormat: 2026,
		PacketId:     packets.PacketIDSession,
		SessionUID:   0x111,
	}
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header1,
		SafetyCarStatus: packets.SafetyCarFull,
	})

	// Change session UID
	header2 := packets.PacketHeader{
		PacketFormat: 2026,
		PacketId:     packets.PacketIDSession,
		SessionUID:   0x222,
	}
	// Initial packet in new session with Full SC should NOT trigger an event from session1
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header2,
		SafetyCarStatus: packets.SafetyCarFull,
	})

	broadcaster.BroadcastSnapshot()

	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}

	// No events synthesized on initial session packet
	if len(snapshot.Events) != 0 {
		t.Errorf("expected 0 events on session reset, got %d", len(snapshot.Events))
	}
}
