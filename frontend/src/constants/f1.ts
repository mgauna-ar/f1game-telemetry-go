export const PACKET_IDS = {
  MOTION: 0,
  SESSION: 1,
  LAP_DATA: 2,
  EVENT: 3,
  PARTICIPANTS: 4,
  CAR_SETUP: 5,
  CAR_TELEMETRY: 6,
  CAR_STATUS: 7,
  FINAL_CLASSIFICATION: 8,
  LOBBY_INFO: 9,
  CAR_DAMAGE: 10,
  SESSION_HISTORY: 11,
  TYRE_SETS: 12,
  MOTION_EX: 13,
  TIME_TRIAL: 14,
  LAP_POSITIONS: 15,
  CAR_TELEMETRY_2: 16,
} as const;

export const TYRE_COMPOUND_IDS = {
  INTERMEDIATE: 7,
  WET: 8,
  SOFT: 16,
  MEDIUM: 17,
  HARD: 18,
  SUPER_SOFT: 19,
  CLASSIC_SOFT: 20,
  CLASSIC_MEDIUM: 21,
  CLASSIC_HARD: 22,
} as const;

export const SAFETY_CAR_STATUS = {
  CLEAR: 0,
  FULL: 1,
  VIRTUAL: 2,
  FORMATION_LAP: 3,
} as const;

export const RESULT_STATUS = {
  INVALID: 0,
  INACTIVE: 1,
  ACTIVE: 2,
  FINISHED: 3,
  DNF: 4,
  DSQ: 5,
  NOT_CLASSIFIED: 6,
  RETIRED: 7,
} as const;

export const PIT_STATUS = {
  NONE: 0,
  PITTING: 1,
  IN_PIT_AREA: 2,
} as const;

export const DRIVER_STATUS = {
  IN_GARAGE: 0,
  FLYING_LAP: 1,
  IN_LAP: 2,
  OUT_LAP: 3,
  ON_TRACK: 4,
} as const;

export const PENALTY_TYPES = {
  DRIVE_THROUGH: 0,
  STOP_GO: 1,
  GRID_PENALTY: 2,
  PENALTY_REMINDER: 3,
  TIME_PENALTY: 4,
  WARNING: 5,
  DISQUALIFIED: 6,
  REMOVED_FORMATION: 7,
  PARKED_TOO_LONG: 8,
  TYRE_REGULATIONS: 9,
  LAP_INVALIDATED_MIN: 10,
  LAP_INVALIDATED_MAX: 15,
  RETIRED: 16,
  BLACK_FLAG_TIMER: 17,
} as const;

export const WEATHER_CODES = {
  CLEAR: 0,
  LIGHT_CLOUD: 1,
  OVERCAST: 2,
  LIGHT_RAIN: 3,
  HEAVY_RAIN: 4,
  STORM: 5,
} as const;

export const SESSION_TYPES = {
  UNKNOWN: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  SHORT_P: 4,
  Q1: 5,
  Q2: 6,
  Q3: 7,
  SHORT_Q: 8,
  OSQ: 9,
  SPRINT_Q1: 10,
  SPRINT_Q2: 11,
  SPRINT_Q3: 12,
  SHORT_SPRINT_Q: 13,
  OS_SPRINT_Q: 14,
  RACE: 15,
  RACE_2: 16,
  RACE_3: 17,
  TIME_TRIAL: 18,
  SPRINT_RACE: 19,
  EQUAL_SPRINT_RACE: 20,
} as const;

export const TIME_CONSTANTS = {
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60000,
  MS_PER_HOUR: 3600000,
  SECONDS_PER_MINUTE: 60,
} as const;

export const ACTIVE_AERO_MODES = {
  CORNER: 0,
  STRAIGHT: 1,
} as const;

export const TELEMETRY_DOWNSAMPLE_LIMITS = {
  DEFAULT_MAX_POINTS: 800,
  BUFFER_THRESHOLD: 850,
} as const;

export const F1_FORMATS = {
  FORMAT_2025: 2025,
  FORMAT_2026: 2026,
} as const;

export const GRID_LIMITS = {
  MAX_CARS_2025: 22,
  MAX_CARS_2026: 24,
  MAX_GRID_CARS: 24,
} as const;

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
  [TYRE_COMPOUND_IDS.SOFT]: { label: 'S', color: '#ff3366', bg: 'rgba(255, 51, 102, 0.18)' }, // Soft (C5/C4/C3)
  [TYRE_COMPOUND_IDS.MEDIUM]: { label: 'M', color: '#ffd700', bg: 'rgba(255, 215, 0, 0.18)' }, // Medium
  [TYRE_COMPOUND_IDS.HARD]: { label: 'H', color: '#ffffff', bg: 'rgba(255, 255, 255, 0.18)' }, // Hard
  [TYRE_COMPOUND_IDS.INTERMEDIATE]: { label: 'I', color: '#33cc66', bg: 'rgba(51, 204, 102, 0.18)' }, // Intermediate
  [TYRE_COMPOUND_IDS.WET]: { label: 'W', color: '#3399ff', bg: 'rgba(51, 153, 255, 0.18)' }, // Wet
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
    return format === F1_FORMATS.FORMAT_2025 ? 'Overtake' : 'Boost';
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
  [WEATHER_CODES.CLEAR]: 'Clear',
  [WEATHER_CODES.LIGHT_CLOUD]: 'Light Cloud',
  [WEATHER_CODES.OVERCAST]: 'Overcast',
  [WEATHER_CODES.LIGHT_RAIN]: 'Light Rain',
  [WEATHER_CODES.HEAVY_RAIN]: 'Heavy Rain',
  [WEATHER_CODES.STORM]: 'Storm',
};
