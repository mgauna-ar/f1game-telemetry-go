import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionList } from './useSessionList';

describe('useSessionList Hook', () => {
  const mockSessions = [
    { id: 1, track_name: 'Monza', session_type: 'Race', created_at: '2026-05-01T10:00:00Z', total_laps: 53 },
    { id: 2, track_name: 'Spa', session_type: 'Qualifying', created_at: '2026-05-02T10:00:00Z', total_laps: 20 },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/sessions') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSessions),
          });
        }
        if (url.startsWith('/api/sessions/') && init?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches sessions on mount', async () => {
    const { result } = renderHook(() => useSessionList());

    expect(result.current.loadingSessions).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingSessions).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].track_name).toBe('Monza');
    expect(result.current.error).toBeNull();
  });

  it('handles session deletion and triggers callback', async () => {
    const { result } = renderHook(() => useSessionList());

    await waitFor(() => {
      expect(result.current.loadingSessions).toBe(false);
    });

    act(() => {
      result.current.setSessionToDelete(result.current.sessions[0]);
    });

    expect(result.current.sessionToDelete?.id).toBe(1);

    const onDeleted = vi.fn();
    await act(async () => {
      await result.current.confirmDeleteSession(onDeleted);
    });

    expect(onDeleted).toHaveBeenCalledWith(1);
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].id).toBe(2);
    expect(result.current.sessionToDelete).toBeNull();
  });
});
