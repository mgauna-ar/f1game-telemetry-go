package session

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// HubBroadcaster represents the WebSocket broadcasting hub interface.
type HubBroadcaster interface {
	Broadcast(msg []byte)
	ClientCount() int
}

// SyntheticEvent represents a server-synthesized live race event.
type SyntheticEvent struct {
	EventCode        string   `json:"eventCode"`
	Type             string   `json:"type"`
	Description      string   `json:"description"`
	VehicleIdx       *int     `json:"vehicleIdx,omitempty"`
	DriverName       string   `json:"driverName,omitempty"`
	OtherVehicleIdx  *int     `json:"otherVehicleIdx,omitempty"`
	TargetDriverName string   `json:"targetDriverName,omitempty"`
	LapNum           *int     `json:"lapNum,omitempty"`
	Speed            *float32 `json:"speed,omitempty"`
	LapTime          *float32 `json:"lapTime,omitempty"`
	PenaltyType      *int     `json:"penaltyType,omitempty"`
	InfringementType *int     `json:"infringementType,omitempty"`
	PenaltyTime      *int     `json:"penaltyTime,omitempty"`
	PlacesGained     *int     `json:"placesGained,omitempty"`
	Severity         string   `json:"severity"`
	SessionTime      float32  `json:"sessionTime,omitempty"`
}

