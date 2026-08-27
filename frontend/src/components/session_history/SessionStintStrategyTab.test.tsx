import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding, StintsResponse } from '../../types/session';

describe('SessionStintStrategyTab Component', () => {
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
      laps: [],
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
      laps: [],
      bestS1MS: 28100,
      bestS2MS: 33200,
      bestS3MS: 26600,
      maxSpeed: 322,
      isDSQ: false,
      isDNF: false,
    },
  ];

  const mockStintsData: StintsResponse = {
    drivers: [
      {
        car_index: 0,
        driver_name: 'Max Verstappen',
        race_number: 1,
        team_id: 9,
        position: 1,
        strategy_string: 'M (3L) ➔ H (2L)',
        total_stints: 2,
        total_pits: 1,
        stints: [
          {
            stint_index: 1,
            stint_id: 1,
            compound: 'MEDIUM',
            actual_compound: 'C3',
            start_lap: 1,
            end_lap: 3,
            total_laps: 3,
            avg_lap_time_ms: 88366,
            best_lap_time_ms: 88200,
            has_pit_stop_after: true,
            deg_slope_sec_per_lap: 0.1,
            laps: [],
          },
          {
            stint_index: 2,
            stint_id: 2,
            compound: 'HARD',
            actual_compound: 'C2',
            start_lap: 4,
            end_lap: 5,
            total_laps: 2,
            avg_lap_time_ms: 87650,
            best_lap_time_ms: 87500,
            has_pit_stop_after: false,
            deg_slope_sec_per_lap: null,
            laps: [],
          },
        ],
      },
      {
        car_index: 1,
        driver_name: 'Lewis Hamilton',
        race_number: 44,
        team_id: 1,
        position: 2,
        strategy_string: 'S (2L) ➔ H (3L)',
        total_stints: 2,
        total_pits: 1,
        stints: [
          {
            stint_index: 1,
            stint_id: 1,
            compound: 'SOFT',
            actual_compound: 'C4',
            start_lap: 1,
            end_lap: 2,
            total_laps: 2,
            avg_lap_time_ms: 88950,
            best_lap_time_ms: 88900,
            has_pit_stop_after: true,
            deg_slope_sec_per_lap: null,
            laps: [],
          },
          {
            stint_index: 2,
            stint_id: 2,
            compound: 'HARD',
            actual_compound: 'C2',
            start_lap: 3,
            end_lap: 5,
            total_laps: 3,
            avg_lap_time_ms: 88100,
            best_lap_time_ms: 87900,
            has_pit_stop_after: false,
            deg_slope_sec_per_lap: 0.2,
            laps: [],
          },
        ],
      },
    ],
    kpis: {
      most_popular_strategy: 'M ➔ H',
      most_popular_count: 1,
      longest_stint: {
        driver_name: 'Max Verstappen',
        car_index: 0,
        race_number: 1,
        compound: 'MEDIUM',
        total_laps: 3,
      },
      best_laps_by_compound: {
        MEDIUM: { time_ms: 88200, driver_name: 'Max Verstappen', car_index: 0 },
        HARD: { time_ms: 87500, driver_name: 'Max Verstappen', car_index: 0 },
        SOFT: { time_ms: 88900, driver_name: 'Lewis Hamilton', car_index: 1 },
      },
      total_field_pit_stops: 2,
    },
    degradation_data: [
      { tyreAge: 1, driver_0_stint_1: 88.5, driver_1_stint_1: 89.0, driver_0_stint_2: 87.5, driver_1_stint_2: 87.9 },
      { tyreAge: 2, driver_0_stint_1: 88.2, driver_1_stint_1: 88.9, driver_0_stint_2: 87.8, driver_1_stint_2: 88.1 },
      { tyreAge: 3, driver_0_stint_1: 88.4, driver_1_stint_2: 88.3 },
    ],
    max_tyre_age: 3,
    degradation_rates: {
      driver_0_stint_1: 0.1,
      driver_1_stint_2: 0.2,
    },
    session_compounds: ['MEDIUM', 'HARD', 'SOFT'],
    effective_max_laps: 5,
  };

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const min = Math.floor(ms / 60000);
    const sec = ((ms % 60000) / 1000).toFixed(3);
    return `${min}:${sec.padStart(6, '0')}`;
  };

  const renderTyreBadge = (compound?: string) => <span>{compound}</span>;

  it('renders top strategy KPI summary cards', () => {
    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={mockStintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      </I18nProvider>
    );

    expect(screen.getByText('MOST POPULAR STRATEGY')).toBeInTheDocument();
    expect(screen.getByText('LONGEST STINT')).toBeInTheDocument();
    expect(screen.getByText('TOTAL PIT STOPS')).toBeInTheDocument();
    expect(screen.getByText('FASTEST LAP BY COMPOUND')).toBeInTheDocument();

    // 2 total pit stops
    expect(screen.getByText(/2 Stops/i)).toBeInTheDocument();
  });

  it('renders field tyre strategy timeline with drivers and stint segments', () => {
    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={mockStintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Field Tyre Strategy Timeline')).toBeInTheDocument();
    expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lewis Hamilton').length).toBeGreaterThan(0);
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('renders tyre degradation and pace curves with interactive driver & compound filters', () => {
    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={mockStintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Tyre Degradation & Stint Pace Curves')).toBeInTheDocument();
    expect(screen.getByText('All Compounds')).toBeInTheDocument();

    // Filter by compound button
    const hardCompoundBtn = screen.getByRole('button', { name: /HARD/i });
    expect(hardCompoundBtn).toBeInTheDocument();
    fireEvent.click(hardCompoundBtn);

    // Toggle clear all / select all drivers
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);

    const selectAllBtn = screen.getByText('Select All');
    fireEvent.click(selectAllBtn);
  });

  it('renders correctly in Spanish locale', () => {
    localStorage.setItem('f1_telemetry_language', 'es');

    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={mockStintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      </I18nProvider>
    );

    expect(screen.getByText('ESTRATEGIA MÁS POPULAR')).toBeInTheDocument();
    expect(screen.getByText('STINT MÁS LARGO')).toBeInTheDocument();
    expect(screen.getByText('PARADAS TOTALES EN BOXES')).toBeInTheDocument();
    expect(screen.getByText('VUELTA RÁPIDA POR COMPUESTO')).toBeInTheDocument();
    expect(screen.getByText('Cronología de Estrategia de Neumáticos de la Parrilla')).toBeInTheDocument();
    expect(screen.getByText('Curvas de Degradación y Ritmo por Stint')).toBeInTheDocument();
  });
});
