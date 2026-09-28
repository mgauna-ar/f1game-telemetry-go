import type { SessionLapData } from '../../../utils/sessionDataCache';
import { participantDisplayName } from '../../../utils/player';
import { pickerParticipants } from './pickerParticipants';

export interface DriverNameSuggestion {
  /** The name as the classification shows it, which is what the batch pick matches. */
  name: string;
  /** How many of the loaded sessions have a driver with this name. */
  sessions: number;
}

/**
 * The driver names in a set of sessions, the ones found in the most sessions first (your name is
 * usually in all of them), then by name. Names differing only in case count as one, as the server
 * matches them.
 */
export function driverNameSuggestions(
  sessions: { sessionType: string; data: SessionLapData }[]
): DriverNameSuggestion[] {
  const byKey = new Map<string, DriverNameSuggestion>();
  for (const { sessionType, data } of sessions) {
    const seen = new Set<string>();
    for (const participant of pickerParticipants(data.participants, data.laps, sessionType)) {
      const name = participantDisplayName(participant);
      const key = name.toLowerCase();
      if (name.startsWith('#') || seen.has(key)) continue;
      seen.add(key);
      const entry = byKey.get(key);
      if (entry) entry.sessions += 1;
      else byKey.set(key, { name, sessions: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}
