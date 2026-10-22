package engineer

import (
	"fmt"
	"math"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/ai"
)

// RadioCall returns what a call says, for the AI to word it afresh: a call the engine marked
// Wordable that is still worth saying. It implements ai.RadioCallSource.
func (e *EngineerEngine) RadioCall(id string) (ai.RadioCallFacts, bool) {
	situation := ""
	if v, ok := e.liveView(); ok {
		situation = v.situationLine()
	}

	e.mu.RLock()
	defer e.mu.RUnlock()
	rec := e.radioCallLocked(id)
	if rec == nil || !rec.wordable || e.nowMs() > rec.madeAt+rec.ttlMs {
		return ai.RadioCallFacts{}, false
	}
	return ai.RadioCallFacts{
		Key:       rec.subAlert,
		Message:   rec.Message,
		Values:    describeValues(rec.values),
		Situation: situation,
		Recent:    append([]string(nil), e.history.linesSaid[rec.subAlert]...),
	}, true
}

// RecordRadioLine remembers the line said for a call: the race history shows it to the AI race
// engineer, and the AI words the call differently next time. It implements ai.RadioCallSource.
func (e *EngineerEngine) RecordRadioLine(id, text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	rec := e.radioCallLocked(id)
	if rec == nil {
		return
	}
	// A second dashboard in another language says the same call again: it isn't a new line.
	if rec.Said == "" {
		if e.history.linesSaid == nil {
			e.history.linesSaid = make(map[string][]string)
		}
		e.history.linesSaid[rec.subAlert] = appendCapped(e.history.linesSaid[rec.subAlert], text, RadioLineRecentLines)
	}
	rec.Said = text
}

// radioCallLocked is the recent call with that id, or nil. Must hold e.mu.
func (e *EngineerEngine) radioCallLocked(id string) *RadioCallRecord {
	for i := range e.history.radioCalls {
		if rec := &e.history.radioCalls[i]; rec.id == id && id != "" {
			return rec
		}
	}
	return nil
}

// situationLine is where the race stands, in a few words, for the AI wording a call.
func (v *raceView) situationLine() string {
	s := v.sessionSummary()
	parts := []string{s.SessionType}
	switch {
	case s.TotalLaps > 0:
		parts = append(parts, fmt.Sprintf("lap %d of %d", s.Lap, s.TotalLaps))
	case s.TimeLeft != "":
		parts = append(parts, s.TimeLeft+" left")
	}
	if you, ok := v.carSummary(v.playerIdx); ok {
		if you.Position > 0 {
			parts = append(parts, fmt.Sprintf("P%d", you.Position))
		}
		if you.Tyre != "" {
			parts = append(parts, you.Tyre)
		}
	}
	parts = append(parts, s.Weather)
	if s.TrackStatus != "Green" {
		parts = append(parts, s.TrackStatus)
	}
	return strings.Join(parts, ", ")
}

// describeValues writes a call's values for the AI, with the numbers as the dashboard says them.
func describeValues(v *DirectiveValues) string {
	if v == nil {
		return ""
	}
	var facts []string
	add := func(format string, args ...any) { facts = append(facts, fmt.Sprintf(format, args...)) }
	if v.Position > 0 {
		add("position P%d", v.Position)
	}
	describeGap := func(where string, gap *GapToCar) {
		if gap == nil {
			return
		}
		text := fmt.Sprintf("car %s %.1f s", where, gap.GapSec)
		if gap.Trend != "" && gap.Trend != GapStable && gap.PerLapSec != 0 {
			text += fmt.Sprintf(", %s %.1f s a lap", gap.Trend, gap.PerLapSec)
		} else if gap.Trend == GapStable {
			text += ", stable"
		}
		if gap.ReachSec > 0 {
			text += fmt.Sprintf(", meeting in %d s", gap.ReachSec)
		}
		if gap.Name != "" {
			text += ", " + gap.Name
		}
		if gap.Compound != "" {
			text += fmt.Sprintf(", on %s tyres", gap.Compound)
			switch {
			case gap.TyreAgeDiffLaps > 0:
				text += fmt.Sprintf(" %d laps older than ours", gap.TyreAgeDiffLaps)
			case gap.TyreAgeDiffLaps < 0:
				text += fmt.Sprintf(" %d laps fresher than ours", -gap.TyreAgeDiffLaps)
			}
		}
		facts = append(facts, text)
	}
	describeGap("ahead", v.Ahead)
	describeGap("behind", v.Behind)
	if v.TyreLapsLeft > 0 {
		add("about %d laps left on the tyres", v.TyreLapsLeft)
	}
	if v.Minutes > 0 {
		add("minutes: %d", v.Minutes)
	}
	if v.PoleGapSec != 0 {
		add("%.3f s to pole", v.PoleGapSec)
	}
	if v.Elimination != "" {
		add("qualifying cut line: %s", strings.ReplaceAll(string(v.Elimination), "_", " "))
	}
	if v.Count > 0 {
		add("warnings: %d", v.Count)
	}
	if v.PenaltySec > 0 {
		add("%d s penalty", v.PenaltySec)
	}
	if v.StopSec > 0 {
		add("stop %.1f s", v.StopSec)
	}
	if v.Sector > 0 {
		add("sector %d", v.Sector)
	}
	if v.DeltaSec != 0 {
		add("%.1f s off the best", v.DeltaSec)
	}
	if v.ReactionSec > 0 {
		add("reaction %.2f s", v.ReactionSec)
	}
	if v.Wheel != "" {
		add("%s", strings.ReplaceAll(string(v.Wheel), "_", " "))
	}
	if v.Axle != "" {
		add("%s axle", v.Axle)
	}
	if v.Compound != "" {
		add("%s tyre", v.Compound)
	}
	if v.Pct > 0 {
		add("%d%%", v.Pct)
	}
	if v.RainPct > 0 {
		add("%d%% chance of rain", v.RainPct)
	}
	switch {
	case v.FuelDeltaLaps <= -0.05:
		add("fuel %.1f laps short", -v.FuelDeltaLaps)
	case v.FuelDeltaLaps >= 0.05:
		add("fuel %.1f laps over", v.FuelDeltaLaps)
	}
	if v.LapsToRange > 0 {
		add("in battle range in about %d laps", v.LapsToRange)
	}
	if v.TrackTempDeltaC != 0 {
		// Both units: the dashboard says the driver's.
		dir, c := "up", v.TrackTempDeltaC
		if c < 0 {
			dir, c = "down", -c
		}
		add("track temperature %s %d °C (%d °F) this stint", dir, c, int(math.Round(float64(c)*9/5)))
	}
	return strings.Join(facts, "; ")
}
