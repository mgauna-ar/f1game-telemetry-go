package ai

import (
	"fmt"
	"strings"

	"github.com/mgauna/f1game-telemetry-go/internal/locales"
)

// BuildSystemPrompt constructs a rich system prompt tailored for an elite F1 Race Engineer based on context mode, persona, and language.
func BuildSystemPrompt(telemetryCtx *TelemetryAnalysisContext, persona, language string) string {
	if telemetryCtx != nil && (telemetryCtx.ContextMode == "session_debrief" || (telemetryCtx.SessionSummary != "" && telemetryCtx.LapAName == "")) {
		return buildSessionDebriefPrompt(telemetryCtx)
	}

	if telemetryCtx != nil && (telemetryCtx.ContextMode == "live" || telemetryCtx.LiveSummary != "") {
		return buildLivePrompt(telemetryCtx, persona, language)
	}

	if telemetryCtx != nil && telemetryCtx.ContextMode == "general" {
		return buildGeneralPrompt(telemetryCtx, language)
	}

	return buildComparatorPrompt(telemetryCtx)
}

func buildSessionDebriefPrompt(telemetryCtx *TelemetryAnalysisContext) string {
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
	if telemetryCtx.SessionSummary != "" {
		sb.WriteString(telemetryCtx.SessionSummary)
		sb.WriteString("\n")
	}
	if telemetryCtx.CustomPrompt != "" {
		fmt.Fprintf(&sb, "\nSession Notes: %s\n", telemetryCtx.CustomPrompt)
	}
	return sb.String()
}

func buildLivePrompt(telemetryCtx *TelemetryAnalysisContext, persona, language string) string {
	var sb strings.Builder

	fallbackLang := ""
	if telemetryCtx != nil {
		fallbackLang = telemetryCtx.Language
	}
	catalog := locales.Resolve(language, fallbackLang, persona)

	customPrompt := ""
	if telemetryCtx != nil {
		customPrompt = telemetryCtx.CustomPersonaPrompt
	}
	sb.WriteString(catalog.PersonaPrompt(persona, customPrompt))

	sb.WriteString("\nCRITICAL RADIO CONSTRAINTS:\n")
	if telemetryCtx != nil && strings.TrimSpace(telemetryCtx.DriverCallsign) != "" {
		sb.WriteString(catalog.DriverCallsignDirective(telemetryCtx.DriverCallsign))
	}
	sb.WriteString(catalog.CriticalRadioConstraints())

	// Dynamic Urgency Level Injection
	if telemetryCtx != nil && telemetryCtx.UrgencyLevel != "" {
		sb.WriteString(catalog.UrgencyDirective(telemetryCtx.UrgencyLevel))
	}

	// Incident Status Injection
	if telemetryCtx != nil && telemetryCtx.IncidentStatus != "" {
		sb.WriteString(catalog.IncidentDirective(telemetryCtx.IncidentStatus))
	}

	// F1 2026 Regulation Mandate (DRS abolished -> Override Mode / Straight Mode)
	is2026 := (telemetryCtx != nil && telemetryCtx.PacketFormat >= 2026) ||
		(telemetryCtx != nil && (strings.Contains(telemetryCtx.LiveSummary, "2026") || strings.Contains(telemetryCtx.CustomPrompt, "2026")))
	if is2026 {
		sb.WriteString(catalog.F12026RegulationMandate())
	}

	// Dynamic Driving Phase Protocol Injection
	phase := ""
	if telemetryCtx != nil {
		phase = strings.ToUpper(strings.TrimSpace(telemetryCtx.DrivingPhase))
		if phase == "" && telemetryCtx.LiveSummary != "" {
			switch {
			case strings.Contains(telemetryCtx.LiveSummary, "STATUS: STARTING GRID") || strings.Contains(telemetryCtx.LiveSummary, "STATUS: GRID"):
				phase = "GRID"
			case strings.Contains(telemetryCtx.LiveSummary, "STATUS: RACE START") || strings.Contains(telemetryCtx.LiveSummary, "STATUS: LAP 1"):
				phase = "RACE_START"
			case strings.Contains(telemetryCtx.LiveSummary, "STATUS: IN-LAP") || strings.Contains(telemetryCtx.LiveSummary, "STATUS: COOL-DOWN"):
				phase = "IN_LAP"
			case strings.Contains(telemetryCtx.LiveSummary, "STATUS: POST-RACE"):
				phase = "POST_RACE"
			}
		}
	}
	if phase != "" {
		sb.WriteString(catalog.DrivingPhaseDirective(phase))
	}

	// Engineering Knowledge: Pirelli Tyre Operating Windows & Engine Thermal Derate Curve
	sb.WriteString(catalog.ThermalOperatingWindows())
	sb.WriteString(catalog.EngineThermalDerateCurve())

	// Detect session type mode (Qualifying vs Practice vs Race)
	sessionType := ""
	trackName := ""
	if telemetryCtx != nil {
		sessionType = strings.ToLower(telemetryCtx.SessionType)
		trackName = telemetryCtx.TrackName
	}
	if trackName == "" {
		trackName = "F1 Circuit"
	}

	isQualy := strings.Contains(sessionType, "qual") || strings.Contains(sessionType, "shootout") || strings.Contains(sessionType, "q1") || strings.Contains(sessionType, "q2") || strings.Contains(sessionType, "q3") || strings.Contains(sessionType, "sq1") || strings.Contains(sessionType, "sq2") || strings.Contains(sessionType, "sq3")
	isPractice := strings.Contains(sessionType, "practice") || strings.Contains(sessionType, "fp1") || strings.Contains(sessionType, "fp2") || strings.Contains(sessionType, "fp3") || strings.Contains(sessionType, "p1") || strings.Contains(sessionType, "p2") || strings.Contains(sessionType, "p3")

	sb.WriteString("\nSESSION PROTOCOL DIRECTIVES:\n")
	origSessionType := ""
	if telemetryCtx != nil {
		origSessionType = telemetryCtx.SessionType
	}
	sb.WriteString(catalog.SessionProtocolDirective(origSessionType, trackName, isQualy, isPractice))

	sb.WriteString("### LIVE SESSION TELEMETRY & PIT WALL DATA:\n")
	if telemetryCtx != nil && telemetryCtx.LiveSummary != "" {
		sb.WriteString(telemetryCtx.LiveSummary)
		sb.WriteString("\n")
	} else {
		sb.WriteString("Standing by for live on-track telemetry. Assist the driver with session preparation, track layout advice, vehicle setup theory, or strategy planning.\n")
	}
	if telemetryCtx != nil && telemetryCtx.CustomPrompt != "" {
		fmt.Fprintf(&sb, "\nLive Strategy Notes: %s\n", telemetryCtx.CustomPrompt)
	}
	return sb.String()
}

