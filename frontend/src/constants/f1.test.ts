import { describe, it, expect } from 'vitest';
import { getQualifyingCutoffPosition, SESSION_TYPES } from './f1';

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
