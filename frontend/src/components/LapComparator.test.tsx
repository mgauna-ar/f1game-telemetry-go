import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    
    // Trigger button should be rendered
    const trigger = screen.getByTestId('session-selector-trigger');
    expect(trigger).toHaveTextContent('Select Session...');

    // Wait for sessions to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions');
    });

    // Open dropdown
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

    // Wait for sessions to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions');
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

  it('selects session from custom dropdown and displays quick select buttons & driver laps', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }
    ];

    const mockLaps = [
      { id: 101, session_id: 1, car_index: 0, lap_number: 3, lap_time_ms: 85432, is_valid: true },
      { id: 102, session_id: 1, car_index: 2, lap_number: 4, lap_time_ms: 86100, is_valid: true }
    ];

    const mockParticipants = [
      { id: 1, session_id: 1, car_index: 0, name: 'Max Verstappen', driver_id: 1, team_id: 1, race_number: 1, ai_controlled: false, nationality: 1 }
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
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions');
    });

    // Open dropdown and select Monaco session
    const trigger = screen.getByTestId('session-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Monaco')).toBeInTheDocument();
    });

    const monacoOption = screen.getByText('Monaco');
    fireEvent.click(monacoOption);

    // Verify trigger and banner now display selected Monaco session
    expect(trigger).toHaveTextContent('Monaco');

    // Verify quick select bar renders driver
    await waitFor(() => {
      expect(screen.getAllByText(/Max Verstappen/).length).toBeGreaterThan(0);
    });

    // Verify optgroup labels and lap option labels inside dropdowns
    expect(screen.getAllByRole('group', { name: 'Max Verstappen (#1)' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('group', { name: 'Car 2' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1:25.432/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1:26.100/).length).toBeGreaterThan(0);
  });
});
