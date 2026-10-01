import { render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { SessionSectorMatrixTab } from './SessionSectorMatrixTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding, ClassificationResponse } from '../../types/session';
import { makeParticipant } from '../../test/wireFactories';
import { resetDevicePreferences, useDevicePreferencesStore } from '../../store/useDevicePreferencesStore';

describe('SessionSectorMatrixTab Component', () => {
  afterEach(() => resetDevicePreferences());

  const mockDriverStandings: DriverStanding[] = [
    {
      position: 1,
      carIndex: 0,
      driverName: 'Max Verstappen',
      teamName: 'Red Bull',
      teamId: 2,
      raceNumber: 1,
      participant: makeParticipant({
        id: 1,
        session_id: 100,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 2,
        race_number: 1,
        ai_controlled: false,
      }),
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
      carIndex: 1,
      driverName: 'Lewis Hamilton',
      teamName: 'Mercedes',
      teamId: 0,
      raceNumber: 44,
      participant: makeParticipant({
        id: 2,
        session_id: 100,
        car_index: 1,
        name: 'Lewis Hamilton',
        driver_id: 2,
        team_id: 0,
        race_number: 44,
        ai_controlled: false,
      }),
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
    standings: [], // the tab reads the normalized driverStandings prop instead
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

  it('shows the speed trap in this device’s unit', () => {
    useDevicePreferencesStore.getState().setUnits({ speed: 'mph' });
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
    expect(screen.getByText('205.4 mph')).toBeInTheDocument();
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

    const table = screen.getByRole('table', { name: 'Best sector times by driver' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);

    const s1Btn = screen.getByRole('radio', { name: 'S1' });
    fireEvent.click(s1Btn);
    expect(s1Btn).toHaveAttribute('aria-checked', 'true');
    expect(within(table).getByRole('columnheader', { name: 'BEST S1' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'BEST S2' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'S2' }));
    expect(within(table).getByRole('columnheader', { name: 'BEST S2' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'BEST S1' })).toBeNull();
  });
  it('scales the speed trap bars from the slowest to the fastest top speed', () => {
    const { container } = render(
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

    const bars = Array.from(container.querySelectorAll<HTMLElement>('[data-speed-bar]'));
    expect(bars.map((bar) => bar.style.width)).toEqual(['100%', '8%']);
  });
});
