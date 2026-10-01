package session

import (
	"testing"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

func TestLiveBroadcaster_FeedStatus(t *testing.T) {
	b := NewLiveBroadcaster(&mockHub{})

	if status := b.FeedStatus(); !status.LastPacketAt.IsZero() || status.Session != nil {
		t.Fatalf("before any packet: %+v, want zero", status)
	}

	// A lap packet arrives before the session packet: time known, session not yet
	header := packets.PacketHeader{PacketFormat: 2025, SessionUID: 0xABC, PlayerCarIndex: 4}
	before := time.Now()
	b.ProcessPacket(&packets.PacketLapData{Header: header})
	status := b.FeedStatus()
	if status.LastPacketAt.Before(before) {
		t.Errorf("LastPacketAt = %v, want at or after %v", status.LastPacketAt, before)
	}
	if status.Session != nil {
		t.Errorf("Session = %+v before a session packet, want nil", status.Session)
	}

	b.ProcessPacket(&packets.PacketSessionData{Header: header, SessionType: 15, TrackId: 10})
	want := FeedSession{SessionUID: 0xABC, SessionType: 15, TrackID: 10, PacketFormat: 2025, PlayerCarIndex: 4}
	if got := b.FeedStatus().Session; got == nil || *got != want {
		t.Errorf("Session = %+v, want %+v", got, want)
	}
}
