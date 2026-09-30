package session

import (
	"bytes"
	"context"
	"encoding/binary"
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
	if len(snapshot.LapData) == 0 || snapshot.LapData[0].CurrentLapNum != 5 {
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

	header := packets.PacketHeader{
		PacketFormat: 2026,
		PacketId:     packets.PacketIDSession,
		SessionUID:   0xABC123,
		SessionTime:  10.0,
	}

	// 1. Initial session: Green flag
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header,
		SafetyCarStatus: packets.SafetyCarNone,
	})

	// 2. SC Deployed (creates a synthetic event in pendingEvents)
	header.SessionTime = 12.0
	broadcaster.ProcessPacket(&packets.PacketSessionData{
		Header:          header,
		SafetyCarStatus: packets.SafetyCarFull,
	})

	if len(broadcaster.pendingEvents) != 1 {
		t.Fatalf("expected 1 pending event before broadcast, got %d", len(broadcaster.pendingEvents))
	}

	// Broadcast with 0 clients should clear pending events and dirty state
	broadcaster.BroadcastSnapshot()
	if hub.MessageCount() != 0 {
		t.Errorf("expected 0 messages when no clients connected, got %d", hub.MessageCount())
	}
	if len(broadcaster.pendingEvents) != 0 {
		t.Errorf("expected pendingEvents to be drained/cleared when no clients connected, got %d", len(broadcaster.pendingEvents))
	}
	if broadcaster.dirty {
		t.Errorf("expected dirty to be false after BroadcastSnapshot")
	}
}

func TestLiveBroadcaster_GameEventsRideOnSnapshot(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	eventPkt := &packets.PacketEventData{
		Header: packets.PacketHeader{PacketId: packets.PacketIDEvent, SessionTime: 100.0},
	}
	copy(eventPkt.EventStringCode[:], packets.EventFastestLap)

	broadcaster.ProcessPacket(eventPkt)

	// Game events wait for the next snapshot instead of going out as their own message.
	if hub.MessageCount() != 0 {
		t.Fatalf("expected no message before the snapshot, got %d", hub.MessageCount())
	}

	broadcaster.BroadcastSnapshot()
	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 snapshot, got %d", hub.MessageCount())
	}

	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}
	if snapshot.Header.PacketId != packets.PacketIDLiveSnapshot {
		t.Errorf("expected PacketId %d, got %d", packets.PacketIDLiveSnapshot, snapshot.Header.PacketId)
	}
	if len(snapshot.Events) != 1 || snapshot.Events[0].EventCode != packets.EventFastestLap {
		t.Fatalf("expected the FTLP row in the snapshot, got %+v", snapshot.Events)
	}
	if snapshot.Events[0].SessionTime != 100.0 {
		t.Errorf("expected the event's session time, got %v", snapshot.Events[0].SessionTime)
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
	if evt.EventCode != packets.EventSafetyCarStatus || evt.Type != FeedTypeFlag || evt.Severity != FeedSeverityWarning {
		t.Errorf("unexpected event: %+v", evt)
	}
	if evt.SafetyCarStatus == nil || *evt.SafetyCarStatus != int(packets.SafetyCarFull) {
		t.Errorf("expected safety car status %d, got %v", packets.SafetyCarFull, evt.SafetyCarStatus)
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
	if len(snapshot.Events) != 1 || snapshot.Events[0].SafetyCarStatus == nil ||
		*snapshot.Events[0].SafetyCarStatus != int(packets.SafetyCarVirtual) {
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
	if pitEvt.EventCode != packets.EventTeamMateInPits || pitEvt.Type != FeedTypePit || *pitEvt.VehicleIdx != 0 ||
		pitEvt.DriverName != "Franco Colapinto" || *pitEvt.LapNum != 6 {
		t.Errorf("unexpected pit event: %+v", pitEvt)
	}

	// 2. Penalty event
	penEvt := snapshot.Events[1]
	if penEvt.EventCode != packets.EventPenaltyIssued || penEvt.Type != FeedTypePenalty || *penEvt.PenaltyTime != 5 {
		t.Errorf("unexpected penalty event: %+v", penEvt)
	}

	// 3. Retirement event
	retEvt := snapshot.Events[2]
	if retEvt.EventCode != packets.EventRetirement || retEvt.Type != FeedTypeRetirement || *retEvt.VehicleIdx != 1 ||
		retEvt.DriverName != "Max Verstappen" {
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

func TestLiveBroadcaster_ConcurrentProcessAndBroadcast(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	broadcaster := NewLiveBroadcaster(hub)

	var wg sync.WaitGroup
	// Goroutine 1: Continuous BroadcastSnapshot
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			broadcaster.BroadcastSnapshot()
			time.Sleep(50 * time.Microsecond)
		}
	}()

	// Goroutines 2 & 3: Continuous ProcessPacket
	for g := 0; g < 2; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				broadcaster.ProcessPacket(&packets.PacketCarTelemetryData{
					Header: packets.PacketHeader{
						PacketFormat: 2026,
						PacketId:     packets.PacketIDCarTelemetry,
						SessionUID:   0x123,
					},
				})
				broadcaster.ProcessPacket(&packets.PacketLapData{
					Header: packets.PacketHeader{
						PacketFormat: 2026,
						PacketId:     packets.PacketIDLapData,
						SessionUID:   0x123,
					},
				})
			}
		}()
	}

	wg.Wait()
}

