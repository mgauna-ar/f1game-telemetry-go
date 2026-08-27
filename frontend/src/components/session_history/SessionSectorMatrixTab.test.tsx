import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionSectorMatrixTab } from './SessionSectorMatrixTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding, ClassificationResponse } from '../../types/session';

describe('SessionSectorMatrixTab Component', () => {
  const mockDriverStandings: DriverStanding[] = [
    {
      position: 1,
      participant: {
        id: 1,
        session_id: 100,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 2,
        race_number: 1,
        ai_controlled: false,
      },
      bestLapTimeMS: 87500,
      bestLap: null,
      laps: [],
      bestS1MS: 27500,
      bestS2MS: 33500,
      bestS3MS: 26500,
      theoreticalBestMS: 87500,
      maxSpeed: 330.5,
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
        team_id: 0,
        race_number: 44,
        ai_controlled: false,
      },
      bestLapTimeMS: 87800,
      bestLap: null,
      laps: [],
      bestS1MS: 27300,
      bestS2MS: 33800,
      bestS3MS: 26700,
      theoreticalBestMS: 87800,
      maxSpeed: 326.0,
      isDSQ: false,
      isDNF: false,
    },
  ];

  const mockClassificationData: ClassificationResponse = {
    standings: mockDriverStandings,
    session_best_s1_ms: 27300,
    session_best_s2_ms: 33500,
    session_best_s3_ms: 26500,
    ultimate_theoretical_ms: 87300,
    actual_best_lap_ms: 87500,
    actual_best_lap_driver: 'Max Verstappen',
    speed_rankings: [
      { car_index: 0, driver_name: 'Max Verstappen', team_id: 2, max_speed: 330.5, delta_to_top: 0.0 },
      { car_index: 1, driver_name: 'Lewis Hamilton', team_id: 0, max_speed: 326.0, delta_to_top: 4.5 },
    ],
  };

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const min = Math.floor(ms / 60000);
    const sec = ((ms % 60000) / 1000).toFixed(3);
    return `${min}:${sec.padStart(6, '0')}`;
  };

  it('renders ultimate theoretical lap card and sector matrix table', () => {
    render(
      <I18nProvider>
        <SessionSectorMatrixTab
          classificationData={mockClassificationData}
          driverStandings={mockDriverStandings}
          sessionBestS1={27300}
          sessionBestS2={33500}
          sessionBestS3={26500}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/ULTIMATE THEORETICAL LAP/i)).toBeInTheDocument();
    expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lewis Hamilton').length).toBeGreaterThan(0);
    expect(screen.getByText(/SPEED TRAP/i)).toBeInTheDocument();
    expect(screen.getByText('1:27.300')).toBeInTheDocument();
    expect(screen.getByText('330.5 km/h')).toBeInTheDocument();
  });

  it('supports sector filter buttons (ALL, S1, S2, S3)', () => {
    render(
      <I18nProvider>
        <SessionSectorMatrixTab
          classificationData={mockClassificationData}
          driverStandings={mockDriverStandings}
          sessionBestS1={27300}
          sessionBestS2={33500}
          sessionBestS3={26500}
          formatLapTime={formatLapTime}
        />
      </I18nProvider>
    );

    const s1Btn = screen.getByRole('button', { name: 'S1' });
    fireEvent.click(s1Btn);
    expect(s1Btn).toBeInTheDocument();

    const s2Btn = screen.getByRole('button', { name: 'S2' });
    fireEvent.click(s2Btn);
    expect(s2Btn).toBeInTheDocument();
  });
});
