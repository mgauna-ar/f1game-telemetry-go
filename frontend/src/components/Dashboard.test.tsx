import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { useTelemetry } from '../hooks/useTelemetry';

// Mock the Recharts components to avoid issues with ResizeObserver in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div>LineChart</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

// Mock the hook
vi.mock('../hooks/useTelemetry');

describe('Dashboard', () => {
  beforeEach(() => {
    // Default mock return
    (useTelemetry as any).mockReturnValue({
      telemetry: null,
      lap: null,
      motion: null,
      trackPath: [],
      connected: false,
      history: []
    });
  });

  it('renders disconnected state', () => {
    render(<Dashboard />);
    expect(screen.getByText(/RECONNECTING|DISCONNECTED/i)).toBeInTheDocument();
  });

  it('renders connected state and telemetry data', () => {
    (useTelemetry as any).mockReturnValue({
      telemetry: { Speed: 320, Gear: 8, RPM: 11000 },
      lap: { CurrentLapTimeInMS: 65000 },
      motion: null,
      trackPath: [],
      connected: true,
      history: []
    });

    render(<Dashboard />);
    
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument(); // Speed
    expect(screen.getByText('8')).toBeInTheDocument(); // Gear
  });
});
