import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionTags } from './useSessionTags';
import type { Session, Tag } from '../types/session';

describe('useSessionTags Hook', () => {
  const initialTags: Tag[] = [
    { id: 1, name: 'Championship', color: '#ff4757' },
    { id: 2, name: 'Casual', color: '#2ed573' },
  ];

  let sessions: Session[];
  let setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  let selectedSession: Session | null;
  let setSelectedSession: React.Dispatch<React.SetStateAction<Session | null>>;

  beforeEach(() => {
    sessions = [
      { id: 101, session_uid: '0x101', created_at: '2026-05-01T10:00:00Z', track_name: 'Silverstone', session_type: 'Race', tags: [initialTags[0]] },
      { id: 102, session_uid: '0x102', created_at: '2026-05-02T10:00:00Z', track_name: 'Spa', session_type: 'Race', tags: [initialTags[0], initialTags[1]] },
    ];
    setSessions = vi.fn((updater) => {
      sessions = typeof updater === 'function' ? updater(sessions) : updater;
    });
    selectedSession = sessions[0];
    setSelectedSession = vi.fn((updater) => {
      selectedSession = typeof updater === 'function' ? updater(selectedSession) : updater;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/tags') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(initialTags),
          });
        }
        if (url.startsWith('/api/sessions/101/tags') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([...initialTags]),
          });
        }
        if (url.startsWith('/api/sessions/101/tags/1') && init?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url === '/api/tags/1' && init?.method === 'DELETE') {
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

  it('fetches tags and computes tag counts correctly', async () => {
    const { result } = renderHook(() =>
      useSessionTags({
        sessions,
        setSessions,
        selectedSession,
        setSelectedSession,
      })
    );

    await waitFor(() => {
      expect(result.current.availableTags).toHaveLength(2);
    });

    expect(result.current.sessionCountByTag[1]).toBe(2);
    expect(result.current.sessionCountByTag[2]).toBe(1);
  });

  it('handles adding and removing session tags', async () => {
    const { result } = renderHook(() =>
      useSessionTags({
        sessions,
        setSessions,
        selectedSession,
        setSelectedSession,
      })
    );

    await waitFor(() => {
      expect(result.current.availableTags).toHaveLength(2);
    });

    await act(async () => {
      await result.current.handleAddTag(101, 2);
    });

    expect(setSessions).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleRemoveTag(101, 1);
    });

    expect(setSessions).toHaveBeenCalled();
  });
});
