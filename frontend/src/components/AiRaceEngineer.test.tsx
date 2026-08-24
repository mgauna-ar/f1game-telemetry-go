import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { AiRaceEngineer } from './AiRaceEngineer';
import { RaceEngineerProvider } from '../context/RaceEngineerProvider';
import { useRaceEngineer } from '../context/RaceEngineerContext';
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

    expect(screen.getByText('AI Settings')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();

    // Verify direct API key creation link is present in settings
    const keyLink = screen.getByText(/Get a free API key at Google AI Studio/i);
    expect(keyLink).toBeInTheDocument();
    expect(keyLink.closest('a')).toHaveAttribute('href', 'https://aistudio.google.com/app/apikey');
  });

  it('displays a friendly missing API key card with links when no key is configured', async () => {
    // Setup config status with NO server key
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/ai/config-status') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_gemini_env_key: false,
              has_openai_env_key: false,
              default_provider: 'gemini',
              default_model: 'gemini-flash-lite-latest',
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    // Send a message without an API key
    const input = screen.getByPlaceholderText('Ask your Race Engineer...');
    fireEvent.change(input, { target: { value: 'Analyze tyre deg' } });
    fireEvent.submit(input.closest('form')!);

    // Expect the missing key alert card
    const errorCard = await screen.findByTestId('ai-error-card');
    expect(errorCard).toBeInTheDocument();
    expect(screen.getByText(/Radio Link Disconnected: Missing API Key/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Free Key at Google AI Studio/i)).toBeInTheDocument();
    expect(screen.getByText('Configure in Settings')).toBeInTheDocument();
  });

  it('displays model overloaded error card with retry button on high demand error', async () => {
    localStorage.setItem(
      'f1_ai_engineer_config',
      JSON.stringify({
        provider: 'gemini',
        apiKey: 'test-gemini-key',
        model: 'gemini-flash-lite-latest',
        providerKeys: { gemini: 'test-gemini-key' },
      })
    );

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
      if (url === '/api/ai/chat') {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                error: 'The model is overloaded. Please try again later.',
                code: 'MODEL_OVERLOADED',
                provider: 'gemini',
              })
            ),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    const input = screen.getByPlaceholderText('Ask your Race Engineer...');
    fireEvent.change(input, { target: { value: 'Strategy advice' } });
    fireEvent.submit(input.closest('form')!);

    const errorCard = await screen.findByTestId('ai-error-card');
    expect(errorCard).toBeInTheDocument();
    expect(screen.getByText(/Pit Wall Radio Congested: High Demand/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry Transmission/i)).toBeInTheDocument();
    expect(screen.getByText('Configure in Settings')).toBeInTheDocument();
  });

  it('renders Live Wall badge and live prompt chips when in live mode even if comparator context was populated', async () => {
    const TestLiveHarness = () => {
      const { setContextMode, setComparatorContext, setLiveContext } = useRaceEngineer();

      useEffect(() => {
        setComparatorContext(mockTelemetryContext);
        setLiveContext({
          trackName: 'Silverstone',
          sessionType: 'Race',
          liveSummary: 'Live race ongoing',
        });
        setContextMode('live');
      }, [setComparatorContext, setLiveContext, setContextMode]);

      return <AiRaceEngineer isOpenOverride={true} />;
    };

    render(
      <RaceEngineerProvider>
        <TestLiveHarness />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();
    // Must show Live Wall badge (not Comparator!)
    expect(screen.getByText('Live Wall')).toBeInTheDocument();
    // Must show Live chips (not comparator chips!)
    expect(screen.getByText('Safety Car & Pit Strategy')).toBeInTheDocument();
    expect(screen.getByText('Weather & Crossover')).toBeInTheDocument();
    expect(screen.getByText('Current Sector Pace')).toBeInTheDocument();
    // Must not show comparator chips
    expect(screen.queryByText('Where was time lost?')).toBeNull();
    // Must show live placeholder
    expect(screen.getByPlaceholderText(/Ask about live weather, SC, or tyre windows/i)).toBeInTheDocument();
  });

  it('renders Live Wall badge and standby prompt chips when in live standby mode without active telemetry', async () => {
    const TestLiveStandbyHarness = () => {
      const { setContextMode, setLiveContext } = useRaceEngineer();

      useEffect(() => {
        setLiveContext({
          trackName: 'F1 Pit Wall',
          sessionType: 'Standby',
          liveSummary: 'STATUS: IN GARAGE / STANDBY. No live telemetry packets received from track yet.',
        });
        setContextMode('live');
      }, [setLiveContext, setContextMode]);

      return <AiRaceEngineer isOpenOverride={true} />;
    };

    render(
      <RaceEngineerProvider>
        <TestLiveStandbyHarness />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('Live Wall')).toBeInTheDocument();
    expect(screen.getByText('Radio Check')).toBeInTheDocument();
    expect(screen.getByText('Session Setup Prep')).toBeInTheDocument();
    expect(screen.getByText('Tactical Plan')).toBeInTheDocument();
    // Must not show active race chips when in standby
    expect(screen.queryByText('Current Sector Pace')).toBeNull();
  });

  it('renders Debrief badge and debrief chips when in session_debrief mode', async () => {
    const TestDebriefHarness = () => {
      const { setContextMode, setSessionDebriefContext } = useRaceEngineer();

      useEffect(() => {
        setSessionDebriefContext({
          trackName: 'Spa-Francorchamps',
          sessionType: 'Race',
          driverCount: 20,
          summaryText: 'P1: Verstappen, P2: Norris',
        });
        setContextMode('session_debrief');
      }, [setSessionDebriefContext, setContextMode]);

      return <AiRaceEngineer isOpenOverride={true} />;
    };

    render(
      <RaceEngineerProvider>
        <TestDebriefHarness />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('Debrief')).toBeInTheDocument();
    expect(screen.getByText(/Spa-Francorchamps/)).toBeInTheDocument();
    expect(screen.getByText('Session Pace Overview')).toBeInTheDocument();
    expect(screen.getByText('Tyre Stint Degradation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about session pace, stints, or strategy/i)).toBeInTheDocument();
  });
});
