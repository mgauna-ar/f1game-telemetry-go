package api

import (
	"fmt"
	"strings"
)

// buildSystemPrompt constructs a rich system prompt tailored for an elite F1 Race Engineer based on context mode, persona, and language.
func buildSystemPrompt(telemetryCtx *TelemetryAnalysisContext, persona, language string) string {
	if telemetryCtx != nil && (telemetryCtx.ContextMode == "session_debrief" || (telemetryCtx.SessionSummary != "" && telemetryCtx.LapAName == "")) {
		return buildSessionDebriefPrompt(telemetryCtx)
	}

	if telemetryCtx != nil && (telemetryCtx.ContextMode == "live" || telemetryCtx.LiveSummary != "") {
		return buildLivePrompt(telemetryCtx, persona, language)
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

	lang := strings.ToLower(strings.TrimSpace(language))
	if lang == "" && telemetryCtx != nil {
		lang = strings.ToLower(strings.TrimSpace(telemetryCtx.Language))
	}

	personaNormalized := strings.ToLower(strings.TrimSpace(persona))
	if personaNormalized == "" {
		personaNormalized = "colapinto"
	}

	// If language is unspecified, default to persona's native language
	if lang == "" {
		if personaNormalized == "bono" {
			lang = "en"
		} else {
			lang = "es"
		}
	}

	isEnglish := strings.HasPrefix(lang, "en")

	switch personaNormalized {
	case "bono":
		if isEnglish {
			sb.WriteString("You are Peter 'Bono' Bonnington, senior F1 Race Engineer on the pit wall over live team radio.\n")
			sb.WriteString("STYLE & PROTOCOL: Calm, measured, ultra-technical, and precise. Use classic British race engineering vocabulary ('Box box', 'Hammer time', 'Manage tyre delta', 'Gap is +0.3'). Always respond in English.\n")
		} else {
			sb.WriteString("Sos Peter 'Bono' Bonnington, experimentado Ingeniero de Carrera senior de F1 en el pit wall conectado por radio de equipo en vivo.\n")
			sb.WriteString("ESTILO & PROTOCOLO: Extremadamente calmado, metódico, quirúrgico y calculador (estilo Mercedes). Usá vocabulario técnico de ingeniería de carrera en español ('Entendido', 'Modo carrera activado', 'Momento de empujar', 'Gestioná la degradación de gomas', 'Diferencia +0.4s'). Respondé siempre en español.\n")
		}
	case "custom":
		if telemetryCtx != nil && telemetryCtx.CustomPersonaPrompt != "" {
			sb.WriteString(telemetryCtx.CustomPersonaPrompt)
			sb.WriteString("\n")
		} else {
			if isEnglish {
				sb.WriteString("You are a specialized F1 Race Engineer on the pit wall over team radio during a live session. Respond in English.\n")
			} else {
				sb.WriteString("Sos un Ingeniero de Carrera especializado en el pit wall conectado por radio de equipo durante una sesión en vivo. Respondé en español.\n")
			}
		}
	case "colapinto":
		fallthrough
	default:
		if isEnglish {
			sb.WriteString("You are the personal F1 Race Engineer on the pit wall over live team radio with the energetic and passionate persona of Franco Colapinto.\n")
			sb.WriteString("STYLE & PROTOCOL: Young, spirited, highly technical, and direct with authentic motorsport enthusiasm. Use sharp racing radio terminology ('Tyres in window', 'Box box', 'Great pace, keep pushing', 'Gap is +0.4s'). Always respond in English.\n")
		} else {
			sb.WriteString("Sos el Ingeniero de Carrera personal en el pit wall conectado por radio de equipo en vivo durante la sesión, con la personificación de Franco Colapinto.\n")
			sb.WriteString("ESTILO & PROTOCOLO: Ingeniero de pista argentino, joven, apasionado, técnico y directo. Utilizá jerga rioplatense de motorsport (gomas, boxes, monoplaza, ritmo, frenada, curva, sobrepaso, diferencia de tiempo) con tono profesional, enérgico y ágil. Respondé siempre en español.\n")
		}
	}

	sb.WriteString("\nCRITICAL RADIO CONSTRAINTS:\n")
	sb.WriteString("1. MAXIMUM 2 SHORT SENTENCES per radio message. This is pit-to-car radio communication — be ultra-concise, direct, and actionable with zero filler phrases or markdown lists.\n")
	sb.WriteString("2. Provide tactical advice on tyre wear, rival gaps, weather/safety car status, or pit windows based on the live data.\n\n")

	sb.WriteString("### LIVE SESSION TELEMETRY & PIT WALL DATA:\n")
	if telemetryCtx != nil && telemetryCtx.LiveSummary != "" {
		sb.WriteString(telemetryCtx.LiveSummary)
		sb.WriteString("\n")
	}
	if telemetryCtx != nil && telemetryCtx.CustomPrompt != "" {
		fmt.Fprintf(&sb, "\nLive Strategy Notes: %s\n", telemetryCtx.CustomPrompt)
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
