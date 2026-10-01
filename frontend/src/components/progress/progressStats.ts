import type { ProgressSession } from '../../types/progress';
import { sessionKind, type SessionKind } from '../session_history/sessionKind';
import type { UnitFormatter } from '../../hooks/useUnits';

/** Which sessions the page shows: every one, or one kind. */
export type ProgressKindFilter = 'all' | SessionKind;

const KIND_ORDER: readonly SessionKind[] = ['race', 'sprint', 'qualifying', 'practice'];

/** The kinds of the sessions, in a fixed order, for the filter's options. */
export const presentKinds = (sessions: ProgressSession[]): SessionKind[] => {
  const kinds = new Set(sessions.map((s) => sessionKind(s.session_type)));
  return KIND_ORDER.filter((kind) => kinds.has(kind));
};

export const filterByKind = (sessions: ProgressSession[], kind: ProgressKindFilter): ProgressSession[] =>
  kind === 'all' ? sessions : sessions.filter((s) => sessionKind(s.session_type) === kind);

export type SectorKey = 'best_sector1_ms' | 'best_sector2_ms' | 'best_sector3_ms';
export const SECTOR_KEYS: readonly SectorKey[] = ['best_sector1_ms', 'best_sector2_ms', 'best_sector3_ms'];

export interface ProgressBests {
  /** The session of your fastest lap. */
  bestLap?: ProgressSession;
  /** Your best time in each sector across the sessions, 0 when none. */
  sectors: Record<SectorKey, number>;
  /** The three best sectors added up: 0 unless all three are set. */
  theoreticalMS: number;
}

const minPositive = (values: number[]): number => {
  const positive = values.filter((v) => v > 0);
  return positive.length > 0 ? Math.min(...positive) : 0;
};

/** Your best lap and sectors across the sessions. */
export function progressBests(sessions: ProgressSession[]): ProgressBests {
  let bestLap: ProgressSession | undefined;
  for (const s of sessions) {
    if (s.best_lap_time_ms > 0 && (!bestLap || s.best_lap_time_ms < bestLap.best_lap_time_ms)) bestLap = s;
  }
  const sectors = Object.fromEntries(
    SECTOR_KEYS.map((key) => [key, minPositive(sessions.map((s) => s[key]))])
  ) as Record<SectorKey, number>;
  const theoreticalMS = SECTOR_KEYS.every((key) => sectors[key] > 0)
    ? SECTOR_KEYS.reduce((sum, key) => sum + sectors[key], 0)
    : 0;
  return { bestLap, sectors, theoreticalMS };
}

/** The latest session with a value, and how much it changed since the first one with a value. */
export function latestAndChange(
  sessions: ProgressSession[],
  value: (s: ProgressSession) => number | null | undefined
): { latest?: ProgressSession; latestValue?: number; change?: number } {
  const withValue = sessions.filter((s) => {
    const v = value(s);
    return v !== null && v !== undefined;
  });
  if (withValue.length === 0) return {};
  const latest = withValue[withValue.length - 1];
  const latestValue = value(latest) as number;
  const change = withValue.length > 1 ? latestValue - (value(withValue[0]) as number) : undefined;
  return { latest, latestValue, change };
}

/** A change in milliseconds with its sign: "-0.412s" (faster) or "+0.200s". */
export const formatChange = (ms: number): string => {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}s`;
};

/** A consistency figure: "σ 0.420s". Zero is a real value (identical lap times), not a missing one. */
export const formatSpread = (ms: number): string => `σ ${(ms / 1000).toFixed(3)}s`;

/** A short date for chart axes and table cells, in the page's language. */
export const shortDate = (iso: string, locale: string): string =>
  new Date(iso).toLocaleDateString(locale === 'es' ? 'es-AR' : 'en-GB', { day: 'numeric', month: 'short' });

/** A short date and time, for the table: a weekend has several sessions on one day. */
export const shortDateTime = (iso: string, units: Pick<UnitFormatter, 'dateTime'>): string =>
  units.dateTime(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
