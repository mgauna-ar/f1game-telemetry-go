package session

import (
	"encoding/json"
	"log/slog"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// FeedEvent is one race-control feed row, sent in LiveSnapshot.Events. It carries an event code
// and typed parameters only; the dashboard writes the text in the viewer's language.
type FeedEvent struct {
	EventCode        string   `json:"eventCode" tstype:"FeedEventCode"`
	Type             string   `json:"type" tstype:"FeedEventType"`
	Severity         string   `json:"severity" tstype:"FeedSeverity"`
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
	SafetyCarStatus  *int     `json:"safetyCarStatus,omitempty"`
	SessionTime      float32  `json:"sessionTime,omitempty"`
	// RaceLap is the leader's lap when the event happened. Only the rows stored with a session
	// carry it (SessionManager.RecordFeedEvents); the live feed leaves it out.
	RaceLap int `json:"raceLap,omitempty"`
}

// Feed row categories: the dashboard's filter tabs, icons and tags.
const (
	FeedTypeFastestLap = "fastest_lap"
	FeedTypeOvertake   = "overtake"
	FeedTypePenalty    = "penalty"
	FeedTypeSpeedTrap  = "speed_trap"
	FeedTypePit        = "pit"
	FeedTypeRetirement = "retirement"
	FeedTypeFlag       = "flag"
	FeedTypeGeneral    = "general"
)

// Feed row severities: the dashboard's row colors.
const (
	FeedSeverityInfo    = "info"
	FeedSeverityWarning = "warning"
	FeedSeverityDanger  = "danger"
	FeedSeverityPurple  = "purple"
	FeedSeveritySuccess = "success"
)

// severePenaltySeconds is the time penalty from which a game PENA row is shown as danger.
const severePenaltySeconds = 10

// FeedEventCodes lists every event code the feed sends. The dashboard localizes each one;
// cmd/tsgen turns this list into the FeedEventCode union.
var FeedEventCodes = []string{
	// Game events (Packet ID 3) forwarded by gameFeedEvent.
	packets.EventSessionStarted,
	packets.EventSessionEnded,
	packets.EventFastestLap,
	packets.EventRetirement,
	packets.EventChequeredFlag,
	packets.EventRaceWinner,
	packets.EventPenaltyIssued,
	packets.EventSpeedTrapTriggered,
	packets.EventStartLights,
	packets.EventLightsOut,
	packets.EventDriveThroughServed,
	packets.EventStopGoServed,
	packets.EventRedFlag,
	packets.EventOvertake,
	packets.EventCollision,
	// Events the broadcaster builds from session and lap data.
	packets.EventTeamMateInPits,
	packets.EventDisqualification,
	packets.EventSafetyCarStatus,
}

// FeedEventTypes lists every feed row category, for the FeedEventType union.
var FeedEventTypes = []string{
	FeedTypeFastestLap, FeedTypeOvertake, FeedTypePenalty, FeedTypeSpeedTrap,
	FeedTypePit, FeedTypeRetirement, FeedTypeFlag, FeedTypeGeneral,
}

// FeedSeverities lists every feed row severity, for the FeedSeverity union.
var FeedSeverities = []string{
	FeedSeverityInfo, FeedSeverityWarning, FeedSeverityDanger, FeedSeverityPurple, FeedSeveritySuccess,
}

func ptrTo[T any](v T) *T { return &v }

// StoredFeedEvents decodes the feed rows stored with a session (SessionManager.RecordFeedEvents),
// in their stored order. A row that no longer decodes is skipped.
func StoredFeedEvents(rows []storage.SessionEvent) []FeedEvent {
	events := make([]FeedEvent, 0, len(rows))
	for _, row := range rows {
		var evt FeedEvent
		if err := json.Unmarshal(row.Data, &evt); err != nil {
			slog.Warn("Skipping a stored feed event that does not decode", "eventCode", row.EventCode, "error", err)
			continue
		}
		events = append(events, evt)
	}
	return events
}

// driverName returns the car's driver name, or "" when the game has not named it yet.
// The dashboard shows its own localized fallback for an unnamed car.
func (b *LiveBroadcaster) driverName(vehicleIdx int) string {
	if b.participants == nil || vehicleIdx < 0 || vehicleIdx >= len(b.participants.Participants) {
		return ""
	}
	p := b.participants.Participants[vehicleIdx]
	if name := p.NameString(); name != "" {
		return name
	}
	return packets.DriverNames[p.DriverId]
}

// withVehicle sets the car an event is about. Out of range indices (the game's "no car") are left out.
func (b *LiveBroadcaster) withVehicle(evt *FeedEvent, vehicleIdx int) {
	if vehicleIdx < 0 || vehicleIdx >= packets.MaxCars {
		return
	}
	evt.VehicleIdx = ptrTo(vehicleIdx)
	evt.DriverName = b.driverName(vehicleIdx)
}

// withOtherVehicle sets the second car of an overtake, collision or penalty.
func (b *LiveBroadcaster) withOtherVehicle(evt *FeedEvent, vehicleIdx int) {
	if vehicleIdx < 0 || vehicleIdx >= packets.MaxCars {
		return
	}
	evt.OtherVehicleIdx = ptrTo(vehicleIdx)
	evt.TargetDriverName = b.driverName(vehicleIdx)
}

// gameFeedEvent turns a game event into a feed row. It returns false for events the feed does
// not show (DRS, buttons, flashbacks) and for the ones the broadcaster builds itself from
// session and lap data (TMPT, SCAR). The caller must hold b.mu.
func (b *LiveBroadcaster) gameFeedEvent(p *packets.PacketEventData) (FeedEvent, bool) {
	evt := FeedEvent{EventCode: p.EventCode(), SessionTime: p.Header.SessionTime}

	switch evt.EventCode {
	case packets.EventFastestLap:
		d, ok := p.FastestLapData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.LapTime = ptrTo(d.LapTime)
		evt.Type, evt.Severity = FeedTypeFastestLap, FeedSeverityPurple
	case packets.EventOvertake:
		d, ok := p.OvertakeData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.OvertakingVehicleIdx))
		b.withOtherVehicle(&evt, int(d.BeingOvertakenVehicleIdx))
		evt.Type, evt.Severity = FeedTypeOvertake, FeedSeverityInfo
	case packets.EventPenaltyIssued:
		d, ok := p.PenaltyData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		b.withOtherVehicle(&evt, int(d.OtherVehicleIdx))
		evt.PenaltyType = ptrTo(int(d.PenaltyType))
		evt.InfringementType = ptrTo(int(d.InfringementType))
		evt.LapNum = ptrTo(int(d.LapNum))
		evt.PlacesGained = ptrTo(int(d.PlacesGained))
		severe := d.PenaltyType == packets.PenaltyTypeDisqualified
		if d.Time != packets.PenaltyTimeNotApplicable {
			evt.PenaltyTime = ptrTo(int(d.Time))
			severe = severe || d.Time >= severePenaltySeconds
		}
		evt.Type, evt.Severity = FeedTypePenalty, FeedSeverityWarning
		if severe {
			evt.Severity = FeedSeverityDanger
		}
	case packets.EventSpeedTrapTriggered:
		d, ok := p.SpeedTrapData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.Speed = ptrTo(d.Speed)
		evt.Type, evt.Severity = FeedTypeSpeedTrap, FeedSeveritySuccess
	case packets.EventRetirement:
		d, ok := p.RetirementData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.Type, evt.Severity = FeedTypeRetirement, FeedSeverityDanger
	case packets.EventDriveThroughServed:
		d, ok := p.DriveThroughServedData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.Type, evt.Severity = FeedTypePenalty, FeedSeverityInfo
	case packets.EventStopGoServed:
		d, ok := p.StopGoServedData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.Type, evt.Severity = FeedTypePenalty, FeedSeverityInfo
	case packets.EventCollision:
		d, ok := p.CollisionData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.Vehicle1Idx))
		b.withOtherVehicle(&evt, int(d.Vehicle2Idx))
		evt.Type, evt.Severity = FeedTypePenalty, FeedSeverityDanger
	case packets.EventRaceWinner:
		d, ok := p.RaceWinnerData()
		if !ok {
			return FeedEvent{}, false
		}
		b.withVehicle(&evt, int(d.VehicleIdx))
		evt.Type, evt.Severity = FeedTypeGeneral, FeedSeveritySuccess
	case packets.EventRedFlag:
		evt.Type, evt.Severity = FeedTypeFlag, FeedSeverityDanger
	case packets.EventChequeredFlag:
		evt.Type, evt.Severity = FeedTypeFlag, FeedSeverityInfo
	case packets.EventSessionStarted:
		evt.Type, evt.Severity = FeedTypeGeneral, FeedSeverityInfo
	case packets.EventSessionEnded:
		evt.Type, evt.Severity = FeedTypeGeneral, FeedSeverityPurple
	case packets.EventStartLights:
		evt.Type, evt.Severity = FeedTypeGeneral, FeedSeverityWarning
	case packets.EventLightsOut:
		evt.Type, evt.Severity = FeedTypeGeneral, FeedSeveritySuccess
	default:
		return FeedEvent{}, false
	}
	return evt, true
}

// safetyCarFeedEvent is the feed row for a change of the session's safety car status.
func safetyCarFeedEvent(status uint8, sessionTime float32) FeedEvent {
	evt := FeedEvent{
		EventCode:       packets.EventSafetyCarStatus,
		Type:            FeedTypeFlag,
		SafetyCarStatus: ptrTo(int(status)),
		SessionTime:     sessionTime,
	}
	switch status {
	case packets.SafetyCarFull, packets.SafetyCarVirtual:
		evt.Severity = FeedSeverityWarning
	case packets.SafetyCarFormationLap:
		evt.Severity = FeedSeverityInfo
	default:
		evt.Severity = FeedSeveritySuccess
	}
	return evt
}

// carFeedEvent is a feed row the broadcaster builds from a car's lap data.
func (b *LiveBroadcaster) carFeedEvent(code, feedType, severity string, vehicleIdx, lapNum int, sessionTime float32) FeedEvent {
	evt := FeedEvent{
		EventCode:   code,
		Type:        feedType,
		Severity:    severity,
		LapNum:      ptrTo(lapNum),
		SessionTime: sessionTime,
	}
	b.withVehicle(&evt, vehicleIdx)
	return evt
}