// feedRow is one race-control feed entry as the frontend would list it.
type feedRow struct {
	code        string
	vehicleIdx  int
	penaltyType int
}

// feedRows collects the feed entries from every snapshot the hub received. The hub must only
// ever get snapshots: game events ride on them too.
func feedRows(t *testing.T, hub *mockHub) []feedRow {
	t.Helper()
	hub.mu.Lock()
	defer hub.mu.Unlock()

	rows := make([]feedRow, 0, len(hub.messages))
	for _, msg := range hub.messages {
		var probe struct {
			Header packets.PacketHeader
		}
		if err := json.Unmarshal(msg, &probe); err != nil {
			t.Fatalf("failed to unmarshal message: %v", err)
		}
		if probe.Header.PacketId != packets.PacketIDLiveSnapshot {
			t.Fatalf("expected only snapshots on /ws, got PacketId %d", probe.Header.PacketId)
		}
		var snap LiveSnapshot
		if err := json.Unmarshal(msg, &snap); err != nil {
			t.Fatalf("failed to unmarshal snapshot: %v", err)
		}
		for _, evt := range snap.Events {
			row := feedRow{code: evt.EventCode, vehicleIdx: -1, penaltyType: -1}
			if evt.VehicleIdx != nil {
				row.vehicleIdx = *evt.VehicleIdx
			}
			if evt.PenaltyType != nil {
				row.penaltyType = *evt.PenaltyType
			}
			rows = append(rows, row)
		}
	}
	return rows
}

// countRows counts feed entries for a car that match the predicate.
func countRows(rows []feedRow, vehicleIdx int, match func(feedRow) bool) int {
	n := 0
	for _, r := range rows {
		if r.vehicleIdx == vehicleIdx && match(r) {
			n++
		}
	}
	return n
}

func isRetirementRow(r feedRow) bool {
	return r.code == packets.EventRetirement ||
		(r.code == packets.EventPenaltyIssued && r.penaltyType == int(packets.PenaltyTypeRetired))
}

func isDSQRow(r feedRow) bool {
	return r.code == packets.EventDisqualification ||
		(r.code == packets.EventPenaltyIssued && r.penaltyType == int(packets.PenaltyTypeDisqualified))
}

func isTimePenaltyRow(r feedRow) bool {
	return r.code == packets.EventPenaltyIssued && !isRetirementRow(r) && !isDSQRow(r)
}

func isPitEntryRow(r feedRow) bool { return r.code == packets.EventTeamMateInPits }

// feedTestRig drives a LiveBroadcaster through a two-car race.
type feedTestRig struct {
	t      *testing.T
	hub    *mockHub
	b      *LiveBroadcaster
	header packets.PacketHeader
	laps   [packets.MaxCars]packets.LapData
}

