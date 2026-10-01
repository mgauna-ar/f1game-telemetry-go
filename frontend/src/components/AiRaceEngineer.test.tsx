import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { resetDevicePreferences, useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import { AiRaceEngineer } from './AiRaceEngineer';
import { RaceEngineerProvider } from '../context/RaceEngineerProvider';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useSessionListStore } from '../store/useSessionListStore';
import { makeLiveSession, makeSessionListItem } from '../test/wireFactories';

// Telemetry is always fresh here; whether the feed is live depends on the session store.
vi.mock('../utils/telemetrySocket', () => ({
  getLastTelemetryMessageAt: vi.fn(() => Date.now()),
}));

const SILVERSTONE_TRACK_ID = 7;

/** A GET /api/settings/ai answer with or without a Gemini key in the server's .env. */
const aiSettings = (hasGeminiEnvKey: boolean) => ({
  saved: false,
  provider: 'gemini',
  base_url: '',
  providers: {
    gemini: { model: 'gemini-flash-lite-latest', has_saved_key: false, has_env_key: hasGeminiEnvKey },
    openai: { model: 'gpt-4o-mini', has_saved_key: false, has_env_key: false },
    claude: { model: '', has_saved_key: false, has_env_key: false },
    custom: { model: 'gpt-4o-mini', has_saved_key: false, has_env_key: false },
  },
});

