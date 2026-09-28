import type { CompareParams } from '../router/routes';
import type { SessionListItem } from '../types/session';

/** How many quick-start comparisons the empty comparator offers at most. */
export const QUICK_START_LIMIT = 3;

export type QuickStartKind = 'bestVsFastest' | 'bestVsNextFastest' | 'vsPrevious' | 'fastestLap';

/** A comparison the empty comparator offers to open in one click. */
export interface QuickStartComparison {
  kind: QuickStartKind;
  session: SessionListItem;
  /** The older session of a `vsPrevious` comparison. */
  previous?: SessionListItem;
  /** Lap times shown on the card (ms); B is unknown when the comparator picks it. */
  lapATimeMs: number;
  lapBTimeMs: number | null;
  params: CompareParams;
}

const newestFirst = (sessions: SessionListItem[]) =>
  [...sessions].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

const sameTrack = (a: SessionListItem, b: SessionListItem) => a.track_name.toLowerCase() === b.track_name.toLowerCase();

/** The player's best lap in a session, from the list summary (stored car or `?driver=` name). */
const playerBest = (s: SessionListItem) => {
  const player = s.summary.player;
  return player && player.best_lap_id > 0 && player.best_lap_time_ms > 0 ? player : null;
};

/** Your best lap against the session's fastest, or the next fastest when yours was the fastest. */
function bestVsFastest(session: SessionListItem): QuickStartComparison | null {
  const mine = playerBest(session);
  const fastest = session.summary.fastest_lap;
  if (!mine || !fastest) return null;
  if (fastest.lap_id === mine.best_lap_id) {
    // Slot B picks the next fastest lap by itself
    return {
      kind: 'bestVsNextFastest',
      session,
      lapATimeMs: mine.best_lap_time_ms,
      lapBTimeMs: null,
      params: { sessionA: session.id, lapA: mine.best_lap_id },
    };
  }
  return {
    kind: 'bestVsFastest',
    session,
    lapATimeMs: mine.best_lap_time_ms,
    lapBTimeMs: fastest.lap_time_ms,
    params: { sessionA: session.id, lapA: mine.best_lap_id, lapB: fastest.lap_id },
  };
}

/**
 * The comparisons the empty comparator offers, newest first: your best lap against the fastest in
 * your latest session, against your best the previous time at that track, and against the fastest
 * in your latest session at another track. With no session where you are known (no stored car and
 * no saved name), the latest session's fastest lap.
 */
export function quickStartComparisons(sessions: SessionListItem[]): QuickStartComparison[] {
  const ordered = newestFirst(sessions);
  const mine = ordered.filter((s) => playerBest(s));
  const cards: QuickStartComparison[] = [];

  const latest = mine[0];
  if (latest) {
    const vsFastest = bestVsFastest(latest);
    if (vsFastest) cards.push(vsFastest);

    const previous = mine.find((s) => s !== latest && sameTrack(s, latest));
    if (previous) {
      const a = playerBest(latest)!;
      const b = playerBest(previous)!;
      cards.push({
        kind: 'vsPrevious',
        session: latest,
        previous,
        lapATimeMs: a.best_lap_time_ms,
        lapBTimeMs: b.best_lap_time_ms,
        params: { sessionA: latest.id, lapA: a.best_lap_id, sessionB: previous.id, lapB: b.best_lap_id },
      });
    }

    const otherTrack = mine.find((s) => !sameTrack(s, latest));
    const vsOther = otherTrack ? bestVsFastest(otherTrack) : null;
    if (vsOther) cards.push(vsOther);
    return cards.slice(0, QUICK_START_LIMIT);
  }

  const withFastest = ordered.find((s) => s.summary.fastest_lap);
  if (withFastest?.summary.fastest_lap) {
    cards.push({
      kind: 'fastestLap',
      session: withFastest,
      lapATimeMs: withFastest.summary.fastest_lap.lap_time_ms,
      lapBTimeMs: null,
      params: { sessionA: withFastest.id, lapA: withFastest.summary.fastest_lap.lap_id },
    });
  }
  return cards;
}
