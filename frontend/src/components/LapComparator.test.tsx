import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { LapComparator } from './LapComparator';

// Mock Recharts to prevent canvas/DOM size errors in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>LineChart {children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ReferenceLine: () => <div />,
  Brush: () => <div />,
}));

describe('LapComparator Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches sessions on mount, opens custom dropdown and displays session items with badges', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' },
      { id: 2, session_uid: '124', track_name: 'Spa-Francorchamps', session_type: 'Sprint Race', created_at: '2026-08-11T14:00:00Z' }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessions),
        });
      }
      if (url === '/api/ai/config-status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_provider: 'gemini', default_model: 'gemini-2.5-flash' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    expect(screen.getByText('Lap Comparator')).toBeInTheDocument();

    // Trigger button for Session A should be rendered
    const trigger = screen.getByTestId('session-selector-trigger');
    expect(trigger).toHaveTextContent('Select Session A...');

    // Wait for sessions to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    // Open Session A dropdown
    fireEvent.click(trigger);

    // Both sessions should be listed in the dropdown menu
    await waitFor(() => {
      expect(screen.getByText('Monaco')).toBeInTheDocument();
      expect(screen.getByText('Spa-Francorchamps')).toBeInTheDocument();
    });
    expect(screen.getByText('Sprint Race')).toHaveClass('badge-orange');
  });

  it('filters sessions using search bar and category tabs in custom dropdown', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' },
      { id: 2, session_uid: '124', track_name: 'Spa-Francorchamps', session_type: 'Sprint Race', created_at: '2026-08-11T14:00:00Z' },
      { id: 3, session_uid: '125', track_name: 'Silverstone', session_type: 'Qualifying 1', created_at: '2026-08-12T10:00:00Z' }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    const trigger = screen.getByTestId('session-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Monaco')).toBeInTheDocument();
    });

    // Search for "Silverstone"
    const searchInput = screen.getByPlaceholderText('Search track, type, date...');
    fireEvent.change(searchInput, { target: { value: 'Silverstone' } });

    expect(screen.getByText('Silverstone')).toBeInTheDocument();
    expect(screen.queryByText('Monaco')).not.toBeInTheDocument();
    expect(screen.queryByText('Spa-Francorchamps')).not.toBeInTheDocument();

    // Clear search and filter by "Sprint" tab
    fireEvent.change(searchInput, { target: { value: '' } });
    const sprintTab = screen.getByRole('button', { name: 'Sprint' });
    fireEvent.click(sprintTab);

    expect(screen.getByText('Spa-Francorchamps')).toBeInTheDocument();
    expect(screen.queryByText('Monaco')).not.toBeInTheDocument();
    expect(screen.queryByText('Silverstone')).not.toBeInTheDocument();
  });

  it('selects session, auto-selects laps and displays driver quick selects and custom lap triggers', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }
    ];

    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 85432, sector1_ms: 28000, sector2_ms: 31000, sector3_ms: 26432, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 305 },
      { id: 102, session_id: 1, car_index: 2, lap_number: 4, lap_time_ms: 86100, sector1_ms: 28200, sector2_ms: 31200, sector3_ms: 26700, is_valid: true, tyre_compound: 'MEDIUM', max_speed_kmh: 301 }
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 1, race_number: 1, ai_controlled: false, nationality: 1 },
      { id: 2, session_id: 1, car_index: 2, name: 'Charles Leclerc', driver_id: 2, team_id: 2, race_number: 16, ai_controlled: false, nationality: 2 }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      }
      if (url === '/api/sessions/1/laps') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      }
      if (url === '/api/sessions/1/participants') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    // Open dropdown and select Monaco session
    const trigger = screen.getByTestId('session-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Monaco')).toBeInTheDocument();
    });

    const monacoOption = screen.getByText('Monaco');
    fireEvent.click(monacoOption);

    // Verify Session A and Session B triggers display Monaco (linked)
    expect(trigger).toHaveTextContent('Monaco');

    // Wait for laps to be fetched and auto-selected
    await waitFor(() => {
      expect(screen.getByTestId('lap-a-trigger')).toHaveTextContent('1:25.432');
      expect(screen.getByTestId('lap-b-trigger')).toHaveTextContent('1:26.100');
    });

    // Quick select bar should render driver names
    expect(screen.getAllByText(/Max Verstappen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Charles Leclerc/).length).toBeGreaterThan(0);
  });

  it('supports unlinking sessions for cross-session comparison and filters Session B to same circuit', async () => {
    const mockSessions = [
      { id: 1, session_uid: '101', track_name: 'Spa-Francorchamps', session_type: 'Practice 1', created_at: '2026-08-10T10:00:00Z' },
      { id: 2, session_uid: '102', track_name: 'Spa-Francorchamps', session_type: 'Qualifying', created_at: '2026-08-10T14:00:00Z' },
      { id: 3, session_uid: '103', track_name: 'Monza', session_type: 'Race', created_at: '2026-08-11T12:00:00Z' }
    ];

    const mockLapsP1 = [
      { id: 201, session_id: 1, car_index: 0, lap_number: 5, lap_time_ms: 105000, is_valid: true, tyre_compound: 'HARD' }
    ];
    const mockLapsQ = [
      { id: 202, session_id: 2, car_index: 0, lap_number: 3, lap_time_ms: 103500, is_valid: true, tyre_compound: 'SOFT' }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLapsP1) });
      if (url === '/api/sessions/2/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLapsQ) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    // Select Spa Practice 1 for Session A
    const triggerA = screen.getByTestId('session-selector-trigger');
    fireEvent.click(triggerA);

    await waitFor(() => {
      expect(screen.getByText('Practice 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Practice 1'));

    // Toggle to Unlink Sessions (Cross-Session mode)
    const syncBtn = screen.getByTestId('session-sync-toggle');
    expect(syncBtn).toHaveTextContent('Linked');
    fireEvent.click(syncBtn);
    expect(syncBtn).toHaveTextContent('Cross-Session');

    // Open Session B selector
    const triggerB = screen.getByTestId('session-b-selector-trigger');
    fireEvent.click(triggerB);

    // Session B popover should show Spa Qualifying but NOT Monza (restricted to same circuit)
    await waitFor(() => {
      expect(screen.getByText('Filtered to Spa-Francorchamps')).toBeInTheDocument();
      expect(screen.getByText('Qualifying')).toBeInTheDocument();
      expect(screen.queryByText('Monza')).not.toBeInTheDocument();
    });

    // Select Qualifying for Session B
    fireEvent.click(screen.getByText('Qualifying'));

    // Verify Session B trigger has Qualifying
    expect(triggerB).toHaveTextContent('Qualifying');
  });

  it('custom lap selector opens popover and allows searching and filtering laps', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Silverstone', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }
    ];

    const mockLaps = [
      { id: 301, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 30000, sector2_ms: 32000, sector3_ms: 28000, is_valid: true, tyre_compound: 'SOFT' },
      { id: 302, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 88500, sector1_ms: 29500, sector2_ms: 31500, sector3_ms: 27500, is_valid: true, tyre_compound: 'SOFT' },
      { id: 303, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 0, is_valid: false, tyre_compound: 'SOFT' }
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 1, team_id: 1, race_number: 44, ai_controlled: false, nationality: 1 }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    fireEvent.click(screen.getByTestId('session-selector-trigger'));
    await waitFor(() => expect(screen.getByText('Silverstone')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Silverstone'));

    // Wait for both Lap A and Lap B selector triggers to be populated with auto-selected laps
    await waitFor(() => {
      expect(screen.getByTestId('lap-a-trigger')).toHaveTextContent('1:28.500');
      expect(screen.getByTestId('lap-b-trigger')).toHaveTextContent('1:30.000');
    });

    // Open Lap A custom popover
    fireEvent.click(screen.getByTestId('lap-a-trigger'));

    // Popover should render search bar and laps
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search driver, lap #, time...')).toBeInTheDocument();
      expect(screen.getAllByText('1:28.500').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1:30.000').length).toBeGreaterThan(0);
    });

    // Test Valid Only filter button
    const validOnlyBtn = screen.getByRole('button', { name: /Valid Only/i });
    fireEvent.click(validOnlyBtn);

    // Invalid lap should be excluded
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();

    // Select Lap 1 option from the open popover
    const lap1Option = screen.getAllByText('1:30.000')[0];
    fireEvent.click(lap1Option);

    // Trigger should now show selected Lap 1
    await waitFor(() => {
      expect(screen.getByTestId('lap-a-trigger')).toHaveTextContent('1:30.000');
    });
  });

  it('ranks drivers in quick select leaderboard, displays P1/P2 badges, leader delta, and supports searching and toggling', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monza', session_type: 'Qualifying', created_at: '2026-08-10T12:00:00Z' }
    ];

    const mockLaps = [
      { id: 401, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 80000, sector1_ms: 26000, sector2_ms: 28000, sector3_ms: 26000, is_valid: true, tyre_compound: 'SOFT' },
      { id: 402, session_id: 1, car_index: 2, lap_number: 1, lap_time_ms: 80500, sector1_ms: 26200, sector2_ms: 28100, sector3_ms: 26200, is_valid: true, tyre_compound: 'MEDIUM' }
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 1, race_number: 1, ai_controlled: false, nationality: 1 },
      { id: 2, session_id: 1, car_index: 2, name: 'Lando Norris', driver_id: 2, team_id: 2, race_number: 4, ai_controlled: false, nationality: 2 }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    fireEvent.click(screen.getByTestId('session-selector-trigger'));
    await waitFor(() => expect(screen.getByText('Monza')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Monza'));

    // Wait for Quick Select panel to render
    await waitFor(() => {
      expect(screen.getByTestId('quick-select-panel')).toBeInTheDocument();
    });

    // Check P1 (Max Verstappen - LEADER) and P2 (Lando Norris - +0.500s)
    expect(screen.getByTestId('rank-badge-1')).toHaveTextContent('P1');
    expect(screen.getByTestId('rank-badge-2')).toHaveTextContent('P2');
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getByText('+0.500s')).toBeInTheDocument();

    // Check Sector timings are rendered
    expect(screen.getAllByText(/S1: 26.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S2: 28.000/).length).toBeGreaterThan(0);

    // Test Search input inside Quick Select
    const searchInput = screen.getByTestId('driver-quick-search-input');
    fireEvent.change(searchInput, { target: { value: 'Norris' } });

    const grid = screen.getByTestId('quick-select-drivers-grid');
    // Norris should be present in grid, Verstappen should be filtered out
    expect(within(grid).getByText(/Lando Norris/)).toBeInTheDocument();
    expect(within(grid).queryByText(/Max Verstappen/)).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(within(grid).getByText(/Max Verstappen/)).toBeInTheDocument();

    // Test collapse toggle button in header
    const collapseBtn = screen.getByTestId('quick-select-collapse-btn');
    expect(collapseBtn).toHaveTextContent('Collapse');
    fireEvent.click(collapseBtn);

    // Now it should be collapsed
    expect(screen.queryByTestId('quick-select-drivers-grid')).not.toBeInTheDocument();
    expect(collapseBtn).toHaveTextContent('Expand');

    // Test toggle via the top toolbar button
    const toolbarBtn = screen.getByTestId('toggle-quick-select-toolbar-btn');
    expect(toolbarBtn).toBeInTheDocument();
    fireEvent.click(toolbarBtn);

    // Grid should expand back
    expect(screen.getByTestId('quick-select-drivers-grid')).toBeInTheDocument();
  });

  it('renders all telemetry charts smoothly when laps have boundary distance differences', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Silverstone', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }
    ];
    const mockLaps = [
      { id: 501, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 30000, sector2_ms: 30000, sector3_ms: 30000, is_valid: true, tyre_compound: 'SOFT' },
      { id: 502, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 91000, sector1_ms: 30500, sector2_ms: 30200, sector3_ms: 30300, is_valid: true, tyre_compound: 'MEDIUM' }
    ];
    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Driver One', race_number: 1, driver_id: 1, team_id: 1, ai_controlled: false, nationality: 1 },
      { id: 2, session_id: 1, car_index: 1, name: 'Driver Two', race_number: 2, driver_id: 2, team_id: 2, ai_controlled: false, nationality: 2 }
    ];

    const mockMergedPoints = [
      { lap_distance: 0, time_delta: 0, timeA: 0, timeB: 0, speedA: 250, speedB: 245, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 6, gearB: 6, ersBatteryA: 80, ersBatteryB: 85, ersDeployModeA: 1, ersDeployModeB: 1, worldX: 10, worldZ: 10 },
      { lap_distance: 2500, time_delta: -0.5, timeA: 45, timeB: 45.5, speedA: 280, speedB: 275, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0.1, steerB: 0.1, gearA: 7, gearB: 7, ersBatteryA: 60, ersBatteryB: 65, ersDeployModeA: 2, ersDeployModeB: 2, worldX: 50, worldZ: 50 },
      { lap_distance: 5320, time_delta: -1.0, timeA: 90, timeB: 91, speedA: 290, speedB: 285, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 8, gearB: 8, ersBatteryA: 40, ersBatteryB: 45, ersDeployModeA: 2, ersDeployModeB: 2, worldX: 10, worldZ: 10 }
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url.includes('/api/comparator/merge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ points: mockMergedPoints, turns: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator initialPreload={{ sessionAId: 1, sessionBId: 1, lapAId: 501, lapBId: 502 }} />);

    // Wait for telemetry charts to render
    await waitFor(() => {
      expect(screen.getAllByText(/Time Delta/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Speed \(KM\/H\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Throttle Application/i)).toBeInTheDocument();
      expect(screen.getByText(/Brake Pressure/i)).toBeInTheDocument();
      expect(screen.getByText(/Gear Selection/i)).toBeInTheDocument();
      expect(screen.getByText(/Steering Angle/i)).toBeInTheDocument();
      expect(screen.getByText(/ERS Battery Store/i)).toBeInTheDocument();
      expect(screen.getByText(/ERS Deploy Mode/i)).toBeInTheDocument();
    });

    // Zoom buttons should be visible and functional
    expect(screen.getByText('Full Track')).toBeInTheDocument();
    expect(screen.getByText('Sector 1')).toBeInTheDocument();
    expect(screen.getByText('Sector 2')).toBeInTheDocument();
    expect(screen.getByText('Sector 3')).toBeInTheDocument();

    // Click Sector 2 zoom
    fireEvent.click(screen.getByText('Sector 2'));
    await waitFor(() => {
      expect(screen.getByText(/Reset Zoom/i)).toBeInTheDocument();
    });
  });
});

