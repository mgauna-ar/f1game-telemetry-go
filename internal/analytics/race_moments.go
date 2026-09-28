package analytics

import (
	"fmt"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	sessionfeed "github.com/mgauna/f1game-telemetry-go/internal/session"
)

// Race-control period kinds.
const (
	PeriodSafetyCar        = "sc"
	PeriodVirtualSafetyCar = "vsc"
)

// RaceControlPeriod is a stretch of a race under the safety car or the virtual safety car, in the
// leader's laps. EndLap is 0 when the session ended before the period did.
type RaceControlPeriod struct {
	Kind     string
	StartLap int
	EndLap   int
}

// debriefMaxMoments caps the key moments the debrief lists, so a chaotic race doesn't crowd out
// the classification.
const debriefMaxMoments = 20

// RaceControlPeriods reads the safety car and virtual safety car periods from a session's stored
// feed rows (the SCAR rows the broadcaster builds from the session's safety car status).
func RaceControlPeriods(events []sessionfeed.FeedEvent) []RaceControlPeriod {
	var periods []RaceControlPeriod
	open := -1
	for _, e := range events {
		if e.EventCode != packets.EventSafetyCarStatus || e.SafetyCarStatus == nil {
			continue
		}
		kind := ""
		switch uint8(*e.SafetyCarStatus) {
		case packets.SafetyCarFull:
			kind = PeriodSafetyCar
		case packets.SafetyCarVirtual:
			kind = PeriodVirtualSafetyCar
		case packets.SafetyCarFormationLap:
			continue
		}
		// A change of status ends the open period, including a VSC turning into a full SC
		if open >= 0 {
			periods[open].EndLap = max(e.RaceLap, periods[open].StartLap)
			open = -1
		}
		if kind != "" {
			periods = append(periods, RaceControlPeriod{Kind: kind, StartLap: e.RaceLap})
			open = len(periods) - 1
		}
	}
	return periods
}

// writeDebriefMoments writes the race-control story of the session: safety car periods, red
// flags, retirements, disqualifications and penalties, and the player's own overtakes and
// collisions. It writes nothing for sessions recorded before the feed was stored.
func writeDebriefMoments(sb *strings.Builder, events []sessionfeed.FeedEvent, me *DriverStanding) {
	if len(events) == 0 {
		return
	}
	isMe := func(idx *int) bool { return me != nil && idx != nil && *idx == me.CarIndex }
	driver := func(name string, idx *int) string {
		switch {
		case isMe(idx):
			return "YOU"
		case name != "":
			return name
		case idx != nil:
			return fmt.Sprintf("Car #%d", *idx+1)
		}
		return "Unknown driver"
	}

	var lines []string
	for _, p := range RaceControlPeriods(events) {
		name := "Safety Car"
		if p.Kind == PeriodVirtualSafetyCar {
			name = "Virtual Safety Car"
		}
		if p.EndLap > 0 {
			lines = append(lines, fmt.Sprintf("- %s: laps %d-%d", name, p.StartLap, p.EndLap))
		} else {
			lines = append(lines, fmt.Sprintf("- %s: from lap %d to the end", name, p.StartLap))
		}
	}

	passes, passed := 0, 0
	for _, e := range events {
		lap := fmt.Sprintf("- L%d: ", e.RaceLap)
		switch e.EventCode {
		case packets.EventRedFlag:
			lines = append(lines, lap+"Red flag")
		case packets.EventRetirement:
			lines = append(lines, lap+driver(e.DriverName, e.VehicleIdx)+" retired")
		case packets.EventDisqualification:
			lines = append(lines, lap+driver(e.DriverName, e.VehicleIdx)+" disqualified")
		case packets.EventPenaltyIssued:
			if text := penaltyText(e); text != "" {
				lines = append(lines, lap+driver(e.DriverName, e.VehicleIdx)+": "+text)
			}
		case packets.EventCollision:
			if isMe(e.VehicleIdx) || isMe(e.OtherVehicleIdx) {
				lines = append(lines, lap+"Collision between "+driver(e.DriverName, e.VehicleIdx)+" and "+
					driver(e.TargetDriverName, e.OtherVehicleIdx))
			}
		case packets.EventOvertake:
			switch {
			case isMe(e.VehicleIdx):
				passes++
			case isMe(e.OtherVehicleIdx):
				passed++
			}
		}
	}

	sb.WriteString("\nRACE CONTROL KEY MOMENTS (laps are the leader's):\n")
	if len(lines) > debriefMaxMoments {
		lines = append(lines[:debriefMaxMoments], fmt.Sprintf("- ... and %d more", len(lines)-debriefMaxMoments))
	}
	for _, l := range lines {
		sb.WriteString(l + "\n")
	}
	if len(lines) == 0 {
		sb.WriteString("- No safety cars, red flags, retirements or penalties\n")
	}
	if me != nil {
		fmt.Fprintf(sb, "- Your overtakes: %d made, %d suffered\n", passes, passed)
	}
}

// penaltyText describes the penalties worth a debrief line: time, drive-through, stop-go and grid
// penalties. Warnings, reminders and lap invalidations are left out.
func penaltyText(e sessionfeed.FeedEvent) string {
	if e.PenaltyType == nil {
		// A penalty the broadcaster read from the lap data's penalty seconds
		if e.PenaltyTime != nil && *e.PenaltyTime > 0 {
			return fmt.Sprintf("%ds time penalty", *e.PenaltyTime)
		}
		return ""
	}
	seconds := ""
	if e.PenaltyTime != nil && *e.PenaltyTime > 0 && *e.PenaltyTime != int(packets.PenaltyTimeNotApplicable) {
		seconds = fmt.Sprintf("%ds ", *e.PenaltyTime)
	}
	switch uint8(*e.PenaltyType) {
	case packets.PenaltyTypeTimePenalty:
		return seconds + "time penalty"
	case packets.PenaltyTypeDriveThrough:
		return "drive-through penalty"
	case packets.PenaltyTypeStopGo:
		return seconds + "stop-go penalty"
	case packets.PenaltyTypeGridPenalty:
		return "grid penalty"
	}
	return ""
}
