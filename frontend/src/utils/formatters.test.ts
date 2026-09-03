import { describe, it, expect } from 'vitest';
import {
  formatLapTime,
  formatSectorTime,
  formatGapTime,
  formatDuration,
  formatTotalDuration,
  formatDate,
  formatSessionUID,
  getSessionBadgeClass,
} from './formatters';

describe('formatters', () => {
  describe('formatSessionUID', () => {
    it('formats normal decimal strings to hex', () => {
      expect(formatSessionUID('123456789')).toBe('0x00000000075BCD15');
    });

    it('formats numbers to hex', () => {
      expect(formatSessionUID(123456789)).toBe('0x00000000075BCD15');
    });

    it('handles negative 64-bit signed numbers by converting to uint64 hex', () => {
      // -5240916583427224000 in two's complement 64-bit is 0xB749A39284F14640 (or 13205827490282327616)
      const res = formatSessionUID('-5240916583427224000');
      expect(res.startsWith('0x')).toBe(true);
      expect(res.includes('-')).toBe(false);
    });

    it('preserves existing hex strings in uppercase', () => {
      expect(formatSessionUID('0x48d7f9b1e038c41a')).toBe('0x48D7F9B1E038C41A');
    });

    it('handles undefined or 0 gracefully', () => {
      expect(formatSessionUID(undefined)).toBe('0x0000000000000000');
      expect(formatSessionUID(0)).toBe('0x0000000000000000');
    });
  });

  describe('formatLapTime', () => {
    it('formats milliseconds to M:SS.mmm', () => {
      expect(formatLapTime(85913)).toBe('1:25.913');
    });

    it('returns dashes for invalid or zero ms', () => {
      expect(formatLapTime(0)).toBe('--:--.---');
      expect(formatLapTime(undefined)).toBe('--:--.---');
    });
  });

  describe('formatSectorTime', () => {
    it('formats ms to seconds with unit by default', () => {
      expect(formatSectorTime(28724)).toBe('28.724s');
    });

    it('returns dash for zero ms with unit', () => {
      expect(formatSectorTime(0)).toBe('-');
    });

    it('formats ms without unit when requested', () => {
      expect(formatSectorTime(28724, false)).toBe('28.724');
      expect(formatSectorTime(0, false)).toBe('--.---');
    });
  });

  describe('formatGapTime', () => {
    it('returns LEADER for 0 or negative', () => {
      expect(formatGapTime(0)).toBe('LEADER');
      expect(formatGapTime(undefined)).toBe('LEADER');
    });

    it('formats seconds gap', () => {
      expect(formatGapTime(1250)).toBe('+1.250s');
    });

    it('formats minute gap', () => {
      expect(formatGapTime(65430)).toBe('+1:05.430');
    });
  });

  describe('formatDuration', () => {
    it('formats hours:minutes:seconds', () => {
      expect(formatDuration(3661000)).toBe('1:01:01');
    });

    it('formats minutes:seconds', () => {
      expect(formatDuration(125000)).toBe('2:05');
    });
  });

  describe('formatTotalDuration', () => {
    it('formats hours:minutes:seconds.millis', () => {
      expect(formatTotalDuration(3661234)).toBe('1:01:01.234');
    });

    it('formats minutes:seconds.millis', () => {
      expect(formatTotalDuration(125456)).toBe('2:05.456');
    });

    it('returns dashes for invalid or zero ms', () => {
      expect(formatTotalDuration(0)).toBe('--:--.---');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date string without errors', () => {
      const res = formatDate('2026-06-01T14:30:00Z');
      expect(res).toBeTruthy();
      expect(res).not.toBe('Unknown Date');
    });

    it('returns Unknown Date for empty date', () => {
      expect(formatDate(undefined)).toBe('Unknown Date');
    });
  });

  describe('getSessionBadgeClass', () => {
    it('returns badge class according to type', () => {
      expect(getSessionBadgeClass('Race')).toBe('badge-red');
      expect(getSessionBadgeClass('Sprint Shootout 1')).toBe('badge-orange');
      expect(getSessionBadgeClass('Qualifying 1')).toBe('badge-purple');
      expect(getSessionBadgeClass('Practice 1')).toBe('badge-green');
    });
  });

  describe('getTyreThermalWindow & calculateEnginePowerPct', () => {
    it('resolves actual and visual compound windows accurately', async () => {
      const { getTyreThermalWindow, TYRE_COMPOUND_IDS } = await import('../constants/f1');

      // Actual C1
      const wC1 = getTyreThermalWindow(20);
      expect(wC1.compound).toBe('C1');
      expect(wC1.minTemp).toBe(95);
      expect(wC1.maxTemp).toBe(115);

      // Actual C5
      const wC5 = getTyreThermalWindow(16);
      expect(wC5.compound).toBe('C5');
      expect(wC5.minTemp).toBe(75);
      expect(wC5.maxTemp).toBe(85);

      // Visual fallbacks (Soft -> C4, Medium -> C3, Hard -> C2)
      const wSoft = getTyreThermalWindow(undefined, TYRE_COMPOUND_IDS.SOFT);
      expect(wSoft.compound).toBe('C4');
      expect(wSoft.minTemp).toBe(75);
      expect(wSoft.maxTemp).toBe(95);

      const wMed = getTyreThermalWindow(undefined, TYRE_COMPOUND_IDS.MEDIUM);
      expect(wMed.compound).toBe('C3');
      expect(wMed.minTemp).toBe(85);
      expect(wMed.maxTemp).toBe(95);
    });

    it('calculates engine power percentage and thermal derate losses correctly', async () => {
      const { calculateEnginePowerPct } = await import('../constants/f1');

      // Cold
      expect(calculateEnginePowerPct(65)).toEqual({ powerPct: 96, powerLossPct: 4 });

      // Peak
      expect(calculateEnginePowerPct(115)).toEqual({ powerPct: 100, powerLossPct: 0 });
      expect(calculateEnginePowerPct(125)).toEqual({ powerPct: 100, powerLossPct: 0 });

      // Warning derate
      expect(calculateEnginePowerPct(135)).toEqual({ powerPct: 98.5, powerLossPct: 1.5 });

      // Midpoint linear interpolation
      const mid = calculateEnginePowerPct(140);
      expect(mid.powerPct).toBeCloseTo(96.25, 2);
      expect(mid.powerLossPct).toBeCloseTo(3.75, 2);

      // Critical derate
      expect(calculateEnginePowerPct(145)).toEqual({ powerPct: 94, powerLossPct: 6 });
      expect(calculateEnginePowerPct(175)).toEqual({ powerPct: 85, powerLossPct: 15 });
    });
  });
});
