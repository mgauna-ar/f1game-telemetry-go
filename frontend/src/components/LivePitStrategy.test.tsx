import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LivePitStrategy } from './LivePitStrategy';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../hooks/useTelemetry';

describe('LivePitStrategy', () => {
  const mockSession: SessionData = {
    Weather: 0,
    TrackTemperature: 32,
    AirTemperature: 24,
    TotalLaps: 58,
    TrackLength: 5303,
    SessionType: 15,
    TrackId: 0,
    SessionTimeLeft: 3600,
    SessionDuration: 7200,
    SafetyCarStatus: 0,
    PitStopWindowIdealLap: 18,
    PitStopWindowLatestLap: 24,
    PitStopRejoinPosition: 6,
  };

  const mockParticipants: ParticipantData[] = [
    { Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0, Nationality: 5 },
    { Name: 'Lando Norris', DriverId: 10, TeamId: 2, RaceNumber: 4, AIControlled: 1, Nationality: 12 },
  ];

  const mockLaps: LapData[] = [
    {
      CarPosition: 1,
      CurrentLapNum: 10,
      CurrentLapTimeInMS: 81000,
      LastLapTimeInMS: 80500,
      Sector1TimeMSPart: 28000,
      Sector2TimeMSPart: 31000,
      PitStatus: 0,
      NumPitStops: 0,
      CurrentLapInvalid: 0,
    },
    {
      CarPosition: 2,
      CurrentLapNum: 10,
      CurrentLapTimeInMS: 81500,
      LastLapTimeInMS: 80800,
      Sector1TimeMSPart: 28200,
      Sector2TimeMSPart: 31100,
      PitStatus: 1,
      NumPitStops: 1,
      PitLaneTimeInLaneInMS: 18500,
      CurrentLapInvalid: 0,
    },
  ];

  const mockStatuses: CarStatusData[] = [
    { VisualTyreCompound: 17, TyresAgeLaps: 10, FuelInTank: 45, ERSStoreEnergy: 3500000, ERSDeployMode: 1 },
    { VisualTyreCompound: 16, TyresAgeLaps: 1, FuelInTank: 44, ERSStoreEnergy: 3800000, ERSDeployMode: 2 },
  ];

  it('renders pit strategy header and estimated pit window', () => {
    render(
      <LivePitStrategy
        session={mockSession}
        participants={mockParticipants}
        laps={mockLaps}
        carStatuses={mockStatuses}
        selectedCarIndex={0}
        playerCarIndex={0}
        onSelectCar={vi.fn()}
      />
    );

    expect(screen.getByText(/Pit Strategy & Field Tyre Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/LAP 18 — 24/i)).toBeInTheDocument();
    expect(screen.getByText(/P6/i)).toBeInTheDocument();
  });

  it('renders driver tyre compound badges and ages', () => {
    render(
      <LivePitStrategy
        session={mockSession}
        participants={mockParticipants}
        laps={mockLaps}
        carStatuses={mockStatuses}
        selectedCarIndex={0}
        playerCarIndex={0}
        onSelectCar={vi.fn()}
      />
    );

    expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lando Norris')).toBeInTheDocument();
    expect(screen.getByText(/10 L/i)).toBeInTheDocument();
  });

  it('calls onSelectCar when driver row is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <LivePitStrategy
        session={mockSession}
        participants={mockParticipants}
        laps={mockLaps}
        carStatuses={mockStatuses}
        selectedCarIndex={0}
        playerCarIndex={0}
        onSelectCar={handleSelect}
      />
    );

    const landoRow = screen.getByText('Lando Norris').closest('tr');
    fireEvent.click(landoRow!);

    expect(handleSelect).toHaveBeenCalledWith(1);
  });
});
