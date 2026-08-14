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
    (useTelemetry as any).mockReturnValue({
      session: null,
      participants: [],
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      telemetry: null,
      lap: null,
      motion: null,
      trackPath: [],
      connected: false,
      playerCarIndex: 0,
      selectedCarIndex: 0,
      history: [],
    });
  });

  it('renders waiting state when disconnected from backend', () => {
    render(<Dashboard />);
    expect(screen.getByText(/CONNECTING TO BACKEND/i)).toBeInTheDocument();
    expect(screen.getByText(/Connecting to Telemetry Bridge/i)).toBeInTheDocument();
    expect(screen.getAllByText(/20777/i).length).toBeGreaterThan(0);
  });

  it('renders waiting state when connected to backend but session data is null', () => {
    (useTelemetry as any).mockReturnValue({
      session: null,
      participants: [],
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      telemetry: null,
      lap: null,
      motion: null,
      trackPath: [],
      connected: true,
      playerCarIndex: 0,
      selectedCarIndex: 0,
      history: [],
    });

    render(<Dashboard />);
    expect(screen.getByText(/BACKEND CONNECTED/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Live Session Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/In-Game Telemetry Settings/i)).toBeInTheDocument();
  });

  it('renders full live telemetry dashboard when connected and session data is received', () => {
    (useTelemetry as any).mockReturnValue({
      session: {
        TrackId: 0,
        SessionType: 15,
        Weather: 0,
        TrackTemperature: 32,
        AirTemperature: 24,
        TotalLaps: 58,
        TrackLength: 5303,
        SessionTimeLeft: 3600,
        SessionDuration: 7200,
        SafetyCarStatus: 0,
      },
      participants: [
        { Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0 },
      ],
      allLaps: [
        { CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, Sector: 1 },
      ],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      telemetry: { Speed: 320, Gear: 8, EngineRPM: 11500, Throttle: 1, Brake: 0, Steer: 0, DRS: 1, RevLightsPercent: 80 },
      lap: { CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, Sector: 1 },
      motion: null,
      trackPath: [],
      connected: true,
      playerCarIndex: 0,
      selectedCarIndex: 0,
      setSelectedCarIndex: vi.fn(),
      history: [],
    });

    render(<Dashboard />);
    expect(screen.getByText(/Melbourne/i)).toBeInTheDocument();
    expect(screen.getByText(/320/)).toBeInTheDocument(); // Speed
    expect(screen.getByText('8')).toBeInTheDocument(); // Gear
  });
});
