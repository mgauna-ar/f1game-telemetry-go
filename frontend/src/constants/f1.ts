export const TEAM_COLORS: Record<number, string> = {
  0: '#00D2BE', // Mercedes-AMG Petronas
  1: '#DC0000', // Scuderia Ferrari HP
  2: '#3671C6', // Oracle Red Bull Racing
  3: '#64C4FF', // Williams Racing
  4: '#229971', // Aston Martin Aramco
  5: '#0090FF', // BWT Alpine
  6: '#6692FF', // Visa Cash App RB
  7: '#6CD3BF', // MoneyGram Haas F1 Team
  8: '#FF8000', // McLaren
  9: '#002B30', // Stake F1 Team Kick Sauber
  // 2026 Teams
  476: '#00D2BE', // Mercedes '26
  477: '#DC0000', // Ferrari '26
  478: '#3671C6', // Red Bull Racing '26
  479: '#64C4FF', // Williams '26
  480: '#229971', // Aston Martin '26
  481: '#0090FF', // Alpine '26
  482: '#6692FF', // RB '26
  483: '#6CD3BF', // Haas '26
  484: '#FF8000', // McLaren '26
  485: '#C0C0C0', // Audi '26
  486: '#D4AF37', // Cadillac '26
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
  3: 'BOOST',
};

export const ERS_MODE_NAMES: Record<number, string> = {
  0: 'Off',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Boost',
};

export const getErsModeName = (mode: number, format?: number | null): string => {
  if (mode === 3) {
    return format === 2025 ? 'Overtake' : 'Boost';
  }
  return ERS_MODE_NAMES[mode] || `Mode ${mode}`;
};

export const F1_DRIVER_NAMES: Record<number, string> = {
  0: 'Carlos Sainz',
  2: 'Daniel Ricciardo',
  3: 'Fernando Alonso',
  4: 'Felipe Massa',
  7: 'Lewis Hamilton',
  9: 'Max Verstappen',
  10: 'Nico Hülkenberg',
  11: 'Kevin Magnussen',
  14: 'Sergio Pérez',
  15: 'Valtteri Bottas',
  17: 'Esteban Ocon',
  19: 'Lance Stroll',
  22: 'Charles Leclerc',
  50: 'George Russell',
  54: 'Lando Norris',
  58: 'Charles Leclerc',
  59: 'Pierre Gasly',
  62: 'Alexander Albon',
  80: 'Guanyu Zhou',
  90: 'Michael Schumacher',
  94: 'Yuki Tsunoda',
  102: 'Aidan Jackson',
  109: 'Jenson Button',
  110: 'David Coulthard',
  112: 'Oscar Piastri',
  113: 'Liam Lawson',
  116: 'Richard Verschoor',
  123: 'Enzo Fittipaldi',
  125: 'Mark Webber',
  126: 'Jacques Villeneuve',
  132: 'Logan Sargeant',
  136: 'Jack Doohan',
  145: 'Zane Maloney',
  146: 'Victor Martins',
  147: 'Oliver Bearman',
  148: 'Jak Crawford',
  149: 'Isack Hadjar',
  152: 'Roman Stanek',
  153: 'Kush Maini',
  156: 'Brendon Leigh',
  157: 'David Tonizza',
  158: 'Jarno Opmeer',
  159: 'Lucas Blakeley',
  160: 'Paul Aron',
  161: 'Gabriel Bortoleto',
  162: 'Franco Colapinto',
  163: 'Taylor Barnard',
  164: 'Joshua Dürksen',
  165: 'Andrea-Kimi Antonelli',
  166: 'Ritomo Miyata',
  167: 'Rafael Villagómez',
  168: 'Zak O’Sullivan',
  169: 'Pepe Martí',
  170: 'Sonny Hayes',
};

export const WEATHER_TYPES: Record<number, string> = {
  0: 'Clear',
  1: 'Light Cloud',
  2: 'Overcast',
  3: 'Light Rain',
  4: 'Heavy Rain',
  5: 'Storm',
};
