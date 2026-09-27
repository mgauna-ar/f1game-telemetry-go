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

// FeedEventSink receives a session's race-control feed rows as the broadcaster sends them,
// whether or not a dashboard is connected. Session recording stores them
// (SessionManager.RecordFeedEvents), so the events are built once for both.
type FeedEventSink func(sessionUID uint64, events []FeedEvent)

// LiveBroadcaster aggregates high-frequency UDP telemetry packets and broadcasts consolidated snapshots at 10Hz.
type LiveBroadcaster struct {
	hub      HubBroadcaster
	mu       sync.RWMutex
	feedSink FeedEventSink

	dirty         bool
	latestHeader  packets.PacketHeader
	session       *packets.PacketSessionData
	participants  *packets.PacketParticipantsData
	lapData       *packets.PacketLapData
	carTelemetry  *packets.PacketCarTelemetryData
	carTelemetry2 *packets.PacketCarTelemetry2Data
	carStatus     *packets.PacketCarStatusData
	carDamage     *packets.PacketCarDamageData

	// State tracking for event synthesis
	sessionUID          uint64
	hasPrevSafetyCar    bool
	prevSafetyCarStatus uint8
	hasPrevLapData      [packets.MaxCars]bool
	prevLapData         [packets.MaxCars]packets.LapData
	pendingEvents       []FeedEvent

	// Per-car feed reports. The game and the lap data can both report the same
	// retirement, disqualification or time penalty; only the first one reaches the feed.
	retirementReported  [packets.MaxCars]bool
	dsqReported         [packets.MaxCars]bool
	hasGamePenalty      [packets.MaxCars]bool
	lastGamePenaltyTime [packets.MaxCars]float32
}

// NewLiveBroadcaster creates a new LiveBroadcaster.
func NewLiveBroadcaster(hub HubBroadcaster) *LiveBroadcaster {
	return &LiveBroadcaster{
		hub: hub,
	}
}

