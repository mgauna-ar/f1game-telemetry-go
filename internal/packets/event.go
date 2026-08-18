package packets

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
)

// Event code constants (4-character codes).
const (
	EventSessionStarted     = "SSTA"
	EventSessionEnded       = "SEND"
	EventFastestLap         = "FTLP"
	EventRetirement         = "RTMT"
	EventDRSEnabled         = "DRSE"
	EventDRSDisabled        = "DRSD"
	EventTeamMateInPits     = "TMPT"
	EventChequeredFlag      = "CHQF"
	EventRaceWinner         = "RCWN"
	EventPenaltyIssued      = "PENA"
	EventSpeedTrapTriggered = "SPTP"
	EventStartLights        = "STLG"
	EventLightsOut          = "LGOT"
	EventDriveThroughServed = "DTSV"
	EventStopGoServed       = "SGSV"
	EventFlashback          = "FLBK"
	EventButtonStatus       = "BUTN"
	EventRedFlag            = "RDFL"
	EventOvertake           = "OVTK"
	EventSafetyCarStatus    = "SCAR"
	EventCollision          = "COLL"
)

// EventDataDetails holds the raw 12 bytes of event payload union.
type EventDataDetails struct {
	Data [12]byte
}

// PacketEventData contains event data. Packet ID: 3.
type PacketEventData struct {
	Header          PacketHeader     `json:"Header"`
	EventStringCode [4]uint8         `json:"EventStringCode"`
	EventDetails    EventDataDetails `json:"EventDetails"`
}

func (p PacketEventData) GetHeader() PacketHeader { return p.Header }

// EventCode returns the event string code as a Go string (e.g., "SSTA", "FTLP").
func (p PacketEventData) EventCode() string {
	return string(p.EventStringCode[:])
}

// FastestLapEventData contains data specific to the fastest lap event.
type FastestLapEventData struct {
	VehicleIdx uint8   `json:"VehicleIdx"`
	LapTime    float32 `json:"LapTime"`
}

// RetirementEventData contains data specific to the retirement event.
type RetirementEventData struct {
	VehicleIdx uint8 `json:"VehicleIdx"`
	Reason     uint8 `json:"Reason"`
}

// DRSDisabledEventData contains data for DRS disabled event.
type DRSDisabledEventData struct {
	Reason uint8 `json:"Reason"`
}

// TeamMateInPitsEventData contains data specific to the teammate in pits event.
type TeamMateInPitsEventData struct {
	VehicleIdx uint8 `json:"VehicleIdx"`
}

// RaceWinnerEventData contains data specific to the race winner event.
type RaceWinnerEventData struct {
	VehicleIdx uint8 `json:"VehicleIdx"`
}

// PenaltyEventData contains data specific to the penalty event.
type PenaltyEventData struct {
	PenaltyType      uint8 `json:"PenaltyType"`
	InfringementType uint8 `json:"InfringementType"`
	VehicleIdx       uint8 `json:"VehicleIdx"`
	OtherVehicleIdx  uint8 `json:"OtherVehicleIdx"`
	Time             uint8 `json:"Time"`
	LapNum           uint8 `json:"LapNum"`
	PlacesGained     uint8 `json:"PlacesGained"`
}

// SpeedTrapEventData contains data specific to the speed trap event.
type SpeedTrapEventData struct {
	VehicleIdx                 uint8   `json:"VehicleIdx"`
	Speed                      float32 `json:"Speed"`
	IsOverallFastestInSession  uint8   `json:"IsOverallFastestInSession"`
	IsDriverFastestInSession   uint8   `json:"IsDriverFastestInSession"`
	FastestVehicleIdxInSession uint8   `json:"FastestVehicleIdxInSession"`
	FastestSpeedInSession      float32 `json:"FastestSpeedInSession"`
}

// StartLightsEventData contains data specific to the start lights event.
type StartLightsEventData struct {
	NumLights uint8 `json:"NumLights"`
}

// DriveThroughPenaltyServedEventData contains data for drive through penalty served.
type DriveThroughPenaltyServedEventData struct {
	VehicleIdx uint8 `json:"VehicleIdx"`
}

// StopGoPenaltyServedEventData contains data for stop go penalty served.
type StopGoPenaltyServedEventData struct {
	VehicleIdx uint8   `json:"VehicleIdx"`
	StopTime   float32 `json:"StopTime"`
}

