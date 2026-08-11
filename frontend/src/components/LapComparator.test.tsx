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
}));

describe('LapComparator Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches sessions on mount and renders initial layout', async () => {
    const mockSessions = [
      { id: 1, session_uid: '123', track_name: 'Monaco', session_type: 'Race', created_at: '2026-08-10T12:00:00Z' }
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

    render(<LapComparator />);

    expect(screen.getByText('Lap Comparator')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Monaco - Race/)).toBeInTheDocument();
    });
  });

  it('fetches participants and displays quick select buttons & driver laps in selector', async () => {
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
      expect(screen.getByText(/Monaco - Race/)).toBeInTheDocument();
    });

    // Select session #1
    const selects = screen.getAllByRole('combobox');
    const sessionSelect = selects[0];
    fireEvent.change(sessionSelect, { target: { value: '1' } });

    // Verify quick select bar renders driver
    await waitFor(() => {
      expect(screen.getByText(/#1 Max Verstappen/)).toBeInTheDocument();
    });

    // Verify optgroup labels and lap option labels inside dropdowns
    expect(screen.getAllByRole('group', { name: 'Max Verstappen (#1)' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('group', { name: 'Car 2' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lap 3 — 1:25.432/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lap 4 — 1:26.100/).length).toBeGreaterThan(0);
  });
});
