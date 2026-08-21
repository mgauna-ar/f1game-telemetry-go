import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSlotTelemetry } from './useSlotTelemetry';

describe('useSlotTelemetry Hook', () => {
  const mockParticipants = [
    { id: 1, car_index: 0, name: 'Max Verstappen', race_number: 1 },
    { id: 2, car_index: 1, name: 'Sergio Perez', race_number: 11 },
  ];

  const mockLaps = [
    { id: 10, car_index: 0, lap_number: 1, lap_time_ms: 90000, is_valid: true, sector1_ms: 30000 },
    { id: 11, car_index: 0, lap_number: 2, lap_time_ms: 88000, is_valid: true, sector1_ms: 29000 },
  ];

  const mockTelemetry = [
    { lap_distance: 0, speed: 200, throttle: 1, brake: 0, gear: 5, engine_rpm: 10500, drs: 0 },
    { lap_distance: 50, speed: 250, throttle: 1, brake: 0, gear: 6, engine_rpm: 11500, drs: 1 },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/sessions/1/participants') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
        }
        if (url === '/api/sessions/1/laps') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
        }
        if (url.startsWith('/api/laps/11/telemetry')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTelemetry) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches participants, laps and auto-selects best valid lap', async () => {
    const { result } = renderHook(() =>
      useSlotTelemetry({
        sessionId: 1,
      })
    );

    await waitFor(() => {
      expect(result.current.laps).toHaveLength(2);
    });

    // Best lap is id 11 (88000ms < 90000ms)
    expect(result.current.lapId).toBe(11);
    expect(result.current.selectedLap?.lap_time_ms).toBe(88000);
    expect(result.current.driverName).toBe('#1 Max Verstappen');

    await waitFor(() => {
      expect(result.current.rawTelemetry).toHaveLength(2);
    });
  });
});
