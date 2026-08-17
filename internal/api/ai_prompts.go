package api

import (
	"fmt"
	"strings"
)

// buildSystemPrompt constructs a rich system prompt tailored for an elite F1 Race Engineer based on context mode.
func buildSystemPrompt(telemetryCtx *TelemetryAnalysisContext) string {
	if telemetryCtx != nil && (telemetryCtx.ContextMode == "session_debrief" || (telemetryCtx.SessionSummary != "" && telemetryCtx.LapAName == "")) {
		return buildSessionDebriefPrompt(telemetryCtx)
	}

	if telemetryCtx != nil && (telemetryCtx.ContextMode == "live" || telemetryCtx.LiveSummary != "") {
		return buildLivePrompt(telemetryCtx)
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
		sb.WriteString(fmt.Sprintf("\nSession Notes: %s\n", telemetryCtx.CustomPrompt))
	}
	return sb.String()
}

func buildLivePrompt(telemetryCtx *TelemetryAnalysisContext) string {
	var sb strings.Builder
	sb.WriteString("You are the active F1 Race Engineer on the pit wall over team radio during a live race or session.\n")
	sb.WriteString("Provide immediate tactical advice, weather updates, safety car restart strategy, tyre crossover windows, and gap management.\n\n")
	sb.WriteString("COMMUNICATION STYLE & ROLE RULES:\n")
	sb.WriteString("1. Maintain an urgent, clear, radio-concise tone suited for real-time in-car communication.\n")
	sb.WriteString("2. Always respond in the language used by the user / driver (e.g. if Spanish, reply in Spanish; if English, reply in English).\n")
	sb.WriteString("3. Highlight critical safety flags, weather precipitation forecasts, and optimal box/pit windows.\n\n")

	sb.WriteString("### LIVE SESSION TELEMETRY & PIT WALL DATA:\n")
	if telemetryCtx.LiveSummary != "" {
		sb.WriteString(telemetryCtx.LiveSummary)
		sb.WriteString("\n")
	}
	if telemetryCtx.CustomPrompt != "" {
		sb.WriteString(fmt.Sprintf("\nLive Strategy Notes: %s\n", telemetryCtx.CustomPrompt))
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

	if telemetryCtx != nil && telemetryCtx.LapAName != "" && telemetryCtx.LapBName != "" {
		sb.WriteString("### COMPARATIVE TELEMETRY DATA:\n")
		if telemetryCtx.CrossSession || (telemetryCtx.SessionBType != "" && telemetryCtx.SessionBType != telemetryCtx.SessionType) {
			sb.WriteString(fmt.Sprintf("- Track: %s (Cross-Session Comparison)\n", telemetryCtx.TrackName))
			sb.WriteString(fmt.Sprintf("  * Lap A Session: %s", telemetryCtx.SessionType))
			if telemetryCtx.WeatherA != "" {
				sb.WriteString(fmt.Sprintf(" (Weather: %s)", telemetryCtx.WeatherA))
			}
			sb.WriteString("\n")
			sb.WriteString(fmt.Sprintf("  * Lap B Session: %s", telemetryCtx.SessionBType))
			if telemetryCtx.WeatherB != "" {
				sb.WriteString(fmt.Sprintf(" (Weather: %s)", telemetryCtx.WeatherB))
			}
			sb.WriteString("\n")
		} else {
			sb.WriteString(fmt.Sprintf("- Track: %s | Session: %s\n", telemetryCtx.TrackName, telemetryCtx.SessionType))
		}
		sb.WriteString(fmt.Sprintf("- YOUR DRIVER (Lap A): %s (%s) - Compound: %s\n", telemetryCtx.LapAName, telemetryCtx.LapATimeFormatted, telemetryCtx.LapACompound))
		sb.WriteString(fmt.Sprintf("- BENCHMARK / RIVAL (Lap B): %s (%s) - Compound: %s\n", telemetryCtx.LapBName, telemetryCtx.LapBTimeFormatted, telemetryCtx.LapBCompound))
		sb.WriteString(fmt.Sprintf("- Total Time Delta: %.3f s (Faster: %s)\n", telemetryCtx.TimeDeltaSeconds, telemetryCtx.FasterLap))

		sb.WriteString("- Sector Times:\n")
		sb.WriteString(fmt.Sprintf("  * Sector 1: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS1Formatted, telemetryCtx.LapBS1Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 2: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS2Formatted, telemetryCtx.LapBS2Formatted))
		sb.WriteString(fmt.Sprintf("  * Sector 3: Your time (%s) vs Benchmark (%s)\n", telemetryCtx.LapAS3Formatted, telemetryCtx.LapBS3Formatted))

		sb.WriteString(fmt.Sprintf("- Top Speed (Speed Trap): Your speed = %.1f km/h | Benchmark = %.1f km/h\n", telemetryCtx.TopSpeedA, telemetryCtx.TopSpeedB))
		sb.WriteString(fmt.Sprintf("- Cumulative ERS Deployment: Your usage = %.1f%% | Benchmark = %.1f%%\n", telemetryCtx.ERSAUsedPercent, telemetryCtx.ERSBUsedPercent))

		if telemetryCtx.BrakingSummary != "" {
			sb.WriteString(fmt.Sprintf("- Braking Analysis: %s\n", telemetryCtx.BrakingSummary))
		}
		if telemetryCtx.ApexSpeedSummary != "" {
			sb.WriteString(fmt.Sprintf("- Corner Apex Speed: %s\n", telemetryCtx.ApexSpeedSummary))
		}
		if telemetryCtx.ThrottleSummary != "" {
			sb.WriteString(fmt.Sprintf("- Traction & Acceleration: %s\n", telemetryCtx.ThrottleSummary))
		}
		if telemetryCtx.ERSDRSSummary != "" {
			sb.WriteString(fmt.Sprintf("- ERS & DRS: %s\n", telemetryCtx.ERSDRSSummary))
		}

		if telemetryCtx.ZoomedRange != nil {
			zr := telemetryCtx.ZoomedRange
			sb.WriteString(fmt.Sprintf("\n### ZOOMED SECTOR FOCUSED BY DRIVER (%.0fm - %.0fm):\n", zr.StartDistanceMeters, zr.EndDistanceMeters))
			if zr.Description != "" {
				sb.WriteString(fmt.Sprintf("- Description: %s\n", zr.Description))
			}
			sb.WriteString(fmt.Sprintf("- Delta in this segment: %.3fs\n", zr.DeltaInSegment))
			sb.WriteString(fmt.Sprintf("- Apex speed delta in corner: %.1f km/h\n", zr.SpeedDiffAtApex))
			sb.WriteString(fmt.Sprintf("- Braking point difference: %.1f meters\n", zr.BrakingDiffMeters))
		}
	} else if telemetryCtx != nil && telemetryCtx.CustomPrompt != "" {
		sb.WriteString(fmt.Sprintf("\nTelemetry / Context Information:\n%s\n", telemetryCtx.CustomPrompt))
	} else {
		sb.WriteString("Currently, specific telemetry data is not active. Assist the driver with general F1 telemetry interpretation, driving advice, setup considerations, or racecraft guidance.\n")
	}

	return sb.String()
}
