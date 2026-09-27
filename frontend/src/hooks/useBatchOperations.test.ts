import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBatchOperations } from './useBatchOperations';
import { useToastStore } from '../store/useToastStore';
import type { SessionListItem } from '../types/session';
import { makeSessionListItem } from '../test/wireFactories';

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const lastToast = () => {
  const { toasts } = useToastStore.getState();
  return toasts[toasts.length - 1];
};

describe('useBatchOperations Hook', () => {
  let mockSessions: SessionListItem[];
  let fetchSessions: () => Promise<void>;
  let fetchTags: () => Promise<void>;
  let setSessions: React.Dispatch<React.SetStateAction<SessionListItem[]>>;

  beforeEach(() => {
    mockSessions = [
      makeSessionListItem({ id: 1, session_uid: '0x1', created_at: '2026-05-01T10:00:00Z', track_name: 'Monza', session_type: 'Race' }),
      makeSessionListItem({ id: 2, session_uid: '0x2', created_at: '2026-05-02T10:00:00Z', track_name: 'Spa', session_type: 'Qualifying' }),
      makeSessionListItem({ id: 3, session_uid: '0x3', created_at: '2026-05-03T10:00:00Z', track_name: 'Monaco', session_type: 'Practice' }),
    ];
    fetchSessions = vi.fn().mockResolvedValue(undefined);
    fetchTags = vi.fn().mockResolvedValue(undefined);
    setSessions = vi.fn();
    useToastStore.getState().clearToasts();

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
    expect(lastToast()?.type).toBe('success');
  });

  const renderBatchHook = () =>
    renderHook(() =>
      useBatchOperations({
        sessions: mockSessions,
        filteredSessions: mockSessions,
        setSessions,
        fetchSessions,
        fetchTags,
      })
    );

  it('shows the server error text when a batch export fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(404, { error: 'no valid sessions found to export' })));
    const { result } = renderBatchHook();

    act(() => {
      result.current.handleToggleSelectSession(1);
      result.current.handleToggleSelectSession(2);
    });
    await act(async () => {
      await result.current.handleBatchExport();
    });

    expect(lastToast()).toMatchObject({ type: 'error', message: 'Export failed: no valid sessions found to export' });
  });

  it('shows the server error text when a single export fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(500, { error: 'failed to export session' })));
    const { result } = renderBatchHook();

    await act(async () => {
      await result.current.handleExportSession(mockSessions[0]);
    });

    expect(lastToast()).toMatchObject({ type: 'error', message: 'Export failed: failed to export session' });
  });

  it('shows the failure reason when an import is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        jsonResponse(400, {
          status: 'error',
          total: 1,
          imported: 0,
          skipped: 0,
          failed: 1,
          session_ids: [],
          error: 'invalid session package format',
          details: [{ filename: 'bad.f1session', status: 'failed', reason: 'invalid session package format' }],
        })
      )
    );
    const { result } = renderBatchHook();

    await act(async () => {
      await result.current.handleImportFiles([new File(['x'], 'bad.f1session')]);
    });

    expect(lastToast()).toMatchObject({ type: 'error', message: 'Import failed: invalid session package format' });
    expect(fetchSessions).not.toHaveBeenCalled();
  });

  it('names the first failed file in a partial import summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        jsonResponse(200, {
          status: 'partial_failure',
          total: 2,
          imported: 1,
          skipped: 0,
          failed: 1,
          session_ids: [7],
          details: [
            { filename: 'good.f1session', status: 'imported', session_id: 7 },
            { filename: 'bad.f1session', status: 'failed', reason: 'empty session payload' },
          ],
        })
      )
    );
    const { result } = renderBatchHook();

    await act(async () => {
      await result.current.handleImportFiles([new File(['a'], 'good.f1session'), new File(['b'], 'bad.f1session')]);
    });

    const toast = lastToast();
    expect(toast?.message).toContain('Import completed: 1 imported, 0 skipped, 1 failed.');
    expect(toast?.message).toContain('bad.f1session: empty session payload');
    expect(fetchSessions).toHaveBeenCalled();
  });

  it('localizes batch delete and tag assignment errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/sessions/batch-delete'
          ? jsonResponse(500, { error: 'failed to delete sessions' })
          : jsonResponse(500, { error: 'failed to assign tags to sessions' })
      )
    );
    const { result } = renderBatchHook();

    act(() => {
      result.current.handleToggleSelectSession(1);
    });
    await act(async () => {
      await result.current.handleExecuteBatchDelete();
    });
    expect(lastToast()).toMatchObject({ type: 'error', message: 'Delete failed: failed to delete sessions' });

    await act(async () => {
      await result.current.handleExecuteBatchTag(5);
    });
    expect(lastToast()).toMatchObject({ type: 'error', message: 'Tag assignment failed: failed to assign tags to sessions' });
  });
});
