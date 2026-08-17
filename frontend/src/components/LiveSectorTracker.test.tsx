import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveSectorTracker } from './LiveSectorTracker';
import type { ParticipantData, LapData } from '../hooks/useTelemetry';

describe('LiveSectorTracker', () => {
  const mockParticipants: ParticipantData[] = [
    { Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0, Nationality: 5 },
    { Name: 'Charles Leclerc', DriverId: 22, TeamId: 4, RaceNumber: 16, AIControlled: 1, Nationality: 18 },
  ];

  const mockLaps: LapData[] = [
    {
      CarPosition: 1,
      CurrentLapNum: 15,
      CurrentLapTimeInMS: 81500,
      LastLapTimeInMS: 80250,
      Sector1TimeMSPart: 27950,
      Sector2TimeMSPart: 30800,
      SpeedTrapFastestSpeed: 335.2,
      SpeedTrapFastestLap: 12,
      PitStatus: 0,
      CurrentLapInvalid: 0,
    },
    {
      CarPosition: 2,
      CurrentLapNum: 15,
      CurrentLapTimeInMS: 81800,
      LastLapTimeInMS: 80600,
      Sector1TimeMSPart: 28100,
      Sector2TimeMSPart: 30750,
      SpeedTrapFastestSpeed: 332.8,
      SpeedTrapFastestLap: 14,
      PitStatus: 0,
      CurrentLapInvalid: 0,
    },
  ];

  it('renders sector performance title and theoretical best', () => {
    render(
      <LiveSectorTracker
        participants={mockParticipants}
        laps={mockLaps}
        selectedCarIndex={0}
        playerCarIndex={0}
      />
    );

    expect(screen.getByText(/Live Sector Performance & Speed Traps/i)).toBeInTheDocument();
    expect(screen.getByText(/THEORETICAL BEST:/i)).toBeInTheDocument();
  });

  it('displays purple sector holders correctly', () => {
    render(
      <LiveSectorTracker
        participants={mockParticipants}
        laps={mockLaps}
        selectedCarIndex={0}
        playerCarIndex={0}
      />
    );

    expect(screen.getByText(/SECTOR 1/i)).toBeInTheDocument();
    expect(screen.getByText(/SECTOR 2/i)).toBeInTheDocument();
    expect(screen.getByText(/FASTEST LAP/i)).toBeInTheDocument();
  });

  it('renders speed trap rankings', () => {
    render(
      <LiveSectorTracker
        participants={mockParticipants}
        laps={mockLaps}
        selectedCarIndex={0}
        playerCarIndex={0}
      />
    );

    expect(screen.getByText(/Speed Trap Leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText(/335 KM\/H/i)).toBeInTheDocument();
  });
});
