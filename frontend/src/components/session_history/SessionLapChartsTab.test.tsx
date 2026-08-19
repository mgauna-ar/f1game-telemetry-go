import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionLapChartsTab } from './SessionLapChartsTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding } from '../../types/session';

describe('SessionLapChartsTab Component', () => {
  const mockDriverStandings: DriverStanding[] = [
    {
      position: 1,
      participant: {
        id: 1,
        session_id: 100,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 9,
        race_number: 1,
        ai_controlled: false,
      },
      bestLapTimeMS: 87500,
      bestLap: null,
      laps: [
        { id: 1, session_id: 100, car_index: 0, lap_number: 1, lap_time_ms: 88500, is_valid: true, tyre_compound: 'MEDIUM', car_position: 1 },
        { id: 2, session_id: 100, car_index: 0, lap_number: 2, lap_time_ms: 115000, is_valid: true, tyre_compound: 'MEDIUM', car_position: 1 }, // Pit in-lap
        { id: 3, session_id: 100, car_index: 0, lap_number: 3, lap_time_ms: 87500, is_valid: true, tyre_compound: 'HARD', car_position: 1 },
      ],
      bestS1MS: 28000,
      bestS2MS: 33000,
      bestS3MS: 26500,
      maxSpeed: 325,
      isDSQ: false,
      isDNF: false,
    },
    {
      position: 2,
      participant: {
        id: 2,
        session_id: 100,
        car_index: 1,
        name: 'Lewis Hamilton',
        driver_id: 2,
        team_id: 1,
        race_number: 44,
        ai_controlled: false,
      },
      bestLapTimeMS: 87900,
      bestLap: null,
      laps: [
        { id: 4, session_id: 100, car_index: 1, lap_number: 1, lap_time_ms: 89000, is_valid: true, tyre_compound: 'SOFT', car_position: 2 },
        { id: 5, session_id: 100, car_index: 1, lap_number: 2, lap_time_ms: 88900, is_valid: true, tyre_compound: 'SOFT', car_position: 2 },
        { id: 6, session_id: 100, car_index: 1, lap_number: 3, lap_time_ms: 87900, is_valid: true, tyre_compound: 'HARD', car_position: 2 },
      ],
      bestS1MS: 28100,
      bestS2MS: 33200,
      bestS3MS: 26600,
      maxSpeed: 322,
      isDSQ: false,
      isDNF: false,
    },
  ];

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const min = Math.floor(ms / 60000);
    const sec = ((ms % 60000) / 1000).toFixed(3);
    return `${min}:${sec.padStart(6, '0')}`;
  };

  it('renders pace chart and driver chips with no outlier checkbox', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    // Outlier checkbox should not exist
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Chart title and buttons should be rendered
    expect(screen.getByText(/Lap-by-Lap Pace Evolution/i)).toBeInTheDocument();
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
  });

  it('allows switching between Pace, Position, and Gap charts', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    // Switch to Position chart
    const posBtn = screen.getByRole('button', { name: /Position Lap Chart/i });
    fireEvent.click(posBtn);
    expect(screen.getByText(/Position Progression/i)).toBeInTheDocument();

    // Switch to Gap chart
    const gapBtn = screen.getByRole('button', { name: /Gap to Leader Evolution/i });
    fireEvent.click(gapBtn);
    expect(screen.getByText(/Gap to Leader Delta/i)).toBeInTheDocument();
  });

  it('supports selecting and clearing all drivers', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(screen.getByText(/Select at least one driver above/i)).toBeInTheDocument();

    const selectAllBtn = screen.getByText('Select All');
    fireEvent.click(selectAllBtn);
    expect(screen.getByText(/Lap-by-Lap Pace Evolution/i)).toBeInTheDocument();
  });
});
