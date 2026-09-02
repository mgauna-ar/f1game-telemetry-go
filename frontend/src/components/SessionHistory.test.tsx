import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionHistory } from './SessionHistory';
import { RaceEngineerProvider } from '../context/RaceEngineerProvider';
import { I18nProvider } from '../context/I18nProvider';
import { AiRaceEngineer } from './AiRaceEngineer';
import type { Session, Participant, Lap, ClassificationResponse } from '../types/session';

const makeMockClassification = (participants: Participant[], laps: Lap[]): ClassificationResponse => {
  const standings = (participants.length > 0 ? participants : [{
    id: 1, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false
  }]).map((p) => {
    const pLaps = laps.filter((l) => (l.car_index ?? 0) === p.car_index);
    const validLaps = pLaps.filter((l) => l.lap_time_ms > 0 && (l.is_valid ?? true));
    const completedLaps = pLaps.filter((l) => l.lap_time_ms > 0);
    const bestLap =
      validLaps.length > 0
        ? validLaps.reduce((min, l) => (l.lap_time_ms < min.lap_time_ms ? l : min), validLaps[0])
        : completedLaps.length > 0
        ? completedLaps[0]
        : null;
    const lastLap = completedLaps.length > 0 ? completedLaps[completedLaps.length - 1] : null;
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

    return {
      position: pos,
      car_index: p.car_index,
      driver_name: p.name,
      race_number: p.race_number,
      team_id: p.team_id,
      team_color: '#DC0000',
      best_lap: bestLap,
      bestLap: bestLap,
      best_lap_time_ms: bestLap ? bestLap.lap_time_ms : 0,
      bestLapTimeMS: bestLap ? bestLap.lap_time_ms : 0,
      last_lap: lastLap,
      lastLap: lastLap,
      last_lap_time_ms: lastLap ? lastLap.lap_time_ms : 0,
      lastLapTimeMS: lastLap ? lastLap.lap_time_ms : 0,
      total_race_time_ms: totalTime,
      totalRaceTimeMS: totalTime,
      total_with_penalties_ms: totalTime,
      totalRaceTimeWithPenalties: totalTime,
      penalty_seconds: 0,
      penaltySeconds: 0,
      positions_gained: 0,
      positionsGained: 0,
      is_dnf: isDNF,
      isDNF: isDNF,
      is_dsq: isDSQ,
      isDSQ: isDSQ,
      max_speed: maxSpd,
      maxSpeed: maxSpd,
      best_s1_ms: bestS1,
      bestS1MS: bestS1,
      best_s2_ms: bestS2,
      bestS2MS: bestS2,
      best_s3_ms: bestS3,
      bestS3MS: bestS3,
      theoretical_best_ms: bestS1 + bestS2 + bestS3,
      theoreticalBestMS: bestS1 + bestS2 + bestS3,
      stints_summary: 'S (2L)',
      laps: pLaps,
      participant: p,
    };
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
  sessions?: Session[];
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
    if (url === '/api/sessions') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sessions) });
    }
    if (url.endsWith('/participants')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(participants) });
    }
    if (url.endsWith('/laps')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(laps) });
    }
    if (url.endsWith('/classification')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(classification || makeMockClassification(participants, laps)),
      });
    }
    if (url.endsWith('/progression')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            lap_pace: [],
            positions: [],
            gap_to_leader: [],
            drivers: [],
            total_session_laps: 0,
          }),
      });
    }
    if (url.endsWith('/stints')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            drivers: [],
            kpis: null,
            degradation_data: [],
            max_tyre_age: 0,
            degradation_rates: {},
            session_compounds: [],
            effective_max_laps: 0,
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
  });

  it('fetches and renders historical sessions and data table on mount', async () => {
    const mockSessions = [
      {
        id: 1,
        session_uid: '1001',
        track_name: 'Silverstone',
        session_type: 'Race',
        weather: 'Clear ☀️',
        total_laps: 52,
        session_duration: 5400,
        created_at: '2026-08-10T14:00:00Z',
      },
      {
        id: 2,
        session_uid: '1002',
        track_name: 'Spa-Francorchamps',
        session_type: 'Qualifying',
        weather: 'Light Rain 🌧️',
        total_laps: 15,
        session_duration: 3600,
        created_at: '2026-08-10T16:00:00Z',
      },
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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', total_laps: 52, session_duration: 5400, created_at: '2026-08-10T14:00:00Z' },
      { id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', total_laps: 20, session_duration: 3600, created_at: '2026-08-10T16:00:00Z' },
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

    expect(screen.queryByRole('cell', { name: /Silverstone/i })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Monaco/i })).toBeInTheDocument();
  });

  it('selects a session and displays Classification and Driver Standings', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27100, is_valid: true, tyre_compound: 'SOFT', fuel_load: 30.5, max_speed_kmh: 312.4 },
      { id: 202, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 88500, sector1_ms: 27500, sector2_ms: 34500, sector3_ms: 26500, is_valid: true, tyre_compound: 'SOFT', fuel_load: 28.0, max_speed_kmh: 318.0 },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    // Click explore on session
    const exploreBtn = screen.getByRole('button', { name: /^Explore$/i });
    fireEvent.click(exploreBtn);

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

  it('triggers onNavigateToComparator when Slot A or Slot B button is clicked on a lap', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27100, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 312.4 },
    ];

    const onNavigateMock = vi.fn();
    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory onNavigateToComparator={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

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
    expect(onNavigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionAId: 1, lapAId: 201 })
    );
  });

  it('stages both Slot A and Slot B, supports swapping, and launches dual comparison', async () => {
    const onNavigateMock = vi.fn();
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
      { id: 11, session_id: 1, car_index: 1, name: 'Max Verstappen', driver_id: 1, team_id: 3, race_number: 1, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 320.0 },
      { id: 202, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 90500, sector1_ms: 28100, sector2_ms: 35200, sector3_ms: 27200, is_valid: true, tyre_compound: 'MEDIUM', max_speed_kmh: 322.0 },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory onNavigateToComparator={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

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
    const swapBtn = screen.getByTitle('Swap Slot A and Slot B');
    fireEvent.click(swapBtn);

    // Launch comparison
    fireEvent.click(screen.getByRole('button', { name: /Compare 2 Laps/i }));
    expect(onNavigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionAId: 1,
        lapAId: 202,
        sessionBId: 1,
        lapBId: 201,
      })
    );
  });

  it('switches between detail tabs: Lap Progression and Sector Matrix', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 320.0 },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

    await waitFor(() => {
      expect(screen.getByText('Classification & Laps')).toBeInTheDocument();
      expect(screen.getByText('Lap Progression & Gap Charts')).toBeInTheDocument();
      expect(screen.getByText('Sector & Speed Matrix')).toBeInTheDocument();
    });

    // Switch to Charts tab
    fireEvent.click(screen.getByText('Lap Progression & Gap Charts'));
    expect(screen.getByText('Lap Pace Progression')).toBeInTheDocument();

    // Switch to Sector Matrix tab
    fireEvent.click(screen.getByText('Sector & Speed Matrix'));
    expect(screen.getByText('SESSION ULTIMATE THEORETICAL LAP')).toBeInTheDocument();
    expect(screen.getByText('Speed Trap & Maximum Speeds')).toBeInTheDocument();
  });

  it('opens and interacts with AI Race Engineer debrief', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT' },
    ];

    setupFetchMock({
      sessions: mockSessions,
      participants: mockParticipants,
      laps: mockLaps,
      custom: (url) => {
        if (url === '/api/ai/config-status') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                has_gemini_env_key: true,
                default_provider: 'gemini',
                default_model: 'gemini-flash-lite-latest',
              }),
          });
        }
        return null;
      },
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

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
      { id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', created_at: '2026-08-10T16:00:00Z' },
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

    // Click delete button for Silverstone (#1)
    const deleteBtn = screen.getByTitle('Delete Session #1');
    fireEvent.click(deleteBtn);

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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 0, race_number: 1, position: 1, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Charles Leclerc', driver_id: 3, team_id: 4, race_number: 16, position: 2, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 85000, sector1_ms: 27000, sector2_ms: 30000, sector3_ms: 28000, is_valid: true, car_position: 2 },
      { id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 1, result_status: 3 },
      { id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 80000, sector1_ms: 26000, sector2_ms: 29000, sector3_ms: 25000, is_valid: true, car_position: 1 },
      { id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 2, result_status: 3 },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Driver DNF', driver_id: 1, team_id: 0, race_number: 1, position: 2, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Driver Finisher', driver_id: 2, team_id: 1, race_number: 44, position: 1, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, is_valid: true, car_position: 1, result_status: 2 },
      { id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, is_valid: true, car_position: 1, result_status: 4 }, // DNF
      { id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 2 },
      { id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 3 },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Spa-Francorchamps', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Oscar Piastri', driver_id: 1, team_id: 2, race_number: 81, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 1, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 2, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 3, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' },
      { id: 4, session_id: 1, car_index: 0, lap_number: 4, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' },
      { id: 5, session_id: 1, car_index: 0, lap_number: 5, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 6, session_id: 1, car_index: 0, lap_number: 6, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' },
    ];

    setupFetchMock({ sessions: mockSessions, participants: mockParticipants, laps: mockLaps });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Spa-Francorchamps').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Oscar Piastri').length).toBeGreaterThan(0);
    });

    const stintElements = screen.getAllByText('2L');
    expect(stintElements.length).toBe(3);
    expect(screen.getAllByText('➔').length).toBe(2);
  });

  it('renders Official Race Classification and Laps subtable in Spanish when locale is es', async () => {
    localStorage.setItem('f1_telemetry_language', 'es');

    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Interlagos', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Franco Colapinto', driver_id: 43, team_id: 6, race_number: 43, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 301, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 71200, sector1_ms: 18200, sector2_ms: 32000, sector3_ms: 21000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 335.0 },
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
    fireEvent.click(screen.getByRole('button', { name: /^Explorar$/i }));

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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
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
            json: () => Promise.resolve({ status: 'success', session_id: 2 }),
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

    // 2. Click Export button on the session card
    const exportBtn = screen.getByTitle('Export Session (.f1session) #1');
    fireEvent.click(exportBtn);

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
      expect(screen.getByText('Session imported successfully!')).toBeInTheDocument();
    });
  });

  it('navigates to the Tyre Strategy & Stints tab within a selected session', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', total_laps: 5, session_duration: 5400, created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90100, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 },
      { id: 202, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 89500, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 },
      { id: 203, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 88500, is_valid: true, tyre_compound: 'HARD', stint: 2 },
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
    const selectBtn = screen.getByRole('button', { name: /^Explore$/i });
    fireEvent.click(selectBtn);

    await waitFor(() => {
      expect(screen.getByText('Tyre Strategy & Stints')).toBeInTheDocument();
    });

    // Click on Tyre Strategy & Stints tab
    const stintsTabBtn = screen.getByText('Tyre Strategy & Stints');
    fireEvent.click(stintsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Field Tyre Strategy Timeline')).toBeInTheDocument();
      expect(screen.getByText('Tyre Degradation & Stint Pace Curves')).toBeInTheDocument();
    });
  });

  it('supports multi-session selection, batch ZIP export, and batch deletion', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
      { id: 2, session_uid: '1002', track_name: 'Spa', session_type: 'Race', weather: 'Light Rain', created_at: '2026-08-11T14:00:00Z' },
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
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
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

  it('fetches and integrates classification, progression, and stints endpoints when exploring session', async () => {
    const mockSessions = [
      { id: 42, session_uid: '0xabc42', track_name: 'Monaco', session_type: 'Race', weather: 'Clear', created_at: '2026-08-15T14:00:00Z', total_laps: 78 },
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
          participant: {
            id: 1,
            session_id: 42,
            car_index: 0,
            name: 'Charles Leclerc',
            driver_id: 4,
            team_id: 1,
            race_number: 16,
            ai_controlled: false,
          },
          laps: [],
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
      if (url === '/api/sessions/42/classification') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockClassification) });
      if (url === '/api/sessions/42/progression') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProgression) });
      if (url === '/api/sessions/42/stints') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStints) });
      if (url === '/api/sessions/42/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url === '/api/sessions/42/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
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

    fireEvent.click(screen.getByRole('button', { name: /^Explore$/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/42/classification', expect.anything());
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/42/progression', expect.anything());
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/42/stints', expect.anything());
      expect(screen.getAllByText('Charles Leclerc').length).toBeGreaterThan(0);
    });

    // Check Sector Matrix tab
    const sectorsTab = screen.getByRole('button', { name: /Sector & Speed/i });
    fireEvent.click(sectorsTab);

    await waitFor(() => {
      expect(screen.getByText(/SESSION ULTIMATE THEORETICAL LAP/i)).toBeInTheDocument();
      expect(screen.getAllByText('1:12.400').length).toBeGreaterThan(0);
    });
  });
});
