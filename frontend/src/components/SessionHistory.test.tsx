import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionHistory } from './SessionHistory';

describe('SessionHistory Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders historical sessions on mount', async () => {
    const mockSessions = [
      {
        id: 1,
        session_uid: '1001',
        track_name: 'Silverstone',
        session_type: 'Race',
        weather: 'Clear ☀️',
        created_at: '2026-08-10T14:00:00Z',
      },
      {
        id: 2,
        session_uid: '1002',
        track_name: 'Spa-Francorchamps',
        session_type: 'Qualifying',
        weather: 'Light Rain 🌧️',
        created_at: '2026-08-10T16:00:00Z',
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessions),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch url: ${url}`));
    });

    render(<SessionHistory />);

    expect(screen.getByText('Session Explorer')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Silverstone')).toBeInTheDocument();
      expect(screen.getByText('Spa-Francorchamps')).toBeInTheDocument();
    });
  });

  it('filters sessions by search query input', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
      { id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', created_at: '2026-08-10T16:00:00Z' },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Silverstone')).toBeInTheDocument();
      expect(screen.getByText('Monaco')).toBeInTheDocument();
    });

    // Type "Monaco" in search box
    const searchInput = screen.getByPlaceholderText('Search track name, session type...');
    fireEvent.change(searchInput, { target: { value: 'Monaco' } });

    expect(screen.queryByText('Silverstone')).not.toBeInTheDocument();
    expect(screen.getByText('Monaco')).toBeInTheDocument();
  });

  it('selects a session and fetches participants, laps, and setups for detail view', async () => {
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

    const mockSetups = [
      { id: 301, session_id: 1, car_index: 0, front_wing: 28, rear_wing: 22, on_throttle: 75, off_throttle: 50, front_camber: -3.0, rear_camber: -1.5, front_toe: 0.05, rear_toe: 0.2, front_suspension: 8, rear_suspension: 6, front_anti_roll_bar: 7, rear_anti_roll_bar: 5, front_suspension_height: 3, rear_suspension_height: 5, brake_pressure: 100, brake_bias: 56, front_tyre_pressure: 23.5, rear_tyre_pressure: 21.0, ballast: 0, fuel_load: 30.5 },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      }
      if (url === '/api/sessions/1/participants') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      }
      if (url === '/api/sessions/1/laps') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      }
      if (url === '/api/sessions/1/setups') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSetups) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Silverstone')).toBeInTheDocument();
    });

    // Click explore on session
    const exploreBtn = screen.getByText('Explore');
    fireEvent.click(exploreBtn);

    // Verify detail header & standings table
    await waitFor(() => {
      expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
      expect(screen.getByText('#44')).toBeInTheDocument();
      expect(screen.getByText('BEST LAP')).toBeInTheDocument();
      expect(screen.getByText('LAST LAP')).toBeInTheDocument();
      expect(screen.getAllByText('1:28.500').length).toBeGreaterThan(0); // Best lap / Last lap
      expect(screen.getByText('DELTA')).toBeInTheDocument();
      expect(screen.getByText('TOTAL RACE TIME')).toBeInTheDocument();
      expect(screen.getByText('LEADER')).toBeInTheDocument();
    });

    // Expand driver laps
    const lapsToggleBtn = screen.getByRole('button', { name: /2 Laps/ });
    fireEvent.click(lapsToggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Recorded Laps for Lewis Hamilton')).toBeInTheDocument();
      expect(screen.getByText('Lap 1')).toBeInTheDocument();
      expect(screen.getByText('Lap 2')).toBeInTheDocument();
    });

    // Click Setup icon button next to Lewis Hamilton
    const setupBtn = screen.getByTitle('View Setup for Lewis Hamilton');
    fireEvent.click(setupBtn);

    await waitFor(() => {
      expect(screen.getByText(/Car Setup Details — Lewis Hamilton/)).toBeInTheDocument();
      expect(screen.getByText('Aerodynamics & Wings')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument(); // Front wing
      expect(screen.getByText('22')).toBeInTheDocument(); // Rear wing
    });
  });

  it('shows confirmation modal and deletes a session when confirmed', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
      { id: 2, session_uid: '1002', track_name: 'Monaco', session_type: 'Qualifying', weather: 'Clear', created_at: '2026-08-10T16:00:00Z' },
    ];

    let deletedId: string | null = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url === '/api/sessions') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      }
      if (url.startsWith('/api/sessions/') && options?.method === 'DELETE') {
        deletedId = url.split('/')[3];
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Silverstone')).toBeInTheDocument();
      expect(screen.getByText('Monaco')).toBeInTheDocument();
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
      expect(screen.getByText('Monaco')).toBeInTheDocument();
    });
  });

  it('correctly sorts race standings based on official F1 positions even when final lap is uncompleted (lap_time_ms=0)', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Monza', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 0, race_number: 1, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Charles Leclerc', driver_id: 3, team_id: 4, race_number: 16, ai_controlled: false },
    ];

    // Car 0 has completed Lap 1 (85s) and has Lap 2 in-progress (lap_time_ms=0, car_position=1, result_status=3)
    // Car 1 has completed Lap 1 (80s, faster lap time than Car 0) and has Lap 2 in-progress (lap_time_ms=0, car_position=2, result_status=3)
    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 85000, sector1_ms: 27000, sector2_ms: 30000, sector3_ms: 28000, is_valid: true, car_position: 2 },
      { id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 1, result_status: 3 },
      { id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 80000, sector1_ms: 26000, sector2_ms: 29000, sector3_ms: 25000, is_valid: true, car_position: 1 },
      { id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 0, sector1_ms: 0, sector2_ms: 0, sector3_ms: 0, is_valid: true, car_position: 2, result_status: 3 },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Monza')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Explore'));

    await waitFor(() => {
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
    });

    // P1 should be Max Verstappen (officialPos = 1) even though Charles Leclerc had a faster completed lap time on lap 1
    const driverRows = screen.getAllByRole('row');
    // First body row should be P1 Max Verstappen
    expect(driverRows[1]).toHaveTextContent('P1');
    expect(driverRows[1]).toHaveTextContent('Max Verstappen');
    // Second body row should be P2 Charles Leclerc
    expect(driverRows[2]).toHaveTextContent('P2');
    expect(driverRows[2]).toHaveTextContent('Charles Leclerc');
  });

  it('places DNF drivers at the bottom of race standings behind all classified finishers', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Driver DNF', driver_id: 1, team_id: 0, race_number: 1, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Driver Finisher', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    // Driver DNF (Car 0) retired on Lap 2 (result_status = 4, officialPos = 1 when retired)
    // Driver Finisher (Car 1) finished 10 laps (result_status = 3, officialPos = 2)
    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, is_valid: true, car_position: 1, result_status: 2 },
      { id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 0, is_valid: true, car_position: 1, result_status: 4 }, // DNF
      { id: 201, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 2 },
      { id: 202, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 91000, is_valid: true, car_position: 2, result_status: 3 },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Silverstone')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Explore'));

    await waitFor(() => {
      expect(screen.getByText('Driver Finisher')).toBeInTheDocument();
      expect(screen.getByText('Driver DNF')).toBeInTheDocument();
    });

    const driverRows = screen.getAllByRole('row');
    // First body row must be Driver Finisher (P1)
    expect(driverRows[1]).toHaveTextContent('P1');
    expect(driverRows[1]).toHaveTextContent('Driver Finisher');
    // Second body row must be Driver DNF (P2)
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

    // Piastri strategy: Lap 1-2 MEDIUM, Lap 3-4 HARD, Lap 5-6 MEDIUM again
    const mockLaps = [
      { id: 1, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 2, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 100000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 3, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' },
      { id: 4, session_id: 1, car_index: 0, lap_number: 4, lap_time_ms: 101000, is_valid: true, tyre_compound: 'HARD' },
      { id: 5, session_id: 1, car_index: 0, lap_number: 5, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' },
      { id: 6, session_id: 1, car_index: 0, lap_number: 6, lap_time_ms: 99000, is_valid: true, tyre_compound: 'MEDIUM' },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Spa-Francorchamps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Explore'));

    await waitFor(() => {
      expect(screen.getByText('Oscar Piastri')).toBeInTheDocument();
    });

    // Should render 2L for first Medium stint, 2L for Hard stint, and 2L for second Medium stint
    const stintElements = screen.getAllByText('2L');
    expect(stintElements.length).toBe(3); // Stint 1: 2L (Medium), Stint 2: 2L (Hard), Stint 3: 2L (Medium)
    expect(screen.getAllByText('➔').length).toBe(2); // 2 stint transition arrows
  });

  it('splits consecutive stints using the same compound when stint IDs are provided', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Zandvoort', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Lando Norris', driver_id: 1, team_id: 2, race_number: 4, ai_controlled: false },
    ];

    // Norris strategy: Stint 1 (Laps 1-3, MEDIUM), Stint 2 (Laps 4-7, MEDIUM set 2 after pit stop)
    const mockLaps = [
      { id: 1, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 70000, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 },
      { id: 2, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 70000, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 },
      { id: 3, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 70000, is_valid: true, tyre_compound: 'MEDIUM', stint: 1 },
      { id: 4, session_id: 1, car_index: 0, lap_number: 4, lap_time_ms: 71000, is_valid: true, tyre_compound: 'MEDIUM', stint: 2 },
      { id: 5, session_id: 1, car_index: 0, lap_number: 5, lap_time_ms: 71000, is_valid: true, tyre_compound: 'MEDIUM', stint: 2 },
      { id: 6, session_id: 1, car_index: 0, lap_number: 6, lap_time_ms: 71000, is_valid: true, tyre_compound: 'MEDIUM', stint: 2 },
      { id: 7, session_id: 1, car_index: 0, lap_number: 7, lap_time_ms: 71000, is_valid: true, tyre_compound: 'MEDIUM', stint: 2 },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText('Zandvoort')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Explore'));

    await waitFor(() => {
      expect(screen.getByText('Lando Norris')).toBeInTheDocument();
    });

    // Should render 3L for Stint 1 (Medium) and 4L for Stint 2 (Medium), separated by an arrow
    expect(screen.getByText('3L')).toBeInTheDocument();
    expect(screen.getByText('4L')).toBeInTheDocument();
    expect(screen.getByText('➔')).toBeInTheDocument();
  });
});


