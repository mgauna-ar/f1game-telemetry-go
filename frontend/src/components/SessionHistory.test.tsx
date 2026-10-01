import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionHistory } from './SessionHistory';
import { RaceEngineerProvider } from '../context/RaceEngineerProvider';
import { I18nProvider } from '../context/I18nProvider';
import { AiRaceEngineer } from './AiRaceEngineer';
import { useSessionListStore } from '../store/useSessionListStore';
import type { SessionListItem, Participant, Lap, ClassificationResponse } from '../types/session';
import { makeDriverStanding, makeLap, makeParticipant, makePlayerResult, makeSessionListItem } from '../test/wireFactories';

const makeMockClassification = (participants: Participant[], laps: Lap[]): ClassificationResponse => {
  const standings = (participants.length > 0 ? participants : [makeParticipant({
    id: 1, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false
  })]).map((p) => {
    const pLaps = laps.filter((l) => (l.car_index ?? 0) === p.car_index);
    const validLaps = pLaps.filter((l) => l.lap_time_ms > 0 && (l.is_valid ?? true));
    const completedLaps = pLaps.filter((l) => l.lap_time_ms > 0);
    const bestLap =
      validLaps.length > 0
        ? validLaps.reduce((min, l) => (l.lap_time_ms < min.lap_time_ms ? l : min), validLaps[0])
        : completedLaps.length > 0
        ? completedLaps[0]
        : null;
    const totalTime = completedLaps.reduce((acc, l) => acc + l.lap_time_ms, 0);

    const isDNF = Boolean(
      pLaps.some((l) => l.result_status === 4 || l.result_status === 5) ||
      (typeof p.name === 'string' && p.name.toLowerCase().includes('dnf'))
    );
    const isDSQ = pLaps.some((l) => l.result_status === 6);

    const pos = p.position || (pLaps.length > 0 ? pLaps[pLaps.length - 1].car_position || 0 : 0);

    let bestS1 = 0;
    let bestS2 = 0;
    let bestS3 = 0;
    validLaps.forEach((l) => {
      if (l.sector1_ms && l.sector1_ms > 0 && (!bestS1 || l.sector1_ms < bestS1)) bestS1 = l.sector1_ms;
      if (l.sector2_ms && l.sector2_ms > 0 && (!bestS2 || l.sector2_ms < bestS2)) bestS2 = l.sector2_ms;
      if (l.sector3_ms && l.sector3_ms > 0 && (!bestS3 || l.sector3_ms < bestS3)) bestS3 = l.sector3_ms;
    });

    const maxSpd = pLaps.reduce((max, l) => Math.max(max, l.max_speed_kmh || 0), 0);

    return makeDriverStanding({
      position: pos,
      car_index: p.car_index,
      driver_name: p.name,
      race_number: p.race_number,
      team_id: p.team_id,
      best_lap_id: bestLap?.id,
      best_lap_time_ms: bestLap ? bestLap.lap_time_ms : 0,
      last_lap_time_ms: completedLaps.at(-1)?.lap_time_ms ?? 0,
      total_race_time_ms: totalTime,
      total_with_penalties_ms: totalTime,
      positions_gained: 0,
      is_dnf: isDNF,
      is_dsq: isDSQ,
      max_speed: maxSpd,
      best_s1_ms: bestS1,
      best_s2_ms: bestS2,
      best_s3_ms: bestS3,
      theoretical_best_ms: bestS1 + bestS2 + bestS3,
      stints_summary: 'S (2L)',
    });
  });

  standings.sort((a, b) => {
    if (a.is_dnf !== b.is_dnf) return a.is_dnf ? 1 : -1;
    if (a.position > 0 && b.position > 0) return a.position - b.position;
    if (a.best_lap_time_ms && b.best_lap_time_ms && a.best_lap_time_ms > 0 && b.best_lap_time_ms > 0) return a.best_lap_time_ms - b.best_lap_time_ms;
    return (a.car_index ?? 0) - (b.car_index ?? 0);
  });

  standings.forEach((s, i) => {
    s.position = i + 1;
  });

  const s1s = standings.map((s) => s.best_s1_ms ?? 0).filter((v) => v > 0);
  const s2s = standings.map((s) => s.best_s2_ms ?? 0).filter((v) => v > 0);
  const s3s = standings.map((s) => s.best_s3_ms ?? 0).filter((v) => v > 0);
  const bestS1 = s1s.length > 0 ? Math.min(...s1s) : 0;
  const bestS2 = s2s.length > 0 ? Math.min(...s2s) : 0;
  const bestS3 = s3s.length > 0 ? Math.min(...s3s) : 0;

  return {
    standings,
    session_best_s1_ms: bestS1,
    session_best_s2_ms: bestS2,
    session_best_s3_ms: bestS3,
    ultimate_theoretical_ms: bestS1 + bestS2 + bestS3,
    actual_best_lap_ms: standings[0]?.best_lap_time_ms || 0,
    actual_best_lap_driver: standings[0]?.driver_name || '',
    speed_rankings: standings.map((s) => ({
      car_index: s.car_index ?? 0,
      driver_name: s.driver_name ?? '',
      team_id: s.team_id ?? 0,
      max_speed: s.max_speed ?? 0,
      delta_to_top: 0,
    })),
  };
};

