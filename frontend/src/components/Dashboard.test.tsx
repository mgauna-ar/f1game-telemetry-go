import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { vi } from 'vitest';
import { resetDevicePreferences } from '../store/useDevicePreferencesStore';
import { api } from '../utils/apiClient';
import { Dashboard } from './Dashboard';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import * as storeModule from '../store/useTelemetryStore';
import { makeLiveCarStatus, makeLiveLap, makeLiveParticipant, makeLiveSession } from '../test/wireFactories';
import { RaceEngineerProvider } from '../context/RaceEngineerProvider';
import { useRaceEngineerActions, useRaceEngineerState } from '../context/RaceEngineerContext';

// Mock connectTelemetryWebSocket to avoid actual network calls
vi.spyOn(storeModule, 'connectTelemetryWebSocket').mockReturnValue(() => {});

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.removeItem('f1_race_control_layout');
    resetDevicePreferences();
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
      session: makeLiveSession({
        TrackId: 0,
        SessionType: 15,
        Weather: 0,
        TrackTemperature: 32,
        AirTemperature: 24,
        TotalLaps: 58,
        SessionTimeLeft: 3600,
        SafetyCarStatus: 0,
        PitStopWindowIdealLap: 18,
        PitStopWindowLatestLap: 24,
        PitStopRejoinPosition: 6,
      }),
      participants: [
        makeLiveParticipant({ Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0 }),
      ],
      events: [
        {
          id: '1',
          timestamp: Date.now(),
          eventCode: 'FTLP',
          type: 'fastest_lap',
          driverName: 'Max Verstappen',
          lapTime: 80.95,
          severity: 'purple',
        },
      ],
      connected: true,
    });

    useTelemetryDataStore.setState({
      allLaps: [
        makeLiveLap({ CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950, SpeedTrapFastestSpeed: 334.5 }),
      ],
      allCarStatus: [
        makeLiveCarStatus({ VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 }),
      ],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
    });

    render(<Dashboard />);
    // Session Header (and the your-car panel)
    expect(screen.getAllByText(/Melbourne/i).length).toBeGreaterThan(0);

    // Your car, the battle and the track position strip
    expect(screen.getByTestId('race-control-your-car')).toBeInTheDocument();
    expect(screen.getByTestId('battle-panel')).toBeInTheDocument();
    expect(screen.getByTestId('track-position-strip')).toBeInTheDocument();

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

  it('lays out the hub panels by preset, remembers it, and opens a car from the tower', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      session_uid: '',
      car_index: 0,
      best_lap_num: 0,
      best_sector_lap_nums: [0, 0, 0],
      laps: [],
      stints: [],
    });
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: 15 }),
      participants: [makeLiveParticipant({ Name: 'Max Verstappen', RaceNumber: 1, AIControlled: 0 })],
      connected: true,
    });
    useTelemetryDataStore.setState({ allLaps: [makeLiveLap({ CarPosition: 1 })], playerCarIndex: 0 });
    render(<Dashboard />);

    const hub = screen.getByTestId('race-control-hub');
    expect(hub).toHaveAttribute('data-layout', 'grid');
    fireEvent.click(screen.getByRole('radio', { name: 'Race' }));
    expect(hub).toHaveAttribute('data-layout', 'race');
    expect(screen.queryByText(/Weather Radar & Track Evolution/i)).toBeNull();
    expect(localStorage.getItem('f1_race_control_layout')).toBe('race');

    const tower = screen.getByRole('region', { name: /Race Leaderboard Tower/i });
    fireEvent.click(within(tower).getByRole('button', { name: /Max Verstappen/ }));
    expect(await screen.findByRole('dialog', { name: /Max Verstappen/ })).toBeInTheDocument();
  });

  it('switches to Voice Cockpit mode and unmounts 2x2 dashboard modules to save sim racing FPS', async () => {
    useSessionStatusStore.setState({
      session: makeLiveSession({
        TrackId: 0,
        SessionType: 15,
        Weather: 0,
        TrackTemperature: 32,
        AirTemperature: 24,
        TotalLaps: 58,
        SessionTimeLeft: 3600,
        SafetyCarStatus: 0,
      }),
      participants: [
        makeLiveParticipant({ Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0 }),
      ],
      events: [],
      connected: true,
    });

    useTelemetryDataStore.setState({
      allLaps: [
        makeLiveLap({ CarPosition: 1, CurrentLapNum: 5, CurrentLapTimeInMS: 81234, LastLapTimeInMS: 80950 }),
      ],
      allCarStatus: [
        makeLiveCarStatus({ VisualTyreCompound: 17, TyresAgeLaps: 5, FuelInTank: 45, ERSStoreEnergy: 3500000 }),
      ],
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

    // The Driver view replaces the whole page, and keeps its own compact switch
    fireEvent.click(screen.getByTestId('live-view-toggle-driver'));
    expect(screen.getByTestId('driver-glance')).toBeInTheDocument();
    expect(screen.queryByText(/Weather Radar & Track Evolution/i)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/live/driver');
    fireEvent.click(screen.getByRole('radio', { name: 'Race Control' }));
    expect(screen.getByText(/Weather Radar & Track Evolution/i)).toBeInTheDocument();
  });

  it('points the chat at the live session and never re-renders chat consumers on a timer', async () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState(null, '', '/live/dashboard');
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      useSessionStatusStore.setState({ connected: true, session: makeLiveSession({ TrackId: 7 }) });

      const renders = { actions: 0, state: 0 };
      let mode = '';
      const ActionsProbe = () => {
        useRaceEngineerActions();
        renders.actions++;
        return null;
      };
      const StateProbe = () => {
        mode = useRaceEngineerState().contextMode;
        renders.state++;
        return null;
      };

      render(
        <RaceEngineerProvider>
          <ActionsProbe />
          <StateProbe />
          <Dashboard />
        </RaceEngineerProvider>
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mode).toBe('live');

      const before = { ...renders };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(renders.actions).toBe(1);
      expect(renders).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
