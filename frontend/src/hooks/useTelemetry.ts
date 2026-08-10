import { useState, useEffect, useRef } from 'react';

export interface CarTelemetryData {
  Speed: number;
  Throttle: number;
  Steer: number;
  Brake: number;
  Clutch: number;
  Gear: number;
  EngineRPM: number;
  DRS: number;
  RevLightsPercent: number;
}

export interface LapData {
  LastLapTimeInMS: number;
  CurrentLapTimeInMS: number;
  Sector1TimeMSPart: number;
  Sector1TimeMinutesPart?: number;
  Sector2TimeMSPart: number;
  Sector2TimeMinutesPart?: number;
  DeltaToCarInFrontMSPart?: number;
  DeltaToCarInFrontMinutesPart?: number;
  DeltaToRaceLeaderMSPart?: number;
  DeltaToRaceLeaderMinutesPart?: number;
  SafetyCarDelta?: number;
  CarPosition: number;
  CurrentLapNum: number;
  PitStatus: number;
  NumPitStops?: number;
  Sector?: number;
  CurrentLapInvalid: number;
  DriverStatus?: number;
  ResultStatus?: number;
  LapDistance?: number;
  TotalDistance?: number;
}

export interface CarMotionData {
  WorldPositionX: number;
  WorldPositionY: number;
  WorldPositionZ: number;
}

export interface SessionData {
  Weather: number;
  TrackTemperature: number;
  AirTemperature: number;
  TotalLaps: number;
  TrackLength: number;
  SessionType: number;
  TrackId: number;
  SessionTimeLeft: number;
  SessionDuration: number;
  SafetyCarStatus: number;
}

export interface ParticipantData {
  AIControlled: number;
  DriverId: number;
  NetworkId?: number;
  TeamId: number;
  MyTeam?: number;
  RaceNumber: number;
  Nationality: number;
  Name: string | number[];
}

export interface CarStatusData {
  FuelInTank: number;
  FuelCapacity?: number;
  VisualTyreCompound: number;
  ActualTyreCompound?: number;
  TyresAgeLaps?: number;
  ERSStoreEnergy: number;
  ERSDeployMode: number;
  ERSHarvestedThisLapMGUK?: number;
  ERSHarvestedThisLapMGUH?: number;
  ERSDeployedThisLap?: number;
}

export interface CarSetupData {
  FrontWing: number;
  RearWing: number;
  OnThrottle: number;
  OffThrottle: number;
  FrontCamber: number;
  RearCamber: number;
  FrontToe: number;
  RearToe: number;
  FrontSuspension: number;
  RearSuspension: number;
  FrontAntiRollBar: number;
  RearAntiRollBar: number;
  FrontSuspensionHeight: number;
  RearSuspensionHeight: number;
  BrakePressure: number;
  BrakeBias: number;
  FrontTyrePressure: number;
  RearTyrePressure: number;
  Ballast: number;
  FuelLoad: number;
}

export interface PacketHeader {
  PacketId: number;
  SessionTime: number;
  PlayerCarIndex: number;
}

interface PacketCarTelemetryData {
  Header: PacketHeader;
  CarTelemetryData: CarTelemetryData[];
}

interface PacketCarSetupData {
  Header: PacketHeader;
  CarSetupData: CarSetupData[];
}


interface PacketLapData {
  Header: PacketHeader;
  LapData: LapData[];
}

interface PacketMotionData {
  Header: PacketHeader;
  CarMotionData: CarMotionData[];
}

interface PacketSessionData {
  Header: PacketHeader;
  Weather: number;
  TrackTemperature: number;
  AirTemperature: number;
  TotalLaps: number;
  TrackLength: number;
  SessionType: number;
  TrackId: number;
  SessionTimeLeft: number;
  SessionDuration: number;
  SafetyCarStatus: number;
}

interface PacketParticipantsData {
  Header: PacketHeader;
  NumActiveCars: number;
  Participants: ParticipantData[];
}

interface PacketCarStatusData {
  Header: PacketHeader;
  CarStatusData: CarStatusData[];
}

export interface TelemetrySample extends CarTelemetryData {
  SessionTime: number;
}

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

export function parseDriverName(rawName: string | number[] | undefined, defaultName: string, driverId?: number): string {
  let nameStr = '';
  if (typeof rawName === 'string') {
    nameStr = rawName.replace(/\0/g, '').trim();
  } else if (Array.isArray(rawName)) {
    const chars = rawName.map(c => String.fromCharCode(c)).join('');
    nameStr = chars.replace(/\0/g, '').trim();
  }

  if (nameStr && nameStr.length > 0) {
    return nameStr;
  }

  if (driverId !== undefined && F1_DRIVER_NAMES[driverId]) {
    return F1_DRIVER_NAMES[driverId];
  }

  return defaultName;
}

