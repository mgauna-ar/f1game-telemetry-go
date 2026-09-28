import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { LapComparator } from './LapComparator';
import { useSessionListStore } from '../store/useSessionListStore';
import { makeLap, makeParticipant, makePlayerResult, makeSessionListItem } from '../test/wireFactories';
import { RaceEngineerActionsContext, type RaceEngineerActionsContextValue } from '../context/RaceEngineerContext';
import type { MergedTelemetryPoint, TrackTurn } from '../types/comparator';

// Mock Recharts to prevent canvas/DOM size errors in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>LineChart {children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ReferenceLine: () => <div />,
  ReferenceArea: () => <div />,
  Brush: () => <div />,
}));

describe('LapComparator Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSessionListStore.getState().reset();
  });

  it('fetches sessions on mount, opens custom dropdown and displays session items with badges', async () => {
    const mockSessions = [
      makeSessionListItem({ id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }),
      makeSessionListItem({
        id: 2,
        session_uid: '124',
        track_name: 'Spa-Francorchamps',
        session_type: 'Sprint Race',
        created_at: '2026-08-11T14:00:00Z',
      }),
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessions),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    expect(screen.getByText('Lap Comparator')).toBeInTheDocument();

    // Trigger button for Session A should be rendered
    const trigger = screen.getByTestId('session-selector-trigger');
    expect(trigger).toHaveTextContent('Select Reference Session...');

    // Wait for sessions to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    // Open Session A dropdown
    fireEvent.click(trigger);

    // Both sessions should be listed in the dropdown menu
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Monaco/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Spa-Francorchamps/ })).toBeInTheDocument();
    });
    expect(screen.getByText('Sprint Race').closest('[data-tone]')).toHaveAttribute('data-tone', 'orange');
  });

  it('filters sessions using search bar and category tabs in custom dropdown', async () => {
    const mockSessions = [
      makeSessionListItem({ id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }),
      makeSessionListItem({
        id: 2,
        session_uid: '124',
        track_name: 'Spa-Francorchamps',
        session_type: 'Sprint Race',
        created_at: '2026-08-11T14:00:00Z',
      }),
      makeSessionListItem({
        id: 3,
        session_uid: '125',
        track_name: 'Silverstone',
        session_type: 'Qualifying 1',
        created_at: '2026-08-12T10:00:00Z',
      }),
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
      expect(screen.getByRole('option', { name: /Monaco/ })).toBeInTheDocument();
    });

    // Search for "Silverstone"
    const searchInput = screen.getByPlaceholderText('Search track, type, date...');
    fireEvent.change(searchInput, { target: { value: 'Silverstone' } });

    expect(screen.getByRole('option', { name: /Silverstone/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Monaco/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Spa-Francorchamps/ })).not.toBeInTheDocument();

    // Clear search and filter by "Sprint" tab
    fireEvent.change(searchInput, { target: { value: '' } });
    const sprintTab = screen.getByRole('radio', { name: 'Sprint' });
    fireEvent.click(sprintTab);

    expect(screen.getByRole('option', { name: /Spa-Francorchamps/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Monaco/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Silverstone/ })).not.toBeInTheDocument();
  });

  it('selects session, auto-selects laps and displays driver quick selects and custom lap triggers', async () => {
    const mockSessions = [
      makeSessionListItem({ id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }),
    ];

    const mockLaps = [
      {
        id: 101,
        session_id: 1,
        car_index: 0,
        lap_number: 3,
        lap_time_ms: 85432,
        sector1_ms: 28000,
        sector2_ms: 31000,
        sector3_ms: 26432,
        is_valid: true,
        tyre_compound: 'SOFT',
        max_speed_kmh: 305,
      },
      {
        id: 102,
        session_id: 1,
        car_index: 2,
        lap_number: 4,
        lap_time_ms: 86100,
        sector1_ms: 28200,
        sector2_ms: 31200,
        sector3_ms: 26700,
        is_valid: true,
        tyre_compound: 'MEDIUM',
        max_speed_kmh: 301,
      },
    ];

    const mockParticipants = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 1,
        race_number: 1,
        ai_controlled: false,
        nationality: 1,
      },
      {
        id: 2,
        session_id: 1,
        car_index: 2,
        name: 'Charles Leclerc',
        driver_id: 2,
        team_id: 2,
        race_number: 16,
        ai_controlled: false,
        nationality: 2,
      },
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
      expect(screen.getByRole('option', { name: /Monaco/ })).toBeInTheDocument();
    });

    const monacoOption = screen.getByRole('option', { name: /Monaco/ });
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
      makeSessionListItem({
        id: 1,
        session_uid: '101',
        track_name: 'Spa-Francorchamps',
        session_type: 'Practice 1',
        created_at: '2026-08-10T10:00:00Z',
      }),
      makeSessionListItem({
        id: 2,
        session_uid: '102',
        track_name: 'Spa-Francorchamps',
        session_type: 'Qualifying',
        created_at: '2026-08-10T14:00:00Z',
      }),
      makeSessionListItem({ id: 3, session_uid: '103', track_name: 'Monza', session_type: 'Race', created_at: '2026-08-11T12:00:00Z' }),
    ];

    const mockLapsP1 = [
      {
        id: 201,
        session_id: 1,
        car_index: 0,
        lap_number: 5,
        lap_time_ms: 105000,
        is_valid: true,
        tyre_compound: 'HARD',
      },
    ];
    const mockLapsQ = [
      {
        id: 202,
        session_id: 2,
        car_index: 0,
        lap_number: 3,
        lap_time_ms: 103500,
        is_valid: true,
        tyre_compound: 'SOFT',
      },
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
      makeSessionListItem({
        id: 1,
        session_uid: '123',
        track_name: 'Silverstone',
        session_type: 'Race',
        created_at: '2026-08-10T12:00:00Z',
      }),
    ];

    const mockLaps = [
      {
        id: 301,
        session_id: 1,
        car_index: 0,
        lap_number: 1,
        lap_time_ms: 90000,
        sector1_ms: 30000,
        sector2_ms: 32000,
        sector3_ms: 28000,
        is_valid: true,
        tyre_compound: 'SOFT',
      },
      {
        id: 302,
        session_id: 1,
        car_index: 0,
        lap_number: 2,
        lap_time_ms: 88500,
        sector1_ms: 29500,
        sector2_ms: 31500,
        sector3_ms: 27500,
        is_valid: true,
        tyre_compound: 'SOFT',
      },
      { id: 303, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 0, is_valid: false, tyre_compound: 'SOFT' },
    ];

    const mockParticipants = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Lewis Hamilton',
        driver_id: 1,
        team_id: 1,
        race_number: 44,
        ai_controlled: false,
        nationality: 1,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants')
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
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

    // Popover should render laps
    await waitFor(() => {
      expect(screen.getByTestId('slot-a-lap-popover')).toBeInTheDocument();
      expect(screen.getAllByText('1:28.500').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1:30.000').length).toBeGreaterThan(0);
    });

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
      makeSessionListItem({
        id: 1,
        session_uid: '123',
        track_name: 'Monza',
        session_type: 'Qualifying',
        created_at: '2026-08-10T12:00:00Z',
      }),
    ];

    const mockLaps = [
      {
        id: 401,
        session_id: 1,
        car_index: 0,
        lap_number: 1,
        lap_time_ms: 80000,
        sector1_ms: 26000,
        sector2_ms: 28000,
        sector3_ms: 26000,
        is_valid: true,
        tyre_compound: 'SOFT',
      },
      {
        id: 402,
        session_id: 1,
        car_index: 2,
        lap_number: 1,
        lap_time_ms: 80500,
        sector1_ms: 26200,
        sector2_ms: 28100,
        sector3_ms: 26200,
        is_valid: true,
        tyre_compound: 'MEDIUM',
      },
    ];

    const mockParticipants = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 1,
        race_number: 1,
        ai_controlled: false,
        nationality: 1,
      },
      {
        id: 2,
        session_id: 1,
        car_index: 2,
        name: 'Lando Norris',
        driver_id: 2,
        team_id: 2,
        race_number: 4,
        ai_controlled: false,
        nationality: 2,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants')
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<LapComparator />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.anything());
    });

    fireEvent.click(screen.getByTestId('session-selector-trigger'));
    await waitFor(() => expect(screen.getByText('Monza')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Monza'));

    // Wait for Quick Select panel to render: both laps get picked, so it folds away
    await waitFor(() => {
      expect(screen.getByTestId('quick-select-panel')).toBeInTheDocument();
    });
    await waitFor(() => expect(screen.queryByTestId('quick-select-drivers-grid')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('toggle-quick-select-toolbar-btn'));

    // Check P1 (Max Verstappen - LEADER) and P2 (Lando Norris - +0.500s)
    expect(screen.getByTestId('rank-badge-1')).toHaveTextContent('P1');
    expect(screen.getByTestId('rank-badge-2')).toHaveTextContent('P2');
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getAllByText('+0.500s').length).toBeGreaterThan(0);

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
      makeSessionListItem({
        id: 1,
        session_uid: '123',
        track_name: 'Silverstone',
        session_type: 'Race',
        created_at: '2026-08-10T12:00:00Z',
      }),
    ];
    const mockLaps = [
      {
        id: 501,
        session_id: 1,
        car_index: 0,
        lap_number: 1,
        lap_time_ms: 90000,
        sector1_ms: 30000,
        sector2_ms: 30000,
        sector3_ms: 30000,
        is_valid: true,
        tyre_compound: 'SOFT',
      },
      {
        id: 502,
        session_id: 1,
        car_index: 1,
        lap_number: 1,
        lap_time_ms: 91000,
        sector1_ms: 30500,
        sector2_ms: 30200,
        sector3_ms: 30300,
        is_valid: true,
        tyre_compound: 'MEDIUM',
      },
    ];
    const mockParticipants = [
      {
        id: 1,
        session_id: 1,
        car_index: 0,
        name: 'Driver One',
        race_number: 1,
        driver_id: 1,
        team_id: 1,
        ai_controlled: false,
        nationality: 1,
      },
      {
        id: 2,
        session_id: 1,
        car_index: 1,
        name: 'Driver Two',
        race_number: 2,
        driver_id: 2,
        team_id: 2,
        ai_controlled: false,
        nationality: 2,
      },
    ];

    const mockMergedPoints = [
      {
        lap_distance: 0,
        time_delta: 0,
        timeA: 0,
        timeB: 0,
        speedA: 250,
        speedB: 245,
        throttleA: 1,
        throttleB: 1,
        brakeA: 0,
        brakeB: 0,
        steerA: 0,
        steerB: 0,
        gearA: 6,
        gearB: 6,
        ersBatteryA: 80,
        ersBatteryB: 85,
        ersDeployModeA: 1,
        ersDeployModeB: 1,
        worldX: 10,
        worldZ: 10,
      },
      {
        lap_distance: 2500,
        time_delta: -0.5,
        timeA: 45,
        timeB: 45.5,
        speedA: 280,
        speedB: 275,
        throttleA: 1,
        throttleB: 1,
        brakeA: 0,
        brakeB: 0,
        steerA: 0.1,
        steerB: 0.1,
        gearA: 7,
        gearB: 7,
        ersBatteryA: 60,
        ersBatteryB: 65,
        ersDeployModeA: 2,
        ersDeployModeB: 2,
        worldX: 50,
        worldZ: 50,
      },
      {
        lap_distance: 5320,
        time_delta: -1.0,
        timeA: 90,
        timeB: 91,
        speedA: 290,
        speedB: 285,
        throttleA: 1,
        throttleB: 1,
        brakeA: 0,
        brakeB: 0,
        steerA: 0,
        steerB: 0,
        gearA: 8,
        gearB: 8,
        ersBatteryA: 40,
        ersBatteryB: 45,
        ersDeployModeA: 2,
        ersDeployModeB: 2,
        worldX: 10,
        worldZ: 10,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLaps) });
      if (url === '/api/sessions/1/participants')
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockParticipants) });
      if (url.includes('/api/comparator/merge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ points: mockMergedPoints, turns: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    window.history.replaceState(null, '', '/compare?sa=1&a=501&b=502');
    render(<LapComparator />);

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

    // The laps from the URL stay in it once loaded
    expect(window.location.search).toBe('?sa=1&a=501&b=502');

    // Click Sector 2 zoom; the zoomed stretch goes into the URL
    fireEvent.click(screen.getByText('Sector 2'));
    await waitFor(() => {
      expect(screen.getByText(/Reset Zoom/i)).toBeInTheDocument();
    });
    expect(window.location.search).toMatch(/^\?sa=1&a=501&b=502&zoom=\d+-\d+$/);

    // The compact strips replace the cards, and the choice is remembered on this device
    fireEvent.click(screen.getByRole('radio', { name: /Strips/ }));
    expect(screen.getByRole('list', { name: 'Telemetry strips' })).toBeInTheDocument();
    expect(screen.queryByText(/Gear Selection/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('f1_comparator_chart_view')).toContain('strips');
    localStorage.removeItem('f1_comparator_chart_view');
  });

  it("defaults slot A to your best lap from the session's stored car, and slot B to the fastest", async () => {
    // An old saved driver name points at the fastest driver, but the session stored car 1 as yours
    localStorage.setItem('f1_comparator_default_driver_name', 'Verstappen');
    const sessions = [makeSessionListItem({ id: 1, track_name: 'Monaco', session_type: 'Race', player_car_index: 1 })];
    const participants = [
      makeParticipant({ session_id: 1, car_index: 0, name: 'Max Verstappen', race_number: 1 }),
      makeParticipant({ session_id: 1, car_index: 1, name: 'Charles Leclerc', race_number: 16 }),
    ];
    const laps = [
      makeLap({ id: 11, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 85_432 }),
      makeLap({ id: 12, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 86_100 }),
    ];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.split('?')[0] === '/api/sessions') {
        // The list arrives after the laps would have
        return new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: () => Promise.resolve(sessions) }), 20)
        );
      }
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(laps) });
      if (url === '/api/sessions/1/participants') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(participants) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    window.history.replaceState(null, '', '/compare?sa=1');
    render(<LapComparator />);

    await waitFor(() => {
      expect(screen.getByTestId('lap-a-trigger')).toHaveTextContent('1:26.100');
      expect(screen.getByTestId('lap-b-trigger')).toHaveTextContent('1:25.432');
    });
    localStorage.clear();
  });

  it('offers quick-start comparisons before any lap is picked, and opens one', async () => {
    const sessions = [
      makeSessionListItem(
        { id: 1, track_name: 'Monaco', session_type: 'Race', player_car_index: 1 },
        {
          player: makePlayerResult({ car_index: 1, best_lap_id: 12, best_lap_time_ms: 86_100 }),
          fastest_lap: { car_index: 0, driver_name: 'Max Verstappen', team_id: 0, race_number: 1, lap_id: 11, lap_time_ms: 85_432 },
        }
      ),
    ];
    const participants = [
      makeParticipant({ session_id: 1, car_index: 0, name: 'Max Verstappen', race_number: 1 }),
      makeParticipant({ session_id: 1, car_index: 1, name: 'Charles Leclerc', race_number: 16 }),
    ];
    const laps = [
      makeLap({ id: 11, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 85_432 }),
      makeLap({ id: 12, session_id: 1, car_index: 1, lap_number: 1, lap_time_ms: 86_100 }),
    ];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.split('?')[0] === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(sessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(laps) });
      if (url === '/api/sessions/1/participants') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(participants) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    window.history.replaceState(null, '', '/compare');
    render(<LapComparator />);

    const card = await screen.findByRole('button', { name: /My best vs the fastest/ });
    expect(card).toHaveTextContent('1:26.100');
    expect(card).toHaveTextContent('+0.668 s');
    fireEvent.click(card);

    await waitFor(() => {
      expect(screen.getByTestId('lap-a-trigger')).toHaveTextContent('1:26.100');
      expect(screen.getByTestId('lap-b-trigger')).toHaveTextContent('1:25.432');
    });
    expect(screen.queryByRole('button', { name: /My best vs the fastest/ })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?sa=1&a=12&b=11'));
    // Both laps picked: the timing tower folds away
    expect(screen.queryByTestId('quick-select-drivers-grid')).not.toBeInTheDocument();
  });

  it('shows where time was lost per corner; a row zooms and Ask AI sends the corner as the chat zoom', async () => {
    const sessions = [makeSessionListItem({ id: 1, track_name: 'Monza', session_type: 'Race' })];
    const participants = [
      makeParticipant({ session_id: 1, car_index: 0, name: 'Max Verstappen', race_number: 1 }),
      makeParticipant({ session_id: 1, car_index: 1, name: 'Lando Norris', race_number: 4 }),
    ];
    const laps = [
      makeLap({ id: 501, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 80_000, sector1_ms: 26_000, sector2_ms: 27_000, sector3_ms: 27_000 }),
      makeLap({ id: 502, session_id: 1, car_index: 1, lap_number: 2, lap_time_ms: 80_300, sector1_ms: 26_100, sector2_ms: 27_100, sector3_ms: 27_100 }),
    ];
    // A slows to 100 km/h at the 500 m apex, B to 110; A loses 0.2 s through the corner
    const points: MergedTelemetryPoint[] = [];
    for (let d = 0; d <= 1000; d += 5) {
      const near = Math.abs(d - 500) < 150;
      points.push({
        lap_distance: d,
        time_delta: d < 350 ? 0 : d > 650 ? 0.2 : ((d - 350) / 300) * 0.2,
        timeA: d / 12,
        timeB: d / 12,
        speedA: near ? 100 + Math.abs(d - 500) : 250,
        speedB: near ? 110 + Math.abs(d - 500) : 250,
        speed_delta: null,
        throttleA: near ? 0 : 1,
        throttleB: near ? 0 : 1,
        brakeA: near && d < 500 ? 0.8 : 0,
        brakeB: near && d < 500 ? 0.8 : 0,
        steerA: 0,
        steerB: 0,
        gearA: 5,
        gearB: 5,
        ersBatteryA: 50,
        ersBatteryB: 50,
        ersDeployModeA: 1,
        ersDeployModeB: 1,
        worldX: d,
        worldZ: 0,
      });
    }
    const turns: TrackTurn[] = [
      { turnNumber: 1, name: 'T1', distance: 500, entryDistance: 465, exitDistance: 535, worldX: 500, worldZ: 0, normalX: 0, normalZ: 1 },
    ];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.split('?')[0] === '/api/sessions') return Promise.resolve({ ok: true, json: () => Promise.resolve(sessions) });
      if (url === '/api/sessions/1/laps') return Promise.resolve({ ok: true, json: () => Promise.resolve(laps) });
      if (url === '/api/sessions/1/participants') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(participants) });
      }
      if (url.includes('/api/comparator/merge')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ points, turns }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    const openChat = vi.fn();
    const actions: RaceEngineerActionsContextValue = {
      openChat,
      closeChat: vi.fn(),
      toggleChat: vi.fn(),
      sendMessage: vi.fn(),
      retryLastMessage: vi.fn(),
      clearMessages: vi.fn(),
      stopGenerating: vi.fn(),
      saveConfig: vi.fn(),
      saveApiKey: vi.fn(),
      fetchAvailableModels: vi.fn(),
    };

    window.history.replaceState(null, '', '/compare?sa=1&a=501&b=502');
    render(
      <RaceEngineerActionsContext.Provider value={actions}>
        <LapComparator />
      </RaceEngineerActionsContext.Provider>
    );

    const table = await screen.findByRole('table', { name: /Corners: #1 Max Verstappen against #4 Lando Norris/ });
    const row = within(table).getByRole('rowheader', { name: 'T1' }).closest('tr')!;
    expect(row).toHaveTextContent('+0.200 s');
    expect(within(row).getByText('100')).toHaveAttribute('data-slot', 'a');
    expect(within(row).getByText('110')).toHaveAttribute('data-better', 'true');
    expect(screen.getByText(/lost the most time at T1/)).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'T1' }));
    await waitFor(() => expect(window.location.search).toBe('?sa=1&a=501&b=502&zoom=250-650'));
    expect(within(row).getByRole('button', { name: 'T1' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Full Track' }));
    await waitFor(() => expect(window.location.search).toBe('?sa=1&a=501&b=502'));

    fireEvent.click(within(row).getByRole('button', { name: 'Ask the AI engineer about T1' }));
    // The zoom is in the URL, where the chat reads it, before the question goes out
    expect(window.location.search).toBe('?sa=1&a=501&b=502&zoom=250-650');
    expect(openChat).toHaveBeenCalledWith(expect.stringContaining('T1 (250–650 m)'));
  });
});
