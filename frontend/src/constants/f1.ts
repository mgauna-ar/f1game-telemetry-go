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

export const RESULT_REASONS = {
  INVALID: 0,
  RETIRED: 1,
  FINISHED: 2,
  TERMINAL_DAMAGE: 3,
  INACTIVE: 4,
  NOT_ENOUGH_LAPS: 5,
  BLACK_FLAGGED: 6,
  RED_FLAGGED: 7,
  MECHANICAL_FAILURE: 8,
  SESSION_SKIPPED: 9,
  SESSION_SIMULATED: 10,
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

export interface TrackInfo {
  id: number;
  name: string;
  countryCode: string;
  countryKey: string;
  countryIso3: string;
  aliases?: string[];
}

export const TRACK_METADATA: Record<number, TrackInfo> = {
  0: { id: 0, name: 'Melbourne', countryCode: 'au', countryKey: 'au', countryIso3: 'AUS', aliases: ['albert park', 'australia'] },
  1: { id: 1, name: 'Paul Ricard', countryCode: 'fr', countryKey: 'fr', countryIso3: 'FRA', aliases: ['le castellet', 'france'] },
  2: { id: 2, name: 'Shanghai', countryCode: 'cn', countryKey: 'cn', countryIso3: 'CHN', aliases: ['china', 'shanghai international circuit'] },
  3: { id: 3, name: 'Sakhir (Bahrain)', countryCode: 'bh', countryKey: 'bh', countryIso3: 'BHR', aliases: ['bahrain', 'sakhir', 'bahrain international circuit'] },
  4: { id: 4, name: 'Catalunya', countryCode: 'es', countryKey: 'es', countryIso3: 'ESP', aliases: ['barcelona', 'spain', 'circuit de barcelona-catalunya'] },
  5: { id: 5, name: 'Monaco', countryCode: 'mc', countryKey: 'mc', countryIso3: 'MCO', aliases: ['monte carlo', 'circuit de monaco'] },
  6: { id: 6, name: 'Montreal', countryCode: 'ca', countryKey: 'ca', countryIso3: 'CAN', aliases: ['canada', 'gilles villeneuve', 'circuit gilles villeneuve'] },
  7: { id: 7, name: 'Silverstone', countryCode: 'gb', countryKey: 'gb', countryIso3: 'GBR', aliases: ['great britain', 'uk', 'united kingdom'] },
  8: { id: 8, name: 'Hockenheim', countryCode: 'de', countryKey: 'de', countryIso3: 'DEU', aliases: ['germany', 'hockenheimring'] },
  9: { id: 9, name: 'Hungaroring', countryCode: 'hu', countryKey: 'hu', countryIso3: 'HUN', aliases: ['hungary', 'budapest'] },
  10: { id: 10, name: 'Spa-Francorchamps', countryCode: 'be', countryKey: 'be', countryIso3: 'BEL', aliases: ['spa', 'belgium', 'circuit de spa-francorchamps'] },
  11: { id: 11, name: 'Monza', countryCode: 'it', countryKey: 'it', countryIso3: 'ITA', aliases: ['autodromo nazionale monza', 'italy'] },
  12: { id: 12, name: 'Singapore', countryCode: 'sg', countryKey: 'sg', countryIso3: 'SGP', aliases: ['marina bay', 'marina bay street circuit'] },
  13: { id: 13, name: 'Suzuka', countryCode: 'jp', countryKey: 'jp', countryIso3: 'JPN', aliases: ['japan', 'suzuka international racing course'] },
  14: { id: 14, name: 'Abu Dhabi', countryCode: 'ae', countryKey: 'ae', countryIso3: 'ARE', aliases: ['yas marina', 'uae', 'united arab emirates'] },
  15: { id: 15, name: 'Texas (COTA)', countryCode: 'us', countryKey: 'us', countryIso3: 'USA', aliases: ['austin', 'texas', 'cota', 'circuit of the americas', 'united states', 'usa'] },
  16: { id: 16, name: 'Interlagos', countryCode: 'br', countryKey: 'br', countryIso3: 'BRA', aliases: ['brazil', 'são paulo', 'sao paulo', 'autódromo josé carlos pace'] },
  17: { id: 17, name: 'Red Bull Ring', countryCode: 'at', countryKey: 'at', countryIso3: 'AUT', aliases: ['austria', 'spielberg', 'österreichring'] },
  18: { id: 18, name: 'Sochi', countryCode: 'ru', countryKey: 'ru', countryIso3: 'RUS', aliases: ['russia', 'sochi autodrom'] },
  19: { id: 19, name: 'Mexico City', countryCode: 'mx', countryKey: 'mx', countryIso3: 'MEX', aliases: ['mexico', 'autódromo hermanos rodríguez', 'hermanos rodriguez'] },
  20: { id: 20, name: 'Baku (Azerbaijan)', countryCode: 'az', countryKey: 'az', countryIso3: 'AZE', aliases: ['baku', 'azerbaijan', 'baku city circuit'] },
  21: { id: 21, name: 'Sakhir Short', countryCode: 'bh', countryKey: 'bh', countryIso3: 'BHR', aliases: ['bahrain short', 'sakhir outer'] },
  22: { id: 22, name: 'Silverstone Short', countryCode: 'gb', countryKey: 'gb', countryIso3: 'GBR', aliases: ['silverstone national'] },
  23: { id: 23, name: 'Texas Short', countryCode: 'us', countryKey: 'us', countryIso3: 'USA', aliases: ['austin short', 'cota short'] },
  24: { id: 24, name: 'Suzuka Short', countryCode: 'jp', countryKey: 'jp', countryIso3: 'JPN', aliases: ['suzuka east'] },
  25: { id: 25, name: 'Hanoi', countryCode: 'vn', countryKey: 'vn', countryIso3: 'VNM', aliases: ['vietnam', 'hanoi street circuit'] },
  26: { id: 26, name: 'Zandvoort', countryCode: 'nl', countryKey: 'nl', countryIso3: 'NLD', aliases: ['netherlands', 'dutch', 'circuit zandvoort'] },
  27: { id: 27, name: 'Imola', countryCode: 'it', countryKey: 'it', countryIso3: 'ITA', aliases: ['emilia romagna', 'autodromo enzo e dino ferrari', 'san marino'] },
  28: { id: 28, name: 'Portimão', countryCode: 'pt', countryKey: 'pt', countryIso3: 'PRT', aliases: ['portimao', 'portugal', 'algarve'] },
  29: { id: 29, name: 'Jeddah', countryCode: 'sa', countryKey: 'sa', countryIso3: 'SAU', aliases: ['saudi arabia', 'jeddah cornice', 'jeddah corniche'] },
  30: { id: 30, name: 'Miami', countryCode: 'us', countryKey: 'us', countryIso3: 'USA', aliases: ['miami international autodrome'] },
  31: { id: 31, name: 'Las Vegas', countryCode: 'us', countryKey: 'us', countryIso3: 'USA', aliases: ['las vegas street circuit', 'vegas'] },
  32: { id: 32, name: 'Losail', countryCode: 'qa', countryKey: 'qa', countryIso3: 'QAT', aliases: ['lusail', 'qatar', 'losail international circuit'] },
  33: { id: 33, name: 'Lusail', countryCode: 'qa', countryKey: 'qa', countryIso3: 'QAT', aliases: ['losail', 'qatar'] },
  39: { id: 39, name: 'Silverstone (Reverse)', countryCode: 'gb', countryKey: 'gb', countryIso3: 'GBR', aliases: ['silverstone reverse'] },
  40: { id: 40, name: 'Austria (Reverse)', countryCode: 'at', countryKey: 'at', countryIso3: 'AUT', aliases: ['red bull ring reverse', 'austria reverse'] },
  41: { id: 41, name: 'Zandvoort (Reverse)', countryCode: 'nl', countryKey: 'nl', countryIso3: 'NLD', aliases: ['zandvoort reverse'] },
  42: { id: 42, name: 'Madrid', countryCode: 'es', countryKey: 'es', countryIso3: 'ESP', aliases: ['madrid circuit', 'spain madrid'] },
};

export const TRACK_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(TRACK_METADATA).map(([id, info]) => [Number(id), info.name])
);

