import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { AiRaceEngineer } from './AiRaceEngineer';
import { RaceEngineerProvider } from '../context/RaceEngineerContext';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

describe('AiRaceEngineer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/ai/config-status') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_gemini_env_key: true,
              has_openai_env_key: false,
              default_provider: 'gemini',
              default_model: 'gemini-flash-lite-latest',
            }),
        });
      }
      if (url === '/api/ai/models') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [
                { id: 'gemini-flash-lite-latest', display_name: 'Gemini Flash Lite' },
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

  it('renders floating FAB button when closed and expands on click without background overlay', async () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer />
      </RaceEngineerProvider>
    );

    // Initial state: FAB launcher button visible
    const fabButton = screen.getByRole('button', { name: /Open AI Race Engineer/i });
    expect(fabButton).toBeInTheDocument();
    expect(screen.getByText('Race Engineer')).toBeInTheDocument();

    // Click FAB to expand chat
    fireEvent.click(fabButton);

    // Verify floating chat widget opened
    expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask your Race Engineer...')).toBeInTheDocument();

    // Verify NO modal-overlay is present
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('renders comparative telemetry prompt chips when opened with comparator context', async () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer
          isOpenOverride={true}
          telemetryContext={mockTelemetryContext}
          hasLapsSelected={true}
          isZoomActive={false}
        />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();

    // Verify quick action chips in English
    expect(screen.getByText('Where was time lost?')).toBeInTheDocument();
    expect(screen.getByText('Braking & Apex Speed')).toBeInTheDocument();
    expect(screen.getByText('ERS & DRS Usage')).toBeInTheDocument();

    // Verify prompt input field is ready
    expect(screen.getByPlaceholderText(/Ask engineer about telemetry deltas/i)).toBeInTheDocument();
  });

  it('toggles settings panel within the floating card', async () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer
          isOpenOverride={true}
          telemetryContext={mockTelemetryContext}
          hasLapsSelected={true}
          isZoomActive={false}
        />
      </RaceEngineerProvider>
    );

    // Open settings
    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText('AI Engineer Settings')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();
  });
});
