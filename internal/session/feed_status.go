package session

import "time"

// FeedStatus is what the live feed last received, for GET /api/system/status. Pages that don't
// open /ws read it to tell whether a session is live.
type FeedStatus struct {
	// LastPacketAt is when the last packet of any kind arrived; zero before the first one.
	LastPacketAt time.Time
	// Session is the last session the game reported; nil before the first session packet.
	Session *FeedSession
}

// FeedSession identifies the session the game is sending.
type FeedSession struct {
	SessionUID     uint64
	SessionType    uint8
	TrackID        int8
	PacketFormat   uint16
	PlayerCarIndex uint8
}

// FeedStatus reports when the last packet arrived and which session the game last reported.
func (b *LiveBroadcaster) FeedStatus() FeedStatus {
	var status FeedStatus
	if at := b.lastPacketAt.Load(); at != 0 {
		status.LastPacketAt = time.Unix(0, at)
	}

	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.session != nil {
		status.Session = &FeedSession{
			SessionUID:     b.sessionHeader.SessionUID,
			SessionType:    b.session.SessionType,
			TrackID:        b.session.TrackId,
			PacketFormat:   b.sessionHeader.PacketFormat,
			PlayerCarIndex: b.latestHeader.PlayerCarIndex,
		}
	}
	return status
}

// notePacket records a packet's arrival time for FeedStatus.
func (b *LiveBroadcaster) notePacket(now time.Time) {
	b.lastPacketAt.Store(now.UnixNano())
}
