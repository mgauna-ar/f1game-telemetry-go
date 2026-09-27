import { RADIO_LANGUAGES } from '../constants/f1';
import type { ChatContextMode, ChatContextRequest } from '../types/ai';
import type { Route } from '../router/routes';
import type { Session } from '../types/session';

/** The two laps the comparator chat is about, and the zoomed segment if any. */
export interface ComparatorChatTarget {
  lapAId: number;
  lapBId: number;
  /** Lap distance in meters: [start, end]. */
  zoom: [number, number] | null;
  /** Only for the chat's header badge; the server loads the laps itself. */
  trackName: string;
}

/** The recorded session the debrief chat is about. */
export interface SessionDebriefChatTarget {
  sessionId: number;
  /** Only for the chat's header badge; the server loads the session itself. */
  trackName: string;
}

export interface ChatTargets {
  contextMode: ChatContextMode;
  comparatorTarget: ComparatorChatTarget | null;
  sessionDebriefTarget: SessionDebriefChatTarget | null;
}

/**
 * What the chat is about, read from the page's URL: the session open in History, the laps and
 * zoom in the comparator, or the live session. The sessions only name the track in the badge.
 */
export function chatTargetsFromRoute(
  route: Route,
  sessions: ReadonlyArray<Pick<Session, 'id' | 'track_name'>>
): ChatTargets {
  const trackName = (id: number | undefined) => sessions.find((s) => s.id === id)?.track_name ?? '';
  switch (route.page) {
    case 'live':
      return { contextMode: 'live', comparatorTarget: null, sessionDebriefTarget: null };
    case 'compare': {
      const { lapA, lapB, zoom, sessionA } = route;
      return {
        contextMode: 'comparator',
        comparatorTarget:
          lapA && lapB ? { lapAId: lapA, lapBId: lapB, zoom: zoom ?? null, trackName: trackName(sessionA) } : null,
        sessionDebriefTarget: null,
      };
    }
    case 'history':
      if (!route.sessionId) return { contextMode: 'general', comparatorTarget: null, sessionDebriefTarget: null };
      return {
        contextMode: 'session_debrief',
        comparatorTarget: null,
        sessionDebriefTarget: { sessionId: route.sessionId, trackName: trackName(route.sessionId) },
      };
  }
}

/**
 * What a chat request tells the server about the chat: only identifiers. The server builds the
 * prompt data (live briefing, session debrief, lap comparison) from them.
 */
export function buildChatContextRequest(
  mode: ChatContextMode,
  comparator: ComparatorChatTarget | null,
  debrief: SessionDebriefChatTarget | null
): ChatContextRequest {
  if (mode === 'session_debrief' && debrief) {
    return { context_mode: 'session_debrief', session_id: debrief.sessionId };
  }
  if (mode === 'comparator') {
    if (!comparator) return { context_mode: 'comparator' };
    const [start, end] = comparator.zoom ?? [0, 0];
    return {
      context_mode: 'comparator',
      lap_a_id: comparator.lapAId,
      lap_b_id: comparator.lapBId,
      ...(end > start ? { zoom: { start_meters: start, end_meters: end } } : {}),
    };
  }
  if (mode === 'live') {
    return { context_mode: 'live' };
  }
  return { context_mode: 'general' };
}

/** The language the engineer speaks: the radio setting, or the UI language when it's "auto". */
export function resolveRadioLanguage(radioLanguage: string, uiLocale: string): 'en' | 'es' {
  if (radioLanguage === RADIO_LANGUAGES.AUTO) return uiLocale === 'es' ? 'es' : 'en';
  return radioLanguage === RADIO_LANGUAGES.ES ? 'es' : 'en';
}
