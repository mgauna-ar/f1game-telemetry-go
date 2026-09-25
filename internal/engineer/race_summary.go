package engineer

import (
	"fmt"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// summaryText renders the briefing the AI race engineer reads on every radio question.
func (v *raceView) summaryText() string {
	var sb strings.Builder
	session := v.sessionSummary()
	strat := v.strategySummary()
	you, _ := v.carSummary(v.playerIdx)

	sb.WriteString("LIVE PIT WALL DATA (from the game telemetry, all cars):\n")
	fmt.Fprintf(&sb, "- Session: %s at %s | Phase: %s | Track status: %s\n", session.SessionType, session.Track, session.Phase, session.TrackStatus)
	if session.TotalLaps > 0 {
		fmt.Fprintf(&sb, "- Lap %d of %d (%.1f laps to go)\n", session.Lap, session.TotalLaps, session.LapsRemaining)
	} else if session.TimeLeft != "" {
		fmt.Fprintf(&sb, "- Lap %d | Session time left: %s\n", session.Lap, session.TimeLeft)
	}
	fmt.Fprintf(&sb, "- Weather: %s, track %d°C, air %d°C\n", session.Weather, session.TrackTempC, session.AirTempC)

	v.writePlayerLine(&sb, you, strat)
	v.writeNeighbours(&sb, strat)
	v.writeCarState(&sb, strat)
	v.writeStrategy(&sb, strat)
	v.writeForecast(&sb)
	writeRecentCalls(&sb, v.radioCalls)
	writeRecentEvents(&sb, v.events)
	return sb.String()
}

func (v *raceView) writePlayerLine(sb *strings.Builder, you CarSummary, strat StrategySummary) {
	player := v.playerLap()
	validity := "valid"
	if player.CurrentLapInvalid == 1 {
		validity = "INVALIDATED"
	}
	fmt.Fprintf(sb, "- You: P%d", you.Position)
	if you.GridPosition > 0 {
		fmt.Fprintf(sb, " (started P%d)", you.GridPosition)
	}
	fmt.Fprintf(sb, " | Current lap %s | Last lap %s | Best %s", validity, orNone(you.LastLap), orNone(you.BestLap))
	if strat.RecentPace != "" {
		fmt.Fprintf(sb, " | %s", strat.RecentPace)
	}
	fmt.Fprintf(sb, " | Pit stops: %d | Penalties: %ds | Warnings: %d\n", you.PitStops, you.PenaltiesSec, player.CornerCuttingWarnings)
}

func (v *raceView) writeNeighbours(sb *strings.Builder, strat StrategySummary) {
	player := v.playerLap()
	if idx := v.neighbourIdx(-1); idx >= 0 {
		if car, ok := v.carSummary(idx); ok {
			fmt.Fprintf(sb, "- Car ahead: %s\n", describeCarLine(car, strat.GapAheadTrend))
		}
	}
	if idx := v.neighbourIdx(1); idx >= 0 {
		if car, ok := v.carSummary(idx); ok {
			fmt.Fprintf(sb, "- Car behind: %s\n", describeCarLine(car, strat.GapBehindTrend))
		}
	}
	if player.CarPosition > 1 {
		if idx := carAtPosition(v.lapData, 1); idx >= 0 {
			if leader, ok := v.carSummary(idx); ok {
				fmt.Fprintf(sb, "- Leader: %s (%s), %s\n", leader.Name, leader.Team, leader.RelativeToYou)
			}
		}
	}
	if v.isQualifying() {
		v.writeQualifyingCutoff(sb)
	}
}

// writeQualifyingCutoff reports the gap to the knockout position in Q1 and Q2.
func (v *raceView) writeQualifyingCutoff(sb *strings.Builder) {
	var cutoff int
	switch v.session.SessionType {
	case packets.SessionQ1, packets.SessionSprintQ1:
		cutoff = QualyQ1EliminationPositionThreshold
	case packets.SessionQ2, packets.SessionSprintQ2:
		cutoff = QualyQ2EliminationPositionThreshold
	default:
		return
	}
	idx := carAtPosition(v.lapData, cutoff)
	if idx < 0 {
		return
	}
	car, ok := v.carSummary(idx)
	if !ok || car.BestLap == "" {
		return
	}
	fmt.Fprintf(sb, "- Knockout line: P%d is %s on %s", cutoff, car.Name, car.BestLap)
	if car.RelativeToYou != "" {
		fmt.Fprintf(sb, " (%s)", car.RelativeToYou)
	}
	sb.WriteString("\n")
}

func (v *raceView) writeCarState(sb *strings.Builder, strat StrategySummary) {
	st, hasStatus := v.statusOf(v.playerIdx)
	dmg, hasDamage := v.damageOf(v.playerIdx)
	tel, hasTelemetry := v.telemetryOf(v.playerIdx)

	if hasStatus {
		fmt.Fprintf(sb, "- Tyres: %s", describeTyre(st))
		if hasDamage {
			w := dmg.TyresWear
			fmt.Fprintf(sb, " | Wear FL %.0f%% FR %.0f%% RL %.0f%% RR %.0f%%", w[0], w[1], w[2], w[3])
		}
		if strat.TyreWearPerLapPct > 0 {
			fmt.Fprintf(sb, " | Worst tyre %s wearing %.1f%%/lap, about %.0f laps to the %.0f%% wear limit", strat.WorstTyre, strat.TyreWearPerLapPct, strat.LapsToWearLimit, strat.WearLimitPct)
		}
		sb.WriteString("\n")
	}
	if hasTelemetry {
		window := GetTyreThermalWindow(st.ActualTyreCompound, st.VisualTyreCompound)
		fmt.Fprintf(sb, "- Tyre surface temps (window %.0f-%.0f°C):", window.MinTemp, window.MaxTemp)
		for i, t := range tel.TyresSurfaceTemperature {
			fmt.Fprintf(sb, " %s %d%s", wheelNames[i], t, thermalTag(float32(t), window))
		}
		b := tel.BrakesTemperature
		fmt.Fprintf(sb, " | Brakes FL %d FR %d RL %d RR %d°C\n", b[0], b[1], b[2], b[3])
		powerPct, lossPct := CalculateEnginePowerPct(float32(tel.EngineTemperature))
		fmt.Fprintf(sb, "- Engine: %d°C, %.1f%% power", tel.EngineTemperature, powerPct)
		if lossPct > 0 {
			fmt.Fprintf(sb, " (-%.1f%% thermal derate)", lossPct)
		}
		if hasStatus {
			fmt.Fprintf(sb, " | ERS battery %.0f%%, mode %s", float64(st.ERSStoreEnergy)/packets.MaxERSStoreEnergyJoules*percentScale, ersModeName(st.ERSDeployMode, v.packetFormat))
		}
		sb.WriteString("\n")
	}
	if hasStatus {
		fmt.Fprintf(sb, "- Fuel: %.1f kg, margin %+.1f laps (game estimate)", strat.FuelKg, strat.FuelMarginLaps)
		if strat.FuelBurnPerLapKg > 0 {
			fmt.Fprintf(sb, " | burning %.2f kg/lap", strat.FuelBurnPerLapKg)
		}
		if strat.FuelTargetPerLap > 0 {
			fmt.Fprintf(sb, " | target %.2f kg/lap to the flag", strat.FuelTargetPerLap)
		}
		sb.WriteString("\n")
	}
	if hasDamage {
		if d := describeDamage(dmg); d != "" {
			fmt.Fprintf(sb, "- Damage: %s\n", d)
		}
	}
}

func (v *raceView) writeStrategy(sb *strings.Builder, strat StrategySummary) {
	if !v.isRace() {
		return
	}
	var parts []string
	if strat.PitWindowIdealLap > 0 {
		parts = append(parts, fmt.Sprintf("pit window ideal lap %d, latest lap %d", strat.PitWindowIdealLap, strat.PitWindowLastLap))
	}
	if strat.RejoinPosition > 0 {
		parts = append(parts, fmt.Sprintf("pitting now rejoins about P%d", strat.RejoinPosition))
	}
	if strat.LastVsBestSec != 0 {
		parts = append(parts, fmt.Sprintf("last lap %+.3fs vs your best", strat.LastVsBestSec))
	}
	if len(parts) > 0 {
		fmt.Fprintf(sb, "- Strategy: %s\n", strings.Join(parts, " | "))
	}
}

func (v *raceView) writeForecast(sb *strings.Builder) {
	samples := v.forecast()
	if len(samples) == 0 {
		return
	}
	if len(samples) > SummaryForecastSamples {
		samples = samples[:SummaryForecastSamples]
	}
	parts := make([]string, 0, len(samples))
	for _, f := range samples {
		parts = append(parts, fmt.Sprintf("+%d min %s, %d%% rain", f.TimeOffset, packets.WeatherName(f.Weather), f.RainPercentage))
	}
	fmt.Fprintf(sb, "- Forecast: %s\n", strings.Join(parts, " | "))
}

func writeRecentCalls(sb *strings.Builder, calls []RadioCallRecord) {
	if len(calls) > SummaryRadioCalls {
		calls = calls[len(calls)-SummaryRadioCalls:]
	}
	if len(calls) == 0 {
		return
	}
	sb.WriteString("- Pit wall calls you already made (do not repeat them unprompted):\n")
	for _, c := range calls {
		fmt.Fprintf(sb, "  * Lap %d: %s\n", c.Lap, c.Message)
	}
}

func writeRecentEvents(sb *strings.Builder, events []RaceEventRecord) {
	if len(events) > SummaryRaceEvents {
		events = events[len(events)-SummaryRaceEvents:]
	}
	if len(events) == 0 {
		return
	}
	parts := make([]string, 0, len(events))
	for _, ev := range events {
		parts = append(parts, fmt.Sprintf("lap %d %s", ev.Lap, ev.Description))
	}
	fmt.Fprintf(sb, "- Recent race events: %s\n", strings.Join(parts, " | "))
}

func describeCarLine(car CarSummary, trend string) string {
	line := fmt.Sprintf("P%d %s", car.Position, car.Name)
	if car.Team != "" {
		line += fmt.Sprintf(" (%s)", car.Team)
	}
	if car.RelativeToYou != "" {
		line += ", " + car.RelativeToYou
	}
	if trend != "" {
		line += ", " + trend
	}
	if car.LastLap != "" {
		line += " | Last lap " + car.LastLap
	}
	if car.Tyre != "" {
		line += " | " + car.Tyre
	}
	switch car.PitStops {
	case 0:
		line += " | no stops yet"
	case 1:
		line += " | 1 pit stop"
	default:
		line += fmt.Sprintf(" | %d pit stops", car.PitStops)
	}
	if car.Status != carStatusOnTrack {
		line += " | " + car.Status
	}
	return line
}

func describeTyre(st packets.CarStatusData) string {
	if st.VisualTyreCompound == 0 {
		return ""
	}
	compound := packets.VisualTyreCompoundName(st.VisualTyreCompound)
	if actual := packets.ActualTyreCompoundName(st.ActualTyreCompound); actual != packets.CompoundNameUnknown && actual != compound {
		compound += " (" + actual + ")"
	}
	return fmt.Sprintf("%s, %d laps old", compound, st.TyresAgeLaps)
}

func describeDamage(d packets.CarDamageData) string {
	var parts []string
	add := func(label string, pct uint8) {
		if pct > 0 {
			parts = append(parts, fmt.Sprintf("%s %d%%", label, pct))
		}
	}
	add("front wing L", d.FrontLeftWingDamage)
	add("front wing R", d.FrontRightWingDamage)
	add("rear wing", d.RearWingDamage)
	add("floor", d.FloorDamage)
	add("diffuser", d.DiffuserDamage)
	add("sidepod", d.SidepodDamage)
	add("gearbox wear", d.GearBoxDamage)
	add("engine damage", d.EngineDamage)
	for i, blisters := range d.TyreBlisters {
		add(wheelNames[i]+" blisters", blisters)
	}
	if d.DRSFault == 1 {
		parts = append(parts, "DRS fault")
	}
	if d.ERSFault == 1 {
		parts = append(parts, "ERS fault")
	}
	return strings.Join(parts, ", ")
}

func thermalTag(temp float32, window TyreThermalWindow) string {
	switch {
	case temp >= window.MaxTemp+TyreDegradationTempMarginC:
		return " [overheating]"
	case temp <= window.MinTemp-TyreDegradationTempMarginC:
		return " [cold]"
	}
	return ""
}

// ersModeName names an ERS deploy mode; mode 3 is "Overtake" in F1 25 and "Boost" from 2026.
func ersModeName(mode uint8, packetFormat uint16) string {
	switch mode {
	case packets.ERSDeployModeNone:
		return "None"
	case packets.ERSDeployModeMedium:
		return "Medium"
	case packets.ERSDeployModeHotlap:
		return "Hotlap"
	case packets.ERSDeployModeOvertake:
		if packetFormat >= packets.PacketFormat2026 {
			return "Boost"
		}
		return "Overtake"
	}
	return fmt.Sprintf("mode %d", mode)
}
