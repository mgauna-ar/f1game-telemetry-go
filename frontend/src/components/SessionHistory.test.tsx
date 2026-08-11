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
});


