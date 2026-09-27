import { describe, it, expect } from 'vitest';
import { makeProgressSession } from '../../test/wireFactories';
import {
  filterByKind,
  formatChange,
  formatSpread,
  latestAndChange,
  presentKinds,
  progressBests,
} from './progressStats';

const sessions = [
  makeProgressSession({
    session_id: 1,
    session_type: 'Short Qualifying',
    best_lap_time_ms: 90_500,
    best_sector1_ms: 30_100,
    best_sector2_ms: 30_300,
    best_sector3_ms: 30_100,
    gap_to_fastest_ms: 900,
    consistency_ms: null,
  }),
  makeProgressSession({
    session_id: 2,
    session_type: 'Race',
    best_lap_time_ms: 90_200,
    best_sector1_ms: 30_200,
    best_sector2_ms: 30_000,
    best_sector3_ms: 0,
    gap_to_fastest_ms: 400,
    consistency_ms: 700,
  }),
  makeProgressSession({ session_id: 3, session_type: 'Race', gap_to_fastest_ms: null, consistency_ms: 500 }),
];

describe('progressStats', () => {
  it('finds your best lap and your best sector of each, and adds the sectors up', () => {
    const bests = progressBests(sessions);
    expect(bests.bestLap?.session_id).toBe(2);
    expect(bests.sectors).toEqual({ best_sector1_ms: 30_100, best_sector2_ms: 30_000, best_sector3_ms: 30_100 });
    expect(bests.theoreticalMS).toBe(90_200);
    expect(progressBests([sessions[2]])).toMatchObject({ bestLap: undefined, theoreticalMS: 0 });
  });

  it('gives the latest value and its change since the first session that has one', () => {
    expect(latestAndChange(sessions, (s) => s.gap_to_fastest_ms)).toMatchObject({ latestValue: 400, change: -500 });
    expect(latestAndChange(sessions, (s) => s.consistency_ms)).toMatchObject({ latestValue: 500, change: -200 });
    expect(latestAndChange([sessions[0]], (s) => s.gap_to_fastest_ms)).toMatchObject({
      latestValue: 900,
      change: undefined,
    });
    expect(latestAndChange([sessions[2]], (s) => s.gap_to_fastest_ms)).toEqual({});
  });

  it('filters by the kind of session', () => {
    expect(presentKinds(sessions)).toEqual(['race', 'qualifying']);
    expect(filterByKind(sessions, 'race').map((s) => s.session_id)).toEqual([2, 3]);
    expect(filterByKind(sessions, 'all')).toHaveLength(3);
  });

  it('signs a change', () => {
    expect(formatChange(-412)).toBe('−0.412s');
    expect(formatChange(1_200)).toBe('+1.200s');
    expect(formatChange(0)).toBe('±0.000s');
  });

  it('shows a consistency of zero, since identical laps are a real result', () => {
    expect(formatSpread(0)).toBe('σ 0.000s');
    expect(formatSpread(1_560)).toBe('σ 1.560s');
  });
});
