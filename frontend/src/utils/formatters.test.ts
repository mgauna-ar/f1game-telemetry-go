import { describe, it, expect } from 'vitest';
import {
  formatLapTime,
  formatSectorTime,
  formatGapTime,
  formatDuration,
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
    it('formats ms to seconds', () => {
      expect(formatSectorTime(28724)).toBe('28.724s');
    });

    it('returns dash for zero ms', () => {
      expect(formatSectorTime(0)).toBe('-');
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

  describe('getSessionBadgeClass', () => {
    it('returns badge class according to type', () => {
      expect(getSessionBadgeClass('Race')).toBe('badge-red');
      expect(getSessionBadgeClass('Sprint Shootout 1')).toBe('badge-orange');
      expect(getSessionBadgeClass('Qualifying 1')).toBe('badge-purple');
      expect(getSessionBadgeClass('Practice 1')).toBe('badge-green');
    });
  });
});
