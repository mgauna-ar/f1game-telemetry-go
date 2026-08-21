import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSessionFilters } from './useSessionFilters';
import type { Session } from '../types/session';

describe('useSessionFilters Hook', () => {
  const mockSessions: Session[] = [
    {
      id: 1,
      session_uid: '0x1',
      track_name: 'Monza',
      session_type: 'Race',
      created_at: '2026-05-01T10:00:00Z',
      total_laps: 53,
      tags: [{ id: 10, name: 'League A', color: '#ff0000' }],
    },
    {
      id: 2,
      session_uid: '0x2',
      track_name: 'Spa-Francorchamps',
      session_type: 'Qualifying',
      created_at: '2026-05-02T10:00:00Z',
      total_laps: 20,
      tags: [{ id: 20, name: 'League B', color: '#00ff00' }],
    },
    {
      id: 3,
      session_uid: '0x3',
      track_name: 'Monza',
      session_type: 'Practice',
      created_at: '2026-05-03T10:00:00Z',
      total_laps: 15,
      tags: [],
    },
  ];

  it('filters sessions by search query', () => {
    const { result } = renderHook(() =>
      useSessionFilters({ sessions: mockSessions })
    );

    expect(result.current.filteredSessions).toHaveLength(3);

    act(() => {
      result.current.setSearchQuery('Spa');
    });

    expect(result.current.filteredSessions).toHaveLength(1);
    expect(result.current.filteredSessions[0].track_name).toBe('Spa-Francorchamps');
  });

  it('filters sessions by session type and circuit', () => {
    const { result } = renderHook(() =>
      useSessionFilters({ sessions: mockSessions })
    );

    act(() => {
      result.current.setCircuitFilter('Monza');
    });

    expect(result.current.filteredSessions).toHaveLength(2);

    act(() => {
      result.current.setSessionTypeFilter('Race');
    });

    expect(result.current.filteredSessions).toHaveLength(1);
    expect(result.current.filteredSessions[0].id).toBe(1);
  });

  it('toggles sorting correctly', () => {
    const { result } = renderHook(() =>
      useSessionFilters({ sessions: mockSessions })
    );

    // Initial sort is date desc -> id 3, 2, 1
    expect(result.current.filteredSessions.map((s) => s.id)).toEqual([3, 2, 1]);

    act(() => {
      result.current.handleToggleSort('laps');
    });

    expect(result.current.sortField).toBe('laps');
    expect(result.current.sortOrder).toBe('asc');
    // Asc laps: 15 (id 3), 20 (id 2), 53 (id 1)
    expect(result.current.filteredSessions.map((s) => s.id)).toEqual([3, 2, 1]);

    act(() => {
      result.current.handleToggleSort('laps');
    });

    expect(result.current.sortOrder).toBe('desc');
    // Desc laps: 53 (id 1), 20 (id 2), 15 (id 3)
    expect(result.current.filteredSessions.map((s) => s.id)).toEqual([1, 2, 3]);
  });
});
