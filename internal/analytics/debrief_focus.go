package analytics

import (
	"fmt"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
	sessionfeed "github.com/mgauna/f1game-telemetry-go/internal/session"
	"github.com/mgauna/f1game-telemetry-go/internal/storage"
)

// focusDriver is one car the lap-by-lap focus follows, with the label the prompt gives it.
type focusDriver struct {
	label    string
	carIndex int
}

// focusDrivers picks the cars a lap-by-lap focus follows: the player, the cars that finished
// either side of them and the winner; without a player, the top three.
func focusDrivers(standings []DriverStanding, me *DriverStanding) []focusDriver {
	label := func(tag string, d *DriverStanding) string {
		return fmt.Sprintf("%s %s (#%d)", tag, d.DriverName, d.RaceNumber)
	}
	var out []focusDriver
	if me == nil {
		for i := 0; i < len(standings) && i < 3; i++ {
			out = append(out, focusDriver{label(fmt.Sprintf("P%d", standings[i].Position), &standings[i]), standings[i].CarIndex})
		}
		return out
	}
	out = append(out, focusDriver{label("YOU", me), me.CarIndex})
	// The player's row is at Position-1, so the cars that finished ahead and behind are either side of it
	if i := me.Position - 2; i >= 0 && i < len(standings) {
		out = append(out, focusDriver{label("FINISHED AHEAD", &standings[i]), standings[i].CarIndex})
	}
	if i := me.Position; i >= 0 && i < len(standings) {
		out = append(out, focusDriver{label("FINISHED BEHIND", &standings[i]), standings[i].CarIndex})
	}
	if me.Position > 2 && len(standings) > 0 {
		out = append(out, focusDriver{label("WINNER", &standings[0]), standings[0].CarIndex})
	}
	return out
}

// BuildDebriefFocus writes the data of the session detail chart a debrief chat is looking at:
// lap by lap times, positions and gaps for the lap charts, every stint for the degradation tab,
// sector times for the sectors tab. The Story tab and an unknown focus add nothing.
func BuildDebriefFocus(
	focus string,
	session *storage.Session,
	participants []storage.Participant,
	laps []storage.Lap,
	cls *ClassificationResponse,
	events []sessionfeed.FeedEvent,
) string {
	me, _ := FindPlayerStanding(cls.Standings, session)
	var sb strings.Builder
	switch focus {
	case ai.DebriefFocusPace, ai.DebriefFocusPosition, ai.DebriefFocusGap:
		writeLapByLap(&sb, ComputeSessionProgression(session, participants, laps), focusDrivers(cls.Standings, me))
	case ai.DebriefFocusStints:
		writeStintFocus(&sb, ComputeSessionStints(session, participants, laps, RaceControlPeriods(events)), me)
	case ai.DebriefFocusSectors:
		writeSectorFocus(&sb, laps, cls, me)
	}
	return sb.String()
}

// writeLapByLap writes one line per lap with each followed car's lap time, position and gap to
// the leader, the numbers the pace, position and gap charts draw.
func writeLapByLap(sb *strings.Builder, prog *ProgressionResponse, drivers []focusDriver) {
	if prog == nil || len(drivers) == 0 {
		return
	}
	positions := rowsByLap(prog.Positions)
	gaps := rowsByLap(prog.GapToLeader)
	names := make([]string, len(drivers))
	for i, d := range drivers {
		names[i] = d.label
	}
	sb.WriteString("LAP BY LAP (lap time, position, gap to the leader; laps marked pit_in, pit_out or slow are left out of the pace chart's trend):\n")
	fmt.Fprintf(sb, "- Cars: %s\n", strings.Join(names, " | "))
	for _, row := range prog.LapPace {
		lap, _ := row["lapNumber"].(int)
		cells := make([]string, 0, len(drivers))
		for _, d := range drivers {
			key := fmt.Sprintf("driver_%d", d.carIndex)
			cell := "-"
			if ms, ok := row[key+"_rawMS"].(int); ok {
				cell = lapTimeText(ms)
			}
			if pos, ok := positions[lap][key].(int); ok {
				cell += fmt.Sprintf(" P%d", pos)
			}
			if gap, ok := gaps[lap][key].(float64); ok && gap > 0 {
				cell += fmt.Sprintf(" +%.3fs", gap)
			}
			if reason, _ := row[key+"_outlier_reason"].(string); reason != "" {
				cell += " " + reason
			}
			cells = append(cells, cell)
		}
		fmt.Fprintf(sb, "- L%d: %s\n", lap, strings.Join(cells, " | "))
	}
}

