import { describe, it, expect } from 'vitest';
import { sortLapsByQuality, groupLapsIntoStints, formatStintsText } from './lapUtils';
import type { Lap } from '../types/session';

describe('lapUtils', () => {
  describe('sortLapsByQuality', () => {
    it('returns empty array when given empty laps', () => {
      expect(sortLapsByQuality([])).toEqual([]);
    });

    it('filters out laps with zero lap_time_ms or invalid without sector1', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 0, is_valid: false },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 80000, is_valid: false, sector1_ms: 0 },
        { id: 3, session_id: 1, lap_number: 3, lap_time_ms: 85000, is_valid: true },
      ];

      const sorted = sortLapsByQuality(laps);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe(3);
    });

    it('prioritizes valid laps over invalid laps even if invalid is faster', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 70000, is_valid: false, sector1_ms: 22000 },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 75000, is_valid: true, sector1_ms: 24000 },
      ];

      const sorted = sortLapsByQuality(laps);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });

    it('orders by fastest lap time among valid laps', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 76000, is_valid: true },
        { id: 3, session_id: 1, lap_number: 3, lap_time_ms: 78000, is_valid: true },
      ];

      const sorted = sortLapsByQuality(laps);
      expect(sorted.map((l) => l.id)).toEqual([2, 3, 1]);
    });

    it('breaks ties using telemetry and sector1 score', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true, has_telemetry: false, sector1_ms: 0 },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 80000, is_valid: true, has_telemetry: true, sector1_ms: 25000 },
        { id: 3, session_id: 1, lap_number: 3, lap_time_ms: 80000, is_valid: true, has_telemetry: false, sector1_ms: 25000 },
      ];

      const sorted = sortLapsByQuality(laps);
      expect(sorted.map((l) => l.id)).toEqual([2, 3, 1]);
    });
  });

  describe('groupLapsIntoStints', () => {
    it('returns empty array when given empty laps', () => {
      expect(groupLapsIntoStints([])).toEqual([]);
    });

    it('groups consecutive laps with the same compound', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true, tyre_compound: 'SOFT' },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 81000, is_valid: true, tyre_compound: 'SOFT' },
        { id: 3, session_id: 1, lap_number: 3, lap_time_ms: 82000, is_valid: true, tyre_compound: 'SOFT' },
      ];

      const stints = groupLapsIntoStints(laps);
      expect(stints).toHaveLength(1);
      expect(stints[0].compound).toBe('SOFT');
      expect(stints[0].count).toBe(3);
    });

    it('splits into new stint when compound changes', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true, tyre_compound: 'SOFT' },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 81000, is_valid: true, tyre_compound: 'SOFT' },
        { id: 3, session_id: 1, lap_number: 3, lap_time_ms: 82000, is_valid: true, tyre_compound: 'MEDIUM' },
      ];

      const stints = groupLapsIntoStints(laps);
      expect(stints).toHaveLength(2);
      expect(stints[0]).toEqual({ compound: 'SOFT', actualCompound: undefined, count: 2, stintId: 0 });
      expect(stints[1]).toEqual({ compound: 'MEDIUM', actualCompound: undefined, count: 1, stintId: 0 });
    });

    it('splits into new stint when stint ID changes even if compound is same', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true, tyre_compound: 'SOFT', stint: 1 },
        { id: 2, session_id: 1, lap_number: 2, lap_time_ms: 81000, is_valid: true, tyre_compound: 'SOFT', stint: 2 },
      ];

      const stints = groupLapsIntoStints(laps);
      expect(stints).toHaveLength(2);
      expect(stints[0].stintId).toBe(1);
      expect(stints[1].stintId).toBe(2);
    });

    it('retains actualCompound when available', () => {
      const laps: Lap[] = [
        { id: 1, session_id: 1, lap_number: 1, lap_time_ms: 80000, is_valid: true, tyre_compound: 'C3', actual_compound: 'C3' },
      ];

      const stints = groupLapsIntoStints(laps);
      expect(stints[0].actualCompound).toBe('C3');
    });
  });

  describe('formatStintsText', () => {
    it('returns "No stint data" for empty stints', () => {
      expect(formatStintsText([])).toBe('No stint data');
    });

    it('formats multiple stints with arrow separator', () => {
      const stints = [
        { compound: 'SOFT', count: 15, stintId: 1 },
        { compound: 'HARD', count: 35, stintId: 2 },
      ];
      expect(formatStintsText(stints)).toBe('SOFT (15L) ➔ HARD (35L)');
    });
  });
});
