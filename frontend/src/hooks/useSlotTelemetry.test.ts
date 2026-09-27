import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSlotTelemetry } from './useSlotTelemetry';
import { primeSessionLapData } from '../utils/sessionDataCache';

import type { Participant } from '../types/session';
import { makeLap, makeParticipant } from '../test/wireFactories';

describe('useSlotTelemetry Hook', () => {
  const mockParticipants: Participant[] = [
    makeParticipant({
      id: 1,
      session_id: 1,
      car_index: 0,
      name: 'Max Verstappen',
      race_number: 1,
      team_id: 2,
      driver_id: 1,
      ai_controlled: false,
    }),
    makeParticipant({
      id: 2,
      session_id: 1,
      car_index: 1,
      name: 'Sergio Perez',
      race_number: 11,
      team_id: 2,
      driver_id: 2,
      ai_controlled: false,
    }),
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

  it("picks your best lap from the session's stored car over the saved driver name", async () => {
    primeSessionLapData(7, {
      participants: mockParticipants.map((p) => ({ ...p, session_id: 7 })),
      laps: [
        makeLap({ id: 70, session_id: 7, car_index: 0, lap_number: 1, lap_time_ms: 88_000 }),
        makeLap({ id: 71, session_id: 7, car_index: 1, lap_number: 1, lap_time_ms: 89_000 }),
      ],
    });
    const { result } = renderHook(() =>
      useSlotTelemetry({ sessionId: 7, preferredDriverName: 'Verstappen', playerCarIndex: 1 })
    );
    await waitFor(() => expect(result.current.lapId).toBe(71));
    expect(result.current.driverName).toBe('#11 Sergio Perez');
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

  it('loads a session once when both slots use it', async () => {
    const { result } = renderHook(() => ({
      slotA: useSlotTelemetry({ sessionId: 1 }),
      slotB: useSlotTelemetry({ sessionId: 1, isSlotB: true, isSameSessionAsSlotA: true }),
    }));

    await waitFor(() => {
      expect(result.current.slotA.laps).toHaveLength(2);
      expect(result.current.slotB.laps).toHaveLength(2);
    });
    const urls = vi.mocked(globalThis.fetch).mock.calls.map(([url]) => url);
    expect(urls).toEqual(['/api/sessions/1/participants', '/api/sessions/1/laps']);
  });

  it('does not refetch a session it already has', async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: number | '' }) => useSlotTelemetry({ sessionId }),
      { initialProps: { sessionId: 1 as number | '' } }
    );
    await waitFor(() => expect(result.current.laps).toHaveLength(2));

    rerender({ sessionId: '' });
    await waitFor(() => expect(result.current.laps).toHaveLength(0));
    rerender({ sessionId: 1 });
    await waitFor(() => expect(result.current.laps).toHaveLength(2));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses a session Session History already loaded without any request', async () => {
    primeSessionLapData(5, { participants: mockParticipants, laps: [makeLap({ id: 50, car_index: 1, lap_time_ms: 87000 })] });

    const { result } = renderHook(() => useSlotTelemetry({ sessionId: 5 }));

    await waitFor(() => expect(result.current.lapId).toBe(50));
    expect(result.current.driverName).toBe('#11 Sergio Perez');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
