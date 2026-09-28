import type { Lap, Participant } from '../../../types/session';
import { filterActiveHistoricalParticipants } from '../../../utils/driverFilter';
import { sessionKind } from '../sessionKind';

/**
 * The session's cars in classification order, each with its `position` as the classification
 * reads it: the stored finishing position, else the car's position on its last lap (sessions the
 * game didn't classify). Cars with neither come after, by best lap, then by car index. Empty grid
 * slots are left out.
 */
export function pickerParticipants(participants: Participant[], laps: Lap[], sessionType: string): Participant[] {
  const kind = sessionKind(sessionType);
  const active = filterActiveHistoricalParticipants(participants, laps, kind === 'race' || kind === 'sprint');
  const best = new Map<number, number>();
  const lastPosition = new Map<number, { lap: number; position: number }>();
  for (const lap of laps) {
    const car = lap.car_index ?? -1;
    if (lap.lap_time_ms > 0) best.set(car, Math.min(best.get(car) ?? Infinity, lap.lap_time_ms));
    const last = lastPosition.get(car);
    if (lap.car_position > 0 && (!last || lap.lap_number >= last.lap)) {
      lastPosition.set(car, { lap: lap.lap_number, position: lap.car_position });
    }
  }
  const ranked = active.map((p) => ({
    ...p,
    position: p.position > 0 ? p.position : (lastPosition.get(p.car_index)?.position ?? 0),
  }));
  const rank = (p: Participant) => (p.position > 0 ? p.position : Infinity);
  return ranked.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (best.get(a.car_index) ?? Infinity) - (best.get(b.car_index) ?? Infinity) ||
      a.car_index - b.car_index
  );
}