const setupFetchMock = (config: {
  sessions?: SessionListItem[];
  participants?: Participant[];
  laps?: Lap[];
  classification?: ClassificationResponse;
  custom?: (url: string, options?: RequestInit) => Promise<unknown> | null;
}) => {
  const { sessions = [], participants = [], laps = [], classification, custom } = config;
  globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (custom) {
      const res = custom(url, options);
      if (res !== null) return res;
    }
    if (url.split('?')[0] === '/api/sessions') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sessions) });
    }
    if (url.endsWith('/participants')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(participants) });
    }
    if (url.endsWith('/laps')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(laps) });
    }
    if (url.endsWith('/detail')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            participants,
            laps,
            classification: classification || makeMockClassification(participants, laps),
            progression: {
              lap_pace: [],
              positions: [],
              gap_to_leader: [],
              drivers: [],
              total_session_laps: 0,
            },
            stints: {
              drivers: [],
              kpis: null,
              degradation_data: [],
              max_tyre_age: 0,
              degradation_rates: {},
              session_compounds: [],
              effective_max_laps: 0,
            },
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
};

describe('SessionHistory Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useSessionListStore.getState().reset();
  });

  it('fetches and renders historical sessions and data table on mount', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({
        id: 1,
        session_uid: '1001',
        track_name: 'Silverstone',
        session_type: 'Race',
        weather: 'Clear ☀️',
        total_laps: 52,
        session_duration: 5400,
        created_at: '2026-08-10T14:00:00Z',
      }),
      makeSessionListItem({
        id: 2,
        session_uid: '1002',
        track_name: 'Spa-Francorchamps',
        session_type: 'Qualifying',
        weather: 'Light Rain 🌧️',
        total_laps: 15,
        session_duration: 3600,
        created_at: '2026-08-10T16:00:00Z',
      }),
    ];

    setupFetchMock({ sessions: mockSessions });

    render(<SessionHistory />);

    expect(screen.getByText('Session Explorer')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Track Name')).toBeInTheDocument();
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Spa-Francorchamps').length).toBeGreaterThan(0);
    });
  });

  it('filters sessions by search query input and supports column sorting', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', total_laps: 52, session_duration: 5400, created_at: '2026-08-10T14:00:00Z' }),
      makeSessionListItem({ id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', total_laps: 20, session_duration: 3600, created_at: '2026-08-10T16:00:00Z' }),
    ];

    setupFetchMock({ sessions: mockSessions });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0);
    });

    // Test sort by track name
    const trackHeader = screen.getByText('Track Name');
    fireEvent.click(trackHeader);

    // Type "Monaco" in search box
    const searchInput = screen.getByPlaceholderText('Search track, session type...');
    fireEvent.change(searchInput, { target: { value: 'Monaco' } });

    expect(screen.queryByRole('rowheader', { name: /Silverstone/i })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Monaco/i })).toBeInTheDocument();
  });

  it('reports the sort order on the column headers and sorts from their buttons', async () => {
    setupFetchMock({
      sessions: [
        makeSessionListItem({ id: 1, track_name: 'Silverstone', created_at: '2026-08-10T14:00:00Z' }),
        makeSessionListItem({ id: 2, track_name: 'Monaco', created_at: '2026-08-10T16:00:00Z' }),
      ],
    });

    render(<SessionHistory />);
    await waitFor(() => expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0));

    const dateHeader = screen.getByRole('columnheader', { name: /Date & Time/i });
    const trackHeader = screen.getByRole('columnheader', { name: /Track Name/i });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    expect(trackHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(trackHeader).getByRole('button', { name: /Track Name/i }));
    expect(trackHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(dateHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(trackHeader).getByRole('button', { name: /Track Name/i }));
    expect(trackHeader).toHaveAttribute('aria-sort', 'descending');

    expect(screen.getByRole('checkbox', { name: 'Select session #2' })).toBeInTheDocument();
  });

  it('selects a session and displays Classification and Driver Standings', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27100, is_valid: true, tyre_compound: 'SOFT', fuel_load: 30.5, max_speed_kmh: 312.4 }),
      makeLap({ id: 202, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 88500, sector1_ms: 27500, sector2_ms: 34500, sector3_ms: 26500, is_valid: true, tyre_compound: 'SOFT', fuel_load: 28.0, max_speed_kmh: 318.0 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    // Click explore on session
    const exploreBtn = screen.getByRole('button', { name: /^Explore:/i });
    fireEvent.click(exploreBtn);
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    // Verify detail header & standings table
    await waitFor(() => {
      expect(screen.getAllByText('Lewis Hamilton').length).toBeGreaterThan(0);
      expect(screen.getAllByText('#44').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1:28.500').length).toBeGreaterThan(0); // Best lap
      expect(screen.getAllByText('2:58.600').length).toBeGreaterThan(0); // Total race time
    });

    // Expand driver laps
    const lapsToggleBtn = screen.getByRole('button', { name: /2 Laps/ });
    fireEvent.click(lapsToggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Recorded Laps for Lewis Hamilton')).toBeInTheDocument();
      expect(screen.getByText('Lap 1')).toBeInTheDocument();
      expect(screen.getByText('Lap 2')).toBeInTheDocument();
    });
  });

  it('opens the comparator URL with a staged Slot A lap', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27100, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 312.4 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Lewis Hamilton').length).toBeGreaterThan(0);
    });

    // Expand laps
    fireEvent.click(screen.getByRole('button', { name: /1 Laps/ }));

    await waitFor(() => {
      expect(screen.getByTitle('Stage Lap 1 into Lap Comparator Slot A')).toBeInTheDocument();
    });

    // Stage Slot A
    fireEvent.click(screen.getByTitle('Stage Lap 1 into Lap Comparator Slot A'));

    // Verify Staging Dock appears
    await waitFor(() => {
      expect(screen.getByText('LAP COMPARATOR STAGING')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Launch Comparator/i })).toBeInTheDocument();
    });

    // Click Launch Comparator
    fireEvent.click(screen.getByRole('button', { name: /Launch Comparator/i }));
    expect(window.location.pathname + window.location.search).toBe('/compare?sa=1&a=201');
  });

  it('stages both Slot A and Slot B, supports swapping, and launches dual comparison', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
      makeParticipant({ id: 11, session_id: 1, car_index: 1, name: 'Max Verstappen', driver_id: 1, team_id: 3, race_number: 1, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 320.0 }),
      makeLap({ id: 202, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 90500, sector1_ms: 28100, sector2_ms: 35200, sector3_ms: 27200, is_valid: true, tyre_compound: 'MEDIUM', max_speed_kmh: 322.0 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Lewis Hamilton').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
    });

    // Expand both drivers
    const lapButtons = screen.getAllByRole('button', { name: /1 Laps/ });
    fireEvent.click(lapButtons[0]);
    fireEvent.click(lapButtons[1]);

    await waitFor(() => {
      expect(screen.getAllByTitle('Stage Lap 1 into Lap Comparator Slot A').length).toBeGreaterThan(0);
      expect(screen.getAllByTitle('Stage Lap 1 into Lap Comparator Slot B').length).toBeGreaterThan(0);
    });

    // Stage Lewis Lap 1 into Slot A
    fireEvent.click(screen.getAllByTitle('Stage Lap 1 into Lap Comparator Slot A')[0]);
    // Stage Max Lap 1 into Slot B
    fireEvent.click(screen.getAllByTitle('Stage Lap 1 into Lap Comparator Slot B')[1]);

    // Verify dock displays both
    await waitFor(() => {
      expect(screen.getByText('2 Laps ready to compare')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Compare 2 Laps/i })).toBeInTheDocument();
    });

    // Swap slots
    const swapBtn = screen.getByRole('button', { name: 'Swap Slot A and Slot B' });
    fireEvent.click(swapBtn);

    // Launch comparison
    fireEvent.click(screen.getByRole('button', { name: /Compare 2 Laps/i }));
    // Both laps are in session 1, so sb is left out
    expect(window.location.pathname + window.location.search).toBe('/compare?sa=1&a=202&b=201');
  });

  it('opens on the story and switches between the detail tabs', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 320.0 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Story' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Pace' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Gap to leader' })).toBeInTheDocument();
    });

    // One tab bar: the story first, the lap charts are tabs of their own
    expect(window.location.pathname).toBe('/history/1');
    expect(screen.getByRole('heading', { name: 'Race engineer debrief' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Pace' }));
    expect(screen.getByText(/Lap-by-Lap Pace Evolution/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/history/1/pace');

    fireEvent.click(screen.getByRole('tab', { name: 'Gap to leader' }));
    expect(screen.getByText(/Gap to Leader Delta/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/history/1/gap');

    // Switch to Sector Matrix tab
    fireEvent.click(screen.getByRole('tab', { name: 'Sectors & speed' }));
    expect(screen.getByText('SESSION ULTIMATE THEORETICAL LAP')).toBeInTheDocument();
    expect(screen.getByText('Speed Trap & Maximum Speeds')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/history/1/sectors');

    // Back to the list
    fireEvent.click(screen.getByRole('button', { name: /Back to/i }));
    expect(window.location.pathname).toBe('/history');
    expect(await screen.findByRole('button', { name: /^Explore:/i })).toBeInTheDocument();
  });

  it('opens the session and tab named in the URL, and leaves an unknown session for the list', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];
    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];
    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 320.0 }),
    ];
    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    window.history.replaceState(null, '', '/history/1/sectors');
    const { unmount } = render(<SessionHistory />);
    expect(await screen.findByText('SESSION ULTIMATE THEORETICAL LAP')).toBeInTheDocument();
    unmount();

    window.history.replaceState(null, '', '/history/99');
    render(<SessionHistory />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/history');
    });
    expect(await screen.findByRole('button', { name: /^Explore:/i })).toBeInTheDocument();
  });

  it('opens and interacts with AI Race Engineer debrief', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT' }),
    ];

    setupFetchMock({
      sessions: mockSessions,
      participants: mockParticipants,
      laps: mockLaps,
    });

    render(
      <RaceEngineerProvider>
        <SessionHistory />
        <AiRaceEngineer />
      </RaceEngineerProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getByText(/AI Race Engineer Debrief/i)).toBeInTheDocument();
    });

    // Click AI Debrief button
    fireEvent.click(screen.getByText(/AI Race Engineer Debrief/i));

    await waitFor(() => {
      expect(screen.getByText('AI Race Engineer')).toBeInTheDocument();
      expect(screen.getByText('Session Pace Overview')).toBeInTheDocument();
      expect(screen.getByText('Tyre Stint Degradation')).toBeInTheDocument();
    });
  });

  it('shows confirmation modal and deletes a session when confirmed', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
      makeSessionListItem({ id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', created_at: '2026-08-10T16:00:00Z' }),
    ];

    let deletedId: string | null = null;

    setupFetchMock({
      sessions: mockSessions,
      custom: (url, options) => {
        if (url.startsWith('/api/sessions/') && options?.method === 'DELETE') {
          deletedId = url.split('/')[3];
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
        }
        return null;
      },
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0);
    });

    // Delete Silverstone (#1) from its "⋯" menu
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Silverstone, session #1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete session' }));

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Session Deletion')).toBeInTheDocument();
      expect(screen.getAllByText(/Silverstone/).length).toBeGreaterThan(0);
    });

    // Click Delete Session inside confirmation modal
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Session' });
    fireEvent.click(confirmDeleteBtn);

    // Verify fetch call for DELETE
    await waitFor(() => {
      expect(deletedId).toBe('1');
      expect(screen.queryByText('Silverstone')).not.toBeInTheDocument();
      expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0);
    });
  });

  it('correctly sorts race standings based on official F1 positions even when final lap is uncompleted', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 0, race_number: 1, position: 1, ai_controlled: false }),
      makeParticipant({ id: 2, session_id: 1, car_index: 1, name: 'Charles Leclerc', driver_id: 3, team_id: 4, race_number: 16, position: 2, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 85000, sector1_ms: 27000, sector2_ms: 30000, sector3_ms: 28000, is_valid: true, car_position: 2 }),
      makeLap({ id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 1, result_status: 3 }),
      makeLap({ id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 80000, sector1_ms: 26000, sector2_ms: 29000, sector3_ms: 25000, is_valid: true, car_position: 1 }),
      makeLap({ id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 2, result_status: 3 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Charles Leclerc').length).toBeGreaterThan(0);
    });

    const driverRows = screen.getAllByRole('row');
    expect(driverRows[1]).toHaveTextContent('P1');
    expect(driverRows[1]).toHaveTextContent('Max Verstappen');
    expect(driverRows[2]).toHaveTextContent('P2');
    expect(driverRows[2]).toHaveTextContent('Charles Leclerc');
  });

  it('places DNF drivers at the bottom of race standings behind all classified finishers', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 1, session_id: 1, car_index: 0, name: 'Driver DNF', driver_id: 1, team_id: 0, race_number: 1, position: 2, ai_controlled: false }),
      makeParticipant({ id: 2, session_id: 1, car_index: 1, name: 'Driver Finisher', driver_id: 2, team_id: 1, race_number: 44, position: 1, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, is_valid: true, car_position: 1, result_status: 2 }),
      makeLap({ id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, is_valid: true, car_position: 1, result_status: 4 }), // DNF
      makeLap({ id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 2 }),
      makeLap({ id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 3 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Driver Finisher').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Driver DNF').length).toBeGreaterThan(0);
    });

    const driverRows = screen.getAllByRole('row');
    expect(driverRows[1]).toHaveTextContent('P1');
    expect(driverRows[1]).toHaveTextContent('Driver Finisher');
    expect(driverRows[2]).toHaveTextContent('P2');
    expect(driverRows[2]).toHaveTextContent('Driver DNF');
    expect(driverRows[2]).toHaveTextContent('DNF');
  });

  it('renders tyre stints sequentially when the same compound is reused across separate stints', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Spa-Francorchamps', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 1, session_id: 1, car_index: 0, name: 'Oscar Piastri', driver_id: 1, team_id: 2, race_number: 81, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 1, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' }),
      makeLap({ id: 2, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' }),
      makeLap({ id: 3, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' }),
      makeLap({ id: 4, session_id: 1, car_index: 0, lap_number: 4, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' }),
      makeLap({ id: 5, session_id: 1, car_index: 0, lap_number: 5, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' }),
      makeLap({ id: 6, session_id: 1, car_index: 0, lap_number: 6, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Spa-Francorchamps').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(screen.getAllByText('Oscar Piastri').length).toBeGreaterThan(0);
    });

    const stintElements = screen.getAllByText('2L');
    expect(stintElements.length).toBe(3);
    expect(document.querySelectorAll('[data-stint-arrow]').length).toBe(2);
  });

  it('renders Official Race Classification and Laps subtable in Spanish when locale is es', async () => {
    localStorage.setItem('f1_telemetry_language', 'es');

    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Interlagos', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Franco Colapinto', driver_id: 43, team_id: 6, race_number: 43, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 301, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 71200, sector1_ms: 18200, sector2_ms: 32000, sector3_ms: 21000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 335.0 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Interlagos').length).toBeGreaterThan(0);
    });

    // Click explore button (Explorar in Spanish)
    fireEvent.click(screen.getByRole('button', { name: /^Explorar:/i }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Clasificación' }));

    await waitFor(() => {
      expect(screen.getAllByText('Franco Colapinto').length).toBeGreaterThan(0);
      expect(screen.getByText('Clasificación Oficial de Carrera')).toBeInTheDocument();
      expect(screen.getByText('PILOTO')).toBeInTheDocument();
      expect(screen.getByText('TIEMPO / DIF.')).toBeInTheDocument();
      expect(screen.getByText('STINTS DE NEUMÁTICOS')).toBeInTheDocument();
      expect(screen.getByText('VUELTA RÁPIDA')).toBeInTheDocument();
      expect(screen.getByText('DETALLES')).toBeInTheDocument();
      expect(screen.getByText('P1 • GANADOR')).toBeInTheDocument();
      expect(screen.getAllByText('MEJOR VUELTA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('VEL. MÁXIMA').length).toBeGreaterThan(0);
    });

    // Expand driver laps button (1 Vueltas)
    const lapsToggleBtn = screen.getByRole('button', { name: /1 Vueltas/i });
    fireEvent.click(lapsToggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Vueltas Registradas de Franco Colapinto')).toBeInTheDocument();
      expect(screen.getByText('Tiempo de Vuelta')).toBeInTheDocument();
      expect(screen.getByText('Acumulado')).toBeInTheDocument();
      expect(screen.getByText('Dif. con Mejor')).toBeInTheDocument();
      expect(screen.getByText('Comparar Telemetría')).toBeInTheDocument();
      expect(screen.getByText('Vuelta 1')).toBeInTheDocument();
      expect(screen.getByText('RÉCORD PERSONAL')).toBeInTheDocument();
      expect(screen.getByText('VÁLIDA')).toBeInTheDocument();
    });
  });

  it('handles exporting a session and importing a .f1session package', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    setupFetchMock({
      sessions: mockSessions,
      custom: (url, options) => {
        if (url === '/api/sessions/1/export') {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['dummy-binary-f1session'], { type: 'application/octet-stream' })),
          });
        }
        if (url === '/api/sessions/import' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'success',
                total: 1,
                imported: 1,
                skipped: 0,
                failed: 0,
                session_ids: [2],
                session_id: 2,
                details: [{ filename: 'session.f1session', status: 'imported', session_id: 2 }],
              }),
          });
        }
        return null;
      },
    });

    // Mock URL.createObjectURL and revokeObjectURL
    const createObjectURLMock = vi.fn(() => 'blob:http://localhost/dummy');
    const revokeObjectURLMock = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
    });

    // 1. Verify Import Button is present
    expect(screen.getByText('Import Session')).toBeInTheDocument();

    // 2. Export from the session's "⋯" menu
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Monza, session #1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export session' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/1/export', expect.anything());
      expect(createObjectURLMock).toHaveBeenCalled();
    });

    // 3. Upload a file via hidden input
    const fileInput = screen.getByLabelText(/Import Session/i, { selector: 'input' }) as HTMLInputElement;
    const dummyFile = new File(['dummy-content'], 'Monza_Race.f1session', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/import', expect.any(Object));
      expect(screen.getByText('Import completed: 1 imported, 0 skipped, 0 failed.')).toBeInTheDocument();
    });
  });

  it('navigates to the Tyre Strategy & Stints tab within a selected session', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', total_laps: 5, session_duration: 5400, created_at: '2026-08-10T14:00:00Z' }),
    ];

    const mockParticipants: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false }),
    ];

    const mockLaps: Lap[] = [
      makeLap({ id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 }),
      makeLap({ id: 202, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 89500, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 }),
      makeLap({ id: 203, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 88500, is_valid: true, tyre_compound: 'HARD', stint: 2 }),
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    // Select the session
    const selectBtn = screen.getByRole('button', { name: /^Explore:/i });
    fireEvent.click(selectBtn);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tyres & stints' })).toBeInTheDocument();
    });

    // Click on Tyre Strategy & Stints tab
    const stintsTabBtn = screen.getByRole('tab', { name: 'Tyres & stints' });
    fireEvent.click(stintsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Field Tyre Strategy Timeline')).toBeInTheDocument();
      expect(screen.getByText('Tyre Degradation & Stint Pace Curves')).toBeInTheDocument();
    });
  });

  it('navigates back to session list when clicking the back to list button', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', total_laps: 5, session_duration: 5400, created_at: '2026-08-10T14:00:00Z' }),
    ];

    setupFetchMock({ sessions: mockSessions });

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    // Select the session
    const selectBtn = screen.getByRole('button', { name: /^Explore:/i });
    fireEvent.click(selectBtn);

    // Verify back button is visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Back to Sessions List/i })).toBeInTheDocument();
    });

    // Click back button
    fireEvent.click(screen.getByRole('button', { name: /Back to Sessions List/i }));

    // Verify returned to list view (Search input is present again)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search track, session type...')).toBeInTheDocument();
    });
  });

  it('supports multi-session selection, batch ZIP export, and batch deletion', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
      makeSessionListItem({ id: 2, session_uid: '1002', track_name: 'Spa', session_type: 'Race', weather: 'Light Rain', created_at: '2026-08-11T14:00:00Z' }),
    ];

    setupFetchMock({
      sessions: mockSessions,
      custom: (url) => {
        if (url === '/api/sessions/export-batch') {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['dummy-zip-data'], { type: 'application/zip' })),
          });
        }
        if (url === '/api/sessions/batch-delete') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'success', deleted_count: 2 }),
          });
        }
        return null;
      },
    });

    const createObjectURLMock = vi.fn(() => 'blob:http://localhost/dummy-zip');
    const revokeObjectURLMock = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Spa').length).toBeGreaterThan(0);
    });

    // 1. Select all via header checkbox
    const selectAllCheckbox = screen.getByTitle('Select all sessions');
    fireEvent.click(selectAllCheckbox);

    // 2. Batch dock should appear with "2 sessions selected" and "Export ZIP (2)"
    await waitFor(() => {
      expect(screen.getByText('2 sessions selected')).toBeInTheDocument();
      expect(screen.getByText('Export ZIP (2)')).toBeInTheDocument();
      expect(screen.getByText('Delete (2)')).toBeInTheDocument();
    });

    // 3. Trigger Batch Export
    const exportZipBtn = screen.getByText('Export ZIP (2)');
    fireEvent.click(exportZipBtn);

    await waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const exportCall = fetchMock.mock.calls.find((call) => call[0] === '/api/sessions/export-batch');
      expect(exportCall).toBeTruthy();
      const parsedBody = JSON.parse(String((exportCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
      expect(parsedBody.session_ids).toHaveLength(2);
      expect(parsedBody.session_ids).toContain(1);
      expect(parsedBody.session_ids).toContain(2);
      expect(createObjectURLMock).toHaveBeenCalled();
    });

    // 4. Click Delete (2) to open batch delete modal
    const deleteBatchBtn = screen.getByText('Delete (2)');
    fireEvent.click(deleteBatchBtn);

    await waitFor(() => {
      expect(screen.getByText('Confirm Batch Deletion')).toBeInTheDocument();
    });

    // 5. Confirm batch deletion inside modal
    const modalDeleteBtn = screen.getAllByText('Delete (2)')[1];
    fireEvent.click(modalDeleteBtn);

    await waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const deleteCall = fetchMock.mock.calls.find((call) => call[0] === '/api/sessions/batch-delete');
      expect(deleteCall).toBeTruthy();
      const parsedBody = JSON.parse(String((deleteCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
      expect(parsedBody.session_ids).toHaveLength(2);
      expect(parsedBody.session_ids).toContain(1);
      expect(parsedBody.session_ids).toContain(2);
    });
  });

  it('handles multi-file / ZIP batch import with summary toast', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' }),
    ];

    setupFetchMock({
      sessions: mockSessions,
      custom: (url, options) => {
        if (url === '/api/sessions/import' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'success',
                total: 3,
                imported: 2,
                skipped: 1,
                failed: 0,
                session_ids: [2, 3],
              }),
          });
        }
        return null;
      },
    });

    const { container } = render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
    });

    // Upload files via hidden file input
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file1 = new File(['data1'], 'monza.f1session', { type: 'application/octet-stream' });
    const file2 = new File(['data2'], 'spa.f1session', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/import', expect.any(Object));
      expect(screen.getByText(/Import completed: 2 imported, 1 skipped, 0 failed/i)).toBeInTheDocument();
    });
  });

  it('loads classification, progression and stints with one detail request when exploring a session', async () => {
    const mockSessions: SessionListItem[] = [
      makeSessionListItem({ id: 42, session_uid: '0xabc42', track_name: 'Monaco', session_type: 'Race', weather: 'Clear', created_at: '2026-08-15T14:00:00Z', total_laps: 78 }),
    ];

    const mockClassification = {
      standings: [
        {
          position: 1,
          car_index: 0,
          driver_name: 'Charles Leclerc',
          race_number: 16,
          team_id: 1,
          best_lap_time_ms: 72400,
          total_race_time_ms: 5600000,
          total_with_penalties_ms: 5600000,
          best_s1_ms: 18500,
          best_s2_ms: 33400,
          best_s3_ms: 20500,
          theoretical_best_ms: 72400,
          max_speed: 295.5,
          is_dnf: false,
          is_dsq: false,
        },
      ],
      session_best_s1_ms: 18500,
      session_best_s2_ms: 33400,
      session_best_s3_ms: 20500,
      ultimate_theoretical_ms: 72400,
      actual_best_lap_ms: 72400,
      actual_best_lap_driver: 'Charles Leclerc',
      speed_rankings: [
        { car_index: 0, driver_name: 'Charles Leclerc', team_id: 1, max_speed: 295.5, delta_to_top: 0.0 },
      ],
    };

    const mockProgression = {
      lap_pace: [{ lapNumber: 1, driver_0: 73.1 }],
      positions: [{ lapNumber: 1, driver_0: 1 }],
      gap_to_leader: [{ lapNumber: 1, driver_0: 0.0 }],
      drivers: [{ car_index: 0, driver_name: 'Charles Leclerc', race_number: 16, team_id: 1, team_color: '#E80020' }],
      total_session_laps: 78,
    };

    const mockStints = {
      drivers: [
        {
          car_index: 0,
          driver_name: 'Charles Leclerc',
          race_number: 16,
          team_id: 1,
          position: 1,
          strategy_string: 'S (18L) ➔ H (60L)',
          total_stints: 2,
          total_pits: 1,
          stints: [],
        },
      ],
      kpis: {
        most_popular_strategy: 'S ➔ H',
        most_popular_count: 1,
        longest_stint: {
          driver_name: 'Charles Leclerc',
          car_index: 0,
          race_number: 16,
          compound: 'HARD',
          total_laps: 60,
        },
        best_laps_by_compound: {
          SOFT: { time_ms: 72400, driver_name: 'Charles Leclerc', car_index: 0 },
        },
        total_field_pit_stops: 1,
      },
      degradation_data: [],
      max_tyre_age: 60,
      degradation_rates: {},
      session_compounds: ['SOFT', 'HARD'],
      effective_max_laps: 78,
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/42/detail') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              participants: [
                makeParticipant({ id: 1, session_id: 42, car_index: 0, name: 'Charles Leclerc', driver_id: 4, team_id: 1, race_number: 16 }),
              ],
              laps: [],
              classification: mockClassification,
              progression: mockProgression,
              stints: mockStints,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(
      <I18nProvider>
        <SessionHistory />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore:/i }));
    // A session opens on its story; the drivers are on the classification tab
    fireEvent.click(await screen.findByRole('tab', { name: /^(Classification|Clasificación)$/ }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/42/detail', expect.anything());
      expect(screen.getAllByText('Charles Leclerc').length).toBeGreaterThan(0);
    });
    // The whole view comes from one request.
    const sessionCalls = vi.mocked(globalThis.fetch).mock.calls.filter(([url]) => String(url).startsWith('/api/sessions/42'));
    expect(sessionCalls).toHaveLength(1);

    // Check Sector Matrix tab
    const sectorsTab = screen.getByRole('tab', { name: 'Sectors & speed' });
    fireEvent.click(sectorsTab);

    await waitFor(() => {
      expect(screen.getByText(/SESSION ULTIMATE THEORETICAL LAP/i)).toBeInTheDocument();
      expect(screen.getAllByText('1:12.400').length).toBeGreaterThan(0);
    });
  });

  it('lists the sessions as cards on a narrow screen', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    try {
      setupFetchMock({
        sessions: [makeSessionListItem({ id: 1, track_name: 'Silverstone', session_type: 'Race' })],
        participants: [],
        laps: [],
      });
      render(<SessionHistory />);

      const list = await screen.findByRole('list', { name: 'Recorded sessions' });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      fireEvent.click(within(list).getByRole('button', { name: 'Explore: Silverstone' }));
      expect(window.location.pathname).toBe('/history/1');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('your car', () => {
    const threeCars: Participant[] = [
      makeParticipant({ id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', team_id: 1, race_number: 44, position: 1 }),
      makeParticipant({ id: 11, session_id: 1, car_index: 1, name: 'Lando Norris', team_id: 8, race_number: 4, position: 2 }),
      makeParticipant({ id: 12, session_id: 1, car_index: 2, name: 'Oscar Piastri', team_id: 8, race_number: 81, position: 3 }),
    ];
    const threeCarLaps: Lap[] = [
      makeLap({ id: 301, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 88_000, is_valid: true }),
      makeLap({ id: 302, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 88_400, is_valid: true }),
      makeLap({ id: 303, session_id: 1, car_index: 2, lap_number: 1, lap_time_ms: 89_000, is_valid: true }),
    ];
    const openSession = async (playerCarIndex: number | null) => {
      setupFetchMock({
        sessions: [
          makeSessionListItem({ id: 1, track_name: 'Silverstone', session_type: 'Race', player_car_index: playerCarIndex }),
        ],
        participants: threeCars,
        laps: threeCarLaps,
      });
      window.history.replaceState(null, '', '/history/1');
      render(<SessionHistory />);
      await screen.findByRole('tab', { name: 'Story', selected: true });
    };
    const openClassification = async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Classification' }));
      await waitFor(() => expect(screen.getAllByText('Oscar Piastri').length).toBeGreaterThan(0));
    };

    it('shows your result in the session table, and the format only where it differs', async () => {
      setupFetchMock({
        sessions: [
          makeSessionListItem(
            { id: 1, track_name: 'Silverstone', session_type: 'Race', packet_format: 2026 },
            { player: makePlayerResult({ position: 2, classified_cars: 20, positions_gained: -1 }) }
          ),
          makeSessionListItem({ id: 2, track_name: 'Monaco', session_type: 'Race', packet_format: 2026 }),
          makeSessionListItem({ id: 3, track_name: 'Spa', session_type: 'Race', packet_format: 2025 }),
        ],
      });
      render(<SessionHistory />);
      const table = await screen.findByRole('table', { name: 'Recorded sessions' });
      expect(within(table).getByRole('columnheader', { name: 'Your result' })).toBeInTheDocument();
      const row = (track: string) => within(table).getByRole('rowheader', { name: new RegExp(track) }).closest('tr')!;
      expect(within(row('Silverstone')).getByText('P2')).toBeInTheDocument();
      expect(within(row('Silverstone')).getByText('1 place lost')).toBeInTheDocument();
      expect(within(row('Monaco')).getByRole('button', { name: 'Pick your driver in Monaco Race' })).toBeInTheDocument();
      expect(within(row('Silverstone')).queryByRole('button', { name: /Pick your driver/ })).not.toBeInTheDocument();
      expect(within(table).queryByText('F1 2026')).not.toBeInTheDocument();
      expect(within(row('Spa')).getByText('F1 2025')).toBeInTheDocument();
    });

    it('sums up your race on the story when the session stored your car', async () => {
      await openSession(1);

      const card = await screen.findByTestId('your-race');
      expect(within(card).getByRole('heading', { name: 'Your race' })).toBeInTheDocument();
      expect(within(card).getByText('Lando Norris')).toBeInTheDocument();
      expect(within(card).getByText('P2')).toBeInTheDocument();
      expect(within(card).getByText('of 3')).toBeInTheDocument();
      expect(within(card).getByText('+0.400s to the fastest')).toBeInTheDocument();
      expect(within(card).getByText('P1 Lewis Hamilton')).toBeInTheDocument();
      expect(within(card).getByText('P3 Oscar Piastri')).toBeInTheDocument();
      expect(within(card).queryByText(/Chosen by you/)).not.toBeInTheDocument();

      fireEvent.click(within(card).getByRole('button', { name: 'Compare with the fastest lap' }));
      expect(window.location.pathname + window.location.search).toBe('/compare?sa=1&a=302&b=301');
    });

    it('marks your row in the classification', async () => {
      await openSession(1);
      await openClassification();
      const table = screen.getByRole('table', { name: /Every driver with position/ });
      const youRows = within(table)
        .getAllByRole('row')
        .filter((row) => within(row).queryByText('YOU'));
      expect(youRows).toHaveLength(1);
      expect(within(youRows[0]).getByText('Lando Norris')).toBeInTheDocument();
    });

    it('lets you pick your driver in a session without one, and follows the pick', async () => {
      // The saved driver name of older versions no longer finds anyone
      localStorage.setItem('f1_comparator_default_driver_name', 'Piastri');
      let listed = makeSessionListItem({ id: 1, track_name: 'Silverstone', session_type: 'Race', player_car_index: null });
      const put = vi.fn();
      setupFetchMock({
        participants: threeCars,
        laps: threeCarLaps,
        custom: (url, options) => {
          if (url === '/api/sessions/1/player' && options?.method === 'PUT') {
            const body = JSON.parse(String(options.body)) as { car_index: number | null };
            put(body);
            listed = { ...listed, player_car_index: body.car_index, player_car_source: body.car_index === null ? null : 'user' };
            return Promise.resolve({ ok: true, json: () => Promise.resolve(listed) });
          }
          if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve([listed]) });
          return null;
        },
      });
      window.history.replaceState(null, '', '/history/1');
      render(<SessionHistory />);

      const note = await screen.findByTestId('no-driver');
      expect(screen.queryByTestId('your-race')).not.toBeInTheDocument();
      fireEvent.click(within(note).getByRole('button', { name: 'Pick your driver' }));

      const dialog = await screen.findByRole('dialog', { name: 'Who were you?' });
      const radios = await within(dialog).findAllByRole('radio');
      // Classification order, then "None"
      expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
        'P1#44Lewis Hamilton',
        'P2#4Lando Norris',
        'P3#81Oscar Piastri',
        "None: I wasn't driving",
      ]);
      const save = within(dialog).getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      fireEvent.click(within(dialog).getByRole('radio', { name: /Oscar Piastri/ }));
      fireEvent.click(save);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(put).toHaveBeenCalledWith({ car_index: 2 });
      const card = await screen.findByTestId('your-race');
      expect(within(card).getByText('Oscar Piastri')).toBeInTheDocument();
      expect(within(card).getByText(/Chosen by you/)).toBeInTheDocument();
      expect(within(card).getByText('P3')).toBeInTheDocument();
      expect(await screen.findByText('Oscar Piastri is now your driver in this session')).toBeInTheDocument();

      // Change, then "None" takes the card away again
      fireEvent.click(within(card).getByRole('button', { name: 'Change your driver' }));
      const again = await screen.findByRole('dialog', { name: 'Who were you?' });
      expect(await within(again).findByRole('radio', { name: /Oscar Piastri/ })).toBeChecked();
      expect(within(again).getByText('Your pick')).toBeInTheDocument();
      fireEvent.click(within(again).getByRole('radio', { name: "None: I wasn't driving" }));
      fireEvent.click(within(again).getByRole('button', { name: 'Save' }));
      await screen.findByTestId('no-driver');
      expect(put).toHaveBeenLastCalledWith({ car_index: null });
    });

    it('offers the old saved name once, and sets your driver in the selected sessions from the batch dock', async () => {
      localStorage.setItem('f1_comparator_default_driver_name', 'Piastri');
      const batches: unknown[] = [];
      setupFetchMock({
        sessions: [
          makeSessionListItem({ id: 7, track_name: 'Silverstone', session_type: 'Race', player_car_index: null }),
          makeSessionListItem({ id: 8, track_name: 'Monza', session_type: 'Race', player_car_index: null }),
          makeSessionListItem({ id: 9, track_name: 'Spa', session_type: 'Race', player_car_index: 0, player_car_source: 'game' }),
        ],
        participants: threeCars,
        laps: threeCarLaps,
        custom: (url, options) => {
          if (url !== '/api/sessions/batch-player') return null;
          batches.push(JSON.parse(String(options?.body)));
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: [7, 8], not_found: [], ambiguous: [] }) });
        },
      });
      window.history.replaceState(null, '', '/history');
      render(<SessionHistory />);

      const notice = await screen.findByRole('region', { name: 'Apply “Piastri” to the 2 sessions without a driver?' });
      fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByRole('region', { name: /Apply “Piastri”/ })).not.toBeInTheDocument();
      expect(localStorage.getItem('f1_comparator_default_driver_name')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'No driver' }));
      fireEvent.click(screen.getByTitle('Select all sessions'));
      fireEvent.click(await screen.findByRole('button', { name: 'Set my driver…' }));

      const dialog = await screen.findByRole('dialog', { name: 'Set my driver' });
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Lando Norris, in 2 of 2 sessions' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to 2' }));

      expect(await within(dialog).findByRole('heading', { name: 'Updated: 2' })).toBeInTheDocument();
      expect(batches).toEqual([{ session_ids: [7, 8], driver_name: 'Lando Norris' }]);
    });

    it('shows no card and no YOU row when your car is unknown', async () => {
      await openSession(null);
      expect(screen.queryByTestId('your-race')).not.toBeInTheDocument();
      expect(screen.getByText(/Which car was yours isn't known/)).toBeInTheDocument();
      await openClassification();
      expect(screen.queryByText('YOU')).not.toBeInTheDocument();
    });
  });
});
