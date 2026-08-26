export interface MergedTelemetryPoint {
  lap_distance: number;
  time_delta: number | null;
  timeA: number | null;
  timeB: number | null;
  speedA: number | null;
  speedB: number | null;
  speed_delta: number | null;
  throttleA: number | null;
  throttleB: number | null;
  brakeA: number | null;
  brakeB: number | null;
  steerA: number | null;
  steerB: number | null;
  gearA: number | null;
  gearB: number | null;
  ersBatteryA: number | null;
  ersBatteryB: number | null;
  ersDeployModeA: number | null;
  ersDeployModeB: number | null;
  activeAeroA?: number | null;
  activeAeroB?: number | null;
  boostActiveA?: number | null;
  boostActiveB?: number | null;
  worldX?: number | null;
  worldZ?: number | null;
}

export interface TrackTurn {
  turnNumber: number;
  name: string;
  distance: number;
  entryDistance: number;
  exitDistance: number;
  worldX: number;
  worldZ: number;
  normalX: number;
  normalZ: number;
  speedA?: number;
  speedB?: number;
}

export interface TurnContextInfo {
  turn: TrackTurn | null;
  phase: 'entry' | 'apex' | 'exit' | 'straight';
  label: string;
}

export interface ComparatorLapMeta {
  lap_id: number;
  lap_time_ms: number;
  driver: string;
  compound: string;
  tyre_age: number;
}

export interface ComparatorResponse {
  points: MergedTelemetryPoint[];
  turns: TrackTurn[];
  lap_a?: ComparatorLapMeta;
  lap_b?: ComparatorLapMeta;
}
