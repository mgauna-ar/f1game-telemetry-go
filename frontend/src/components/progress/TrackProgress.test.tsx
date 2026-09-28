import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../../context/I18nProvider';
import { api } from '../../utils/apiClient';
import { useSessionListStore } from '../../store/useSessionListStore';
import type { TrackProgressResponse } from '../../types/progress';
import { makeProgressSession } from '../../test/wireFactories';
import { TrackProgress } from './TrackProgress';

const response = (fields: Partial<TrackProgressResponse> = {}): TrackProgressResponse => ({
  track: 'Monza',
  tracks: [
    { track_name: 'Monza', sessions: 3, last_session_at: '2026-09-03T18:00:00Z' },
    { track_name: 'Spa', sessions: 1, last_session_at: '2026-08-01T18:00:00Z' },
  ],
  sessions: [
    makeProgressSession({
      session_id: 1,
      session_type: 'Short Qualifying',
      created_at: '2026-09-01T18:00:00Z',
      position: 5,
      best_lap_id: 11,
      best_lap_time_ms: 81_900,
      best_sector1_ms: 26_000,
      best_sector2_ms: 28_000,
      best_sector3_ms: 27_900,
      fastest_lap_id: 12,
      fastest_lap_time_ms: 81_000,
      fastest_driver_name: 'Max Verstappen',
      gap_to_fastest_ms: 900,
    }),
    makeProgressSession({
      session_id: 2,
      session_type: 'Race',
      created_at: '2026-09-02T18:00:00Z',
      position: 3,
      best_lap_id: 21,
      best_lap_time_ms: 81_300,
      best_sector1_ms: 26_100,
      best_sector2_ms: 27_600,
      best_sector3_ms: 27_600,
      fastest_lap_id: 21,
      fastest_lap_time_ms: 81_300,
      gap_to_fastest_ms: 0,
      consistency_ms: 420,
      clean_laps: 8,
      source: 'chosen',
    }),
  ],
  unmatched_sessions: 1,
  ...fields,
});

const renderPage = (url = '/progress') => {
  window.history.replaceState(null, '', url);
  return render(
    <I18nProvider>
      <TrackProgress />
    </I18nProvider>
  );
};

/** The value of a headline figure, by its label. */
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe('TrackProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for the track in the URL, without the old saved driver name', async () => {
    localStorage.setItem('f1_comparator_default_driver_name', JSON.stringify('Hamilton'));
    const get = vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage('/progress/Monza');
    await screen.findByRole('table');
    expect(document.title).toBe('Progress: Monza · F1 Telemetry');
    expect(get).toHaveBeenCalledWith('/api/progress', expect.objectContaining({ params: { track: 'Monza' } }));
  });

  it('shows your personal best, the latest gap and consistency, and every session newest first', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage();

    await screen.findByRole('table');
    expect(stat('Personal best')).toHaveTextContent('1:21.300');
    expect(stat('Gap to the fastest')).toHaveTextContent('Fastest of the session');
    expect(screen.getByText('−0.900s since the first session')).toBeInTheDocument();
    expect(stat('Consistency')).toHaveTextContent('σ 0.420s');
    // Best S1 26.000 + S2 27.600 + S3 27.600
    expect(stat('Theoretical best')).toHaveTextContent('1:21.200');

    const table = screen.getByRole('table', { name: 'Your sessions at Monza' });
    const [race, quali] = within(table).getAllByRole('row').slice(1);
    expect(within(race).getByText('P3')).toBeInTheDocument();
    expect(within(race).getByText('Personal best', { exact: false })).toHaveClass('sr-only');
    expect(within(race).getByText('Fastest')).toHaveAttribute('title', 'Fastest of the session');
    expect(within(race).getByText('Driver chosen by you')).toHaveClass('sr-only');
    expect(within(quali).getByText('+0.900s')).toHaveAttribute('title', 'Max Verstappen');
    expect(within(quali).getByText('26.000')).toBeInTheDocument();
  });

  it('says how many sessions have no driver, and links to them in the list', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage();
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(/1 session at this track is left out: it has no driver picked/);
    const link = within(note).getByRole('link', { name: 'Pick your driver in it' });
    expect(link).toHaveAttribute('href', '/history?quick=noDriver&track=Monza');
    fireEvent.click(link);
    expect(window.location.pathname + window.location.search).toBe('/history?quick=noDriver&track=Monza');
  });

  it('reloads when a driver is picked in a session', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage();
    await screen.findByRole('table');
    expect(get).toHaveBeenCalledTimes(1);
    act(() => useSessionListStore.setState((s) => ({ playerRevision: s.playerRevision + 1 })));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('opens the comparator with your best lap and the fastest, or the session', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage();
    const table = await screen.findByRole('table');
    const quali = within(table).getAllByRole('row')[2];

    fireEvent.click(within(quali).getByRole('button', { name: 'Compare with the fastest lap' }));
    expect(window.location.pathname + window.location.search).toBe('/compare?sa=1&a=11&b=12');

    window.history.replaceState(null, '', '/progress');
    fireEvent.click(within(quali).getByRole('button', { name: 'Open session' }));
    expect(window.location.pathname).toBe('/history/1');
  });

  it('picks another track, and filters by session type', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response());
    renderPage();
    await screen.findByRole('table');

    fireEvent.change(screen.getByRole('combobox', { name: 'Track' }), { target: { value: 'Spa' } });
    expect(window.location.pathname).toBe('/progress/Spa');

    fireEvent.click(screen.getByRole('radio', { name: 'Race' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('explains an empty track and an empty history', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response({ sessions: [], unmatched_sessions: 0 }));
    const { unmount } = renderPage();
    expect(await screen.findByText('None of your sessions at Monza')).toBeInTheDocument();
    unmount();

    get.mockResolvedValue(response({ track: '', tracks: [], sessions: [], unmatched_sessions: 0 }));
    renderPage();
    expect(await screen.findByText('No sessions recorded yet')).toBeInTheDocument();
  });

  it('shows a load error with a retry', async () => {
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('boom')).mockResolvedValue(response());
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your progress');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
