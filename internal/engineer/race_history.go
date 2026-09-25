package engineer

import (
	"fmt"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// LapRecord captures the player's car at the end of a completed lap, so the AI race
// engineer can reason about pace, tyre wear, fuel burn and gap trends over a stint.
type LapRecord struct {
	LapNumber    int        `json:"lap"`
	LapTimeMS    uint32     `json:"lap_time_ms"`
	Sector1MS    uint32     `json:"sector1_ms,omitempty"`
	Sector2MS    uint32     `json:"sector2_ms,omitempty"`
	Sector3MS    uint32     `json:"sector3_ms,omitempty"`
	Valid        bool       `json:"valid"`
	Compound     string     `json:"compound,omitempty"`
	TyreAgeLaps  int        `json:"tyre_age_laps"`
	TyreWearPct  [4]float32 `json:"tyre_wear_pct"`
	FuelKg       float32    `json:"fuel_kg"`
	Position     int        `json:"position"`
	PitStops     int        `json:"pit_stops"`
	CarAheadIdx  int        `json:"-"`
	GapAheadMS   uint32     `json:"-"`
	CarBehindIdx int        `json:"-"`
	GapBehindMS  uint32     `json:"-"`
}

// RaceEventRecord is a notable race event (fastest lap, retirement, penalty, pit stop, safety car...).
type RaceEventRecord struct {
	Lap         int     `json:"lap"`
	SessionTime float32 `json:"session_time_s"`
	Description string  `json:"description"`
}

// RadioCallRecord is a proactive call the pit wall already made to the driver.
type RadioCallRecord struct {
	Lap         int     `json:"lap"`
	SessionTime float32 `json:"session_time_s"`
	Message     string  `json:"message"`
	Urgency     string  `json:"urgency"`
}

// raceHistory accumulates what happened earlier in the session: the player's completed laps,
// per-car session history, notable race events and the proactive radio calls already made.
type raceHistory struct {
	playerLaps []LapRecord
	carHistory [packets.MaxCars]*packets.PacketSessionHistoryData
	events     []RaceEventRecord
	radioCalls []RadioCallRecord
}

func appendCapped[T any](items []T, item T, maxLen int) []T {
	items = append(items, item)
	if len(items) > maxLen {
		items = items[len(items)-maxLen:]
	}
	return items
}

// recordLapTransitionsLocked compares the incoming lap data with the previous snapshot to
// log the player's completed laps and other cars' pit stops. Must hold e.mu.
func (e *EngineerEngine) recordLapTransitionsLocked(next *packets.PacketLapData) {
	prev := e.latestLapData
	if prev == nil || e.playerCarIndex < 0 || e.playerCarIndex >= len(next.LapData) {
		return
	}

	e.recordRivalPitStopsLocked(prev, next)

	before := prev.LapData[e.playerCarIndex]
	after := next.LapData[e.playerCarIndex]
	switch {
	case after.CurrentLapNum < before.CurrentLapNum:
		// Flashback or session restart: forget laps that are being re-driven.
		e.truncatePlayerLapsLocked(int(after.CurrentLapNum))
	case after.CurrentLapNum > before.CurrentLapNum && before.CurrentLapNum > 0 && after.LastLapTimeInMS > 0:
		e.history.playerLaps = appendCapped(e.history.playerLaps, e.buildLapRecordLocked(before, after, next), MaxPlayerLapRecords)
	}
}

func (e *EngineerEngine) truncatePlayerLapsLocked(currentLap int) {
	kept := e.history.playerLaps[:0]
	for _, rec := range e.history.playerLaps {
		if rec.LapNumber < currentLap {
			kept = append(kept, rec)
		}
	}
	e.history.playerLaps = kept
}

func (e *EngineerEngine) buildLapRecordLocked(before, after packets.LapData, next *packets.PacketLapData) LapRecord {
	rec := LapRecord{
		LapNumber:    int(before.CurrentLapNum),
		LapTimeMS:    after.LastLapTimeInMS,
		Sector1MS:    splitTimeMS(before.Sector1TimeMinutesPart, before.Sector1TimeMSPart),
		Sector2MS:    splitTimeMS(before.Sector2TimeMinutesPart, before.Sector2TimeMSPart),
		Valid:        before.CurrentLapInvalid == 0,
		Position:     int(after.CarPosition),
		PitStops:     int(after.NumPitStops),
		CarAheadIdx:  -1,
		CarBehindIdx: -1,
	}
	if rec.Sector1MS > 0 && rec.Sector2MS > 0 && rec.LapTimeMS > rec.Sector1MS+rec.Sector2MS {
		rec.Sector3MS = rec.LapTimeMS - rec.Sector1MS - rec.Sector2MS
	}

	if status := e.getPlayerCarStatusLocked(); status != nil {
		rec.Compound = packets.VisualTyreCompoundName(status.VisualTyreCompound)
		rec.TyreAgeLaps = int(status.TyresAgeLaps)
		rec.FuelKg = status.FuelInTank
	}
	if e.latestDamage != nil {
		rec.TyreWearPct = e.latestDamage.CarDamageData[e.playerCarIndex].TyresWear
	}

	if ahead := carAtPosition(next, int(after.CarPosition)-1); ahead >= 0 {
		rec.CarAheadIdx = ahead
		rec.GapAheadMS = deltaToCarInFrontMS(after)
	}
	if behind := carAtPosition(next, int(after.CarPosition)+1); behind >= 0 {
		rec.CarBehindIdx = behind
		rec.GapBehindMS = deltaToCarInFrontMS(next.LapData[behind])
	}
	return rec
}

func (e *EngineerEngine) recordRivalPitStopsLocked(prev, next *packets.PacketLapData) {
	for i := range next.LapData {
		if i == e.playerCarIndex {
			continue
		}
		if next.LapData[i].NumPitStops > prev.LapData[i].NumPitStops && next.LapData[i].NumPitStops > 0 {
			e.addRaceEventLocked(next.Header.SessionTime, fmt.Sprintf("%s pitted (stop %d)", e.driverNameLocked(i), next.LapData[i].NumPitStops))
		}
	}
}

// recordRaceEventLocked logs race events the driver may ask about. Must hold e.mu.
func (e *EngineerEngine) recordRaceEventLocked(p *packets.PacketEventData) {
	if desc := e.describeRaceEventLocked(p); desc != "" {
		e.addRaceEventLocked(p.Header.SessionTime, desc)
	}
}

func (e *EngineerEngine) addRaceEventLocked(sessionTime float32, desc string) {
	e.history.events = appendCapped(e.history.events, RaceEventRecord{
		Lap:         e.playerLapNumberLocked(),
		SessionTime: sessionTime,
		Description: desc,
	}, MaxRaceEventRecords)
}

// recordRadioCallLocked remembers a proactive call that was just broadcast. Must hold e.mu.
func (e *EngineerEngine) recordRadioCallLocked(d Directive) {
	e.history.radioCalls = appendCapped(e.history.radioCalls, RadioCallRecord{
		Lap:         e.playerLapNumberLocked(),
		SessionTime: d.SessionTime,
		Message:     d.Message,
		Urgency:     d.Urgency,
	}, MaxRadioCallRecords)
}

func (e *EngineerEngine) describeRaceEventLocked(p *packets.PacketEventData) string {
	switch p.EventCode() {
	case packets.EventFastestLap:
		if d, ok := p.FastestLapData(); ok {
			return fmt.Sprintf("Fastest lap: %s, %s", e.driverNameLocked(int(d.VehicleIdx)), formatLapTimeMS(uint32(d.LapTime*packets.MillisPerSecond)))
		}
	case packets.EventRetirement:
		if d, ok := p.RetirementData(); ok {
			return fmt.Sprintf("%s retired", e.driverNameLocked(int(d.VehicleIdx)))
		}
	case packets.EventPenaltyIssued:
		if d, ok := p.PenaltyData(); ok {
			return e.describePenaltyLocked(d)
		}
	case packets.EventSafetyCarStatus:
		if d, ok := p.SafetyCarData(); ok {
			return describeSafetyCarEvent(d)
		}
	case packets.EventRedFlag:
		return "Red flag, session suspended"
	case packets.EventCollision:
		if d, ok := p.CollisionData(); ok && (int(d.Vehicle1Idx) == e.playerCarIndex || int(d.Vehicle2Idx) == e.playerCarIndex) {
			other := int(d.Vehicle1Idx)
			if other == e.playerCarIndex {
				other = int(d.Vehicle2Idx)
			}
			return fmt.Sprintf("Contact between you and %s", e.driverNameLocked(other))
		}
	case packets.EventOvertake:
		if d, ok := p.OvertakeData(); ok {
			switch e.playerCarIndex {
			case int(d.OvertakingVehicleIdx):
				return fmt.Sprintf("You passed %s", e.driverNameLocked(int(d.BeingOvertakenVehicleIdx)))
			case int(d.BeingOvertakenVehicleIdx):
				return fmt.Sprintf("%s passed you", e.driverNameLocked(int(d.OvertakingVehicleIdx)))
			}
		}
	case packets.EventChequeredFlag:
		return "Chequered flag"
	}
	return ""
}

func (e *EngineerEngine) describePenaltyLocked(d packets.PenaltyEventData) string {
	name := e.driverNameLocked(int(d.VehicleIdx))
	isPlayer := int(d.VehicleIdx) == e.playerCarIndex
	switch d.PenaltyType {
	case PenaltyTypeTimePenalty:
		return fmt.Sprintf("%ds time penalty for %s", d.Time, name)
	case PenaltyTypeDriveThrough:
		return fmt.Sprintf("Drive-through penalty for %s", name)
	case PenaltyTypeStopGo:
		return fmt.Sprintf("Stop-go penalty for %s", name)
	case PenaltyTypeDisqualified:
		return fmt.Sprintf("%s disqualified", name)
	case PenaltyTypeWarning:
		if isPlayer {
			return "Track limits / driving warning for you"
		}
	}
	return ""
}

func describeSafetyCarEvent(d packets.SafetyCarEventData) string {
	kind := "Safety Car"
	switch d.SafetyCarType {
	case packets.SafetyCarVirtual:
		kind = "Virtual Safety Car"
	case packets.SafetyCarFormationLap:
		return ""
	}
	switch d.EventType {
	case packets.SafetyCarEventDeployed:
		return kind + " deployed"
	case packets.SafetyCarEventReturning:
		return kind + " ending this lap"
	case packets.SafetyCarEventResumeRace:
		return "Racing resumed after the " + kind
	}
	return ""
}

func (e *EngineerEngine) playerLapNumberLocked() int {
	if pLap := e.getPlayerLapDataLocked(); pLap != nil {
		return int(pLap.CurrentLapNum)
	}
	return 0
}

func (e *EngineerEngine) driverNameLocked(idx int) string {
	return participantName(e.latestParticipant, idx)
}

// participantName resolves a readable driver name for a car index.
func participantName(parts *packets.PacketParticipantsData, idx int) string {
	if parts != nil && idx >= 0 && idx < len(parts.Participants) {
		p := parts.Participants[idx]
		if name := p.NameString(); name != "" {
			return name
		}
		if p.DriverId != packets.InvalidDriverID {
			if name, ok := packets.DriverNames[p.DriverId]; ok {
				return name
			}
		}
		if p.RaceNumber > 0 {
			return fmt.Sprintf("Car #%d", p.RaceNumber)
		}
	}
	return fmt.Sprintf("Car %d", idx+1)
}

// carAtPosition returns the car index running in the given position, or -1.
func carAtPosition(lapData *packets.PacketLapData, position int) int {
	if lapData == nil || position <= 0 {
		return -1
	}
	for i := range lapData.LapData {
		if int(lapData.LapData[i].CarPosition) == position && isRunning(lapData.LapData[i]) {
			return i
		}
	}
	return -1
}

func isRunning(l packets.LapData) bool {
	return l.ResultStatus == packets.ResultStatusActive || l.ResultStatus == packets.ResultStatusFinished
}

// splitTimeMS combines the minutes and milliseconds parts the UDP spec splits times into.
func splitTimeMS(minutes uint8, ms uint16) uint32 {
	return uint32(minutes)*packets.MillisPerMinute + uint32(ms)
}

func deltaToCarInFrontMS(l packets.LapData) uint32 {
	return splitTimeMS(l.DeltaToCarInFrontMinutesPart, l.DeltaToCarInFrontMSPart)
}

func deltaToLeaderMS(l packets.LapData) uint32 {
	return splitTimeMS(l.DeltaToRaceLeaderMinutesPart, l.DeltaToRaceLeaderMSPart)
}

// formatLapTimeMS renders milliseconds as m:ss.mmm (or s.mmm under a minute).
func formatLapTimeMS(ms uint32) string {
	if ms == 0 {
		return "no time"
	}
	minutes := ms / packets.MillisPerMinute
	seconds := float64(ms%packets.MillisPerMinute) / packets.MillisPerSecond
	if minutes == 0 {
		return fmt.Sprintf("%.3f", seconds)
	}
	return fmt.Sprintf("%d:%06.3f", minutes, seconds)
}
