export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type RaceEngineerMode = 'live' | 'comparator' | 'session_debrief' | 'general';

export interface LiveTelemetryContext {
  trackName?: string;
  sessionType?: string;
  currentLap?: number;
  totalLaps?: number;
  safetyCarStatus?: string;
  weatherSummary?: string;
  lapTimesSummary?: string;
  liveSummary?: string;
}

export interface ComparatorTelemetryContext {
  trackName: string;
  lapA: {
    driver: string;
    lapNumber: number;
    lapTime: string;
    s1?: string;
    s2?: string;
    s3?: string;
    topSpeed?: number;
  };
  lapB: {
    driver: string;
    lapNumber: number;
    lapTime: string;
    s1?: string;
    s2?: string;
    s3?: string;
    topSpeed?: number;
  };
  deltaSummary: string;
  cornerAnalysis?: string;
}

export interface DebriefTelemetryContext {
  trackName: string;
  sessionType: string;
  winner: string;
  fastestLap: string;
  summary: string;
}
