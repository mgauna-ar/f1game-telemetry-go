import { describe, expect, it } from 'vitest';
import { quickStartComparisons } from './comparatorQuickStart';
import { makePlayerResult, makeSessionListItem } from '../test/wireFactories';

const fastest = (lap_id: number, lap_time_ms: number) => ({
  car_index: 3,
  driver_name: 'Rival',
  team_id: 0,
  race_number: 3,
  lap_id,
  lap_time_ms,
});

const session = (id: number, track: string, day: number, best?: [number, number], fastestLap?: [number, number]) =>
  makeSessionListItem(
    { id, track_name: track, created_at: `2026-09-${String(day).padStart(2, '0')}T18:00:00Z` },
    {
      player: best ? makePlayerResult({ best_lap_id: best[0], best_lap_time_ms: best[1] }) : null,
      fastest_lap: fastestLap ? fastest(...fastestLap) : null,
    }
  );

describe('quickStartComparisons', () => {
  it('offers my best vs the fastest, vs last time at the track, and at another track', () => {
    const cards = quickStartComparisons([
      session(1, 'Monza', 1, [10, 81_000], [11, 80_500]),
      session(2, 'Silverstone', 5, [20, 90_000], [21, 89_000]),
      session(3, 'Silverstone', 2, [30, 91_000], [31, 89_500]),
      session(4, 'Spa', 6),
    ]);
    expect(cards.map((c) => c.kind)).toEqual(['bestVsFastest', 'vsPrevious', 'bestVsFastest']);
    expect(cards[0].params).toEqual({ sessionA: 2, lapA: 20, lapB: 21 });
    expect(cards[1].params).toEqual({ sessionA: 2, lapA: 20, sessionB: 3, lapB: 30 });
    expect(cards[1].previous?.id).toBe(3);
    expect(cards[2].params).toEqual({ sessionA: 1, lapA: 10, lapB: 11 });
  });

  it('lets the comparator pick the next fastest when mine was the fastest', () => {
    const [card] = quickStartComparisons([session(1, 'Monza', 1, [10, 80_000], [10, 80_000])]);
    expect(card.kind).toBe('bestVsNextFastest');
    expect(card.params).toEqual({ sessionA: 1, lapA: 10 });
    expect(card.lapBTimeMs).toBeNull();
  });

  it("falls back to the latest session's fastest lap when I'm not known anywhere", () => {
    const cards = quickStartComparisons([session(1, 'Monza', 1, undefined, [11, 80_500]), session(2, 'Spa', 3)]);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('fastestLap');
    expect(cards[0].params).toEqual({ sessionA: 1, lapA: 11 });
    expect(quickStartComparisons([])).toEqual([]);
  });
});