func rowsByLap(rows []map[string]any) map[int]map[string]any {
	out := make(map[int]map[string]any, len(rows))
	for _, row := range rows {
		if lap, ok := row["lapNumber"].(int); ok {
			out[lap] = row
		}
	}
	return out
}

// writeStintFocus writes every driver's stints with the degradation rate the degradation table
// shows and the laps left out of it.
func writeStintFocus(sb *strings.Builder, stints *StintsResponse, me *DriverStanding) {
	if stints == nil || len(stints.Drivers) == 0 {
		return
	}
	sb.WriteString("TYRE STINTS & DEGRADATION (rate = lap time change per lap of tyre age, from the clean laps):\n")
	for _, d := range stints.Drivers {
		tag := ""
		if me != nil && d.CarIndex == me.CarIndex {
			tag = " (YOU)"
		}
		fmt.Fprintf(sb, "- P%d %s (#%d)%s: %s\n", d.Position, d.DriverName, d.RaceNumber, tag, orDefault(d.StrategyString, "-"))
		for _, s := range d.Stints {
			rate := "no rate"
			if s.DegSlopeSecPerLap != nil {
				rate = fmt.Sprintf("%+.3fs/lap", *s.DegSlopeSecPerLap)
			}
			fmt.Fprintf(sb, "  - Stint %d %s L%d-L%d (%d laps): avg %s, best %s, %s from %d laps",
				s.StintIndex, orDefault(s.Compound, "Unknown"), s.StartLap, s.EndLap, s.TotalLaps,
				lapTimeText(s.AvgLapTimeMS), lapTimeText(s.BestLapTimeMS), rate, s.FitLaps)
			if len(s.ExcludedLaps) > 0 {
				left := make([]string, len(s.ExcludedLaps))
				for i, e := range s.ExcludedLaps {
					left[i] = fmt.Sprintf("L%d %s", e.LapNumber, e.Reason)
				}
				fmt.Fprintf(sb, "; left out: %s", strings.Join(left, ", "))
			}
			sb.WriteString("\n")
		}
	}
}

// writeSectorFocus writes each driver's best sectors against the session's, and the followed
// driver's sectors lap by lap.
func writeSectorFocus(sb *strings.Builder, laps []storage.Lap, cls *ClassificationResponse, me *DriverStanding) {
	if len(cls.Standings) == 0 {
		return
	}
	best := [3]int{cls.SessionBestS1MS, cls.SessionBestS2MS, cls.SessionBestS3MS}
	delta := func(ms, ref int) string {
		if ms <= 0 {
			return "-"
		}
		if ref <= 0 || ms == ref {
			return sectorText(ms)
		}
		return fmt.Sprintf("%s (+%.3f)", sectorText(ms), float64(ms-ref)/packets.MillisPerSecond)
	}
	sb.WriteString("BEST SECTORS (gap to the session's best sector):\n")
	for i := range cls.Standings {
		d := &cls.Standings[i]
		tag := ""
		if d == me {
			tag = " (YOU)"
		}
		fmt.Fprintf(sb, "- P%d %s (#%d)%s: S1 %s | S2 %s | S3 %s\n", d.Position, d.DriverName, d.RaceNumber, tag,
			delta(d.BestS1MS, best[0]), delta(d.BestS2MS, best[1]), delta(d.BestS3MS, best[2]))
	}

	subject := me
	if subject == nil {
		subject = &cls.Standings[0]
	}
	own := [3]int{subject.BestS1MS, subject.BestS2MS, subject.BestS3MS}
	fmt.Fprintf(sb, "\nSECTORS LAP BY LAP for %s (gap to their own best sector):\n", subject.DriverName)
	for _, l := range laps {
		if l.CarIndex != subject.CarIndex || l.LapTimeMS <= 0 {
			continue
		}
		invalid := ""
		if !l.IsValid {
			invalid = " (invalid)"
		}
		fmt.Fprintf(sb, "- L%d %s%s: S1 %s | S2 %s | S3 %s\n", l.LapNumber, lapTimeText(l.LapTimeMS), invalid,
			delta(l.Sector1MS, own[0]), delta(l.Sector2MS, own[1]), delta(l.Sector3MS, own[2]))
	}
}
