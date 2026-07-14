package packets

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// Event code constants (4-character codes).
const (
	EventSessionStarted      = "SSTA"
	EventSessionEnded        = "SEND"
	EventFastestLap          = "FTLP"
	EventRetirement          = "RTMT"
	EventDRSEnabled          = "DRSE"
	EventDRSDisabled         = "DRSD"
	EventTeamMateInPits      = "TMPT"
	EventChequeredFlag       = "CHQF"
	EventRaceWinner          = "RCWN"
	EventPenaltyIssued       = "PENA"
	EventSpeedTrapTriggered  = "SPTP"
	EventStartLights         = "STLG"
	EventLightsOut           = "LGOT"
	EventDriveThroughServed  = "DTSV"
	EventStopGoServed        = "SGSV"
	EventFlashback           = "FLBK"
	EventButtonStatus        = "BUTN"
	EventOvertake            = "OVTK"
	EventSafetyCarStatus     = "SCAR"
	EventCollision           = "COLL"
)

// EventDataDetails is a union-like struct holding event-specific data.
// The interpretation depends on the event code. The raw bytes are stored
// and can be parsed further based on the event type.
type EventDataDetails struct {
	Data [12]byte
}

// PacketEventData contains event data. Packet ID: 3.
// The EventStringCode identifies the event type, and EventDetails contains
// event-specific data whose interpretation depends on the event code.
type PacketEventData struct {
	Header          PacketHeader
	EventStringCode [4]uint8
	EventDetails    EventDataDetails
}

func (p PacketEventData) GetHeader() PacketHeader { return p.Header }

// EventCode returns the event string code as a Go string (e.g., "SSTA", "FTLP").
func (p PacketEventData) EventCode() string {
	return string(p.EventStringCode[:])
}

// FastestLapEventData contains data specific to the fastest lap event.
type FastestLapEventData struct {
	VehicleIdx uint8
	LapTime    float32
}

// RetirementEventData contains data specific to the retirement event.
type RetirementEventData struct {
	VehicleIdx uint8
}

// TeamMateInPitsEventData contains data specific to the teammate in pits event.
type TeamMateInPitsEventData struct {
	VehicleIdx uint8
}

// RaceWinnerEventData contains data specific to the race winner event.
type RaceWinnerEventData struct {
	VehicleIdx uint8
}

// PenaltyEventData contains data specific to the penalty event.
type PenaltyEventData struct {
	PenaltyType      uint8
	InfringementType uint8
	VehicleIdx       uint8
	OtherVehicleIdx  uint8
	Time             uint8
	LapNum           uint8
	PlacesGained     uint8
}

// SpeedTrapEventData contains data specific to the speed trap event.
type SpeedTrapEventData struct {
	VehicleIdx                 uint8
	Speed                      float32
	IsOverallFastestInSession  uint8
	IsDriverFastestInSession   uint8
	FastestVehicleIdxInSession uint8
	FastestSpeedInSession      float32
}

// StartLightsEventData contains data specific to the start lights event.
type StartLightsEventData struct {
	NumLights uint8
}

// OvertakeEventData contains data specific to the overtake event.
type OvertakeEventData struct {
	OvertakingVehicleIdx  uint8
	BeingOvertakenVehicleIdx uint8
}

// DecodeEvent decodes a PacketEventData from raw bytes.
func DecodeEvent(data []byte) (*PacketEventData, error) {
	var pkt PacketEventData
	err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &pkt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode event packet: %w", err)
	}
	return &pkt, nil
}
