import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LeaderboardTower } from './LeaderboardTower';
import type { SessionData, ParticipantData, LapData, CarStatusData } from '../hooks/useTelemetry';

describe('LeaderboardTower', () => {
  const qualySession: SessionData = {
    SessionType: 5, // Q1
    Weather: 0,
    TrackTemperature: 30,
    AirTemperature: 25,
    TotalLaps: 0,
    TrackLength: 5000,
    TrackId: 0,
    SessionTimeLeft: 900,
    SessionDuration: 1100,
    SafetyCarStatus: 0,
  };

  const participants: ParticipantData[] = [
    { AIControlled: 0, DriverId: 9, TeamId: 0, RaceNumber: 1, Nationality: 1, Name: 'Max Verstappen' },
    { AIControlled: 0, DriverId: 7, TeamId: 1, RaceNumber: 44, Nationality: 1, Name: 'Lewis Hamilton' },
    { AIControlled: 0, DriverId: 10, TeamId: 2, RaceNumber: 4, Nationality: 1, Name: 'Lando Norris' },
  ];

  it('keeps stable standings order in qualifying when no driver has set a lap time despite fluctuating CarPosition', () => {
    // Simulated laps where no driver has set a time (LastLapTimeInMS = 0), but CarPosition changes rapidly on outlaps
    const lapsInitial: LapData[] = [
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 15000, CarPosition: 3, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 14000, CarPosition: 1, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 16000, CarPosition: 2, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
    ];

    const carStatuses: CarStatusData[] = [
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
    ];

    const { rerender } = render(
      <LeaderboardTower
        session={qualySession}
        participants={participants}
        laps={lapsInitial}
        carStatuses={carStatuses}
        playerCarIndex={0}
        selectedCarIndex={0}
        onSelectCar={() => {}}
      />
    );

    // Initial render order should be stable carIndex order: Verstappen (car 0), Hamilton (car 1), Norris (car 2)
    const driverNamesFirst = screen.getAllByText(/Verstappen|Hamilton|Norris/).map(el => el.textContent);
    expect(driverNamesFirst).toEqual(['Max Verstappen', 'Lewis Hamilton', 'Lando Norris']);

    // Now simulate next telemetry tick where CarPosition values swap on track as cars drive around
    const lapsUpdated: LapData[] = [
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 30000, CarPosition: 1, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 29000, CarPosition: 2, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 31000, CarPosition: 3, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
    ];

    rerender(
      <LeaderboardTower
        session={qualySession}
        participants={participants}
        laps={lapsUpdated}
        carStatuses={carStatuses}
        playerCarIndex={0}
        selectedCarIndex={0}
        onSelectCar={() => {}}
      />
    );

    // Standings order MUST remain stable and not jump around
    const driverNamesSecond = screen.getAllByText(/Verstappen|Hamilton|Norris/).map(el => el.textContent);
    expect(driverNamesSecond).toEqual(['Max Verstappen', 'Lewis Hamilton', 'Lando Norris']);
  });

  it('sorts drivers with timed laps above drivers without times in qualifying', () => {
    const laps: LapData[] = [
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 60000, CarPosition: 1, CurrentLapNum: 2, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 },
      { LastLapTimeInMS: 75000, CurrentLapTimeInMS: 10000, CarPosition: 2, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 }, // Hamilton set 1:15.000
      { LastLapTimeInMS: 74000, CurrentLapTimeInMS: 12000, CarPosition: 3, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0 }, // Norris set 1:14.000
    ];

    const carStatuses: CarStatusData[] = [
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
    ];

    render(
      <LeaderboardTower
        session={qualySession}
        participants={participants}
        laps={laps}
        carStatuses={carStatuses}
        playerCarIndex={0}
        selectedCarIndex={0}
        onSelectCar={() => {}}
      />
    );

    const driverNames = screen.getAllByText(/Verstappen|Hamilton|Norris/).map(el => el.textContent);
    // Norris (1:14.000) P1, Hamilton (1:15.000) P2, Verstappen (No time) P3
    expect(driverNames).toEqual(['Lando Norris', 'Lewis Hamilton', 'Max Verstappen']);
  });
});