// LiveSnapshot represents a consolidated 10Hz live session telemetry state.
type LiveSnapshot struct {
	Header         packets.PacketHeader             `json:"Header"`
	Session        *packets.PacketSessionData       `json:"Session,omitempty"`
	Participants   *packets.PacketParticipantsData  `json:"Participants,omitempty"`
	LapData        *packets.PacketLapData           `json:"LapData,omitempty"`
	CarTelemetry   *packets.PacketCarTelemetryData  `json:"CarTelemetry,omitempty"`
	CarTelemetry2  *packets.PacketCarTelemetry2Data `json:"CarTelemetry2,omitempty"`
	CarStatus      *packets.PacketCarStatusData     `json:"CarStatus,omitempty"`
	CarDamage      *packets.PacketCarDamageData     `json:"CarDamage,omitempty"`
	Events         []SyntheticEvent                 `json:"Events,omitempty"`
	ActiveCarCount int                              `json:"ActiveCarCount,omitempty"`
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

	// State tracking for event synthesis
	sessionUID          uint64
	hasPrevSafetyCar    bool
	prevSafetyCarStatus uint8
	hasPrevLapData      [packets.MaxCars]bool
	prevLapData         [packets.MaxCars]packets.LapData
	pendingEvents       []SyntheticEvent
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

func (b *LiveBroadcaster) checkSessionTransition(sessionUID uint64) {
	if sessionUID != 0 && b.sessionUID != sessionUID {
		b.sessionUID = sessionUID
		b.hasPrevSafetyCar = false
		b.prevSafetyCarStatus = packets.SafetyCarNone
		b.hasPrevLapData = [packets.MaxCars]bool{}
		b.prevLapData = [packets.MaxCars]packets.LapData{}
		b.pendingEvents = nil
	}
}

func (b *LiveBroadcaster) getDriverName(vehicleIdx int) string {
	if b.participants != nil && vehicleIdx >= 0 && vehicleIdx < len(b.participants.Participants) {
		p := b.participants.Participants[vehicleIdx]
		name := p.NameString()
		if name != "" {
			return name
		}
		if p.RaceNumber > 0 {
			return fmt.Sprintf("Driver #%d", p.RaceNumber)
		}
	}
	return fmt.Sprintf("Car #%d", vehicleIdx+1)
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
		b.checkSessionTransition(header.SessionUID)
		b.latestHeader = header
		b.session = p

		// Synthesize Safety Car state changes
		if b.hasPrevSafetyCar {
			if b.prevSafetyCarStatus != p.SafetyCarStatus {
				var desc string
				var sev string
				switch p.SafetyCarStatus {
				case packets.SafetyCarFull:
					desc = "Full Safety Car Deployed"
					sev = "warning"
				case packets.SafetyCarVirtual:
					desc = "Virtual Safety Car Deployed"
					sev = "warning"
				case packets.SafetyCarFormationLap:
					desc = "Formation Lap In Progress"
					sev = "info"
				default:
					desc = "Track Clear (Green Flag)"
					sev = "success"
				}
				b.pendingEvents = append(b.pendingEvents, SyntheticEvent{
					EventCode:   packets.EventSafetyCarStatus,
					Type:        "flag",
					Description: desc,
					Severity:    sev,
					SessionTime: header.SessionTime,
				})
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
				driverName := b.getDriverName(idx)
				vIdx := idx
				lapNum := int(curr.CurrentLapNum)

				// Pit entry transition
				if prev.PitStatus == packets.PitStatusNone && (curr.PitStatus == packets.PitStatusPitting || curr.PitStatus == packets.PitStatusInPitArea) {
					b.pendingEvents = append(b.pendingEvents, SyntheticEvent{
						EventCode:   packets.EventTeamMateInPits,
						Type:        "pit",
						Description: fmt.Sprintf("%s entered the pit lane (Lap %d)", driverName, lapNum),
						VehicleIdx:  &vIdx,
						DriverName:  driverName,
						LapNum:      &lapNum,
						Severity:    "warning",
						SessionTime: header.SessionTime,
					})
				}

				// Penalty increment
				if curr.Penalties > prev.Penalties {
					added := int(curr.Penalties - prev.Penalties)
					b.pendingEvents = append(b.pendingEvents, SyntheticEvent{
						EventCode:   packets.EventPenaltyIssued,
						Type:        "penalty",
						Description: fmt.Sprintf("%s received +%ds penalty (Lap %d)", driverName, added, lapNum),
						VehicleIdx:  &vIdx,
						DriverName:  driverName,
						LapNum:      &lapNum,
						PenaltyTime: &added,
						Severity:    "danger",
						SessionTime: header.SessionTime,
					})
				}

				// Retirement / DNF / DSQ transition
				prevStatus := prev.ResultStatus
				currStatus := curr.ResultStatus
				if prevStatus != packets.ResultStatusRetired && prevStatus != packets.ResultStatusDNF && prevStatus != packets.ResultStatusDSQ {
					switch currStatus {
					case packets.ResultStatusDSQ:
						b.pendingEvents = append(b.pendingEvents, SyntheticEvent{
							EventCode:   "DSQ",
							Type:        "penalty",
							Description: fmt.Sprintf("%s was disqualified from the session", driverName),
							VehicleIdx:  &vIdx,
							DriverName:  driverName,
							LapNum:      &lapNum,
							Severity:    "danger",
							SessionTime: header.SessionTime,
						})
					case packets.ResultStatusRetired, packets.ResultStatusDNF:
						b.pendingEvents = append(b.pendingEvents, SyntheticEvent{
							EventCode:   packets.EventRetirement,
							Type:        "retirement",
							Description: fmt.Sprintf("%s retired from the session (Lap %d)", driverName, lapNum),
							VehicleIdx:  &vIdx,
							DriverName:  driverName,
							LapNum:      &lapNum,
							Severity:    "danger",
							SessionTime: header.SessionTime,
						})
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

// BroadcastSnapshot serializes and broadcasts the consolidated live snapshot if changes are pending.
func (b *LiveBroadcaster) BroadcastSnapshot() {
	if b.hub == nil || b.hub.ClientCount() == 0 {
		return
	}

	b.mu.Lock()
	if !b.dirty && len(b.pendingEvents) == 0 {
		b.mu.Unlock()
		return
	}

	snapshotHeader := b.latestHeader
	snapshotHeader.PacketId = packets.PacketIDLiveSnapshot

	activeCarCount := b.computeActiveCarCount()

	var eventsCopy []SyntheticEvent
	if len(b.pendingEvents) > 0 {
		eventsCopy = make([]SyntheticEvent, len(b.pendingEvents))
		copy(eventsCopy, b.pendingEvents)
		b.pendingEvents = nil
	}

	snapshot := LiveSnapshot{
		Header:         snapshotHeader,
		Session:        b.session,
		Participants:   b.participants,
		LapData:        b.lapData,
		CarTelemetry:   b.carTelemetry,
		CarTelemetry2:  b.carTelemetry2,
		CarStatus:      b.carStatus,
		CarDamage:      b.carDamage,
		Events:         eventsCopy,
		ActiveCarCount: activeCarCount,
	}
	b.dirty = false
	b.mu.Unlock()

	if js, err := json.Marshal(snapshot); err == nil {
		b.hub.Broadcast(js)
	}
}
