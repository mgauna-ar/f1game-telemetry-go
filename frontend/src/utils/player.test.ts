import { describe, expect, it } from 'vitest';
import { makeParticipant } from '../test/wireFactories';
import { defaultChartCars, findPlayer } from './player';

describe('findPlayer', () => {
  const participants = [
    makeParticipant({ car_index: 0, name: 'Max Verstappen', race_number: 1 }),
    makeParticipant({ car_index: 1, name: 'Lando Norris', race_number: 4 }),
    makeParticipant({ car_index: 2, name: 'Oscar Piastri', race_number: 81 }),
  ];

  it("finds the session's car and says who set it", () => {
    expect(findPlayer(participants, 2, 'game')).toEqual({ participant: participants[2], source: 'recorded' });
    expect(findPlayer(participants, 1, 'user')).toEqual({ participant: participants[1], source: 'chosen' });
    expect(findPlayer(participants, 0, null)).toEqual({ participant: participants[0], source: 'recorded' });
  });

  it('finds nobody without a car, or when the car has no participant', () => {
    expect(findPlayer(participants, null, null)).toBeUndefined();
    expect(findPlayer(participants, undefined, undefined)).toBeUndefined();
    expect(findPlayer(participants, 9, 'user')).toBeUndefined();
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