func newFeedTestRig(t *testing.T, sessionUID uint64) *feedTestRig {
	t.Helper()
	r := &feedTestRig{
		t:   t,
		hub: &mockHub{clientCount: 1},
		header: packets.PacketHeader{
			PacketFormat: packets.PacketFormat2026,
			SessionUID:   sessionUID,
			SessionTime:  100,
		},
	}
	r.b = NewLiveBroadcaster(r.hub)

	var participants [packets.MaxCars]packets.ParticipantData
	copy(participants[0].Name[:], "Franco Colapinto")
	copy(participants[1].Name[:], "Max Verstappen")
	h := r.header
	h.PacketId = packets.PacketIDParticipants
	r.b.ProcessPacket(&packets.PacketParticipantsData{Header: h, NumActiveCars: 2, Participants: participants})

	for i := 0; i < 2; i++ {
		r.laps[i] = packets.LapData{CurrentLapNum: 5, CarPosition: uint8(i + 1), ResultStatus: packets.ResultStatusActive}
	}
	r.sendLaps()
	return r
}

func (r *feedTestRig) at(sessionTime float32) *feedTestRig {
	r.header.SessionTime = sessionTime
	return r
}

func (r *feedTestRig) sendLaps() {
	h := r.header
	h.PacketId = packets.PacketIDLapData
	r.b.ProcessPacket(&packets.PacketLapData{Header: h, LapData: r.laps})
}

func (r *feedTestRig) sendEvent(code string, payload any) {
	r.t.Helper()
	var buf bytes.Buffer
	if err := binary.Write(&buf, binary.LittleEndian, payload); err != nil {
		r.t.Fatalf("failed to encode event payload: %v", err)
	}
	h := r.header
	h.PacketId = packets.PacketIDEvent
	pkt := &packets.PacketEventData{Header: h}
	copy(pkt.EventStringCode[:], code)
	copy(pkt.EventDetails.Data[:], buf.Bytes())
	r.b.ProcessPacket(pkt)
}

func (r *feedTestRig) sendPenalty(vehicleIdx, penaltyType, seconds uint8) {
	r.sendEvent(packets.EventPenaltyIssued, packets.PenaltyEventData{
		PenaltyType:     penaltyType,
		VehicleIdx:      vehicleIdx,
		OtherVehicleIdx: packets.InvalidVehicleIdx,
		Time:            seconds,
		LapNum:          5,
	})
}

func (r *feedTestRig) rows() []feedRow {
	r.b.BroadcastSnapshot()
	return feedRows(r.t, r.hub)
}

func TestLiveBroadcaster_RetirementReportedOnce(t *testing.T) {
	t.Run("game RTMT first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xA1)
		r.at(110).sendEvent(packets.EventRetirement, packets.RetirementEventData{VehicleIdx: 1, Reason: packets.ResultReasonTerminalDamage})
		r.laps[1].ResultStatus = packets.ResultStatusRetired
		r.at(110.1).sendLaps()

		if n := countRows(r.rows(), 1, isRetirementRow); n != 1 {
			t.Errorf("expected 1 retirement row, got %d", n)
		}
	})

	t.Run("status change first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xA2)
		r.laps[1].ResultStatus = packets.ResultStatusDNF
		r.at(110).sendLaps()
		r.at(110.1).sendEvent(packets.EventRetirement, packets.RetirementEventData{VehicleIdx: 1, Reason: packets.ResultReasonMechanicalFailure})

		if n := countRows(r.rows(), 1, isRetirementRow); n != 1 {
			t.Errorf("expected 1 retirement row, got %d", n)
		}
	})

	t.Run("game PENA retired counts as the retirement", func(t *testing.T) {
		r := newFeedTestRig(t, 0xA3)
		r.at(110).sendPenalty(1, packets.PenaltyTypeRetired, 0)
		r.laps[1].ResultStatus = packets.ResultStatusRetired
		r.at(110.1).sendLaps()
		r.at(110.2).sendEvent(packets.EventRetirement, packets.RetirementEventData{VehicleIdx: 1})

		if n := countRows(r.rows(), 1, isRetirementRow); n != 1 {
			t.Errorf("expected 1 retirement row, got %d", n)
		}
	})
}

func TestLiveBroadcaster_DisqualificationReportedOnce(t *testing.T) {
	t.Run("game PENA first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xB1)
		r.at(120).sendPenalty(0, packets.PenaltyTypeDisqualified, 0)
		r.laps[0].ResultStatus = packets.ResultStatusDSQ
		r.at(120.1).sendLaps()

		if n := countRows(r.rows(), 0, isDSQRow); n != 1 {
			t.Errorf("expected 1 disqualification row, got %d", n)
		}
	})

	t.Run("status change first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xB2)
		r.laps[0].ResultStatus = packets.ResultStatusDSQ
		r.at(120).sendLaps()
		r.at(120.1).sendPenalty(0, packets.PenaltyTypeDisqualified, 0)

		if n := countRows(r.rows(), 0, isDSQRow); n != 1 {
			t.Errorf("expected 1 disqualification row, got %d", n)
		}
	})
}

