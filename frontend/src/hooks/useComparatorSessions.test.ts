import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useComparatorSessions } from './useComparatorSessions';

describe('useComparatorSessions Hook', () => {
  const mockSessions = [
    { id: 1, track_name: 'Monza', session_type: 'Race', created_at: '2026-05-01' },
    { id: 2, track_name: 'Monza', session_type: 'Qualifying', created_at: '2026-05-02' },
    { id: 3, track_name: 'Spa', session_type: 'Race', created_at: '2026-05-03' },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/sessions') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSessions),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with preload and fetches sessions', async () => {
    const { result } = renderHook(() =>
      useComparatorSessions({
        initialPreload: { sessionAId: 1, sessionBId: 2 },
      })
    );

    expect(result.current.sessionAId).toBe(1);
    expect(result.current.sessionBId).toBe(2);

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3);
    });

    expect(result.current.selectedSessionAObj?.track_name).toBe('Monza');
  });

  it('links and unlinks sessions properly', async () => {
    const { result } = renderHook(() => useComparatorSessions());

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3);
    });

    act(() => {
      result.current.handleSelectSessionA(1);
    });

    // Linked by default: Session B should mirror Session A
    expect(result.current.sessionAId).toBe(1);
    expect(result.current.sessionBId).toBe(1);

    act(() => {
      result.current.toggleSessionLink();
    });

    expect(result.current.isLinkedSessions).toBe(false);

    act(() => {
      result.current.handleSelectSessionB(2);
    });

    expect(result.current.sessionAId).toBe(1);
    expect(result.current.sessionBId).toBe(2);
  });
});