// SetFeedEventSink sets where the feed rows go besides the dashboards. Call it before Start.
func (b *LiveBroadcaster) SetFeedEventSink(sink FeedEventSink) {
	b.mu.Lock()
	b.feedSink = sink
	b.mu.Unlock()
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

func (b *LiveBroadcaster) checkSessionTransition(sessionUID uint64) {
	if sessionUID != 0 && b.sessionUID != sessionUID {
		b.sessionUID = sessionUID
		b.hasPrevSafetyCar = false
		b.prevSafetyCarStatus = packets.SafetyCarNone
		b.hasPrevLapData = [packets.MaxCars]bool{}
		b.prevLapData = [packets.MaxCars]packets.LapData{}
		b.pendingEvents = nil
		b.retirementReported = [packets.MaxCars]bool{}
		b.dsqReported = [packets.MaxCars]bool{}
		b.hasGamePenalty = [packets.MaxCars]bool{}
		b.lastGamePenaltyTime = [packets.MaxCars]float32{}
	}
}

// claimReport marks a car's report as sent. It returns false when it was already sent.
func claimReport(reported *[packets.MaxCars]bool, vehicleIdx int) bool {
	if vehicleIdx < 0 || vehicleIdx >= packets.MaxCars {
		return true
	}
	if reported[vehicleIdx] {
		return false
	}
	reported[vehicleIdx] = true
	return true
}

// withinGamePenaltyWindow reports whether two session times are close enough to be the same penalty.
func withinGamePenaltyWindow(a, b float32) bool {
	d := a - b
	if d < 0 {
		d = -d
	}
	return d <= packets.GamePenaltyEventWindowSeconds
}

// gamePenaltyReportedNear reports whether the game sent a PENA for the car near sessionTime.
func (b *LiveBroadcaster) gamePenaltyReportedNear(vehicleIdx int, sessionTime float32) bool {
	return b.hasGamePenalty[vehicleIdx] && withinGamePenaltyWindow(b.lastGamePenaltyTime[vehicleIdx], sessionTime)
}

// dropPendingPenalties removes the car's not yet broadcast penalty entries that the game's PENA replaces.
func (b *LiveBroadcaster) dropPendingPenalties(vehicleIdx int, sessionTime float32) {
	kept := b.pendingEvents[:0]
	for _, evt := range b.pendingEvents {
		if evt.EventCode == packets.EventPenaltyIssued && evt.VehicleIdx != nil && *evt.VehicleIdx == vehicleIdx &&
			withinGamePenaltyWindow(evt.SessionTime, sessionTime) {
			continue
		}
		kept = append(kept, evt)
	}
	b.pendingEvents = kept
}

// acceptGameEvent records what a raw game event reports and returns whether it
// should reach the feed. The caller must hold b.mu.
func (b *LiveBroadcaster) acceptGameEvent(p *packets.PacketEventData) bool {
	switch p.EventCode() {
	case packets.EventTeamMateInPits:
		// The pit-entry event built from lap data already covers every car, the teammate included.
		return false
	case packets.EventRetirement:
		d, ok := p.RetirementData()
		return !ok || claimReport(&b.retirementReported, int(d.VehicleIdx))
	case packets.EventPenaltyIssued:
		d, ok := p.PenaltyData()
		idx := int(d.VehicleIdx)
		if !ok || idx >= packets.MaxCars {
			return true
		}
		switch d.PenaltyType {
		case packets.PenaltyTypeDisqualified:
			return claimReport(&b.dsqReported, idx)
		case packets.PenaltyTypeRetired:
			return claimReport(&b.retirementReported, idx)
		}
		b.hasGamePenalty[idx] = true
		b.lastGamePenaltyTime[idx] = p.Header.SessionTime
		b.dropPendingPenalties(idx, p.Header.SessionTime)
	}
	return true
}

func (b *LiveBroadcaster) computeActiveCarCount() int {
	maxCars := packets.MaxCarsForFormat(b.latestHeader.PacketFormat)
	if maxCars <= 0 || maxCars > packets.MaxCars {
		maxCars = packets.MaxCars
	}

	playerIdx := int(b.latestHeader.PlayerCarIndex)
	highestActive := playerIdx

	for i := 0; i < maxCars; i++ {
		if b.isCarActive(i) {
			if i > highestActive {
				highestActive = i
			}
		}
	}

	count := highestActive + 1
	if b.participants != nil && int(b.participants.NumActiveCars) > count && int(b.participants.NumActiveCars) <= maxCars {
		count = int(b.participants.NumActiveCars)
	}
	if count < 1 {
		count = 1
	}
	if count > maxCars {
		count = maxCars
	}
	return count
}

func (b *LiveBroadcaster) isCarActive(i int) bool {
	if i == int(b.latestHeader.PlayerCarIndex) {
		return true
	}
	if b.participants != nil && i < len(b.participants.Participants) {
		p := b.participants.Participants[i]
		if p.AIControlled == 0 && p.NameString() != "" {
			return true
		}
		if p.NameString() != "" || p.RaceNumber > 0 || (p.DriverId > 0 && p.DriverId != packets.InvalidDriverID) {
			if b.lapData != nil && i < len(b.lapData.LapData) {
				lap := b.lapData.LapData[i]
				if lap.CarPosition > 0 ||
					lap.ResultStatus == packets.ResultStatusActive ||
					lap.ResultStatus == packets.ResultStatusFinished ||
					lap.ResultStatus == packets.ResultStatusDNF ||
					lap.ResultStatus == packets.ResultStatusDSQ ||
					lap.LastLapTimeInMS > 0 ||
					lap.CurrentLapTimeInMS > 0 ||
					lap.DriverStatus != packets.DriverStatusInGarage ||
					lap.LapDistance > 0 {
					return true
				}
			}
			if b.carTelemetry != nil && i < len(b.carTelemetry.CarTelemetryData) {
				if b.carTelemetry.CarTelemetryData[i].Speed > 0 {
					return true
				}
			}
		}
	}
	return false
}

// ProcessPacket receives an incoming UDP telemetry packet. Telemetry is aggregated, and game
// events join the feed rows the broadcaster builds itself; both go out in the next snapshot.
func (b *LiveBroadcaster) ProcessPacket(pkt packets.Packet) {
	if pkt == nil {
		return
	}

	header := pkt.GetHeader()

	switch p := pkt.(type) {
	case *packets.PacketEventData:
		b.mu.Lock()
		b.checkSessionTransition(header.SessionUID)
		if b.acceptGameEvent(p) {
			if evt, ok := b.gameFeedEvent(p); ok {
				b.pendingEvents = append(b.pendingEvents, evt)
			}
		}
		b.mu.Unlock()
	case *packets.PacketSessionData:
		b.mu.Lock()
		b.checkSessionTransition(header.SessionUID)
		b.latestHeader = header
		b.session = p

		// Synthesize Safety Car state changes
		if b.hasPrevSafetyCar {
			if b.prevSafetyCarStatus != p.SafetyCarStatus {
				b.pendingEvents = append(b.pendingEvents, safetyCarFeedEvent(p.SafetyCarStatus, header.SessionTime))
				b.prevSafetyCarStatus = p.SafetyCarStatus
			}
		} else {
			b.prevSafetyCarStatus = p.SafetyCarStatus
			b.hasPrevSafetyCar = true
		}

		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketParticipantsData:
		b.mu.Lock()
		b.checkSessionTransition(header.SessionUID)
		b.latestHeader = header
		b.participants = p
		b.dirty = true
		b.mu.Unlock()
	case *packets.PacketLapData:
		b.mu.Lock()
		b.checkSessionTransition(header.SessionUID)
		b.latestHeader = header
		b.lapData = p

		maxCars := packets.MaxCarsForFormat(header.PacketFormat)
		if maxCars <= 0 || maxCars > packets.MaxCars {
			maxCars = packets.MaxCars
		}

		for idx := 0; idx < maxCars; idx++ {
			curr := p.LapData[idx]
			if b.hasPrevLapData[idx] {
				prev := b.prevLapData[idx]
				lapNum := int(curr.CurrentLapNum)

				// Pit entry transition
				if prev.PitStatus == packets.PitStatusNone && (curr.PitStatus == packets.PitStatusPitting || curr.PitStatus == packets.PitStatusInPitArea) {
					b.pendingEvents = append(b.pendingEvents, b.carFeedEvent(
						packets.EventTeamMateInPits, FeedTypePit, FeedSeverityWarning, idx, lapNum, header.SessionTime))
				}

				// Penalty increment, unless the game's own PENA event already reported it
				if curr.Penalties > prev.Penalties && !b.gamePenaltyReportedNear(idx, header.SessionTime) {
					evt := b.carFeedEvent(packets.EventPenaltyIssued, FeedTypePenalty, FeedSeverityDanger, idx, lapNum, header.SessionTime)
					evt.PenaltyTime = ptrTo(int(curr.Penalties - prev.Penalties))
					b.pendingEvents = append(b.pendingEvents, evt)
				}

				// Retirement / DNF / DSQ transition
				prevStatus := prev.ResultStatus
				currStatus := curr.ResultStatus
				if prevStatus != packets.ResultStatusRetired && prevStatus != packets.ResultStatusDNF && prevStatus != packets.ResultStatusDSQ {
					switch currStatus {
					case packets.ResultStatusDSQ:
						if claimReport(&b.dsqReported, idx) {
							b.pendingEvents = append(b.pendingEvents, b.carFeedEvent(
								packets.EventDisqualification, FeedTypePenalty, FeedSeverityDanger, idx, lapNum, header.SessionTime))
						}
					case packets.ResultStatusRetired, packets.ResultStatusDNF:
						if claimReport(&b.retirementReported, idx) {
							b.pendingEvents = append(b.pendingEvents, b.carFeedEvent(
								packets.EventRetirement, FeedTypeRetirement, FeedSeverityDanger, idx, lapNum, header.SessionTime))
						}
					}
				}
			}

			b.prevLapData[idx] = curr
			b.hasPrevLapData[idx] = true
		}

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

// BroadcastSnapshot serializes and broadcasts the slim live snapshot (see LiveSnapshot) if changes
// are pending, and hands the new feed rows to the feed sink.
func (b *LiveBroadcaster) BroadcastSnapshot() {
	b.mu.Lock()
	// The rows leave the queue on every tick, with or without clients, so it never grows
	events := b.pendingEvents
	b.pendingEvents = nil
	sessionUID, sink := b.sessionUID, b.feedSink
	if sink != nil && len(events) > 0 {
		defer sink(sessionUID, events)
	}

	if b.hub == nil || b.hub.ClientCount() == 0 {
		b.dirty = false
		b.mu.Unlock()
		return
	}

	if !b.dirty && len(events) == 0 {
		b.mu.Unlock()
		return
	}

	snapshotHeader := b.latestHeader
	snapshotHeader.PacketId = packets.PacketIDLiveSnapshot

	activeCarCount := b.computeActiveCarCount()

	snapshot := LiveSnapshot{
		Header:         snapshotHeader,
		Session:        newLiveSession(b.session),
		Events:         events,
		ActiveCarCount: activeCarCount,
	}
	if b.participants != nil {
		snapshot.Participants = liveCars(&b.participants.Participants, activeCarCount, toLiveParticipant)
	}
	if b.lapData != nil {
		snapshot.LapData = liveCars(&b.lapData.LapData, activeCarCount, toLiveLapData)
	}
	if b.carTelemetry != nil {
		snapshot.CarTelemetry = liveCars(&b.carTelemetry.CarTelemetryData, activeCarCount, toLiveCarTelemetry)
	}
	if b.carTelemetry2 != nil {
		snapshot.CarTelemetry2 = liveCars(&b.carTelemetry2.CarTelemetry2Data, activeCarCount, toLiveCarTelemetry2)
	}
	if b.carStatus != nil {
		snapshot.CarStatus = liveCars(&b.carStatus.CarStatusData, activeCarCount, toLiveCarStatus)
	}
	if b.carDamage != nil {
		snapshot.CarDamage = liveCars(&b.carDamage.CarDamageData, activeCarCount, toLiveCarDamage)
	}
	b.dirty = false

	js, err := json.Marshal(snapshot)
	b.mu.Unlock()

	if err == nil {
		b.hub.Broadcast(js)
	}
}