func TestLiveBroadcaster_TimePenaltyReportedOnce(t *testing.T) {
	t.Run("game PENA first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xC1)
		r.at(130).sendPenalty(0, packets.PenaltyTypeTimePenalty, 5)
		r.laps[0].Penalties = 5
		r.at(130.1).sendLaps()

		if n := countRows(r.rows(), 0, isTimePenaltyRow); n != 1 {
			t.Errorf("expected 1 penalty row, got %d", n)
		}
	})

	t.Run("counter increase first", func(t *testing.T) {
		r := newFeedTestRig(t, 0xC2)
		r.laps[0].Penalties = 5
		r.at(130).sendLaps()
		r.at(130.05).sendPenalty(0, packets.PenaltyTypeTimePenalty, 5)

		rows := r.rows()
		if n := countRows(rows, 0, isTimePenaltyRow); n != 1 {
			t.Errorf("expected 1 penalty row, got %d", n)
		}
		// The game's event carries the penalty type, so it is the one kept.
		if n := countRows(rows, 0, func(fr feedRow) bool { return fr.penaltyType == int(packets.PenaltyTypeTimePenalty) }); n != 1 {
			t.Errorf("expected the game's PENA to be kept, rows: %+v", rows)
		}
	})

	t.Run("counter increase outside the window is still reported", func(t *testing.T) {
		r := newFeedTestRig(t, 0xC3)
		r.at(130).sendPenalty(0, packets.PenaltyTypeTimePenalty, 5)
		r.laps[0].Penalties = 5
		r.at(130.1).sendLaps()
		r.laps[0].Penalties = 10
		r.at(130 + packets.GamePenaltyEventWindowSeconds + 5).sendLaps()

		if n := countRows(r.rows(), 0, isTimePenaltyRow); n != 2 {
			t.Errorf("expected 2 penalty rows, got %d", n)
		}
	})

	t.Run("another car's PENA does not hide the counter increase", func(t *testing.T) {
		r := newFeedTestRig(t, 0xC4)
		r.at(130).sendPenalty(1, packets.PenaltyTypeTimePenalty, 5)
		r.laps[0].Penalties = 5
		r.at(130.1).sendLaps()

		if n := countRows(r.rows(), 0, isTimePenaltyRow); n != 1 {
			t.Errorf("expected 1 penalty row for car 0, got %d", n)
		}
	})
}

func TestLiveBroadcaster_TeamMateInPitsNotForwarded(t *testing.T) {
	r := newFeedTestRig(t, 0xD1)
	r.at(140).sendEvent(packets.EventTeamMateInPits, packets.TeamMateInPitsEventData{VehicleIdx: 1})

	if n := countRows(r.rows(), 1, isPitEntryRow); n != 0 {
		t.Fatalf("expected the game's TMPT not to be forwarded, got %d rows", n)
	}

	r.laps[1].PitStatus = packets.PitStatusPitting
	r.at(140.1).sendLaps()

	rows := r.rows()
	if n := countRows(rows, 1, isPitEntryRow); n != 1 {
		t.Errorf("expected 1 pit entry row from the broadcaster, got %d: %+v", n, rows)
	}
}

