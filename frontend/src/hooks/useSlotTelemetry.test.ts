import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSlotTelemetry } from './useSlotTelemetry';

import type { Participant } from '../types/session';

describe('useSlotTelemetry Hook', () => {
  const mockParticipants: Participant[] = [
    {
      id: 1,
      session_id: 1,
      car_index: 0,
      name: 'Max Verstappen',
      race_number: 1,
      team_id: 2,
      driver_id: 1,
      ai_controlled: false,
    },
    {
      id: 2,
      session_id: 1,
      car_index: 1,
      name: 'Sergio Perez',
      race_number: 11,
      team_id: 2,
      driver_id: 2,
      ai_controlled: false,
    },
  ];

  const mockLaps = [
    { id: 10, car_index: 0, lap_number: 1, lap_time_ms: 90000, is_valid: true, sector1_ms: 30000 },
    { id: 11, car_index: 0, lap_number: 2, lap_time_ms: 88000, is_valid: true, sector1_ms: 29000 },
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
  });

  it('auto-selects configured preferred driver lap', async () => {
    const perezLaps = [
      ...mockLaps,
      { id: 12, car_index: 1, lap_number: 3, lap_time_ms: 89000, is_valid: true, sector1_ms: 29500 },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/sessions/1/participants') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
        }
        if (url === '/api/sessions/1/laps') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(perezLaps) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );

    const { result } = renderHook(() =>
      useSlotTelemetry({
        sessionId: 1,
        preferredDriverName: 'Perez',
      })
    );

    await waitFor(() => {
      expect(result.current.laps).toHaveLength(3);
    });

    // Should select Perez's best lap (id 12), not Verstappen's faster lap (id 11)
    expect(result.current.lapId).toBe(12);
    expect(result.current.driverName).toBe('#11 Sergio Perez');
  });

  it('selects comparison lap for Slot B with P1 tiebreaker', async () => {
    const multiLaps = [
      ...mockLaps,
      { id: 12, car_index: 1, lap_number: 3, lap_time_ms: 89000, is_valid: true, sector1_ms: 29500 },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/sessions/1/participants') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
        }
        if (url === '/api/sessions/1/laps') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(multiLaps) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );

    const { result } = renderHook(() =>
      useSlotTelemetry({
        sessionId: 1,
        isSlotB: true,
        referenceDriver: mockParticipants[0],
        referenceLapId: 11, // Verstappen has P1
        rivalMode: 'fastest',
      })
    );

    await waitFor(() => {
      expect(result.current.laps).toHaveLength(3);
    });

    // Reference driver has P1 (id 11), so Comparison should pick P2 (id 12, Perez)
    expect(result.current.lapId).toBe(12);
    expect(result.current.driverName).toBe('#11 Sergio Perez');
  });
});
