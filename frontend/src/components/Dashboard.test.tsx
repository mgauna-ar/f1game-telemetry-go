import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { useTelemetry } from '../hooks/useTelemetry';

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
      events: [],
      clearEvents: vi.fn(),
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

  it('renders waiting state when disconnected from backend and still mounts LiveRadioHUD', () => {
    render(<Dashboard />);
    expect(screen.getByText(/CONNECTING TO BACKEND/i)).toBeInTheDocument();
    expect(screen.getByText(/Connecting to Telemetry Bridge/i)).toBeInTheDocument();
    expect(screen.getAllByText(/20777/i).length).toBeGreaterThan(0);
    // Voice Radio HUD is active and available even when disconnected
    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
  });

  it('renders waiting state when connected to backend but session data is null and still mounts LiveRadioHUD', () => {
    (useTelemetry as any).mockReturnValue({
      session: null,
      participants: [],
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      events: [],
      clearEvents: vi.fn(),
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
    // Voice Radio HUD is active and available
    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
  });

  it('renders full live Race Control Hub when connected and session data is received', () => {
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
        PitStopWindowIdealLap: 18,
        PitStopWindowLatestLap: 24,
        PitStopRejoinPosition: 6,
      },
      participants: [
        { Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0 },
      ],
      allLaps: [
        { CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, Sector: 1, SpeedTrapFastestSpeed: 334.5 },
      ],
      allCarStatus: [
        { VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 },
      ],
      allCarDamage: [],
      allTelemetry: [],
      events: [
        {
          id: '1',
          timestamp: Date.now(),
          eventCode: 'FTLP',
          type: 'fastest_lap',
          description: 'Max Verstappen set the fastest lap (80.950s)',
          severity: 'purple',
        },
      ],
      clearEvents: vi.fn(),
      telemetry: null,
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
    // Session Header
    expect(screen.getByText(/Melbourne/i)).toBeInTheDocument();

    // 4 Core Race Modules
    expect(screen.getByText(/Race Control & Incidents/i)).toBeInTheDocument();
    expect(screen.getByText(/Weather Radar & Track Evolution/i)).toBeInTheDocument();
    expect(screen.getByText(/Pit Strategy & Field Tyre Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Sector Performance & Speed Traps/i)).toBeInTheDocument();

    // Event Feed content
    expect(screen.getByText(/Max Verstappen set the fastest lap/i)).toBeInTheDocument();

    // Voice Radio HUD is active
    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
  });

  it('switches to Voice Cockpit mode and unmounts 2x2 dashboard modules to save sim racing FPS', async () => {
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
      allCarStatus: [
        { VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 },
      ],
      allCarDamage: [],
      allTelemetry: [],
      events: [],
      clearEvents: vi.fn(),
      telemetry: null,
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

    // Initially in Race Control mode
    expect(screen.getByText(/Weather Radar & Track Evolution/i)).toBeInTheDocument();

    // Click Voice Cockpit toggle
    const cockpitToggleBtn = screen.getByTestId('live-view-toggle-cockpit');
    fireEvent.click(cockpitToggleBtn);

    // Voice Cockpit container is now mounted
    expect(screen.getByTestId('voice-cockpit-container')).toBeInTheDocument();
    expect(screen.getByText(/POWERTRAIN & STRATEGY/i)).toBeInTheDocument();

    // 2x2 Race control modules are unmounted!
    expect(screen.queryByText(/Weather Radar & Track Evolution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pit Strategy & Field Tyre Matrix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live Sector Performance & Speed Traps/i)).not.toBeInTheDocument();

    // Verify localStorage was updated
    expect(localStorage.getItem('f1_live_view_mode')).toBe('cockpit');

    // Switch back to Race Control
    const dashboardToggleBtn = screen.getByTestId('live-view-toggle-dashboard');
    fireEvent.click(dashboardToggleBtn);
    expect(screen.getByText(/Weather Radar & Track Evolution/i)).toBeInTheDocument();
    expect(localStorage.getItem('f1_live_view_mode')).toBe('dashboard');
  });
});

