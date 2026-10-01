package ai

import (
	"fmt"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/locales"
	"github.com/mgauna/f1game-telemetry-go/internal/packets"
)

// BuildSystemPrompt constructs a rich system prompt tailored for an elite F1 Race Engineer based on context mode, persona, and language.
func BuildSystemPrompt(tc *TelemetryAnalysisContext, persona, language string) string {
	if tc == nil {
		tc = &TelemetryAnalysisContext{ContextMode: ContextModeComparator}
	}
	switch tc.ContextMode {
	case ContextModeSessionDebrief:
		return buildSessionDebriefPrompt(tc.Debrief)
	case ContextModeLive:
		return buildLivePrompt(tc, persona, language)
	case ContextModeGeneral:
		return buildGeneralPrompt(language)
	}
	return buildComparatorPrompt(tc.Comparison)
}

func buildSessionDebriefPrompt(debrief *SessionDebrief) string {
	var sb strings.Builder
	sb.WriteString("You are the Chief Race Strategist and Performance Engineer providing an executive post-session debrief of the recorded session.\n")
	sb.WriteString("Analyze overall session classification, driver gaps, pace deltas, tyre stint strategies, degradation, and sector splits across the field.\n\n")
	sb.WriteString("ROLE & COMMUNICATION GUIDELINES:\n")
	sb.WriteString("1. Maintain an analytical, executive F1 engineering debrief tone reviewing the entire session.\n")
	sb.WriteString("2. DO NOT pretend to be an in-car radio talking to a single driver (DO NOT say 'Box box', 'bringing the car home to P2', etc.) unless the user specifically asks for coaching on a specific driver.\n")
	sb.WriteString("3. Clearly highlight the Winner / Pole Sitter, podium finishers, key gaps, strategy differences (e.g. tyre compounds and stint lengths), and sector records.\n")
	sb.WriteString("4. Always respond in the language used by the user / driver (e.g. if Spanish, reply in Spanish; if English, reply in English).\n")
	sb.WriteString("5. Use structured Markdown with clear headings (## Summary, ## Classification & Gaps, ## Tyre Stints & Strategy, ## Sector Breakdown) and bullet points.\n\n")

	sb.WriteString("### SESSION CLASSIFICATION & TIMING DATA:\n")
	if debrief != nil && debrief.Summary != "" {
		sb.WriteString(debrief.Summary)
		sb.WriteString("\n")
	} else {
		sb.WriteString("No classification data is available for this session yet.\n")
	}
	if debrief != nil && debrief.Focus != "" {
		sb.WriteString("\n### WHAT THE USER IS LOOKING AT:\n")
		fmt.Fprintf(&sb, "The user opened this chat from the %s. Answer about it first, using the data below; bring in the rest of the session only where it explains it.\n", debriefFocusNames[debrief.Focus])
		if debrief.FocusData != "" {
			sb.WriteString(debrief.FocusData)
		}
	}
	return sb.String()
}

// debriefFocusNames names each session detail chart for the debrief prompt.
var debriefFocusNames = map[string]string{
	DebriefFocusPace:     "lap pace chart (lap times lap by lap)",
	DebriefFocusPosition: "position chart (race position lap by lap)",
	DebriefFocusGap:      "gap chart (gap to the leader lap by lap)",
	DebriefFocusStints:   "tyre strategy and degradation tab",
	DebriefFocusSectors:  "sector analysis tab",
	DebriefFocusStory:    "race story (key moments and race-control events)",
}