describe('AiRaceEngineer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetDevicePreferences();
    useSessionStatusStore.setState({ connected: false, session: null });
    useSessionListStore.getState().reset();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/ai') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(aiSettings(true)) });
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

  /** The chat reads what it is about from the URL; the session list names the track. */
  const openPage = (url: string, sessions: Array<{ id: number; track_name: string }> = []) => {
    window.history.replaceState(null, '', url);
    useSessionListStore.setState({ sessions: sessions.map((s) => makeSessionListItem(s)) });
  };

  /** Opens the chat on the comparator with two laps picked. */
  const ComparatorHarness = () => <AiRaceEngineer isOpenOverride={true} />;
  const openComparatorPage = () => openPage('/compare?sa=5&a=11&b=12', [{ id: 5, track_name: 'Monza' }]);

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
    openComparatorPage();
    render(
      <RaceEngineerProvider>
        <ComparatorHarness />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();

    // Verify quick action chips in English
    expect(screen.getByText('Where was time lost?')).toBeInTheDocument();
    expect(screen.getByText('Braking & Apex Speed')).toBeInTheDocument();
    expect(screen.getByText('ERS & DRS Usage')).toBeInTheDocument();

    // Verify prompt input field is ready
    expect(screen.getByPlaceholderText(/Ask engineer about telemetry deltas/i)).toBeInTheDocument();
    expect(screen.getByText(/Monza/)).toBeInTheDocument();
  });

  it('toggles settings panel within the floating card', async () => {
    openComparatorPage();
    render(
      <RaceEngineerProvider>
        <ComparatorHarness />
      </RaceEngineerProvider>
    );

    // Open settings
    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText('AI Settings')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Gemini/ })).toHaveAttribute('aria-checked', 'true');

    // Verify direct API key creation link is present in settings
    const keyLink = screen.getByText(/Get a free key at Google AI Studio/i);
    expect(keyLink).toBeInTheDocument();
    expect(keyLink.closest('a')).toHaveAttribute('href', 'https://aistudio.google.com/app/apikey');
  });

  it('closes the settings with Esc before the chat, then returns focus to the launcher', () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer />
      </RaceEngineerProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open AI Race Engineer/i }));
    const chat = screen.getByRole('dialog', { name: 'AI Race Engineer' });
    fireEvent.click(within(chat).getByRole('button', { name: 'AI Settings' }));

    const settings = screen.getByRole('dialog', { name: 'AI Settings' });
    expect(settings).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'AI Settings' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'AI Race Engineer' })).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'AI Race Engineer' })).toBeNull();
    expect(screen.getByRole('button', { name: /Open AI Race Engineer/i })).toHaveFocus();
  });

  it('sends with Enter and adds a new line with Shift+Enter', async () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    const input = screen.getByPlaceholderText('Ask your Race Engineer...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'First line' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(input.value).toBe('First line');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
    expect(await screen.findByText('First line')).toBeInTheDocument();
  });

  it('opens large for reading and remembers it on this browser', () => {
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));

    expect(screen.getByRole('dialog', { name: 'AI Race Engineer' })).toHaveAttribute('data-expanded', 'true');
    expect(localStorage.getItem('f1_ai_engineer_expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Shrink chat' })).toBeInTheDocument();
  });

  it('docks beside the page, making room for it, and remembers it on this browser', () => {
    const { rerender } = render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    const dock = screen.getByRole('button', { name: 'Dock beside the page' });
    expect(dock).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dock);

    const panel = screen.getByRole('complementary', { name: 'AI Race Engineer' });
    expect(panel).toHaveAttribute('data-docked', 'true');
    expect(document.documentElement).toHaveAttribute('data-chat-docked');
    expect(localStorage.getItem('f1_ai_engineer_docked')).toBe('true');
    // Docked it is full height already, so there is no large view to switch to
    expect(screen.queryByRole('button', { name: 'Expand chat' })).toBeNull();

    // Closed, the page takes its whole width back; opened again, it docks again
    rerender(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={false} />
      </RaceEngineerProvider>
    );
    expect(document.documentElement).not.toHaveAttribute('data-chat-docked');
    rerender(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dock beside the page', pressed: true }));
    expect(screen.getByRole('dialog', { name: 'AI Race Engineer' })).toHaveAttribute('data-docked', 'false');
    expect(document.documentElement).not.toHaveAttribute('data-chat-docked');
  });

  it('floats on a window too narrow to dock', () => {
    useDevicePreferencesStore.setState({ chatDocked: true });
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('1100px'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    try {
      render(
        <RaceEngineerProvider>
          <AiRaceEngineer isOpenOverride={true} />
        </RaceEngineerProvider>
      );

      expect(screen.getByRole('dialog', { name: 'AI Race Engineer' })).toHaveAttribute('data-docked', 'false');
      expect(screen.queryByRole('button', { name: 'Dock beside the page' })).toBeNull();
      expect(document.documentElement).not.toHaveAttribute('data-chat-docked');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('displays a friendly missing API key card with links when no key is configured', async () => {
    // Setup config status with NO server key
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/ai') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(aiSettings(false)) });
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
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/ai') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(aiSettings(true)) });
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
    // Let the saved AI settings (with the .env key) load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByPlaceholderText('Ask your Race Engineer...');
    fireEvent.change(input, { target: { value: 'Strategy advice' } });
    fireEvent.submit(input.closest('form')!);

    const errorCard = await screen.findByTestId('ai-error-card');
    expect(errorCard).toBeInTheDocument();
    expect(screen.getByText(/Pit Wall Radio Congested: High Demand/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry Transmission/i)).toBeInTheDocument();
    expect(screen.getByText('Configure in Settings')).toBeInTheDocument();
  });

  it('renders Live Wall badge and live prompt chips on the live page', async () => {
    useSessionStatusStore.setState({ connected: true, session: makeLiveSession({ TrackId: SILVERSTONE_TRACK_ID }) });
    openPage('/live/dashboard', [{ id: 5, track_name: 'Monza' }]);

    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();
    // Must show Live Wall badge (not Comparator!) with the track from the live feed
    expect(screen.getByText('Live Wall')).toBeInTheDocument();
    expect(screen.getByText(/Silverstone/)).toBeInTheDocument();
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
    openPage('/live/dashboard');

    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('Live Wall')).toBeInTheDocument();
    expect(screen.getByText('Radio Check')).toBeInTheDocument();
    expect(screen.getByText('Session Setup Prep')).toBeInTheDocument();
    expect(screen.getByText('Tactical Plan')).toBeInTheDocument();
    // Must not show active race chips when in standby
    expect(screen.queryByText('Current Sector Pace')).toBeNull();
  });

  it('renders Debrief badge and debrief chips on a session page', async () => {
    openPage('/history/42', [{ id: 42, track_name: 'Spa-Francorchamps' }]);

    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );

    expect(screen.getByText('Debrief')).toBeInTheDocument();
    expect(screen.getByText(/Spa-Francorchamps/)).toBeInTheDocument();
    expect(screen.getByText('Session Pace Overview')).toBeInTheDocument();
    expect(screen.getByText('Tyre Stint Degradation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about session pace, stints, or strategy/i)).toBeInTheDocument();
  });

  it('names the session tab the engineer looks at first', () => {
    openPage('/history/42/stints', [{ id: 42, track_name: 'Spa-Francorchamps' }]);
    render(
      <RaceEngineerProvider>
        <AiRaceEngineer isOpenOverride={true} />
      </RaceEngineerProvider>
    );
    expect(screen.getByText('Spa-Francorchamps · Tyres & stints')).toBeInTheDocument();
  });
});
