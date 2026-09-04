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

  return {
    buildCurrentBackendContext,
  };
};
