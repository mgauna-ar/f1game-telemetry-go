import { useCallback, useEffect, useState } from 'react';
import type { TrackProgressResponse } from '../types/progress';
import { api } from '../utils/apiClient';
import { savedDriverName } from '../utils/comparatorPreferencesUtils';

export interface TrackProgressState {
  data: TrackProgressResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Your sessions at a track, from `GET /api/progress` (the latest session's track when `track` is
 * left out). The saved driver name finds you in sessions recorded before your car was stored.
 */
export function useTrackProgress(track: string | undefined): TrackProgressState {
  const [data, setData] = useState<TrackProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const driver = savedDriverName().trim();

    setLoading(true);
    setError(null);
    api
      .get<TrackProgressResponse>('/api/progress', {
        params: { track: track || undefined, driver: driver || undefined },
        signal: controller.signal,
      })
      .then((response) => setData(response))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [track, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, loading, error, reload };
}
