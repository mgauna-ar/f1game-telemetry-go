import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionLapChartsTab } from './SessionLapChartsTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding, ProgressionResponse } from '../../types/session';

describe('SessionLapChartsTab Component', () => {
  const mockDriverStandings: DriverStanding[] = [
    {
      position: 1,
      carIndex: 0,
      driverName: 'Max Verstappen',
      teamName: 'Red Bull',
      teamId: 9,
      raceNumber: 1,
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
        { id: 2, session_id: 100, car_index: 0, lap_number: 2, lap_time_ms: 115000, is_valid: true, tyre_compound: 'MEDIUM', car_position: 1 },
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
      carIndex: 1,
      driverName: 'Lewis Hamilton',
      teamName: 'Mercedes',
      teamId: 1,
      raceNumber: 44,
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

  const mockProgressionData: ProgressionResponse = {
    lap_pace: [
      { lapNumber: 1, driver_0: 88.5, driver_1: 89.0 },
      { lapNumber: 2, driver_0: 115.0, driver_1: 88.9 },
      { lapNumber: 3, driver_0: 87.5, driver_1: 87.9 },
    ],
    positions: [
      { lapNumber: 1, driver_0: 1, driver_1: 2 },
      { lapNumber: 2, driver_0: 2, driver_1: 1 },
      { lapNumber: 3, driver_0: 1, driver_1: 2 },
    ],
    gap_to_leader: [
      { lapNumber: 1, driver_0: 0.0, driver_1: 0.5 },
      { lapNumber: 2, driver_0: 26.1, driver_1: 0.0 },
      { lapNumber: 3, driver_0: 0.0, driver_1: 0.4 },
    ],
    drivers: [
      { car_index: 0, driver_name: 'Max Verstappen', race_number: 1, team_id: 9, team_color: '#3671C6' },
      { car_index: 1, driver_name: 'Lewis Hamilton', race_number: 44, team_id: 1, team_color: '#DC0000' },
    ],
    total_session_laps: 3,
  };

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const min = Math.floor(ms / 60000);
    const sec = ((ms % 60000) / 1000).toFixed(3);
    return `${min}:${sec.padStart(6, '0')}`;
  };

  it('renders pace chart with pit laps and outlier filter toggle active by default', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          progressionData={mockProgressionData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    // Pit stop / outlier filter checkbox should exist and be checked by default
    const checkbox = screen.getByRole('checkbox', { name: /Filter Pit Stops & Anomalies/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    // Toggling the checkbox
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Chart title and buttons should be rendered
    expect(screen.getByText(/Lap-by-Lap Pace Evolution/i)).toBeInTheDocument();
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
  });

  it('allows switching between Pace, Position, and Gap charts', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          progressionData={mockProgressionData}
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
          progressionData={mockProgressionData}
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

  it('renders position progression in race mode', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          progressionData={mockProgressionData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
          isRaceSession={true}
        />
      </I18nProvider>
    );

    // Switch to Position chart
    const posBtn = screen.getByRole('button', { name: /Position Lap Chart/i });
    fireEvent.click(posBtn);
    expect(screen.getByText(/Position Progression/i)).toBeInTheDocument();
  });

  it('renders position progression in qualifying mode', () => {
    render(
      <I18nProvider>
        <SessionLapChartsTab
          progressionData={mockProgressionData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={3}
          formatLapTime={formatLapTime}
          isRaceSession={false}
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
});