func TestLiveBroadcaster_ReportedFlagsResetOnSessionChange(t *testing.T) {
	r := newFeedTestRig(t, 0xE1)
	r.at(150).sendEvent(packets.EventRetirement, packets.RetirementEventData{VehicleIdx: 1})
	r.at(150).sendPenalty(0, packets.PenaltyTypeDisqualified, 0)
	r.at(150).sendPenalty(1, packets.PenaltyTypeTimePenalty, 5)
	r.b.BroadcastSnapshot()
	r.hub.mu.Lock()
	r.hub.messages = nil
	r.hub.mu.Unlock()

	// A new session starts with the same cars; the old reports must not hide new ones.
	r.header.SessionUID = 0xE2
	for i := 0; i < 2; i++ {
		r.laps[i] = packets.LapData{CurrentLapNum: 1, CarPosition: uint8(i + 1), ResultStatus: packets.ResultStatusActive}
	}
	r.at(150.5).sendLaps()

	r.laps[1].ResultStatus = packets.ResultStatusRetired
	r.laps[1].Penalties = 5
	r.laps[0].ResultStatus = packets.ResultStatusDSQ
	r.at(151).sendLaps()

	rows := r.rows()
	if n := countRows(rows, 1, isRetirementRow); n != 1 {
		t.Errorf("expected 1 retirement row in the new session, got %d: %+v", n, rows)
	}
	if n := countRows(rows, 0, isDSQRow); n != 1 {
		t.Errorf("expected 1 disqualification row in the new session, got %d: %+v", n, rows)
	}
	if n := countRows(rows, 1, isTimePenaltyRow); n != 1 {
		t.Errorf("expected 1 penalty row in the new session, got %d: %+v", n, rows)
	}
}

func TestLiveBroadcaster_FeedEventSink(t *testing.T) {
	for _, clients := range []int{0, 1} {
		hub := &mockHub{clientCount: clients}
		broadcaster := NewLiveBroadcaster(hub)
		type delivery struct {
			uid    uint64
			events []FeedEvent
		}
		var got []delivery
		broadcaster.SetFeedEventSink(func(uid uint64, events []FeedEvent) {
			got = append(got, delivery{uid, events})
		})

		header := packets.PacketHeader{PacketFormat: 2026, PacketId: packets.PacketIDSession, SessionUID: 0xFEED, SessionTime: 10}
		broadcaster.ProcessPacket(&packets.PacketSessionData{Header: header, SafetyCarStatus: packets.SafetyCarNone})
		broadcaster.BroadcastSnapshot()
		if len(got) != 0 {
			t.Fatalf("clients=%d: expected no delivery without new rows, got %d", clients, len(got))
		}

		header.SessionTime = 12
		broadcaster.ProcessPacket(&packets.PacketSessionData{Header: header, SafetyCarStatus: packets.SafetyCarVirtual})
		broadcaster.BroadcastSnapshot()
		if len(got) != 1 || got[0].uid != 0xFEED || len(got[0].events) != 1 ||
			got[0].events[0].EventCode != packets.EventSafetyCarStatus {
			t.Fatalf("clients=%d: expected the VSC row for session 0xFEED, got %+v", clients, got)
		}

		// Each row reaches the sink once
		broadcaster.BroadcastSnapshot()
		if len(got) != 1 {
			t.Errorf("clients=%d: expected no second delivery, got %d", clients, len(got))
		}
	}
}

func TestLiveBroadcaster_GapTrendsRideOnSnapshot(t *testing.T) {
	hub := &mockHub{clientCount: 1}
	b := NewLiveBroadcaster(hub)
	b.SetGapTrendSource(func() (ahead, behind *LiveGapTrend) {
		return &LiveGapTrend{CarIndex: 3, ChangePerLapMS: -120, Laps: 3}, nil
	})
	var status [packets.MaxCars]packets.CarStatusData
	status[0].VehicleFIAFlags = packets.VehicleFIAFlagYellow
	b.ProcessPacket(&packets.PacketCarStatusData{Header: packets.PacketHeader{PacketFormat: 2025}, CarStatusData: status})
	b.BroadcastSnapshot()

	if hub.MessageCount() != 1 {
		t.Fatalf("expected 1 snapshot, got %d", hub.MessageCount())
	}
	var snapshot LiveSnapshot
	if err := json.Unmarshal(hub.messages[0], &snapshot); err != nil {
		t.Fatalf("failed to unmarshal snapshot: %v", err)
	}
	if snapshot.GapAheadTrend == nil || *snapshot.GapAheadTrend != (LiveGapTrend{CarIndex: 3, ChangePerLapMS: -120, Laps: 3}) {
		t.Errorf("GapAheadTrend = %+v", snapshot.GapAheadTrend)
	}
	if snapshot.GapBehindTrend != nil {
		t.Errorf("GapBehindTrend = %+v, want omitted", snapshot.GapBehindTrend)
	}
	if len(snapshot.CarStatus) == 0 || snapshot.CarStatus[0].VehicleFIAFlags != packets.VehicleFIAFlagYellow {
		t.Errorf("player's VehicleFIAFlags not carried: %+v", snapshot.CarStatus)
	}
}
