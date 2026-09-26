import type { Lap, Participant } from '../types/session';
import { SESSION_DATA_CACHE_LIMIT } from '../constants/f1';
import { api } from './apiClient';

/** The participants and laps of one recorded session, as the server sends them. */
export interface SessionLapData {
  participants: Participant[];
  laps: Lap[];
}

// Session ID → loaded or loading data. A Map keeps insertion order, so the first key is the least
// recently used one.
const cache = new Map<number, Promise<SessionLapData>>();

function remember(sessionId: number, entry: Promise<SessionLapData>): void {
  cache.delete(sessionId);
  cache.set(sessionId, entry);
  while (cache.size > SESSION_DATA_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Returns a session's participants and laps, loading them only when they aren't cached yet. Callers
 * asking for the same session share one request, so the promise can't be aborted by one of them:
 * ignore the result instead once it's no longer needed.
 */
export function getSessionLapData(sessionId: number): Promise<SessionLapData> {
  const cached = cache.get(sessionId);
  if (cached) {
    remember(sessionId, cached);
    return cached;
  }
  const entry = Promise.all([
    api.get<Participant[]>(`/api/sessions/${sessionId}/participants`),
    api.get<Lap[]>(`/api/sessions/${sessionId}/laps`),
  ]).then(([participants, laps]) => ({ participants: participants ?? [], laps: laps ?? [] }));
  remember(sessionId, entry);
  // A failed load is not kept, so the next caller retries.
  entry.catch(() => {
    if (cache.get(sessionId) === entry) cache.delete(sessionId);
  });
  return entry;
}

/** Stores data that was already loaded, such as the participants and laps of GET /api/sessions/{id}/detail. */
export function primeSessionLapData(sessionId: number, data: SessionLapData): void {
  remember(sessionId, Promise.resolve(data));
}

/** Drops the given sessions (deleted ones), or every session when called without IDs. */
export function invalidateSessionLapData(sessionIds?: Iterable<number>): void {
  if (sessionIds === undefined) {
    cache.clear();
    return;
  }
  for (const id of sessionIds) cache.delete(id);
}