export function useTelemetry(wsUrl?: string) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [allLaps, setAllLaps] = useState<LapData[]>([]);
  const [allMotion, setAllMotion] = useState<CarMotionData[]>([]);
  const [allCarStatus, setAllCarStatus] = useState<CarStatusData[]>([]);
  const [allCarSetup, setAllCarSetup] = useState<CarSetupData[]>([]);
  const [allTelemetry, setAllTelemetry] = useState<CarTelemetryData[]>([]);
  
  const [playerCarIndex, setPlayerCarIndex] = useState<number>(0);
  const [selectedCarIndex, setSelectedCarIndex] = useState<number>(0);

  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [trackPath, setTrackPath] = useState<{ x: number; z: number }[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const historyRef = useRef<TelemetrySample[]>([]);
  const selectedCarIndexRef = useRef<number>(0);

  useEffect(() => {
    selectedCarIndexRef.current = selectedCarIndex;
  }, [selectedCarIndex]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const getTargetUrl = () => {
      if (wsUrl) return wsUrl;
      if (typeof window === 'undefined') return 'ws://localhost:8080/ws';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    };

    const connect = () => {
      if (isUnmounted) return;

      const targetUrl = getTargetUrl();
      try {
        const socket = new WebSocket(targetUrl);
        ws.current = socket;

        socket.onopen = () => {
          if (!isUnmounted) setConnected(true);
        };

        socket.onclose = () => {
          if (!isUnmounted) {
            setConnected(false);
            reconnectTimer = setTimeout(connect, 2000);
          }
        };

        socket.onerror = () => {
          if (!isUnmounted) {
            setConnected(false);
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const header = data.Header as PacketHeader;
            if (!header) return;

            const playerIdx = header.PlayerCarIndex !== undefined ? header.PlayerCarIndex : 0;
            setPlayerCarIndex(playerIdx);

            // PacketID 1: Session Data
            if (header.PacketId === 1) {
              const pkt = data as PacketSessionData;
              setSession({
                Weather: pkt.Weather,
                TrackTemperature: pkt.TrackTemperature,
                AirTemperature: pkt.AirTemperature,
                TotalLaps: pkt.TotalLaps,
                TrackLength: pkt.TrackLength,
                SessionType: pkt.SessionType,
                TrackId: pkt.TrackId,
                SessionTimeLeft: pkt.SessionTimeLeft,
                SessionDuration: pkt.SessionDuration,
                SafetyCarStatus: pkt.SafetyCarStatus,
              });
            }
            // PacketID 4: Participants Data
            else if (header.PacketId === 4) {
              const pkt = data as PacketParticipantsData;
              if (pkt.Participants && pkt.Participants.length > 0) {
                const activeCount = pkt.NumActiveCars && pkt.NumActiveCars > 0 ? pkt.NumActiveCars : pkt.Participants.length;
                setParticipants(pkt.Participants.slice(0, activeCount));
              }
            }
            // PacketID 7: Car Status Data
            else if (header.PacketId === 7) {
              const pkt = data as PacketCarStatusData;
              if (pkt.CarStatusData) {
                setAllCarStatus(pkt.CarStatusData);
              }
            }
            // PacketID 5: Car Setup Data
            else if (header.PacketId === 5) {
              const pkt = data as PacketCarSetupData;
              if (pkt.CarSetupData) {
                setAllCarSetup(pkt.CarSetupData);
              }
            }
            // PacketID 6: Car Telemetry Data
            else if (header.PacketId === 6) {
              const pkt = data as PacketCarTelemetryData;
              if (pkt.CarTelemetryData) {
                setAllTelemetry(pkt.CarTelemetryData);
                const activeIdx = selectedCarIndexRef.current < pkt.CarTelemetryData.length ? selectedCarIndexRef.current : playerIdx;
                const current = pkt.CarTelemetryData[activeIdx] || pkt.CarTelemetryData[playerIdx];

                if (current) {
                  const sample: TelemetrySample = {
                    ...current,
                    SessionTime: header.SessionTime,
                  };
                  historyRef.current = [...historyRef.current.slice(-99), sample];
                  setHistory(historyRef.current);
                }
              }
            }
            // PacketID 2: Lap Data
            else if (header.PacketId === 2) {
              const pkt = data as PacketLapData;
              if (pkt.LapData) {
                setAllLaps(pkt.LapData);
              }
            }
            // PacketID 0: Motion Data
            else if (header.PacketId === 0) {
              const pkt = data as PacketMotionData;
              if (pkt.CarMotionData) {
                setAllMotion(pkt.CarMotionData);
                const playerMotion = pkt.CarMotionData[playerIdx];
                if (playerMotion) {
                  setTrackPath((prev) => {
                    const last = prev[prev.length - 1];
                    if (!last || Math.abs(last.x - playerMotion.WorldPositionX) > 1.0 || Math.abs(last.z - playerMotion.WorldPositionZ) > 1.0) {
                      return [...prev, { x: playerMotion.WorldPositionX, z: playerMotion.WorldPositionZ }];
                    }
                    return prev;
                  });
                }
              }
            }
          } catch (err) {
            console.error('Failed to parse telemetry packet:', err);
          }
        };
      } catch (err) {
        if (!isUnmounted) {
          setConnected(false);
          reconnectTimer = setTimeout(connect, 2000);
        }
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws.current) {
        ws.current.onclose = null; // Prevent onclose reconnect loop on clean unmount
        ws.current.close();
      }
    };
  }, [wsUrl]);

  const activeIdx = selectedCarIndex < (allTelemetry.length || 1) ? selectedCarIndex : playerCarIndex;
  const telemetry = allTelemetry[activeIdx] || null;
  const lap = allLaps[activeIdx] || null;
  const motion = allMotion[activeIdx] || null;
  const carStatus = allCarStatus[activeIdx] || null;
  const carSetup = allCarSetup[activeIdx] || null;

  return {
    session,
    participants,
    allLaps,
    allMotion,
    allCarStatus,
    allCarSetup,
    allTelemetry,
    telemetry,
    lap,
    motion,
    carStatus,
    carSetup,
    trackPath,
    connected,
    history,
    playerCarIndex,
    selectedCarIndex,
    setSelectedCarIndex,
  };
}


