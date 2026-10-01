import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveSectorTracker } from './LiveSectorTracker';
import type { ParticipantData, LapData } from '../hooks/useTelemetry';
import { makeLiveLap, makeLiveLapTimes, makeLiveParticipant } from '../test/wireFactories';

describe('LiveSectorTracker', () => {
  const mockParticipants: ParticipantData[] = [
    makeLiveParticipant({ Name: 'Max Verstappen', DriverId: 9, TeamId: 0, RaceNumber: 1, AIControlled: 0 }),
    makeLiveParticipant({ Name: 'Charles Leclerc', DriverId: 22, TeamId: 4, RaceNumber: 16, AIControlled: 1 }),
  ];

  const mockLaps: LapData[] = [
    makeLiveLap({
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
    }),
    makeLiveLap({
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
    }),
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

  it('takes S1, S2 and S3 from the session history, not from the lap in progress', () => {
    const lapTimes = [
      makeLiveLapTimes({ LastSectorsMS: [28_000, 31_000, 26_500], BestSectorsMS: [27_900, 31_000, 26_100] }),
      makeLiveLapTimes({ LastSectorsMS: [28_300, 30_900, 26_000], BestSectorsMS: [28_200, 30_900, 26_000] }),
    ];
    render(
      <LiveSectorTracker
        participants={mockParticipants}
        laps={mockLaps}
        lapTimes={lapTimes}
        bestLapTimes={[85_300, 85_400]}
        selectedCarIndex={0}
        playerCarIndex={0}
      />
    );

    // Session bests: S1 Verstappen, S2 and S3 Leclerc; theoretical best is their sum
    expect(screen.getByText('SECTOR 3')).toBeInTheDocument();
    expect(screen.getByText('27.900s')).toBeInTheDocument();
    expect(screen.getByText('30.900s')).toBeInTheDocument();
    expect(screen.getByText('26.000s')).toBeInTheDocument();
    expect(screen.getByText('1:24.800')).toBeInTheDocument();

    // Verstappen's last lap splits against the session bests
    expect(screen.getByText(/Last lap splits: Max Verstappen/)).toBeInTheDocument();
    expect(screen.getAllByText('+0.100s')).toHaveLength(2);
    expect(screen.getByText('+0.500s')).toBeInTheDocument();
  });
});
