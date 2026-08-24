package session

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// HubBroadcaster represents the WebSocket broadcasting hub interface.
type HubBroadcaster interface {
	Broadcast(msg []byte)
	ClientCount() int
}

// LiveSnapshot represents a consolidated 10Hz live session telemetry state.
type LiveSnapshot struct {
	Header        packets.PacketHeader             `json:"Header"`
	Session       *packets.PacketSessionData       `json:"Session,omitempty"`
	Participants  *packets.PacketParticipantsData  `json:"Participants,omitempty"`
	LapData       *packets.PacketLapData           `json:"LapData,omitempty"`
	CarTelemetry  *packets.PacketCarTelemetryData  `json:"CarTelemetry,omitempty"`
	CarTelemetry2 *packets.PacketCarTelemetry2Data `json:"CarTelemetry2,omitempty"`
	CarStatus     *packets.PacketCarStatusData     `json:"CarStatus,omitempty"`
	CarDamage     *packets.PacketCarDamageData     `json:"CarDamage,omitempty"`
}

// LiveBroadcaster aggregates high-frequency UDP telemetry packets and broadcasts consolidated snapshots at 10Hz.
type LiveBroadcaster struct {
	hub HubBroadcaster
	mu  sync.RWMutex

	dirty         bool
	latestHeader  packets.PacketHeader
	session       *packets.PacketSessionData
	participants  *packets.PacketParticipantsData
	lapData       *packets.PacketLapData
	carTelemetry  *packets.PacketCarTelemetryData
	carTelemetry2 *packets.PacketCarTelemetry2Data
	carStatus     *packets.PacketCarStatusData
	carDamage     *packets.PacketCarDamageData
}

// NewLiveBroadcaster creates a new LiveBroadcaster.
func NewLiveBroadcaster(hub HubBroadcaster) *LiveBroadcaster {
	return &LiveBroadcaster{
		hub: hub,
	}
}

// Start runs the periodic snapshot broadcast loop at the specified interval.
func (b *LiveBroadcaster) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				b.BroadcastSnapshot()
			}
		}
	}()
}

// ProcessPacket receives an incoming UDP telemetry packet.
// Sparse critical event packets are broadcast immediately, while high-frequency telemetry is aggregated.
func (b *LiveBroadcaster) ProcessPacket(pkt packets.Packet) {
	if pkt == nil {
		return
	}

	header := pkt.GetHeader()

	switch p := pkt.(type) {
	case *packets.PacketEventData:
		// Events are sparse and time-critical (penalties, overtakes, fastest laps): broadcast immediately
		if b.hub != nil && b.hub.ClientCount() > 0 {
			if js, err := json.Marshal(p); err == nil {
				b.hub.Broadcast(js)
			}
		}
	case *packets.PacketSessionData:
		b.mu.Lock()
		b.latestHeader = header
		b.session = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketParticipantsData:
		b.mu.Lock()
		b.latestHeader = header
		b.participants = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketLapData:
		b.mu.Lock()
		b.latestHeader = header
		b.lapData = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketCarTelemetryData:
		b.mu.Lock()
		b.latestHeader = header
		b.carTelemetry = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketCarTelemetry2Data:
		b.mu.Lock()
		b.latestHeader = header
		b.carTelemetry2 = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketCarStatusData:
		b.mu.Lock()
		b.latestHeader = header
		b.carStatus = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketCarDamageData:
		b.mu.Lock()
		b.latestHeader = header
		b.carDamage = p
		b.dirty = true
		b.mu.Unlock()
	}
}

// BroadcastSnapshot serializes and broadcasts the consolidated live snapshot if changes are pending.
func (b *LiveBroadcaster) BroadcastSnapshot() {
	if b.hub == nil || b.hub.ClientCount() == 0 {
		return
	}

	b.mu.Lock()
	if !b.dirty {
		b.mu.Unlock()
		return
	}

	snapshotHeader := b.latestHeader
	snapshotHeader.PacketId = packets.PacketIDLiveSnapshot

	snapshot := LiveSnapshot{
		Header:        snapshotHeader,
		Session:       b.session,
		Participants:  b.participants,
		LapData:       b.lapData,
		CarTelemetry:  b.carTelemetry,
		CarTelemetry2: b.carTelemetry2,
		CarStatus:     b.carStatus,
		CarDamage:     b.carDamage,
	}
	b.dirty = false
	b.mu.Unlock()

	if js, err := json.Marshal(snapshot); err == nil {
		b.hub.Broadcast(js)
	}
}