func buildGeneralPrompt(telemetryCtx *TelemetryAnalysisContext, language string) string {
	var sb strings.Builder
	sb.WriteString("You are the personal F1 Race Engineer.\n")
	sb.WriteString("Help the driver with telemetry interpretation, driving coaching, vehicle setup theory, and racing strategy.\n")
	fallbackLang := ""
	if telemetryCtx != nil {
		fallbackLang = telemetryCtx.Language
	}
	catalog := locales.Resolve(language, fallbackLang, "")
	sb.WriteString(catalog.GeneralAssistantDirectives())
	sb.WriteString("\n")
	sb.WriteString("Use structured, clear Markdown with concise technical bullet points.\n")
	if telemetryCtx != nil && telemetryCtx.CustomPrompt != "" {
		fmt.Fprintf(&sb, "\nContext Notes: %s\n", telemetryCtx.CustomPrompt)
	}
	return sb.String()
}

func buildComparatorPrompt(telemetryCtx *TelemetryAnalysisContext) string {
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

	switch {
	case telemetryCtx != nil && telemetryCtx.LapAName != "" && telemetryCtx.LapBName != "":
		sb.WriteString("### COMPARATIVE TELEMETRY DATA:\n")
		if telemetryCtx.CrossSession || (telemetryCtx.SessionBType != "" && telemetryCtx.SessionBType != telemetryCtx.SessionType) {
			fmt.Fprintf(&sb, "- Track: %s (Cross-Session Comparison)\n", telemetryCtx.TrackName)
			fmt.Fprintf(&sb, "  * Lap A Session: %s", telemetryCtx.SessionType)
			if telemetryCtx.WeatherA != "" {
				fmt.Fprintf(&sb, " (Weather: %s)", telemetryCtx.WeatherA)
			}
			sb.WriteString("\n")
			fmt.Fprintf(&sb, "  * Lap B Session: %s", telemetryCtx.SessionBType)
			if telemetryCtx.WeatherB != "" {
				fmt.Fprintf(&sb, " (Weather: %s)", telemetryCtx.WeatherB)
			}
			sb.WriteString("\n")
		} else {
			fmt.Fprintf(&sb, "- Track: %s | Session: %s\n", telemetryCtx.TrackName, telemetryCtx.SessionType)
		}
		fmt.Fprintf(&sb, "- YOUR DRIVER (Lap A): %s (%s) - Compound: %s\n", telemetryCtx.LapAName, telemetryCtx.LapATimeFormatted, telemetryCtx.LapACompound)
		fmt.Fprintf(&sb, "- BENCHMARK / RIVAL (Lap B): %s (%s) - Compound: %s\n", telemetryCtx.LapBName, telemetryCtx.LapBTimeFormatted, telemetryCtx.LapBCompound)
		fmt.Fprintf(&sb, "- Total Time Delta: %.3f s (Faster: %s)\n", telemetryCtx.TimeDeltaSeconds, telemetryCtx.FasterLap)

		sb.WriteString("- Sector Times:\n")
		fmt.Fprintf(&sb, "  * Sector 1: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS1Formatted, telemetryCtx.LapBS1Formatted)
		fmt.Fprintf(&sb, "  * Sector 2: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS2Formatted, telemetryCtx.LapBS2Formatted)
		fmt.Fprintf(&sb, "  * Sector 3: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS3Formatted, telemetryCtx.LapBS3Formatted)

		fmt.Fprintf(&sb, "- Top Speed (Speed Trap): Your speed = %.1f km/h | Benchmark = %.1f km/h\n", telemetryCtx.TopSpeedA, telemetryCtx.TopSpeedB)
		fmt.Fprintf(&sb, "- Cumulative ERS Deployment: Your usage = %.1f%% | Benchmark = %.1f%%\n", telemetryCtx.ERSAUsedPercent, telemetryCtx.ERSBUsedPercent)

		if telemetryCtx.BrakingSummary != "" {
			fmt.Fprintf(&sb, "- Braking Analysis: %s\n", telemetryCtx.BrakingSummary)
		}
		if telemetryCtx.ApexSpeedSummary != "" {
			fmt.Fprintf(&sb, "- Corner Apex Speed: %s\n", telemetryCtx.ApexSpeedSummary)
		}
		if telemetryCtx.ThrottleSummary != "" {
			fmt.Fprintf(&sb, "- Traction & Acceleration: %s\n", telemetryCtx.ThrottleSummary)
		}
		if telemetryCtx.ERSDRSSummary != "" {
			fmt.Fprintf(&sb, "- ERS & DRS: %s\n", telemetryCtx.ERSDRSSummary)
		}

		if telemetryCtx.ZoomedRange != nil {
			zr := telemetryCtx.ZoomedRange
			fmt.Fprintf(&sb, "\n### ZOOMED SECTOR FOCUSED BY DRIVER (%.0fm - %.0fm):\n", zr.StartDistanceMeters, zr.EndDistanceMeters)
			if zr.Description != "" {
				fmt.Fprintf(&sb, "- Description: %s\n", zr.Description)
			}
			fmt.Fprintf(&sb, "- Delta in this segment: %.3fs\n", zr.DeltaInSegment)
			fmt.Fprintf(&sb, "- Apex speed delta in corner: %.1f km/h\n", zr.SpeedDiffAtApex)
			fmt.Fprintf(&sb, "- Braking point difference: %.1f meters\n", zr.BrakingDiffMeters)
		}
	case telemetryCtx != nil && telemetryCtx.CustomPrompt != "":
		fmt.Fprintf(&sb, "\nTelemetry / Context Information:\n%s\n", telemetryCtx.CustomPrompt)
	default:
		sb.WriteString("Currently, specific telemetry data is not active. Assist the driver with general F1 telemetry interpretation, driving advice, setup considerations, or racecraft guidance.\n")
	}

	return sb.String()
}
