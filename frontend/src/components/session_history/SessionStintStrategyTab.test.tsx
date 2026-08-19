import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding } from '../../types/session';

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
        team_id: 9, // Red Bull
        race_number: 1,
        ai_controlled: false,
      },
      bestLapTimeMS: 87500,
      bestLap: null,
      laps: [
        { id: 1, session_id: 100, car_index: 0, lap_number: 1, lap_time_ms: 88500, is_valid: true, tyre_compound: 'MEDIUM', actual_compound: 'C3', stint: 1 },
        { id: 2, session_id: 100, car_index: 0, lap_number: 2, lap_time_ms: 88200, is_valid: true, tyre_compound: 'MEDIUM', actual_compound: 'C3', stint: 1 },
        { id: 3, session_id: 100, car_index: 0, lap_number: 3, lap_time_ms: 88400, is_valid: true, tyre_compound: 'MEDIUM', actual_compound: 'C3', stint: 1 },
        { id: 4, session_id: 100, car_index: 0, lap_number: 4, lap_time_ms: 87500, is_valid: true, tyre_compound: 'HARD', actual_compound: 'C2', stint: 2 },
        { id: 5, session_id: 100, car_index: 0, lap_number: 5, lap_time_ms: 87800, is_valid: true, tyre_compound: 'HARD', actual_compound: 'C2', stint: 2 },
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
        team_id: 1, // Ferrari
        race_number: 44,
        ai_controlled: false,
      },
      bestLapTimeMS: 87900,
      bestLap: null,
      laps: [
        { id: 6, session_id: 100, car_index: 1, lap_number: 1, lap_time_ms: 89000, is_valid: true, tyre_compound: 'SOFT', actual_compound: 'C4', stint: 1 },
        { id: 7, session_id: 100, car_index: 1, lap_number: 2, lap_time_ms: 88900, is_valid: true, tyre_compound: 'SOFT', actual_compound: 'C4', stint: 1 },
        { id: 8, session_id: 100, car_index: 1, lap_number: 3, lap_time_ms: 87900, is_valid: true, tyre_compound: 'HARD', actual_compound: 'C2', stint: 2 },
        { id: 9, session_id: 100, car_index: 1, lap_number: 4, lap_time_ms: 88100, is_valid: true, tyre_compound: 'HARD', actual_compound: 'C2', stint: 2 },
        { id: 10, session_id: 100, car_index: 1, lap_number: 5, lap_time_ms: 88300, is_valid: true, tyre_compound: 'HARD', actual_compound: 'C2', stint: 2 },
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

  const renderTyreBadge = (compound?: string) => <span>{compound}</span>;

  it('renders top strategy KPI summary cards', () => {
    render(
      <I18nProvider>
        <SessionStintStrategyTab
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

    // 2 total pit stops (1 per driver)
    expect(screen.getByText('2 Stops')).toBeInTheDocument();
  });

  it('renders field tyre strategy timeline with drivers and stint segments', () => {
    render(
      <I18nProvider>
        <SessionStintStrategyTab
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
    fireEvent.click(hardCompoundBtn);

    // Toggle clear all / select all drivers
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(screen.getByText(/Select at least one driver and compound/i)).toBeInTheDocument();

    const selectAllBtn = screen.getByText('Select All');
    fireEvent.click(selectAllBtn);
  });

  it('renders correctly in Spanish locale', () => {
    localStorage.setItem('f1_telemetry_language', 'es');

    render(
      <I18nProvider>
        <SessionStintStrategyTab
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
