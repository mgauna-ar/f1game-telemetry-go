import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Dashboard } from './Dashboard';
import type { ParticipantData, LapData, CarStatusData } from '../types/telemetry';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import * as storeModule from '../store/useTelemetryStore';

// Mock connectTelemetryWebSocket to avoid actual network calls
vi.spyOn(storeModule, 'connectTelemetryWebSocket').mockReturnValue(() => {});

describe('Dashboard', () => {
  beforeEach(() => {
    useSessionStatusStore.getState().resetSession();
    useTelemetryDataStore.getState().resetTelemetryData();
    useSessionStatusStore.setState({
      session: null,
      participants: [],
      events: [],
      connected: false,
      packetFormat: null,
    });
    useTelemetryDataStore.setState({
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
    });
  });

  it('renders waiting state when disconnected from backend and still mounts LiveRadioHUD', () => {
    render(<Dashboard />);
    expect(screen.getAllByText(/CONNECTING TO BACKEND/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Connecting to Telemetry Bridge/i)).toBeInTheDocument();
    expect(screen.getAllByText(/20777/i).length).toBeGreaterThan(0);
    // Voice Radio HUD is active and available even when disconnected
    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
  });

  it('renders waiting state when connected to backend but session data is null and still mounts LiveRadioHUD', () => {
    useSessionStatusStore.setState({
      session: null,
      participants: [],
      events: [],
      connected: true,
      packetFormat: null,
    });
    useTelemetryDataStore.setState({
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
    });

    render(<Dashboard />);
    expect(screen.getAllByText(/BACKEND CONNECTED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Waiting for Live Session Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/In-Game Telemetry Settings/i)).toBeInTheDocument();
    // Voice Radio HUD is active and available
    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
  });

  it('renders full live Race Control Hub when connected and session data is received', () => {
    useSessionStatusStore.setState({
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
      ] as unknown as ParticipantData[],
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
      connected: true,
    });

    useTelemetryDataStore.setState({
      allLaps: [
        { CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, Sector: 1, SpeedTrapFastestSpeed: 334.5 },
      ] as unknown as LapData[],
      allCarStatus: [
        { VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 },
      ] as unknown as CarStatusData[],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
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
    useSessionStatusStore.setState({
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
      ] as unknown as ParticipantData[],
      events: [],
      connected: true,
    });

    useTelemetryDataStore.setState({
      allLaps: [
        { CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, Sector: 1 },
      ] as unknown as LapData[],
      allCarStatus: [
        { VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 },
      ] as unknown as CarStatusData[],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
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
