import { describe, it, expect } from 'vitest';
import {
  matchSessionSearch,
  matchSessionTypeTab,
  filterSessionsBySearch,
} from './sessionFilterUtils';
import type { Session } from '../types/session';

describe('sessionFilterUtils', () => {
  const mockSessions: Session[] = [
    {
      id: 101,
      session_uid: '0x101',
      track_name: 'Monza',
      session_type: 'Race',
      created_at: '2026-05-01T10:00:00Z',
      tags: [{ id: 1, name: 'Championship', color: '#ff0000' }],
    },
    {
      id: 102,
      session_uid: '0x102',
      track_name: 'Spa-Francorchamps',
      session_type: 'Qualifying',
      created_at: '2026-05-02T10:00:00Z',
      tags: [{ id: 2, name: 'Practice Tag', color: '#00ff00' }],
    },
    {
      id: 103,
      session_uid: '0x103',
      track_name: 'Silverstone Circuit',
      session_type: 'Sprint Shootout',
      created_at: '2026-05-03T10:00:00Z',
      tags: [],
    },
    {
      id: 104,
      session_uid: '0x104',
      track_name: 'Albert Park',
      session_type: 'Practice 2',
      created_at: '2026-05-04T10:00:00Z',
      tags: [],
    },
  ];

  describe('matchSessionSearch', () => {
    it('returns true if query is empty', () => {
      expect(matchSessionSearch(mockSessions[0], '')).toBe(true);
      expect(matchSessionSearch(mockSessions[0], '   ')).toBe(true);
    });

    it('matches by track name', () => {
      expect(matchSessionSearch(mockSessions[0], 'monza')).toBe(true);
      expect(matchSessionSearch(mockSessions[0], 'Spa')).toBe(false);
    });

    it('matches by track info (ISO3, country code, aliases)', () => {
      // Monza is in Italy (ITA, IT)
      expect(matchSessionSearch(mockSessions[0], 'ita')).toBe(true);
      expect(matchSessionSearch(mockSessions[0], 'it')).toBe(true);

      // Spa is in Belgium (BEL, BE)
      expect(matchSessionSearch(mockSessions[1], 'bel')).toBe(true);
    });

    it('matches by localized country with t function', () => {
      const mockT = (key: string) => {
        if (key.toLowerCase() === 'common.countries.it') return 'Italia';
        return '';
      };
      expect(matchSessionSearch(mockSessions[0], 'italia', mockT)).toBe(true);
    });

    it('matches by session type', () => {
      expect(matchSessionSearch(mockSessions[0], 'race')).toBe(true);
      expect(matchSessionSearch(mockSessions[1], 'qualifying')).toBe(true);
    });

    it('matches by session ID', () => {
      expect(matchSessionSearch(mockSessions[0], '101')).toBe(true);
      expect(matchSessionSearch(mockSessions[1], '101')).toBe(false);
    });

    it('matches by tag name', () => {
      expect(matchSessionSearch(mockSessions[0], 'championship')).toBe(true);
      expect(matchSessionSearch(mockSessions[1], 'championship')).toBe(false);
    });
  });

  describe('matchSessionTypeTab', () => {
    it('matches ALL tab for any session type', () => {
      expect(matchSessionTypeTab('Race', 'ALL')).toBe(true);
      expect(matchSessionTypeTab('Qualifying', 'ALL')).toBe(true);
    });

    it('correctly filters RACE tab excluding Sprints', () => {
      expect(matchSessionTypeTab('Race', 'RACE')).toBe(true);
      expect(matchSessionTypeTab('Sprint Race', 'RACE')).toBe(false);
    });

    it('correctly filters QUALI tab excluding Sprints', () => {
      expect(matchSessionTypeTab('Qualifying', 'QUALI')).toBe(true);
      expect(matchSessionTypeTab('Q3', 'QUALI')).toBe(true);
      expect(matchSessionTypeTab('Sprint Shootout', 'QUALI')).toBe(false);
    });

    it('correctly filters SPRINT tab', () => {
      expect(matchSessionTypeTab('Sprint Race', 'SPRINT')).toBe(true);
      expect(matchSessionTypeTab('Sprint Shootout', 'SPRINT')).toBe(true);
      expect(matchSessionTypeTab('Race', 'SPRINT')).toBe(false);
    });

    it('correctly filters PRACTICE tab', () => {
      expect(matchSessionTypeTab('Practice 1', 'PRACTICE')).toBe(true);
      expect(matchSessionTypeTab('FP2', 'PRACTICE')).toBe(true);
      expect(matchSessionTypeTab('Race', 'PRACTICE')).toBe(false);
    });
  });

  describe('filterSessionsBySearch', () => {
    it('combines search and tab filtering', () => {
      const results = filterSessionsBySearch(mockSessions, 'Spa', 'QUALI');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(102);

      const emptyResults = filterSessionsBySearch(mockSessions, 'Spa', 'RACE');
      expect(emptyResults).toHaveLength(0);
    });
  });
});
