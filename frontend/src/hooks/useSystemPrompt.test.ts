import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSystemPrompt } from './useSystemPrompt';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

describe('useSystemPrompt Hook', () => {
  const mockComparatorContext: TelemetryContextPayload = {
    track_name: 'Silverstone',
    session_type: 'Qualifying',
    lap_a_name: 'Max Verstappen (Lap 5)',
    lap_b_name: 'Charles Leclerc (Lap 6)',
    lap_a_time_formatted: '1:27.500',
    lap_b_time_formatted: '1:27.850',
    time_delta_seconds: -0.35,
    faster_lap: 'Lap A',
    lap_a_compound: 'SOFT',
    lap_b_compound: 'SOFT',
    lap_a_s1_formatted: '28.100s',
    lap_b_s1_formatted: '28.200s',
    lap_a_s2_formatted: '34.400s',
    lap_b_s2_formatted: '34.600s',
    lap_a_s3_formatted: '25.000s',
    lap_b_s3_formatted: '25.050s',
    top_speed_a: 325.4,
    top_speed_b: 321.8,
    ers_a_used_percent: 42.0,
    ers_b_used_percent: 45.5,
    braking_summary: 'Turn 3 brake point 5m earlier',
    apex_speed_summary: 'Apex speed +3 km/h in Copse',
    throttle_summary: 'Smoother exit traction out of Club',
    ers_drs_summary: 'DRS activated cleanly on Hangar straight',
    zoomed_range: {
      start_distance_meters: 1200,
      end_distance_meters: 1800,
      description: 'Maggotts-Becketts complex',
      delta_in_segment: -0.15,
      speed_diff_at_apex: -4.5,
      braking_diff_meters: -5,
    },
  };

  it('builds general context payload and system prompt', () => {
    const { result } = renderHook(() =>
      useSystemPrompt({
        contextMode: 'general',
        comparatorContext: null,
        sessionDebriefContext: null,
        liveContext: null,
        locale: 'en',
      })
    );

    const backendCtx = result.current.buildCurrentBackendContext();
    expect(backendCtx).toEqual({
      context_mode: 'general',
      language: 'en',
    });

    const clientPrompt = result.current.buildClientSideSystemPrompt();
    expect(clientPrompt).toContain('personal F1 Race Engineer');
    expect(clientPrompt).toContain('Always respond in English');
  });

  it('builds session debrief context and system prompt in Spanish', () => {
    const { result } = renderHook(() =>
      useSystemPrompt({
        contextMode: 'session_debrief',
        comparatorContext: null,
        sessionDebriefContext: {
          trackName: 'Interlagos',
          sessionType: 'Race',
          weather: 'Dry',
          driverCount: 20,
          summaryText: 'P1: Verstappen, P2: Norris (+4.2s)',
        },
        liveContext: null,
        locale: 'es',
      })
    );

    const backendCtx = result.current.buildCurrentBackendContext();
    expect(backendCtx).toEqual({
      context_mode: 'session_debrief',
      language: 'es',
      track_name: 'Interlagos',
      session_type: 'Race',
      weather_a: 'Dry',
      session_summary: 'P1: Verstappen, P2: Norris (+4.2s)',
    });

    const clientPrompt = result.current.buildClientSideSystemPrompt();
    expect(clientPrompt).toContain('Chief Race Strategist');
    expect(clientPrompt).toContain('neumáticos, boxes, monoplaza');
    expect(clientPrompt).toContain('P1: Verstappen, P2: Norris');
  });

  it('builds live context and handles standby vs active telemetry', () => {
    // Standby scenario
    const { result: standbyResult } = renderHook(() =>
      useSystemPrompt({
        contextMode: 'live',
        comparatorContext: null,
        sessionDebriefContext: null,
        liveContext: {
          trackName: 'Monza',
          sessionType: 'Standby',
          liveSummary: 'STATUS: STANDBY IN GARAGE',
        },
        locale: 'es',
      })
    );

    const standbyPrompt = standbyResult.current.buildClientSideSystemPrompt();
    expect(standbyPrompt).toContain('CERO ALUCINACIONES');
    expect(standbyPrompt).toContain('LIVE STATUS: STANDBY');

    // Active scenario
    const { result: activeResult } = renderHook(() =>
      useSystemPrompt({
        contextMode: 'live',
        comparatorContext: null,
        sessionDebriefContext: null,
        liveContext: {
          trackName: 'Monza',
          sessionType: 'Race',
          liveSummary: 'Lap 14/53 - Position P2 (+1.8s) - Tyre Medium (7 laps)',
        },
        locale: 'en',
      })
    );

    const backendCtx = activeResult.current.buildCurrentBackendContext();
    expect(backendCtx.track_name).toBe('Monza');
    expect(backendCtx.session_type).toBe('Race');

    const activePrompt = activeResult.current.buildClientSideSystemPrompt();
    expect(activePrompt).toContain('active F1 Race Engineer on the pit wall');
    expect(activePrompt).toContain('Lap 14/53 - Position P2');
  });

  it('builds comparator context and full comparative telemetry prompt with zoomed range', () => {
    const { result } = renderHook(() =>
      useSystemPrompt({
        contextMode: 'comparator',
        comparatorContext: mockComparatorContext,
        sessionDebriefContext: null,
        liveContext: null,
        locale: 'en',
      })
    );

    const backendCtx = result.current.buildCurrentBackendContext();
    expect(backendCtx.context_mode).toBe('comparator');
    expect(backendCtx.track_name).toBe('Silverstone');
    expect(backendCtx.lap_a_name).toBe('Max Verstappen (Lap 5)');

    const prompt = result.current.buildClientSideSystemPrompt();
    expect(prompt).toContain('exclusive telemetry analyst for the DRIVER OF LAP A');
    expect(prompt).toContain('Max Verstappen (Lap 5)');
    expect(prompt).toContain('Charles Leclerc (Lap 6)');
    expect(prompt).toContain('Turn 3 brake point 5m earlier');
    expect(prompt).toContain('Apex speed +3 km/h in Copse');
    expect(prompt).toContain('Maggotts-Becketts complex');
  });
});
