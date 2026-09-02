import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBatchOperations } from './useBatchOperations';
import type { Session } from '../types/session';

describe('useBatchOperations Hook', () => {
  let mockSessions: Session[];
  let fetchSessions: () => Promise<void>;
  let fetchTags: () => Promise<void>;
  let setSessions: React.Dispatch<React.SetStateAction<Session[]>>;

  beforeEach(() => {
    mockSessions = [
      { id: 1, session_uid: '0x1', created_at: '2026-05-01T10:00:00Z', track_name: 'Monza', session_type: 'Race' },
      { id: 2, session_uid: '0x2', created_at: '2026-05-02T10:00:00Z', track_name: 'Spa', session_type: 'Qualifying' },
      { id: 3, session_uid: '0x3', created_at: '2026-05-03T10:00:00Z', track_name: 'Monaco', session_type: 'Practice' },
    ];
    fetchSessions = vi.fn().mockResolvedValue(undefined);
    fetchTags = vi.fn().mockResolvedValue(undefined);
    setSessions = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/sessions/batch-delete' && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ deleted: 2 }) });
        }
        if (url === '/api/sessions/batch-tags' && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: 2 }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manages selection of sessions correctly', () => {
    const { result } = renderHook(() =>
      useBatchOperations({
        sessions: mockSessions,
        filteredSessions: mockSessions,
        setSessions,
        fetchSessions,
        fetchTags,
      })
    );

    expect(result.current.selectedSessionIds.size).toBe(0);

    act(() => {
      result.current.handleToggleSelectSession(1);
    });
    expect(result.current.selectedSessionIds.has(1)).toBe(true);

    act(() => {
      result.current.handleToggleSelectAll();
    });
    expect(result.current.selectedSessionIds.size).toBe(3);

    act(() => {
      result.current.handleClearSelection();
    });
    expect(result.current.selectedSessionIds.size).toBe(0);
  });

  it('executes batch delete and triggers refresh', async () => {
    const { result } = renderHook(() =>
      useBatchOperations({
        sessions: mockSessions,
        filteredSessions: mockSessions,
        setSessions,
        fetchSessions,
        fetchTags,
      })
    );

    act(() => {
      result.current.handleToggleSelectSession(1);
      result.current.handleToggleSelectSession(2);
    });

    await act(async () => {
      await result.current.handleExecuteBatchDelete();
    });

    expect(setSessions).toHaveBeenCalled();
    expect(fetchSessions).toHaveBeenCalled();
    expect(result.current.selectedSessionIds.size).toBe(0);
    expect(result.current.toastMessage?.type).toBe('success');
  });
});
