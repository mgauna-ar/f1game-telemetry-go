import { describe, it, expect } from 'vitest';
import {
  getQualifyingCutoffPosition,
  getTeamColor,
  getVisualCompoundId,
  SESSION_TYPES,
  TEAM_COLORS,
  TYRE_COMPOUNDS,
  TYRE_COMPOUND_IDS,
} from './f1';

describe('getVisualCompoundId', () => {
  it.each([
    { compound: TYRE_COMPOUND_IDS.SOFT, expected: TYRE_COMPOUND_IDS.SOFT },
    { compound: '17', expected: TYRE_COMPOUND_IDS.MEDIUM },
    { compound: 'Hard', expected: TYRE_COMPOUND_IDS.HARD },
    { compound: 'MED', expected: TYRE_COMPOUND_IDS.MEDIUM },
    { compound: 'intermediate', expected: TYRE_COMPOUND_IDS.INTERMEDIATE },
    { compound: 'W', expected: TYRE_COMPOUND_IDS.WET },
  ])('reads $compound as compound $expected', ({ compound, expected }) => {
    expect(getVisualCompoundId(compound)).toBe(expected);
  });

  it.each([undefined, null, '', 'C3', TYRE_COMPOUND_IDS.CLASSIC_HARD])('has no visual compound for %s', (compound) => {
    expect(getVisualCompoundId(compound)).toBeUndefined();
  });

  it('colours every visual compound with its token', () => {
    expect(TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.SOFT]).toEqual({
      label: 'S',
      color: 'var(--f1-compound-soft)',
      bg: 'var(--f1-compound-soft-bg)',
    });
  });
});

describe('getTeamColor', () => {
  it('uses the team table and the fallback token for unknown teams', () => {
    expect(getTeamColor(0)).toBe(TEAM_COLORS[0]);
    expect(getTeamColor(250)).toBe('var(--f1-team-fallback)');
    expect(getTeamColor(undefined)).toBe('var(--f1-team-fallback)');
  });
});

describe('getQualifyingCutoffPosition', () => {
  it.each([
    { sessionType: SESSION_TYPES.Q1, carCount: 20, expected: 15 },
    { sessionType: SESSION_TYPES.Q1, carCount: 22, expected: 16 },
    { sessionType: SESSION_TYPES.Q1, carCount: 24, expected: 17 },
    { sessionType: SESSION_TYPES.SPRINT_Q1, carCount: 22, expected: 16 },
    { sessionType: SESSION_TYPES.Q2, carCount: 20, expected: 10 },
    { sessionType: SESSION_TYPES.Q2, carCount: 22, expected: 10 },
    { sessionType: SESSION_TYPES.SPRINT_Q2, carCount: 24, expected: 10 },
  ])('keeps P1-P$expected through in session $sessionType with $carCount cars', ({ sessionType, carCount, expected }) => {
    expect(getQualifyingCutoffPosition(sessionType, carCount)).toBe(expected);
  });

  it.each([
    { name: 'Q3', sessionType: SESSION_TYPES.Q3, carCount: 20 },
    { name: 'one-shot qualifying', sessionType: SESSION_TYPES.OSQ, carCount: 20 },
    { name: 'a race', sessionType: SESSION_TYPES.RACE, carCount: 20 },
    { name: 'a lobby too small to knock anyone out', sessionType: SESSION_TYPES.Q2, carCount: 8 },
    { name: 'an unknown session', sessionType: undefined, carCount: 20 },
  ])('knocks nobody out in $name', ({ sessionType, carCount }) => {
    expect(getQualifyingCutoffPosition(sessionType, carCount)).toBeNull();
  });
});
