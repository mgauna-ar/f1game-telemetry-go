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

  it('renders compound laps age and driver penalty badges correctly', () => {
    const laps: LapData[] = [
      { LastLapTimeInMS: 75000, CurrentLapTimeInMS: 10000, CarPosition: 1, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, Penalties: 5 }, // 5s penalty
      { LastLapTimeInMS: 76000, CurrentLapTimeInMS: 10000, CarPosition: 2, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, TotalWarnings: 2 }, // 2 warnings
      { LastLapTimeInMS: 77000, CurrentLapTimeInMS: 10000, CarPosition: 3, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, NumUnservedDriveThroughPens: 1 }, // DT penalty
    ];

    const carStatuses: CarStatusData[] = [
      { VisualTyreCompound: 16, TyresAgeLaps: 7, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 17, TyresAgeLaps: 12, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 18, TyresAgeLaps: 3, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
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

    // Verify tyre age labels
    expect(screen.getByText('7L')).toBeInTheDocument();
    expect(screen.getByText('12L')).toBeInTheDocument();
    expect(screen.getByText('3L')).toBeInTheDocument();

    // Verify penalty & warning badges
    expect(screen.getByText('+5s')).toBeInTheDocument();
    expect(screen.getByText('2W')).toBeInTheDocument();
    expect(screen.getByText('DT')).toBeInTheDocument();
  });

  it('preserves timed driver position with RET badge when driver retires during qualifying', () => {
    const laps: LapData[] = [
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 60000, CarPosition: 3, CurrentLapNum: 2, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 2 }, // Verstappen (No time, Active)
      { LastLapTimeInMS: 75000, CurrentLapTimeInMS: 0, CarPosition: 2, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 7 }, // Hamilton (1:15.000, Retired)
      { LastLapTimeInMS: 74000, CurrentLapTimeInMS: 12000, CarPosition: 1, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 2 }, // Norris (1:14.000, Active)
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
    // Norris (1:14.000) P1, Hamilton (1:15.000, RET) P2, Verstappen (No time) P3
    expect(driverNames).toEqual(['Lando Norris', 'Lewis Hamilton', 'Max Verstappen']);
    // Hamilton has RET badge
    expect(screen.getByText('RET')).toBeInTheDocument();
    // Norris has time displayed
    expect(screen.getByText('1:14.000')).toBeInTheDocument();
    // Hamilton has time displayed
    expect(screen.getByText('1:15.000')).toBeInTheDocument();
  });

  it('ranks un-timed retired driver at bottom with RET badge in qualifying', () => {
    const laps: LapData[] = [
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 0, CarPosition: 3, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 7 }, // Verstappen (No time, Retired)
      { LastLapTimeInMS: 75000, CurrentLapTimeInMS: 10000, CarPosition: 2, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 2 }, // Hamilton (1:15.000, Active)
      { LastLapTimeInMS: 74000, CurrentLapTimeInMS: 12000, CarPosition: 1, CurrentLapNum: 3, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 2 }, // Norris (1:14.000, Active)
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
    // Norris (1:14.000) P1, Hamilton (1:15.000) P2, Verstappen (No time, RET) P3
    expect(driverNames).toEqual(['Lando Norris', 'Lewis Hamilton', 'Max Verstappen']);
    expect(screen.getByText('RET')).toBeInTheDocument();
    expect(screen.getByText('NO TIME')).toBeInTheDocument();
  });

  it('filters out inactive AI placeholder drivers in multiplayer lobby when only humans are racing', () => {
    // 2 human players (Car 0 and Car 1) and 2 AI placeholder slots (Car 2 and Car 3) with no activity
    const mixedParticipants: ParticipantData[] = [
      { AIControlled: 0, DriverId: 255, TeamId: 476, RaceNumber: 99, Nationality: 1, Name: 'LC-LEMAC' },
      { AIControlled: 0, DriverId: 255, TeamId: 485, RaceNumber: 32, Nationality: 1, Name: 'LC-iL.Magno' },
      { AIControlled: 1, DriverId: 54, TeamId: 484, RaceNumber: 4, Nationality: 1, Name: 'Lando Norris' },
      { AIControlled: 1, DriverId: 9, TeamId: 478, RaceNumber: 33, Nationality: 1, Name: 'Max Verstappen' },
    ];

    const mixedLaps: LapData[] = [
      { LastLapTimeInMS: 89393, CurrentLapTimeInMS: 10000, CarPosition: 1, CurrentLapNum: 2, PitStatus: 0, Sector1TimeMSPart: 28000, Sector2TimeMSPart: 37000, CurrentLapInvalid: 0, ResultStatus: 2, DriverStatus: 1, LapDistance: 500 },
      { LastLapTimeInMS: 89753, CurrentLapTimeInMS: 12000, CarPosition: 2, CurrentLapNum: 2, PitStatus: 0, Sector1TimeMSPart: 28200, Sector2TimeMSPart: 36500, CurrentLapInvalid: 0, ResultStatus: 2, DriverStatus: 1, LapDistance: 480 },
      // AI slots with Inactive / InGarage status and no times
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 0, CarPosition: 0, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 1, DriverStatus: 0, LapDistance: -5000 },
      { LastLapTimeInMS: 0, CurrentLapTimeInMS: 0, CarPosition: 0, CurrentLapNum: 1, PitStatus: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, CurrentLapInvalid: 0, ResultStatus: 1, DriverStatus: 0, LapDistance: -5000 },
    ];

    const mixedCarStatuses: CarStatusData[] = [
      { VisualTyreCompound: 16, TyresAgeLaps: 1, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, TyresAgeLaps: 1, FuelInTank: 10, ERSStoreEnergy: 1000, ERSDeployMode: 1 },
      { VisualTyreCompound: 16, TyresAgeLaps: 0, FuelInTank: 0, ERSStoreEnergy: 0, ERSDeployMode: 0 },
      { VisualTyreCompound: 16, TyresAgeLaps: 0, FuelInTank: 0, ERSStoreEnergy: 0, ERSDeployMode: 0 },
    ];

    render(
      <LeaderboardTower
        session={qualySession}
        participants={mixedParticipants}
        laps={mixedLaps}
        carStatuses={mixedCarStatuses}
        playerCarIndex={0}
        selectedCarIndex={0}
        onSelectCar={() => {}}
      />
    );

    // Only the 2 human drivers should be displayed
    expect(screen.getByText('LC-LEMAC')).toBeInTheDocument();
    expect(screen.getByText('LC-iL.Magno')).toBeInTheDocument();
    expect(screen.queryByText('Lando Norris')).not.toBeInTheDocument();
    expect(screen.queryByText('Max Verstappen')).not.toBeInTheDocument();
    expect(screen.getByText('2 CARS')).toBeInTheDocument();
  });
});
