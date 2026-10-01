import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { I18nProvider } from '../../context/I18nProvider';
import type { DriverStanding, StintsResponse } from '../../types/session';
import { makeParticipant } from '../../test/wireFactories';

describe('SessionStintStrategyTab Component', () => {
  const mockDriverStandings: DriverStanding[] = [
    {
      position: 1,
      carIndex: 0,
      driverName: 'Max Verstappen',
      teamName: 'Red Bull',
      teamId: 9,
      raceNumber: 1,
      participant: makeParticipant({
        id: 1,
        session_id: 100,
        car_index: 0,
        name: 'Max Verstappen',
        driver_id: 1,
        team_id: 9,
        race_number: 1,
        ai_controlled: false,
      }),
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
      carIndex: 1,
      driverName: 'Lewis Hamilton',
      teamName: 'Mercedes',
      teamId: 1,
      raceNumber: 44,
      participant: makeParticipant({
        id: 2,
        session_id: 100,
        car_index: 1,
        name: 'Lewis Hamilton',
        driver_id: 2,
        team_id: 1,
        race_number: 44,
        ai_controlled: false,
      }),
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
            fit_laps: 2,
            excluded_laps: [],
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
            fit_laps: 2,
            excluded_laps: [],
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
            fit_laps: 2,
            excluded_laps: [],
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
            fit_laps: 2,
            excluded_laps: [],
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

    expect(screen.getByText('Most Popular Strategy')).toBeInTheDocument();
    expect(screen.getByText('Longest Stint')).toBeInTheDocument();
    expect(screen.getByText('Total Pit Stops')).toBeInTheDocument();
    expect(screen.getByText('Fastest Lap by Compound')).toBeInTheDocument();

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
    const timeline = screen.getByText('Field Tyre Strategy Timeline').closest('section') as HTMLElement;
    expect(within(timeline).getByText('P1')).toBeInTheDocument();
    expect(within(timeline).getByText('P2')).toBeInTheDocument();
  });

  const renderTab = (stintsData: StintsResponse = mockStintsData, playerCarIndex: number | null = null) =>
    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={stintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
          playerCarIndex={playerCarIndex}
        />
      </I18nProvider>
    );

  const degradationTable = () => screen.getByRole('table', { name: /Degradation of each stint/ });
  const tableDrivers = () =>
    within(degradationTable())
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent);

  it('lists every stint in the degradation table and charts the ticked ones', () => {
    renderTab();

    expect(screen.getByText('Tyre Degradation & Stint Pace Curves')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ask the AI engineer about Tyre Degradation & Stint Pace Curves' })
    ).toBeInTheDocument();
    // Both drivers are picked by default, so all their stints are charted
    expect(screen.getByText('4 of 4 stints on the chart')).toBeInTheDocument();
    expect(within(degradationTable()).getAllByRole('checkbox')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 of 4 stints on the chart')).toBeInTheDocument();
    expect(screen.getByText(/Tick at least one stint/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Lewis Hamilton, stint 2 on the chart' }));
    expect(screen.getByText('1 of 4 stints on the chart')).toBeInTheDocument();

    // A driver button in the timeline toggles all of that driver's stints
    fireEvent.click(screen.getByRole('button', { name: /Max Verstappen/, pressed: false }));
    expect(screen.getByText('3 of 4 stints on the chart')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Max Verstappen/, pressed: true }));
    expect(screen.getByText('1 of 4 stints on the chart')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chart all' }));
    expect(screen.getByText('4 of 4 stints on the chart')).toBeInTheDocument();

    // The compound filter narrows the table
    fireEvent.click(screen.getByRole('radio', { name: /HARD/i }));
    expect(screen.getByText('2 of 2 stints on the chart')).toBeInTheDocument();
  });

  it('sorts the stints by degradation, with the stints that have no rate last', () => {
    renderTab();
    expect(tableDrivers()).toEqual(['P1Max Verstappen', 'P1Max Verstappen', 'P2Lewis Hamilton', 'P2Lewis Hamilton']);

    fireEvent.click(within(degradationTable()).getByRole('button', { name: /Deg \/ lap/ }));
    const rates = within(degradationTable())
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);
    expect(rates[0]).toContain('S1 · L1–3');
    expect(rates[0]).toContain('+0.100s');
    expect(rates[1]).toContain('+0.200s');
    expect(rates[2]).toContain('Needs 3 clean laps');
    expect(rates[3]).toContain('Needs 3 clean laps');

    // Descending keeps the stints with no rate last
    fireEvent.click(within(degradationTable()).getByRole('button', { name: /Deg \/ lap/ }));
    const desc = within(degradationTable())
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);
    expect(desc[0]).toContain('+0.200s');
    expect(desc[3]).toContain('Needs 3 clean laps');
  });

  it('says which laps the fit leaves out, and offers only your stints when you drove', () => {
    const withExclusions: StintsResponse = {
      ...mockStintsData,
      drivers: mockStintsData.drivers.map((d, i) =>
        i === 0
          ? {
              ...d,
              stints: [
                {
                  ...d.stints[0],
                  fit_laps: 1,
                  excluded_laps: [
                    { lap_number: 2, reason: 'sc' },
                    { lap_number: 3, reason: 'sc' },
                  ],
                },
                d.stints[1],
              ],
            }
          : d
      ),
    };
    renderTab(withExclusions, 1);

    expect(within(degradationTable()).getByText('1 of 3')).toBeInTheDocument();
    expect(within(degradationTable()).getByText('Left out: L2–3 safety car')).toBeInTheDocument();
    expect(within(degradationTable()).getAllByText('YOU')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Only yours' }));
    expect(screen.getByText('2 of 4 stints on the chart')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show Lewis Hamilton, stint 1 on the chart' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show Max Verstappen, stint 1 on the chart' })).not.toBeChecked();
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

    expect(screen.getByText('Estrategia Más Popular')).toBeInTheDocument();
    expect(screen.getByText('Stint Más Largo')).toBeInTheDocument();
    expect(screen.getByText('Paradas Totales en Boxes')).toBeInTheDocument();
    expect(screen.getByText('Vuelta Rápida por Compuesto')).toBeInTheDocument();
    expect(screen.getByText('Cronología de Estrategia de Neumáticos de la Parrilla')).toBeInTheDocument();
    expect(screen.getByText('Curvas de Degradación y Ritmo por Stint')).toBeInTheDocument();
  });

  it('sorts driver rows by finishing position (P1, P2...) in the Gantt timeline even if stintsData is unsorted', () => {
    // Reverse the order of drivers in stintsData
    const unsortedStintsData: StintsResponse = {
      ...mockStintsData,
      drivers: [mockStintsData.drivers[1], mockStintsData.drivers[0]], // Hamilton first, Verstappen second
    };

    render(
      <I18nProvider>
        <SessionStintStrategyTab
          stintsData={unsortedStintsData}
          driverStandings={mockDriverStandings}
          totalSessionLaps={5}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      </I18nProvider>
    );

    const pBadges = screen.getAllByText(/^P[0-9]+$/);
    expect(pBadges.length).toBeGreaterThanOrEqual(2);
    expect(pBadges[0]).toHaveTextContent('P1');
    expect(pBadges[1]).toHaveTextContent('P2');
  });
});
