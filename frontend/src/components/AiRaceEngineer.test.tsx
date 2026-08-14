import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { AiRaceEngineer } from './AiRaceEngineer';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

describe('AiRaceEngineer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/ai/config-status') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_gemini_env_key: true,
              has_openai_env_key: false,
              default_provider: 'gemini',
              default_model: 'gemini-1.5-flash',
            }),
        });
      }
      if (url === '/api/ai/models') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [
                { id: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash' },
                { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro' },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  const mockTelemetryContext: TelemetryContextPayload = {
    track_name: 'Monza',
    session_type: 'Qualifying',
    lap_a_name: 'Max Verstappen (Lap 5)',
    lap_b_name: 'Charles Leclerc (Lap 6)',
    lap_a_time_formatted: '1:20.500',
    lap_b_time_formatted: '1:21.100',
    time_delta_seconds: -0.6,
    faster_lap: 'Lap A',
    lap_a_compound: 'SOFT',
    lap_b_compound: 'SOFT',
    lap_a_s1_formatted: '25.100s',
    lap_b_s1_formatted: '25.300s',
    lap_a_s2_formatted: '27.400s',
    lap_b_s2_formatted: '27.700s',
    lap_a_s3_formatted: '28.000s',
    lap_b_s3_formatted: '28.100s',
    top_speed_a: 345.2,
    top_speed_b: 342.8,
    ers_a_used_percent: 38.5,
    ers_b_used_percent: 41.2,
    braking_summary: 'Braking test summary',
  };

  it('renders trigger button and opens drawer upon click', async () => {
    render(
      <AiRaceEngineer
        telemetryContext={mockTelemetryContext}
        hasLapsSelected={true}
        isZoomActive={false}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /Abrir AI Race Engineer/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.getAllByText('AI Race Engineer').length).toBeGreaterThan(0);

    // Click to open drawer
    fireEvent.click(triggerBtn);

    // Verify quick action chips
    expect(screen.getByText('¿Dónde se ganó o perdió más tiempo?')).toBeInTheDocument();
    expect(screen.getByText('Comparar frenada y tracción en curvas')).toBeInTheDocument();
    expect(screen.getByText('Comparar despliegue de ERS y uso de DRS')).toBeInTheDocument();

    // Verify status bar shows laps info
    expect(screen.getByText(/Max Verstappen \(Lap 5\)/)).toBeInTheDocument();
    expect(screen.getByText(/Charles Leclerc \(Lap 6\)/)).toBeInTheDocument();
  });

  it('toggles settings modal', async () => {
    render(
      <AiRaceEngineer
        telemetryContext={mockTelemetryContext}
        hasLapsSelected={true}
        isZoomActive={false}
      />
    );

    // Open drawer
    fireEvent.click(screen.getByRole('button', { name: /Abrir AI Race Engineer/i }));

    // Open settings
    const settingsBtn = screen.getByRole('button', { name: /Configuración/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText('Configuración del Asistente')).toBeInTheDocument();
    expect(screen.getByText('Proveedor de IA')).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();
  });
});
