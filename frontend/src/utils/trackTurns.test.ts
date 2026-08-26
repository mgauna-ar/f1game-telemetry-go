import { describe, it, expect } from 'vitest';
import { getTurnContextAtDistance } from './trackTurns';
import type { TrackTurn } from '../types/comparator';

describe('getTurnContextAtDistance', () => {
  const mockTurns: TrackTurn[] = [
    {
      turnNumber: 1,
      name: 'T1',
      distance: 500,
      entryDistance: 465,
      exitDistance: 535,
      worldX: 100,
      worldZ: 100,
      normalX: 0,
      normalZ: 1,
    },
    {
      turnNumber: 2,
      name: 'T2',
      distance: 1000,
      entryDistance: 965,
      exitDistance: 1035,
      worldX: 200,
      worldZ: 200,
      normalX: 1,
      normalZ: 0,
    },
  ];

  it('returns straight info when distance is outside turn apex zones', () => {
    const res = getTurnContextAtDistance(mockTurns, 200);
    expect(res.phase).toBe('straight');
    expect(res.label).toContain('T1');
  });

  it('returns entry info when approaching a turn', () => {
    const res = getTurnContextAtDistance(mockTurns, 475);
    expect(res.phase).toBe('entry');
    expect(res.label).toBe('T1 (Entry)');
    expect(res.turn?.name).toBe('T1');
  });

  it('returns apex info when at the turn apex', () => {
    const res = getTurnContextAtDistance(mockTurns, 505);
    expect(res.phase).toBe('apex');
    expect(res.label).toBe('T1 (Apex)');
    expect(res.turn?.name).toBe('T1');
  });

  it('returns exit info when exiting the turn', () => {
    const res = getTurnContextAtDistance(mockTurns, 530);
    expect(res.phase).toBe('exit');
    expect(res.label).toBe('T1 (Exit)');
  });

  it('handles start and final straight segments correctly', () => {
    const beforeFirst = getTurnContextAtDistance(mockTurns, 100);
    expect(beforeFirst.label).toBe('Main Straight (Start → T1)');

    const afterLast = getTurnContextAtDistance(mockTurns, 1200);
    expect(afterLast.label).toBe('Final Straight (T2 → Finish)');
  });

  it('handles null/undefined gracefully', () => {
    expect(getTurnContextAtDistance([], null)).toEqual({ turn: null, phase: 'straight', label: '' });
    expect(getTurnContextAtDistance([], undefined)).toEqual({ turn: null, phase: 'straight', label: '' });
  });
});
