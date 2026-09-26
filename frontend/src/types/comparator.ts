import type { TrackTurn } from './generated/analytics';

// Comparator wire types generated from the Go structs (go run ./cmd/tsgen).
export type { ComparatorLapMeta, ComparatorResponse, MergedTelemetryPoint, TrackTurn } from './generated/analytics';

export interface TurnContextInfo {
  turn: TrackTurn | null;
  phase: 'entry' | 'apex' | 'exit' | 'straight';
  label: string;
}

import type { Participant, Lap } from './session';

export interface TimingTowerDriver extends Participant {
  bestLap: Lap | null;
  sessionSlot?: 'A' | 'B';
  sessionTrack?: string;
  sessionType?: string;
}

export type QuickSelectDriver = TimingTowerDriver;