// FlashbackEventData contains data for flashback activated.
type FlashbackEventData struct {
	FlashbackFrameIdentifier uint32  `json:"FlashbackFrameIdentifier"`
	FlashbackSessionTime     float32 `json:"FlashbackSessionTime"`
}

// ButtonsEventData contains data for button pressed.
type ButtonsEventData struct {
	ButtonStatus uint32 `json:"ButtonStatus"`
}

// OvertakeEventData contains data specific to the overtake event.
type OvertakeEventData struct {
	OvertakingVehicleIdx     uint8 `json:"OvertakingVehicleIdx"`
	BeingOvertakenVehicleIdx uint8 `json:"BeingOvertakenVehicleIdx"`
}

// SafetyCarEventData contains data for safety car events.
type SafetyCarEventData struct {
	SafetyCarType uint8 `json:"SafetyCarType"`
	EventType     uint8 `json:"EventType"`
}

// CollisionEventData contains data for collision events.
type CollisionEventData struct {
	Vehicle1Idx uint8 `json:"Vehicle1Idx"`
	Vehicle2Idx uint8 `json:"Vehicle2Idx"`
	Severity    uint8 `json:"Severity"`
}

type eventJSON struct {
	Header           PacketHeader `json:"Header"`
	EventCode        string       `json:"EventCode"`
	VehicleIdx       *uint8       `json:"VehicleIdx,omitempty"`
	OtherVehicleIdx  *uint8       `json:"OtherVehicleIdx,omitempty"`
	LapTime          *float32     `json:"LapTime,omitempty"`
	Speed            *float32     `json:"Speed,omitempty"`
	PenaltyType      *uint8       `json:"PenaltyType,omitempty"`
	PenaltyTime      *uint8       `json:"PenaltyTime,omitempty"`
	InfringementType *uint8       `json:"InfringementType,omitempty"`
	PlacesGained     *uint8       `json:"PlacesGained,omitempty"`
	LapNum           *uint8       `json:"LapNum,omitempty"`
	Reason           *uint8       `json:"Reason,omitempty"`
	SafetyCarType    *uint8       `json:"SafetyCarType,omitempty"`
	EventType        *uint8       `json:"EventType,omitempty"`
	Severity         *uint8       `json:"Severity,omitempty"`
}

func (p PacketEventData) MarshalJSON() ([]byte, error) {
	code := p.EventCode()
	ej := eventJSON{
		Header:    p.Header,
		EventCode: code,
	}
	r := bytes.NewReader(p.EventDetails.Data[:])
	switch code {
	case EventFastestLap:
		var d FastestLapEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.VehicleIdx
			ej.LapTime = &d.LapTime
		}
	case EventRetirement:
		var d RetirementEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.VehicleIdx
			ej.Reason = &d.Reason
		}
	case EventTeamMateInPits, EventRaceWinner, EventDriveThroughServed:
		var d TeamMateInPitsEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.VehicleIdx
		}
	case EventPenaltyIssued:
		var d PenaltyEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.VehicleIdx
			ej.OtherVehicleIdx = &d.OtherVehicleIdx
			ej.PenaltyType = &d.PenaltyType
			ej.InfringementType = &d.InfringementType
			ej.PenaltyTime = &d.Time
			ej.LapNum = &d.LapNum
			ej.PlacesGained = &d.PlacesGained
		}
	case EventSpeedTrapTriggered:
		var d SpeedTrapEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.VehicleIdx
			ej.Speed = &d.Speed
		}
	case EventOvertake:
		var d OvertakeEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.OvertakingVehicleIdx
			ej.OtherVehicleIdx = &d.BeingOvertakenVehicleIdx
		}
	case EventSafetyCarStatus:
		var d SafetyCarEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.SafetyCarType = &d.SafetyCarType
			ej.EventType = &d.EventType
		}
	case EventCollision:
		var d CollisionEventData
		if err := binary.Read(r, binary.LittleEndian, &d); err == nil {
			ej.VehicleIdx = &d.Vehicle1Idx
			ej.OtherVehicleIdx = &d.Vehicle2Idx
			ej.Severity = &d.Severity
		}
	}
	return json.Marshal(ej)
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
