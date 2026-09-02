import { useCallback } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import type {
  ContextMode,
  SessionDebriefContextPayload,
  LiveContextPayload,
} from '../context/RaceEngineerContext';

export interface UseSystemPromptProps {
  contextMode: ContextMode;
  comparatorContext: TelemetryContextPayload | null;
  sessionDebriefContext: SessionDebriefContextPayload | null;
  liveContext: LiveContextPayload | null;
  locale: 'en' | 'es';
}

export interface BackendContextPayload {
  context_mode: ContextMode;
  language: 'en' | 'es';
  track_name?: string;
  session_type?: string;
  weather_a?: string;
  session_summary?: string;
  live_summary?: string;
  [key: string]: unknown;
}

export interface UseSystemPromptReturn {
  buildCurrentBackendContext: () => BackendContextPayload;
  buildClientSideSystemPrompt: () => string;
}

export const useSystemPrompt = ({
  contextMode,
  comparatorContext,
  sessionDebriefContext,
  liveContext,
  locale,
}: UseSystemPromptProps): UseSystemPromptReturn => {
  const buildCurrentBackendContext = useCallback((): BackendContextPayload => {
    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return {
        context_mode: 'session_debrief',
        language: locale,
        track_name: sessionDebriefContext.trackName,
        session_type: sessionDebriefContext.sessionType,
        weather_a: sessionDebriefContext.weather,
        session_summary: sessionDebriefContext.summaryText,
      };
    }
    if (contextMode === 'live') {
      return {
        context_mode: 'live',
        language: locale,
        track_name: liveContext?.trackName || '',
        session_type: liveContext?.sessionType || 'Live Session',
        live_summary:
          liveContext?.liveSummary ||
          'Live pit wall telemetry standby. Awaiting live packet stream from game.',
      };
    }
    if (contextMode === 'comparator' && comparatorContext) {
      return {
        context_mode: 'comparator',
        language: locale,
        ...comparatorContext,
      };
    }
    return {
      context_mode: 'general',
      language: locale,
    };
  }, [contextMode, sessionDebriefContext, locale, liveContext, comparatorContext]);

  const buildClientSideSystemPrompt = useCallback((): string => {
    const langInstruction =
      locale === 'es'
        ? 'Always respond in Spanish (Latin America / Argentina motorsport terminology e.g. neumáticos, boxes, monoplaza, vuelta rápida).'
        : 'Always respond in English.';

    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return (
        'You are the Chief Race Strategist and Performance Engineer providing an executive post-session debrief of the recorded session.\n' +
        'Analyze overall session classification, driver gaps, pace deltas, tyre stint strategies, degradation, and sector splits across the field.\n\n' +
        'ROLE & COMMUNICATION GUIDELINES:\n' +
        '1. Maintain an analytical, executive F1 engineering debrief tone reviewing the entire session.\n' +
        '2. DO NOT pretend to be an in-car radio talking to a single driver (DO NOT say "Box box", "bringing the car home to P2", etc.) unless the user specifically asks for coaching on a specific driver.\n' +
        '3. Clearly highlight the Winner / Pole Sitter, podium finishers, key gaps, strategy differences (e.g. tyre compounds and stint lengths), and sector records.\n' +
        `4. ${langInstruction}\n` +
        '5. Use structured Markdown with clear headings (## Summary, ## Classification & Gaps, ## Tyre Stints & Strategy, ## Sector Breakdown) and bullet points.\n\n' +
        `### SESSION CLASSIFICATION & TIMING DATA:\n${sessionDebriefContext.summaryText}`
      );
    }
    if (contextMode === 'live') {
      const isStandby =
        !liveContext ||
        liveContext.sessionType === 'Standby' ||
        !liveContext.liveSummary ||
        liveContext.liveSummary.includes('STANDBY') ||
        liveContext.liveSummary.includes('Waiting for live');
      const liveData = !isStandby
        ? `\n\n### LIVE TELEMETRY DATA:\n${liveContext?.liveSummary}`
        : '\n\n### LIVE STATUS: STANDBY / IN GARAGE (NO TELEMETRY PACKETS YET)\nNo live telemetry packets received from track yet. Live weather radar, tyre temperatures, and gap deltas are currently unavailable.\nCRITICAL: DO NOT invent fake rain percentages, temperatures, or stint data. Inform the driver directly that we are standing by in the garage/pit wall waiting for live track telemetry.';

      const antiHallucination =
        locale === 'es'
          ? '\n3. CERO ALUCINACIONES: Si estamos en espera en boxes (sin telemetría activa de pista), indicá que estamos en espera y que aún no hay datos de radar o pista disponibles. No inventes números ni porcentajes.'
          : '\n3. NO TELEMETRY HALLUCINATIONS: If in garage/standby with no live telemetry, state that we are standing by and live data is not yet available. Do not invent numbers or weather percentages.';

      return (
        'You are the active F1 Race Engineer on the pit wall over team radio during a live session.\n' +
        'Provide immediate tactical advice, weather updates, safety car restart strategy, and tyre crossover advice.\n\n' +
        'COMMUNICATION STYLE & ROLE RULES:\n' +
        '1. Maintain an urgent, clear, radio-concise tone suited for real-time in-car communication.\n' +
        `2. ${langInstruction}${antiHallucination}${liveData}`
      );
    }
    if (contextMode === 'comparator' && comparatorContext) {
      let p =
        'You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n' +
        'Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance and give actionable advice to beat Lap B (the benchmark).\n\n' +
        'CORE RULES:\n' +
        '1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON ("you", "your lap").\n' +
        '2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: NEVER coach driver B.\n' +
        '3. FOCUS ON DRIVING TECHNIQUE: Braking points, apex speeds, traction, ERS/DRS.\n' +
        `4. ${langInstruction}\n\n` +
        `### COMPARATIVE TELEMETRY:\n` +
        `- Track: ${comparatorContext.track_name} | Session: ${comparatorContext.session_type}\n` +
        `- YOUR DRIVER (Lap A): ${comparatorContext.lap_a_name} (${comparatorContext.lap_a_time_formatted}) - ${comparatorContext.lap_a_compound}\n` +
        `- BENCHMARK (Lap B): ${comparatorContext.lap_b_name} (${comparatorContext.lap_b_time_formatted}) - ${comparatorContext.lap_b_compound}\n` +
        `- Delta: ${comparatorContext.time_delta_seconds.toFixed(3)}s (Faster: ${comparatorContext.faster_lap})\n` +
        `- Sectors: S1 (${comparatorContext.lap_a_s1_formatted} vs ${comparatorContext.lap_b_s1_formatted}), S2 (${comparatorContext.lap_a_s2_formatted} vs ${comparatorContext.lap_b_s2_formatted}), S3 (${comparatorContext.lap_a_s3_formatted} vs ${comparatorContext.lap_b_s3_formatted})\n` +
        `- Top Speed: ${comparatorContext.top_speed_a.toFixed(1)} km/h vs ${comparatorContext.top_speed_b.toFixed(1)} km/h\n` +
        `- ERS Usage: ${comparatorContext.ers_a_used_percent.toFixed(1)}% vs ${comparatorContext.ers_b_used_percent.toFixed(1)}%\n`;

      if (comparatorContext.braking_summary) p += `- Braking: ${comparatorContext.braking_summary}\n`;
      if (comparatorContext.apex_speed_summary) p += `- Corner Apex Speed: ${comparatorContext.apex_speed_summary}\n`;
      if (comparatorContext.throttle_summary) p += `- Traction: ${comparatorContext.throttle_summary}\n`;
      if (comparatorContext.ers_drs_summary) p += `- ERS & DRS: ${comparatorContext.ers_drs_summary}\n`;

      if (comparatorContext.zoomed_range) {
        p += `\n### ZOOMED SECTOR (${comparatorContext.zoomed_range.start_distance_meters}m - ${comparatorContext.zoomed_range.end_distance_meters}m):\n`;
        if (comparatorContext.zoomed_range.description) p += `- Segment: ${comparatorContext.zoomed_range.description}\n`;
        p += `- Delta in segment: ${comparatorContext.zoomed_range.delta_in_segment.toFixed(3)}s\n`;
      }
      return p;
    }

    return (
      'You are the personal F1 Race Engineer.\n' +
      'Help the driver with telemetry analysis, driving coaching, setup theory, and racing strategy.\n' +
      `${langInstruction} Use structured, clear markdown.`
    );
  }, [comparatorContext, contextMode, liveContext, locale, sessionDebriefContext]);

  return {
    buildCurrentBackendContext,
    buildClientSideSystemPrompt,
  };
};
