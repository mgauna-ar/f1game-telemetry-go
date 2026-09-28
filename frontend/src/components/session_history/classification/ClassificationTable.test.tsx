import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import type { DriverStanding } from '../../../types/session';
import { makeLap, makeParticipant, makeSession } from '../../../test/wireFactories';
import { ClassificationTable } from './ClassificationTable';

const standing = (position: number, name: string, fields: Partial<DriverStanding>): DriverStanding => ({
  position,
  carIndex: position - 1,
  driverName: name,
  teamName: '',
  teamId: 0,
  raceNumber: position,
  bestLapTimeMS: 90000,
  isDNF: false,
  isDSQ: false,
  maxSpeed: 320,
  bestS1MS: 30000,
  bestS2MS: 30000,
  bestS3MS: 30000,
  participant: makeParticipant({ car_index: position - 1, name, race_number: position }),
  laps: [],
  ...fields,
});

const laps = (count: number) => Array.from({ length: count }, (_, i) => makeLap({ id: i + 1, lap_number: i + 1 }));

const renderTable = (isRaceSession: boolean, driverStandings: DriverStanding[]) =>
  render(
    <I18nProvider>
      <ClassificationTable
        session={makeSession({ id: 1 })}
        driverStandings={driverStandings}
        isRaceSession={isRaceSession}
        sessionBestS1={29000}
        sessionBestS2={29000}
        sessionBestS3={29000}
        sessionFastestLapMS={89000}
        expandedDrivers={{}}
        onToggleDriverExpand={() => {}}
        formatLapTime={(ms) => `${ms}`}
        formatTotalDuration={(ms) => `T${ms}`}
        renderTyreBadge={() => null}
        renderDriverTyreStints={() => null}
      />
    </I18nProvider>
  );

/** The text in the gap column of a driver's row, found by the column's header. */
const gapOf = (name: string) => {
  const headers = screen.getAllByRole('columnheader');
  const column = headers.findIndex((h) => /GAP|INTERVAL/.test(h.textContent ?? ''));
  const row = screen.getByRole('rowheader', { name: new RegExp(name) }).closest('tr') as HTMLElement;
  return row.children[column].textContent;
};

describe('ClassificationTable gap and interval', () => {
  it('shows a race gap to the leader, or the interval to the car ahead in time or laps', () => {
    renderTable(true, [
      standing(1, 'Leclerc', { laps: laps(3), totalRaceTimeWithPenalties: 270000 }),
      standing(2, 'Norris', { laps: laps(3), totalRaceTimeWithPenalties: 272500 }),
      standing(3, 'Piastri', { laps: laps(3), totalRaceTimeWithPenalties: 273000 }),
      standing(4, 'Albon', { laps: laps(2), totalRaceTimeWithPenalties: 190000 }),
      standing(5, 'Sainz', { laps: laps(2), totalRaceTimeWithPenalties: 191250 }),
    ]);
    expect(screen.getByRole('columnheader', { name: 'TIME / GAP' })).toBeInTheDocument();
    expect(gapOf('Piastri')).toBe('+3.000s');
    expect(gapOf('Sainz')).toBe('+1 Lap');

    fireEvent.click(screen.getByRole('radio', { name: 'Interval' }));
    expect(screen.getByRole('columnheader', { name: 'INTERVAL' })).toBeInTheDocument();
    expect(gapOf('Leclerc')).toBe('T270000');
    expect(gapOf('Piastri')).toBe('+0.500s');
    // A lap down on the car ahead, then on the same lap as the next one
    expect(gapOf('Albon')).toBe('+1 Lap');
    expect(gapOf('Sainz')).toBe('+1.250s');
  });

  it('shows a timing session gap to pole or to the car ahead on best laps', () => {
    renderTable(false, [
      standing(1, 'Leclerc', { bestLapTimeMS: 89000 }),
      standing(2, 'Norris', { bestLapTimeMS: 89200 }),
      standing(3, 'Piastri', { bestLapTimeMS: 89500 }),
    ]);
    expect(screen.getByRole('radio', { name: 'Gap to pole' })).toBeChecked();
    expect(gapOf('Piastri')).toBe('+0.500s');
    fireEvent.click(screen.getByRole('radio', { name: 'Interval' }));
    expect(gapOf('Piastri')).toBe('+0.300s');
  });

  it('colours best-lap sectors purple, green or yellow', () => {
    renderTable(false, [
      standing(1, 'Leclerc', {
        bestLapTimeMS: 89000,
        bestS1MS: 29000,
        bestS2MS: 29500,
        bestS3MS: 29800,
        bestLap: makeLap({ id: 9, lap_time_ms: 89000, sector1_ms: 29000, sector2_ms: 29500, sector3_ms: 30500 }),
      }),
    ]);
    const row = screen.getByRole('rowheader', { name: /Leclerc/ }).closest('tr') as HTMLElement;
    const kinds = Array.from(row.querySelectorAll('[data-best]')).map((el) => el.getAttribute('data-best'));
    expect(kinds).toEqual(['session', 'personal', 'none']);
  });
});
