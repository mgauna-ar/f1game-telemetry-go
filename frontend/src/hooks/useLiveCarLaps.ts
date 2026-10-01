import { useEffect, useState } from 'react';
import { api } from '../utils/apiClient';
import { CAR_LAPS_REFRESH_MS } from '../constants/f1';
import type { LiveCarLaps } from '../types/telemetry';

export interface LiveCarLapsState {
  /** The car's lap history, or null until it loads (and after the car changes). */
  data: LiveCarLaps | null;
  /** The last load failed; the last good history is kept. */
  failed: boolean;
}

/**
 * A live car's completed laps and stints (GET /api/live/cars/{carIndex}/laps), reloaded every
 * CAR_LAPS_REFRESH_MS while `carIndex` is set, so new laps appear as the game reports them.
 */
export function useLiveCarLaps(carIndex: number | null): LiveCarLapsState {
  const [state, setState] = useState<LiveCarLapsState & { carIndex: number | null }>({
    carIndex,
    data: null,
    failed: false,
  });

  useEffect(() => {
    if (carIndex === null) return;
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      api
        .get<LiveCarLaps>(`/api/live/cars/${carIndex}/laps`, current.signal)
        .then((data) => setState({ carIndex, data, failed: false }))
        .catch(() => {
          if (current.signal.aborted) return;
          setState((prev) =>
            prev.carIndex === carIndex ? { ...prev, failed: true } : { carIndex, data: null, failed: true }
          );
        });
    };
    load();
    const timer = window.setInterval(load, CAR_LAPS_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller?.abort();
    };
  }, [carIndex]);

  // A history loaded for another car is never shown
  if (state.carIndex !== carIndex) return { data: null, failed: false };
  return { data: state.data, failed: state.failed };
}
