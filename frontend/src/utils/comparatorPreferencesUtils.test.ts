import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadComparatorPreferences,
  saveComparatorPreferences,
  findParticipantByPartialName,
  resolveReferenceLap,
  resolveComparisonLap,
  DEFAULT_COMPARATOR_PREFERENCES,
} from './comparatorPreferencesUtils';
import type { Participant, Lap } from '../types/session';

describe('comparatorPreferencesUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadComparatorPreferences & saveComparatorPreferences', () => {
    it('returns default preferences when nothing stored', () => {
      const prefs = loadComparatorPreferences();
      expect(prefs).toEqual(DEFAULT_COMPARATOR_PREFERENCES);
    });

    it('persists and retrieves valid preferences', () => {
      saveComparatorPreferences({
        defaultDriverName: 'Verstappen',
        rivalMode: 'teammate',
        rivalDriverName: '',
      });

      const loaded = loadComparatorPreferences();
      expect(loaded.defaultDriverName).toBe('Verstappen');
      expect(loaded.rivalMode).toBe('teammate');
      expect(loaded.rivalDriverName).toBe('');
    });

    it('sanitizes and trims inputs', () => {
      saveComparatorPreferences({
        defaultDriverName: '  Norris  ',
        rivalMode: 'driver',
        rivalDriverName: '  Piastri  ',
      });

      const loaded = loadComparatorPreferences();
      expect(loaded.defaultDriverName).toBe('Norris');
      expect(loaded.rivalMode).toBe('driver');
      expect(loaded.rivalDriverName).toBe('Piastri');
    });
  });

  describe('findParticipantByPartialName', () => {
    const participants: Participant[] = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Max Verstappen',
        race_number: 1,
        team_id: 2,
        driver_id: 1,
        ai_controlled: false,
        nationality: 1,
      },
      {
        id: 2,
        session_id: 1,
        car_index: 1,
        name: 'Liam Lawson',
        race_number: 30,
        team_id: 2,
        driver_id: 2,
        ai_controlled: false,
        nationality: 2,
      },
      {
        id: 3,
        session_id: 1,
        car_index: 2,
        name: 'RLS BRYANDRK',
        race_number: 76,
        team_id: 8,
        driver_id: 3,
        ai_controlled: false,
        nationality: 3,
      },
    ];

    it('returns undefined for empty queries', () => {
      expect(findParticipantByPartialName(participants, '')).toBeUndefined();
      expect(findParticipantByPartialName(participants, '   ')).toBeUndefined();
    });

    it('finds participant by case-insensitive partial substring', () => {
      expect(findParticipantByPartialName(participants, 'verstappen')?.name).toBe('Max Verstappen');
      expect(findParticipantByPartialName(participants, 'MAX')?.name).toBe('Max Verstappen');
      expect(findParticipantByPartialName(participants, 'bryan')?.name).toBe('RLS BRYANDRK');
      expect(findParticipantByPartialName(participants, 'law')?.name).toBe('Liam Lawson');
    });

    it('finds participant by race number', () => {
      expect(findParticipantByPartialName(participants, '1')?.name).toBe('Max Verstappen');
      expect(findParticipantByPartialName(participants, '#76')?.name).toBe('RLS BRYANDRK');
    });

    it('returns undefined when no driver matches', () => {
      expect(findParticipantByPartialName(participants, 'Alonso')).toBeUndefined();
    });
  });

  describe('resolveReferenceLap', () => {
    const mockParticipants: Participant[] = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Max Verstappen',
        race_number: 1,
        team_id: 2,
        driver_id: 1,
        ai_controlled: false,
        nationality: 1,
      },
      {
        id: 2,
        session_id: 1,
        car_index: 1,
        name: 'Liam Lawson',
        race_number: 30,
        team_id: 2,
        driver_id: 2,
        ai_controlled: false,
        nationality: 2,
      },
    ];

    const mockLaps: Lap[] = [
      {
        id: 101,
        session_id: 1,
        car_index: 0,
        lap_number: 5,
        lap_time_ms: 80000,
        sector1_ms: 25000,
        sector2_ms: 30000,
        sector3_ms: 25000,
        is_valid: true,
      },
      {
        id: 102,
        session_id: 1,
        car_index: 1,
        lap_number: 6,
        lap_time_ms: 80500,
        sector1_ms: 25200,
        sector2_ms: 30100,
        sector3_ms: 25200,
        is_valid: true,
      },
    ];

    it('returns empty when no laps available', () => {
      expect(resolveReferenceLap(mockParticipants, [], 'Max')).toEqual({ lapId: '' });
    });

    it('resolves configured driver best lap if found', () => {
      const result = resolveReferenceLap(mockParticipants, mockLaps, 'Lawson');
      expect(result.lapId).toBe(102);
      expect(result.driver?.name).toBe('Liam Lawson');
    });

    it('falls back to fastest lap if configured driver not found in session', () => {
      const result = resolveReferenceLap(mockParticipants, mockLaps, 'Hamilton');
      expect(result.lapId).toBe(101); // Verstappen's lap 80000ms is fastest
      expect(result.driver?.name).toBe('Max Verstappen');
    });

    it('defaults to fastest lap when defaultDriverName is empty', () => {
      const result = resolveReferenceLap(mockParticipants, mockLaps, '');
      expect(result.lapId).toBe(101);
      expect(result.driver?.name).toBe('Max Verstappen');
    });
  });

  describe('resolveComparisonLap', () => {
    const pVerstappen: Participant = {
      id: 1,
      session_id: 1,
      car_index: 0,
      name: 'Max Verstappen',
      race_number: 1,
      team_id: 2,
      driver_id: 1,
      ai_controlled: false,
      nationality: 1,
    };

    const pLawson: Participant = {
      id: 2,
      session_id: 1,
      car_index: 1,
      name: 'Liam Lawson',
      race_number: 30,
      team_id: 2,
      driver_id: 2,
      ai_controlled: false,
      nationality: 2,
    };

    const pNorris: Participant = {
      id: 3,
      session_id: 1,
      car_index: 2,
      name: 'Lando Norris',
      race_number: 4,
      team_id: 8,
      driver_id: 3,
      ai_controlled: false,
      nationality: 3,
    };

    const mockParticipants = [pVerstappen, pLawson, pNorris];

    const lapVerstappen: Lap = {
      id: 101,
      session_id: 1,
      car_index: 0,
      lap_number: 5,
      lap_time_ms: 80000,
      sector1_ms: 25000,
      sector2_ms: 30000,
      sector3_ms: 25000,
      is_valid: true,
    };

    const lapLawson: Lap = {
      id: 102,
      session_id: 1,
      car_index: 1,
      lap_number: 6,
      lap_time_ms: 80500,
      sector1_ms: 25200,
      sector2_ms: 30100,
      sector3_ms: 25200,
      is_valid: true,
    };

    const lapNorris: Lap = {
      id: 103,
      session_id: 1,
      car_index: 2,
      lap_number: 7,
      lap_time_ms: 80300,
      sector1_ms: 25100,
      sector2_ms: 30100,
      sector3_ms: 25100,
      is_valid: true,
    };

    // Sorted order by time:
    // 1. Verstappen (80.000s) id: 101
    // 2. Norris (80.300s) id: 103
    // 3. Lawson (80.500s) id: 102
    const mockLaps = [lapVerstappen, lapLawson, lapNorris];

    it('selects fastest lap when Reference is not P1', () => {
      // If Reference is Norris (P2, lap 103), Comparison should be P1 Verstappen (lap 101)
      const res = resolveComparisonLap(mockParticipants, mockLaps, pNorris, 'fastest', '', 103);
      expect(res.lapId).toBe(101);
      expect(res.driver?.name).toBe('Max Verstappen');
    });

    it('selects P2 when Reference is already P1 in fastest mode', () => {
      // If Reference is Verstappen (P1, lap 101), Comparison should pick P2 Norris (lap 103)
      const res = resolveComparisonLap(mockParticipants, mockLaps, pVerstappen, 'fastest', '', 101);
      expect(res.lapId).toBe(103);
      expect(res.driver?.name).toBe('Lando Norris');
    });

    it('resolves teammate when mode is teammate', () => {
      // Verstappen's teammate is Lawson (both team_id: 2)
      const res = resolveComparisonLap(mockParticipants, mockLaps, pVerstappen, 'teammate', '', 101);
      expect(res.lapId).toBe(102);
      expect(res.driver?.name).toBe('Liam Lawson');
    });

    it('falls back to fastest (or P2) when teammate is not found', () => {
      // Norris has team_id: 8 and no other car with team_id: 8 in session
      // Reference is Norris (lap 103), so fastest fallback is Verstappen (lap 101)
      const res = resolveComparisonLap(mockParticipants, mockLaps, pNorris, 'teammate', '', 103);
      expect(res.lapId).toBe(101);
      expect(res.driver?.name).toBe('Max Verstappen');
    });

    it('resolves specific driver by partial name in driver mode', () => {
      const res = resolveComparisonLap(mockParticipants, mockLaps, pVerstappen, 'driver', 'norris', 101);
      expect(res.lapId).toBe(103);
      expect(res.driver?.name).toBe('Lando Norris');
    });

    it('falls back to fastest when specific driver does not exist in session', () => {
      // Reference is Lawson (lap 102), driver queried is 'Alonso' (not in session)
      // Fastest lap is Verstappen (lap 101)
      const res = resolveComparisonLap(mockParticipants, mockLaps, pLawson, 'driver', 'Alonso', 102);
      expect(res.lapId).toBe(101);
      expect(res.driver?.name).toBe('Max Verstappen');
    });
  });
});
