import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionHistory } from './SessionHistory';

describe('SessionHistory Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders historical sessions and KPI bar on mount', async () => {
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
    expect(screen.getByText('TOTAL SESSIONS')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Spa-Francorchamps').length).toBeGreaterThan(0);
    });
  });

  it('filters sessions by search query input and toggles table view', async () => {
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
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Monaco').length).toBeGreaterThan(0);
    });

    // Toggle Table View
    const tableViewBtn = screen.getByTitle('Data Table View');
    fireEvent.click(tableViewBtn);

    // Type "Monaco" in search box
    const searchInput = screen.getByPlaceholderText('Search track, session type...');
    fireEvent.change(searchInput, { target: { value: 'Monaco' } });

    expect(screen.queryByRole('cell', { name: 'Silverstone' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Monaco' })).toBeInTheDocument();
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
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    // Click explore on session
    const exploreBtn = screen.getByRole('button', { name: /Explore Session/i });
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

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory onNavigateToComparator={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

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

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory onNavigateToComparator={onNavigateMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

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

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

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

  it('opens and interacts with AI Race Engineer debrief drawer', async () => {
    const mockSessions = [
      { id: 1, session_uid: '1001', track_name: 'Silverstone', session_type: 'Race', weather: 'Clear', created_at: '2026-08-10T14:00:00Z' },
    ];

    const mockParticipants = [
      { id: 10, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

    const mockLaps = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 28000, sector2_ms: 35000, sector3_ms: 27000, is_valid: true, tyre_compound: 'SOFT' },
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
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

    await waitFor(() => {
      expect(screen.getByText(/AI Race Engineer Debrief/i)).toBeInTheDocument();
    });

    // Open AI Debrief
    fireEvent.click(screen.getByText(/AI Race Engineer Debrief/i));

    await waitFor(() => {
      expect(screen.getByText(/Hello! I am your/i)).toBeInTheDocument();
      expect(screen.getByText(/🏎️ Tyre Strategy Debrief/i)).toBeInTheDocument();
      expect(screen.getByText(/⚡ Sector Performance Breakdown/i)).toBeInTheDocument();
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
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 0, race_number: 1, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Charles Leclerc', driver_id: 3, team_id: 4, race_number: 16, ai_controlled: false },
    ];

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
      expect(screen.getAllByText('Monza').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

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
      { id: 1, session_id: 1, car_index: 0, name: 'Driver DNF', driver_id: 1, team_id: 0, race_number: 1, ai_controlled: false },
      { id: 2, session_id: 1, car_index: 1, name: 'Driver Finisher', driver_id: 2, team_id: 1, race_number: 44, ai_controlled: false },
    ];

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
      expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

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

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/setups') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getAllByText('Spa-Francorchamps').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Session/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Oscar Piastri').length).toBeGreaterThan(0);
    });

    const stintElements = screen.getAllByText('2L');
    expect(stintElements.length).toBe(3);
    expect(screen.getAllByText('➔').length).toBe(2);
  });
});
