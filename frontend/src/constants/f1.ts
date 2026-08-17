export const TEAM_COLORS: Record<number, string> = {
  0: '#00D2BE', // Mercedes-AMG Petronas
  1: '#DC0000', // Scuderia Ferrari HP
  2: '#3671C6', // Oracle Red Bull Racing
  3: '#229971', // Aston Martin Aramco
  4: '#0090FF', // BWT Alpine
  5: '#002B30', // Stake F1 Team Kick Sauber (Green/Black)
  6: '#6CD3BF', // MoneyGram Haas F1 Team (Silver/Red/White)
  7: '#64C4FF', // Williams Racing
  8: '#FF8000', // McLaren
  9: '#6692FF', // Visa Cash App RB
};

export const TYRE_COMPOUNDS: Record<number, { label: string; color: string; bg: string }> = {
  16: { label: 'S', color: '#ff3366', bg: 'rgba(255, 51, 102, 0.18)' }, // Soft (C5/C4/C3)
  17: { label: 'M', color: '#ffd700', bg: 'rgba(255, 215, 0, 0.18)' }, // Medium
  18: { label: 'H', color: '#ffffff', bg: 'rgba(255, 255, 255, 0.18)' }, // Hard
  7: { label: 'I', color: '#33cc66', bg: 'rgba(51, 204, 102, 0.18)' }, // Intermediate
  8: { label: 'W', color: '#3399ff', bg: 'rgba(51, 153, 255, 0.18)' }, // Wet
};

export const ERS_DEPLOY_MODES: Record<number, string> = {
  0: 'NONE',
  1: 'MEDIUM',
  2: 'HOTLAP',
  3: 'OVERTAKE',
};

export const ERS_MODE_NAMES: Record<number, string> = {
  0: 'Off',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Overtake',
};

export const F1_DRIVER_NAMES: Record<number, string> = {
  0: 'Carlos Sainz',
  1: 'Daniil Kvyat',
  2: 'Daniel Ricciardo',
  3: 'Fernando Alonso',
  6: 'Kimi Räikkönen',
  7: 'Lewis Hamilton',
  9: 'Max Verstappen',
  10: 'Lando Norris',
  11: 'Sergio Pérez',
  12: 'Valtteri Bottas',
  14: 'Esteban Ocon',
  15: 'Lance Stroll',
  17: 'George Russell',
  19: 'Alexander Albon',
  20: 'Nicholas Latifi',
  21: 'Pierre Gasly',
  22: 'Charles Leclerc',
  23: 'Zhou Guanyu',
  24: 'Mick Schumacher',
  25: 'Kevin Magnussen',
  26: 'Yuki Tsunoda',
  27: 'Logan Sargeant',
  28: 'Oscar Piastri',
  29: 'Liam Lawson',
  30: 'Nyck de Vries',
  31: 'Felipe Drugovich',
  32: 'Théo Pourchaire',
  33: 'Oliver Bearman',
  34: 'Kimi Antonelli',
  35: 'Jack Doohan',
  36: 'Gabriel Bortoleto',
  37: 'Isack Hadjar',
};

export const WEATHER_TYPES: Record<number, string> = {
  0: 'Clear',
  1: 'Light Cloud',
  2: 'Overcast',
  3: 'Light Rain',
  4: 'Heavy Rain',
  5: 'Storm',
};