func buildLivePrompt(tc *TelemetryAnalysisContext, persona, language string) string {
	var sb strings.Builder
	catalog := locales.Resolve(language, "", persona)
	live := tc.Live
	if live == nil {
		live = &LiveBriefing{}
	}

	sb.WriteString(catalog.PersonaPrompt(persona, tc.CustomPersonaPrompt))

	sb.WriteString("\nCRITICAL RADIO CONSTRAINTS:\n")
	if strings.TrimSpace(tc.DriverCallsign) != "" {
		sb.WriteString(catalog.DriverCallsignDirective(tc.DriverCallsign))
	}
	sb.WriteString(catalog.CriticalRadioConstraints())
	sb.WriteString(catalog.LiveDataDirective())

	if live.IncidentStatus != "" {
		sb.WriteString(catalog.IncidentDirective(live.IncidentStatus))
	}

	// F1 2026 Regulation Mandate (DRS abolished -> Override Mode / Straight Mode)
	if live.PacketFormat >= packets.PacketFormat2026 {
		sb.WriteString(catalog.F12026RegulationMandate())
	}

	// The engine's driving phase picks the radio protocol for this part of the session.
	if phase := strings.ToUpper(strings.TrimSpace(live.DrivingPhase)); phase != "" {
		sb.WriteString(catalog.DrivingPhaseDirective(phase))
	}

	// Engineering Knowledge: Pirelli Tyre Operating Windows & Engine Thermal Derate Curve
	sb.WriteString(catalog.ThermalOperatingWindows())
	sb.WriteString(catalog.EngineThermalDerateCurve())

	// Detect session type mode (Qualifying vs Practice vs Race)
	sessionType := strings.ToLower(live.SessionType)
	trackName := live.TrackName
	if trackName == "" {
		trackName = "F1 Circuit"
	}

	isQualy := strings.Contains(sessionType, "qual") || strings.Contains(sessionType, "shootout") || strings.Contains(sessionType, "q1") || strings.Contains(sessionType, "q2") || strings.Contains(sessionType, "q3") || strings.Contains(sessionType, "sq1") || strings.Contains(sessionType, "sq2") || strings.Contains(sessionType, "sq3")
	isPractice := strings.Contains(sessionType, "practice") || strings.Contains(sessionType, "fp1") || strings.Contains(sessionType, "fp2") || strings.Contains(sessionType, "fp3") || strings.Contains(sessionType, "p1") || strings.Contains(sessionType, "p2") || strings.Contains(sessionType, "p3")

	sb.WriteString("\nSESSION PROTOCOL DIRECTIVES:\n")
	sb.WriteString(catalog.SessionProtocolDirective(live.SessionType, trackName, isQualy, isPractice))

	sb.WriteString("### LIVE SESSION TELEMETRY & PIT WALL DATA:\n")
	if live.Summary != "" {
		sb.WriteString(live.Summary)
		sb.WriteString("\n")
	} else {
		sb.WriteString("Standing by for live on-track telemetry. Assist the driver with session preparation, track layout advice, vehicle setup theory, or strategy planning.\n")
	}
	return sb.String()
}

// toolUseDirective tells a live-mode engineer how to use the race data tools it was given.
func toolUseDirective(persona, language string) string {
	return locales.Resolve(language, "", persona).ToolUseDirective()
}

func buildGeneralPrompt(language string) string {
	var sb strings.Builder
	sb.WriteString("You are the personal F1 Race Engineer.\n")
	sb.WriteString("Help the driver with telemetry interpretation, driving coaching, vehicle setup theory, and racing strategy.\n")
	sb.WriteString(locales.Resolve(language, "", "").GeneralAssistantDirectives())
	sb.WriteString("\n")
	sb.WriteString("Use structured, clear Markdown with concise technical bullet points.\n")
	return sb.String()
}

func buildComparatorPrompt(c *LapComparison) string {
	var sb strings.Builder
	sb.WriteString("You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n")
	sb.WriteString("Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance, diagnose where lap time was gained or lost, and provide clear, highly technical coaching advice to beat Lap B (the comparison / benchmark lap).\n\n")

	sb.WriteString("CORE COACHING & ROLE RULES:\n")
	sb.WriteString("1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON: Use 'you', 'your lap', 'you are braking', 'your traction', always referring to the driver of Lap A.\n")
	sb.WriteString("2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: Refer to Lap B as 'the benchmark', 'Lap B', or by driver B's name. NEVER give improvement advice to driver B or act as their engineer.\n")
	sb.WriteString("3. IF YOUR DRIVER (LAP A) IS SLOWER: Explain specifically where they are losing time (e.g. 'You are braking 15m too early compared to Lap B into Turn 1', 'You lose 0.15s on traction out of the hairpin') and give actionable instructions to recover that delta.\n")
	sb.WriteString("4. IF YOUR DRIVER (LAP A) IS FASTER: Congratulate them on the lap, highlight where they built the advantage over Lap B, and if there are any specific corners where Lap B was stronger, mention them as opportunities to gain even more time.\n")
	sb.WriteString("5. COMMUNICATION STYLE & LANGUAGE: Always respond in the language used by the user / driver (e.g. if the driver writes in Spanish, reply in Spanish; if in English, reply in English; default to English if undetermined). Maintain a professional, sharp, direct F1 team radio tone. Use structured Markdown (bold keywords, bullet points).\n")
	sb.WriteString("6. DO NOT MENTION CAR SETUPS: Setups of other cars are unavailable. Focus 100% on driving technique, braking points, minimum corner apex speed, exit traction, and ERS/DRS deployment.\n\n")

	if c == nil {
		sb.WriteString("Currently, specific telemetry data is not active. Assist the driver with general F1 telemetry interpretation, driving advice, setup considerations, or racecraft guidance.\n")
		return sb.String()
	}
	writeComparisonData(&sb, c)
	return sb.String()
}

