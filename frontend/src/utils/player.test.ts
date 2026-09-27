import { describe, expect, it } from 'vitest';
import { makeParticipant } from '../test/wireFactories';
import { defaultChartCars, findPlayer } from './player';

describe('findPlayer', () => {
  const participants = [
    makeParticipant({ car_index: 0, name: 'Max Verstappen', race_number: 1 }),
    makeParticipant({ car_index: 1, name: 'Lando Norris', race_number: 4 }),
    makeParticipant({ car_index: 2, name: 'Oscar Piastri', race_number: 81 }),
  ];

  it("uses the session's stored car first", () => {
    expect(findPlayer(participants, 2, 'Norris')).toEqual({ participant: participants[2], source: 'recorded' });
  });

  it('finds nobody when the stored car has no participant, even if the name matches', () => {
    expect(findPlayer(participants, 9, 'Norris')).toBeUndefined();
  });

  it('matches the saved driver name, or race number, for older sessions', () => {
    expect(findPlayer(participants, null, 'norris')).toEqual({ participant: participants[1], source: 'driver_name' });
    expect(findPlayer(participants, null, '#81')?.participant.car_index).toBe(2);
    expect(findPlayer(participants, null, '')).toBeUndefined();
    expect(findPlayer(participants, null, 'Senna')).toBeUndefined();
  });
});

describe('defaultChartCars', () => {
  const grid = [10, 11, 12, 13, 14, 15, 16, 17];

  it('picks the top five without a player', () => {
    expect(defaultChartCars(grid, null)).toEqual([10, 11, 12, 13, 14]);
    expect(defaultChartCars(grid, 99)).toEqual([10, 11, 12, 13, 14]);
  });

  it('centres on the player, two ahead and two behind', () => {
    expect(defaultChartCars(grid, 14)).toEqual([12, 13, 14, 15, 16]);
  });

  it('shifts the window at either end of the classification', () => {
    expect(defaultChartCars(grid, 10)).toEqual([10, 11, 12, 13, 14]);
    expect(defaultChartCars(grid, 17)).toEqual([13, 14, 15, 16, 17]);
    expect(defaultChartCars([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });
});
