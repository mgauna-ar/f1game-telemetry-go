import type { TrackTurn, TurnContextInfo } from '../types/comparator';

export type { TrackTurn, TurnContextInfo };

/**
 * Returns contextual description of where the car / cursor is relative to turns
 */
export function getTurnContextAtDistance(turns: TrackTurn[], distance: number | null | undefined): TurnContextInfo {
  if (distance === null || distance === undefined || turns.length === 0) {
    return { turn: null, phase: 'straight', label: '' };
  }

  // 1. Check if inside turn apex/entry/exit zone
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const diff = distance - t.distance;

    // Apex zone: ±15 meters
    if (Math.abs(diff) <= 15) {
      return { turn: t, phase: 'apex', label: `${t.name} (Apex)` };
    }
    // Entry zone: -45m to -15m
    if (diff > -45 && diff < -15) {
      return { turn: t, phase: 'entry', label: `${t.name} (Entry)` };
    }
    // Exit zone: +15m to +45m
    if (diff > 15 && diff < 45) {
      return { turn: t, phase: 'exit', label: `${t.name} (Exit)` };
    }
  }

  // 2. If between turns, find which ones
  for (let i = 0; i < turns.length - 1; i++) {
    const t1 = turns[i];
    const t2 = turns[i + 1];
    if (distance >= t1.distance && distance <= t2.distance) {
      return { turn: null, phase: 'straight', label: `Straight (${t1.name} → ${t2.name})` };
    }
  }

  if (distance < turns[0].distance) {
    return { turn: null, phase: 'straight', label: `Main Straight (Start → ${turns[0].name})` };
  }

  const lastTurn = turns[turns.length - 1];
  return { turn: null, phase: 'straight', label: `Final Straight (${lastTurn.name} → Finish)` };
}
