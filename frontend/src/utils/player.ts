import type { DriverStanding, Participant, PlayerSource } from '../types/session';

/**
 * How many cars the session charts pick by default: the player and the cars either side of them
 * when the player is known, otherwise the top of the classification.
 */
export const DEFAULT_CHART_DRIVERS = 5;

export interface PlayerMatch {
  participant: Participant;
  source: PlayerSource;
}

/** The first participant whose name contains the query or whose race number is it ("7" or "#7"). */
export function findParticipantByPartialName(participants: Participant[], query: string): Participant | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  return participants.find((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.race_number.toString() === q || `#${p.race_number}` === q) return true;
    return false;
  });
}

/**
 * The player's participant: the session's stored car (`player_car_index`) when it has one,
 * otherwise, for sessions recorded before the car was stored, the saved driver name matched as the
 * comparator matches it. The server's summaries use the same rule (`FindPlayerStanding`).
 */
export function findPlayer(
  participants: Participant[],
  playerCarIndex: number | null | undefined,
  driverName: string
): PlayerMatch | undefined {
  if (playerCarIndex !== null && playerCarIndex !== undefined) {
    const participant = participants.find((p) => p.car_index === playerCarIndex);
    return participant ? { participant, source: 'recorded' } : undefined;
  }
  const participant = findParticipantByPartialName(participants, driverName);
  return participant ? { participant, source: 'driver_name' } : undefined;
}

/**
 * The cars a chart picks by default, as car indexes: the player and the cars around them in
 * classification order (two ahead and two behind, shifted at either end), or the top
 * `count` when there is no player.
 */
export function defaultChartCars(
  orderedCarIndexes: number[],
  playerCarIndex: number | null,
  count = DEFAULT_CHART_DRIVERS
): number[] {
  const at = playerCarIndex === null ? -1 : orderedCarIndexes.indexOf(playerCarIndex);
  if (at < 0) return orderedCarIndexes.slice(0, count);
  const start = Math.max(0, Math.min(at - Math.floor(count / 2), orderedCarIndexes.length - count));
  return orderedCarIndexes.slice(start, start + count);
}

/** The drivers a session chart shows at first, keyed by car index (see defaultChartCars). */
export function defaultChartSelection(
  standings: DriverStanding[],
  playerCarIndex: number | null
): Record<number, boolean> {
  const selected: Record<number, boolean> = {};
  for (const car of defaultChartCars(
    standings.map((d) => d.participant.car_index),
    playerCarIndex
  )) {
    selected[car] = true;
  }
  return selected;
}

/** The locale key for places gained or lost from the grid (`gained` < 0 is places lost). */
export const placesKey = (gained: number): string =>
  `history.player.place${Math.abs(gained) === 1 ? '' : 's'}${gained > 0 ? 'Gained' : 'Lost'}`;

/**
 * A three-letter label for a driver on a chart line: the first letters of their surname
 * ("Max Verstappen" → VER), or the car number when the game sent no name.
 */
export function driverCode(name: string | undefined, raceNumber?: number): string {
  const last = (name ?? '').trim().split(/\s+/).pop() ?? '';
  const letters = last.replace(/[^\p{L}\p{N}]/gu, '');
  if (letters) return letters.slice(0, 3).toUpperCase();
  return raceNumber ? `#${raceNumber}` : '—';
}
