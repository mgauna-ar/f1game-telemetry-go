import type { Session } from '../types/session';
import { getTrackInfo } from '../constants/f1';

export type SessionTypeTab = 'ALL' | 'RACE' | 'QUALI' | 'PRACTICE' | 'SPRINT';

/**
 * Checks whether a session matches a given search query.
 * Matches on: track name, country code/ISO3, localized country, track aliases,
 * session type, session ID, created date, and tags.
 */
export function matchSessionSearch(
  session: Session,
  query: string,
  t?: (key: string) => string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const trackInfo = getTrackInfo(session.track_name);
  const localizedCountry = trackInfo && t ? t(`common.countries.${trackInfo.countryCode}`) : '';
  const countryMatches =
    trackInfo &&
    (trackInfo.countryIso3.toLowerCase().includes(q) ||
      trackInfo.countryCode.toLowerCase().includes(q) ||
      (typeof localizedCountry === 'string' && localizedCountry.toLowerCase().includes(q)) ||
      (trackInfo.aliases && trackInfo.aliases.some((a) => a.toLowerCase().includes(q))));

  return (
    (session.track_name ? session.track_name.toLowerCase().includes(q) : false) ||
    Boolean(countryMatches) ||
    (session.session_type ? session.session_type.toLowerCase().includes(q) : false) ||
    String(session.id).includes(q) ||
    (session.created_at
      ? new Date(session.created_at).toLocaleDateString().toLowerCase().includes(q)
      : false) ||
    Boolean(session.tags && session.tags.some((tag) => tag.name.toLowerCase().includes(q)))
  );
}

/**
 * Checks whether a session matches a specific category tab (e.g. RACE, QUALI, PRACTICE, SPRINT).
 */
export function matchSessionTypeTab(
  sessionType: string | undefined,
  tab: SessionTypeTab = 'ALL'
): boolean {
  if (tab === 'ALL') return true;
  const lower = (sessionType || '').toLowerCase();
  if (tab === 'SPRINT') return lower.includes('sprint');
  if (tab === 'RACE') return lower.includes('race') && !lower.includes('sprint');
  if (tab === 'QUALI')
    return (
      (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) &&
      !lower.includes('sprint')
    );
  if (tab === 'PRACTICE')
    return (
      lower.includes('practice') ||
      lower.includes('fp') ||
      lower.includes('p1') ||
      lower.includes('p2') ||
      lower.includes('p3')
    );
  return true;
}

/**
 * Filters a list of sessions by query and optional session type tab.
 */
export function filterSessionsBySearch(
  sessions: Session[],
  query: string,
  typeTab: SessionTypeTab = 'ALL',
  t?: (key: string) => string
): Session[] {
  return sessions.filter(
    (s) => matchSessionSearch(s, query, t) && matchSessionTypeTab(s.session_type, typeTab)
  );
}