// writeComparisonData writes the comparator telemetry section of the prompt.
func writeComparisonData(sb *strings.Builder, c *LapComparison) {
	sb.WriteString("### COMPARATIVE TELEMETRY DATA:\n")
	if c.CrossSession {
		fmt.Fprintf(sb, "- Track: %s (Cross-Session Comparison)\n", c.TrackName)
		writeComparedSession(sb, "A", c.SessionTypeA, c.WeatherA)
		writeComparedSession(sb, "B", c.SessionTypeB, c.WeatherB)
	} else {
		fmt.Fprintf(sb, "- Track: %s | Session: %s\n", c.TrackName, c.SessionTypeA)
	}
	fmt.Fprintf(sb, "- YOUR DRIVER (Lap A): %s (%s) - Compound: %s\n", c.LapAName, c.LapATime, c.CompoundA)
	fmt.Fprintf(sb, "- BENCHMARK / RIVAL (Lap B): %s (%s) - Compound: %s\n", c.LapBName, c.LapBTime, c.CompoundB)
	fmt.Fprintf(sb, "- Total Time Delta: %.3f s (Faster: %s)\n", c.TimeDeltaSeconds, c.FasterLap)

	sb.WriteString("- Sector Times:\n")
	for i := range c.SectorsA {
		fmt.Fprintf(sb, "  * Sector %d: Your time (%s) vs Benchmark (%s)\n", i+1, c.SectorsA[i], c.SectorsB[i])
	}

	fmt.Fprintf(sb, "- Top Speed (Speed Trap): Your speed = %.1f km/h | Benchmark = %.1f km/h\n", c.TopSpeedA, c.TopSpeedB)
	fmt.Fprintf(sb, "- Cumulative ERS Deployment: Your usage = %.1f%% | Benchmark = %.1f%%\n", c.ERSUsedPctA, c.ERSUsedPctB)

	if c.BrakingSummary != "" {
		fmt.Fprintf(sb, "- Braking Analysis: %s\n", c.BrakingSummary)
	}
	if c.ApexSpeedSummary != "" {
		fmt.Fprintf(sb, "- Corner Apex Speed: %s\n", c.ApexSpeedSummary)
	}
	if c.ThrottleSummary != "" {
		fmt.Fprintf(sb, "- Traction & Acceleration: %s\n", c.ThrottleSummary)
	}
	if c.ERSDRSSummary != "" {
		fmt.Fprintf(sb, "- ERS & DRS: %s\n", c.ERSDRSSummary)
	}

	if zr := c.Zoom; zr != nil {
		fmt.Fprintf(sb, "\n### ZOOMED SECTOR FOCUSED BY DRIVER (%.0fm - %.0fm):\n", zr.StartDistanceMeters, zr.EndDistanceMeters)
		if zr.Description != "" {
			fmt.Fprintf(sb, "- Description: %s\n", zr.Description)
		}
		fmt.Fprintf(sb, "- Delta in this segment: %.3fs\n", zr.DeltaInSegment)
		fmt.Fprintf(sb, "- Apex speed delta in corner: %.1f km/h\n", zr.SpeedDiffAtApex)
		if zr.HasBrakingDiff {
			fmt.Fprintf(sb, "- Braking point difference: %.1f meters (positive: you brake later than the benchmark)\n", zr.BrakingDiffMeters)
		}
	}
}

func writeComparedSession(sb *strings.Builder, lap, sessionType, weather string) {
	fmt.Fprintf(sb, "  * Lap %s Session: %s", lap, sessionType)
	if weather != "" {
		fmt.Fprintf(sb, " (Weather: %s)", weather)
	}
	sb.WriteString("\n")
}
