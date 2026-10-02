package engineer

import (
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// playerTrackPosition is where the player is on track, as the box calls need it.
type playerTrackPosition struct {
	known       bool
	lap         int
	lapDistance float32
	trackLength float32
	pitEntry    float32 // 0 while unknown
	inPitLane   bool
}

// lineWaitDirective is a call to box that came too late for this lap's pit entry. It is said at
// the start of the next lap instead, as "box this lap".
type lineWaitDirective struct {
	directive Directive
	lap       int // the lap the call came on
}

// updatePlayerPositionLocked records where the player is, from the context being evaluated.
func (e *EngineerEngine) updatePlayerPositionLocked(ctx *EvaluationContext) {
	lap := ctx.PlayerLap()
	if lap == nil || ctx.Session == nil {
		e.playerPos = playerTrackPosition{}
		return
	}
	e.playerPos = playerTrackPosition{
		known:       true,
		lap:         int(lap.CurrentLapNum),
		lapDistance: lap.LapDistance,
		trackLength: float32(ctx.Session.TrackLength),
		pitEntry:    ctx.PitEntryM,
		inPitLane:   lap.PitStatus != packets.PitStatusNone,
	}
}

// boxTimingLocked is when the player could pit if told to now.
func (e *EngineerEngine) boxTimingLocked() BoxTiming {
	if !e.playerPos.known {
		return BoxASAP
	}
	p := e.playerPos
	return boxTimingAt(p.lapDistance, p.trackLength, p.pitEntry, e.config.PitCallLeadM)
}

// waitForLineLocked keeps a call to box that is not urgent and came too late for this lap's pit
// entry until the player starts the next lap. It reports whether it kept the call.
func (e *EngineerEngine) waitForLineLocked(d Directive, alertKey string) bool {
	if d.BoxCall != BoxCallInstruction || isUrgent(d.Urgency) || !e.playerPos.known || e.playerPos.inPitLane {
		return false
	}
	if e.boxTimingLocked() != BoxNextLap {
		return false
	}
	delete(e.pending, alertKey)
	e.lineWait[alertKey] = lineWaitDirective{directive: d, lap: e.playerPos.lap}
	return true
}

// releaseLineWaitLocked hands the calls waiting for the line to the radio gates once the player
// starts the next lap. It forgets them when the player pits anyway, or when a lap went by.
func (e *EngineerEngine) releaseLineWaitLocked() {
	if len(e.lineWait) == 0 || !e.playerPos.known {
		return
	}
	for alertKey, w := range e.lineWait {
		switch {
		case e.playerPos.inPitLane || e.playerPos.lap > w.lap+1:
			delete(e.lineWait, alertKey)
		case e.playerPos.lap == w.lap+1:
			delete(e.lineWait, alertKey)
			delete(e.pending, alertKey)
			e.holdDirectiveLocked(w.directive, alertKey)
		}
	}
}

// setBoxTimingLocked adds when the player can pit to a call that asks them to, and remembers a
// call that tells them to so the pit entry reminder can follow it.
func (e *EngineerEngine) setBoxTimingLocked(d *Directive) {
	if d.BoxCall == BoxCallNone || !e.playerPos.known || e.playerPos.inPitLane {
		return
	}
	d.Box = e.boxTimingLocked()
	if d.BoxCall != BoxCallInstruction {
		return
	}
	switch d.Box {
	case BoxThisLap:
		e.boxDueLap = e.playerPos.lap
	case BoxNextLap:
		e.boxDueLap = e.playerPos.lap + 1
	case BoxASAP:
	}
	e.boxCallAt = e.nowMs()
}

// pitEntryReminderLocked reminds the driver to box as the pit entry comes up, on the lap a call
// told them to box. It is forgotten once they pit or the entry is behind them.
func (e *EngineerEngine) pitEntryReminderLocked(header packets.PacketHeader) []Directive {
	p := e.playerPos
	if e.boxDueLap == 0 || !p.known {
		return nil
	}
	if p.inPitLane {
		e.boxDueLap = 0
		return nil
	}
	if p.pitEntry <= 0 || p.trackLength <= 0 {
		if p.lap > e.boxDueLap {
			e.boxDueLap = 0
		}
		return nil
	}

	// How far the player is along the lap the stop is due on; the entry may lie past its line.
	progress := p.lapDistance + float32(p.lap-e.boxDueLap)*p.trackLength
	callPoint := boxCallPoint(p.trackLength, p.pitEntry, e.config.PitCallLeadM)
	entry := callPoint + e.config.PitCallLeadM
	switch {
	case progress >= entry:
		e.boxDueLap = 0
		return nil
	case progress < callPoint:
		return nil
	}

	if e.nowMs()-e.boxCallAt < PitEntryReminderMinGapMs {
		return nil // the call to box was only just made: remind later, if the entry is still ahead
	}
	e.boxDueLap = 0
	reminder := Directive{
		ID:       "pit_entry_reminder",
		Category: DirectiveCategoryPitStrategy,
		SubAlert: "pit_entry_reminder",
		Title:    "Pit Entry Reminder",
		Message:  "Box, box. Pit entry coming up, stay to the pit lane side.",
		Urgency:  UrgencyHigh,
	}
	switch e.gateDirectiveLocked(reminder.ID, string(reminder.Category), reminder.Urgency) {
	case gateEmit:
		return []Directive{e.emitDirectiveLocked(header, reminder, reminder.ID, 0)}
	case gateHold:
		e.holdDirectiveLocked(reminder, reminder.ID)
	case gateDrop:
	}
	return nil
}

func isUrgent(urgency string) bool {
	return urgency == UrgencyCritical || urgency == UrgencyHigh
}