export const getTrackInfo = (trackIdOrName?: number | string | null): TrackInfo | null => {
  if (trackIdOrName === undefined || trackIdOrName === null) return null;

  if (typeof trackIdOrName === 'number') {
    return TRACK_METADATA[trackIdOrName] || null;
  }

  const trimmed = trackIdOrName.trim().toLowerCase();
  if (!trimmed) return null;

  // 1. Direct name match or ID string match
  const numericId = Number(trimmed);
  if (!isNaN(numericId) && TRACK_METADATA[numericId]) {
    return TRACK_METADATA[numericId];
  }

  for (const info of Object.values(TRACK_METADATA)) {
    if (info.name.toLowerCase() === trimmed) {
      return info;
    }
    if (info.aliases && info.aliases.some((a) => a.toLowerCase() === trimmed || trimmed.includes(a.toLowerCase()) || a.toLowerCase().includes(trimmed))) {
      return info;
    }
  }

  return null;
};

export const AI_ERROR_CODES = {
  MISSING_API_KEY: 'MISSING_API_KEY',
  MODEL_OVERLOADED: 'MODEL_OVERLOADED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  NETWORK_ERROR: 'NETWORK_ERROR',
  GENERIC_ERROR: 'GENERIC_ERROR',
} as const;

export type AIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

export const AI_PROVIDER_URLS: Record<string, { name: string; url: string; freeTier: boolean }> = {
  gemini: {
    name: 'Google AI Studio',
    url: 'https://aistudio.google.com/app/apikey',
    freeTier: true,
  },
  openai: {
    name: 'OpenAI Platform',
    url: 'https://platform.openai.com/api-keys',
    freeTier: false,
  },
  custom: {
    name: 'Groq Console',
    url: 'https://console.groq.com/keys',
    freeTier: true,
  },
};

