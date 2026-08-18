import { useState, useEffect, useRef } from 'react';
import type {
  CarTelemetryData,
  LapData,
  CarMotionData,
  WeatherForecastSample,
  SessionData,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  TelemetrySample,
} from '../types/telemetry';
import { F1_DRIVER_NAMES } from '../constants/f1';

export type {
  CarTelemetryData,
  LapData,
  CarMotionData,
  WeatherForecastSample,
  SessionData,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  TelemetrySample,
};

export { F1_DRIVER_NAMES };

interface PacketCarTelemetryData {
  Header: PacketHeader;
  CarTelemetryData: CarTelemetryData[];
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
  PitStopWindowIdealLap?: number;
  PitStopWindowLatestLap?: number;
  PitStopRejoinPosition?: number;
  NumWeatherForecastSamples?: number;
  WeatherForecastSamples?: WeatherForecastSample[];
  NumSafetyCarPeriods?: number;
  NumVirtualSafetyCarPeriods?: number;
  NumRedFlagPeriods?: number;
}

interface PacketEventData {
  Header: PacketHeader;
  EventCode: string;
  VehicleIdx?: number;
  OtherVehicleIdx?: number;
  LapTime?: number;
  Speed?: number;
  PenaltyType?: number;
  PenaltyTime?: number;
  LapNum?: number;
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

interface PacketCarDamageData {
  Header: PacketHeader;
  CarDamageData: CarDamageData[];
}

interface PacketCarTelemetry2Data {
  Header: PacketHeader;
  CarTelemetry2Data: import('../types/telemetry').CarTelemetry2Data[];
}

export function parseDriverName(rawName: string | number[] | undefined, defaultName: string, driverId?: number): string {
  let nameStr = '';
  if (typeof rawName === 'string') {
    // Go's encoding/json marshals [48]byte as base64 strings.
    // Detect base64: only contains A-Za-z0-9+/= and is longer than a typical plain name.
    if (rawName.length > 20 && /^[A-Za-z0-9+/=]+$/.test(rawName)) {
      try {
        const decoded = atob(rawName);
        // Extract up to the first null byte
        const nullIdx = decoded.indexOf('\0');
        const candidate = (nullIdx !== -1 ? decoded.slice(0, nullIdx) : decoded).trim();
        // Only accept if all characters are printable ASCII (0x20-0x7E)
        if (candidate.length > 0 && /^[\x20-\x7E]+$/.test(candidate)) {
          nameStr = candidate;
        }
      } catch {
        // atob() failed — not valid base64, fall through to raw string handling
      }
    }

    // Fall through: try raw string with null-byte search if base64 didn't produce a name
    if (!nameStr) {
      const nullIdx = rawName.indexOf('\0');
      nameStr = (nullIdx !== -1 ? rawName.slice(0, nullIdx) : rawName).trim();
    }
  } else if (Array.isArray(rawName)) {
    const nullIdx = rawName.indexOf(0);
    const validBytes = nullIdx !== -1 ? rawName.slice(0, nullIdx) : rawName;
    nameStr = validBytes.map(c => String.fromCharCode(c)).join('').trim();
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
  const [allCarDamage, setAllCarDamage] = useState<CarDamageData[]>([]);
  const [allTelemetry, setAllTelemetry] = useState<CarTelemetryData[]>([]);
  const [allTelemetry2, setAllTelemetry2] = useState<import('../types/telemetry').CarTelemetry2Data[]>([]);
  const [events, setEvents] = useState<RaceEvent[]>([]);
  
  const [playerCarIndex, setPlayerCarIndex] = useState<number>(0);
  const [selectedCarIndex, setSelectedCarIndex] = useState<number>(0);
  const [packetFormat, setPacketFormat] = useState<number | null>(null);

  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [trackPath, setTrackPath] = useState<{ x: number; z: number }[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const historyRef = useRef<TelemetrySample[]>([]);
  const selectedCarIndexRef = useRef<number>(0);
  const participantsRef = useRef<ParticipantData[]>([]);
  const prevLapsRef = useRef<LapData[]>([]);
  const prevSafetyCarRef = useRef<number>(0);

  useEffect(() => {
    selectedCarIndexRef.current = selectedCarIndex;
  }, [selectedCarIndex]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const addEvent = (event: Omit<RaceEvent, 'id' | 'timestamp'>) => {
    const newEvt: RaceEvent = {
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    };
    setEvents((prev) => [newEvt, ...prev].slice(0, 80));
  };

  const clearEvents = () => {
    setEvents([]);
  };

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

            if (header.PacketFormat) {
              setPacketFormat(header.PacketFormat);
            }

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
                PitStopWindowIdealLap: pkt.PitStopWindowIdealLap,
                PitStopWindowLatestLap: pkt.PitStopWindowLatestLap,
                PitStopRejoinPosition: pkt.PitStopRejoinPosition,
                NumWeatherForecastSamples: pkt.NumWeatherForecastSamples,
                WeatherForecastSamples: pkt.WeatherForecastSamples?.slice(0, pkt.NumWeatherForecastSamples || 4),
                NumSafetyCarPeriods: pkt.NumSafetyCarPeriods,
                NumVirtualSafetyCarPeriods: pkt.NumVirtualSafetyCarPeriods,
                NumRedFlagPeriods: pkt.NumRedFlagPeriods,
                PacketFormat: header.PacketFormat,
              });

              // Track Safety Car status change events
              if (prevSafetyCarRef.current !== pkt.SafetyCarStatus) {
                const scStatus = pkt.SafetyCarStatus;
                let desc = 'Track Clear (Green Flag)';
                let sev: RaceEvent['severity'] = 'success';
                if (scStatus === 1) {
                  desc = 'Full Safety Car Deployed';
                  sev = 'warning';
                } else if (scStatus === 2) {
                  desc = 'Virtual Safety Car Deployed';
                  sev = 'warning';
                } else if (scStatus === 3) {
                  desc = 'Formation Lap In Progress';
                  sev = 'info';
                }
                addEvent({
                  eventCode: 'SCAR',
                  type: 'flag',
                  description: desc,
                  severity: sev,
                  sessionTime: header.SessionTime,
                });
                prevSafetyCarRef.current = scStatus;
              }
            }
            // PacketID 3: Event Data
            else if (header.PacketId === 3) {
              const pkt = data as PacketEventData;
              const code = pkt.EventCode;
              const vIdx = pkt.VehicleIdx ?? 0;
              const driver = participantsRef.current[vIdx];
              const driverName = parseDriverName(driver?.Name, `Car #${vIdx + 1}`, driver?.DriverId);

              switch (code) {
                case 'FTLP':
                  addEvent({
                    eventCode: 'FTLP',
                    type: 'fastest_lap',
                    description: `${driverName} set the fastest lap (${(pkt.LapTime || 0).toFixed(3)}s)`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'purple',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'OVTK': {
                  const targetIdx = pkt.OtherVehicleIdx ?? 0;
                  const targetDriver = participantsRef.current[targetIdx];
                  const targetName = parseDriverName(targetDriver?.Name, `Car #${targetIdx + 1}`, targetDriver?.DriverId);
                  addEvent({
                    eventCode: 'OVTK',
                    type: 'overtake',
                    description: `${driverName} overtook ${targetName}`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'info',
                    sessionTime: header.SessionTime,
                  });
                  break;
                }
                case 'PENA':
                  addEvent({
                    eventCode: 'PENA',
                    type: 'penalty',
                    description: `${driverName} received a ${pkt.PenaltyTime || 5}s time penalty`,
                    vehicleIdx: vIdx,
                    driverName,
                    lapNum: pkt.LapNum,
                    severity: 'danger',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'SPTP':
                  addEvent({
                    eventCode: 'SPTP',
                    type: 'speed_trap',
                    description: `${driverName} triggered speed trap at ${(pkt.Speed || 0).toFixed(1)} km/h`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'success',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'TMPT':
                  addEvent({
                    eventCode: 'TMPT',
                    type: 'pit',
                    description: `${driverName} entered the pit lane`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'warning',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'RTMT':
                  addEvent({
                    eventCode: 'RTMT',
                    type: 'retirement',
                    description: `${driverName} retired from the session`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'danger',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'SSTA':
                  addEvent({
                    eventCode: 'SSTA',
                    type: 'general',
                    description: 'Session Started',
                    severity: 'success',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'SEND':
                  addEvent({
                    eventCode: 'SEND',
                    type: 'general',
                    description: 'Session Ended',
                    severity: 'info',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'CHQF':
                  addEvent({
                    eventCode: 'CHQF',
                    type: 'flag',
                    description: 'Chequered Flag waved',
                    severity: 'info',
                    sessionTime: header.SessionTime,
                  });
                  break;
                case 'RCWN':
                  addEvent({
                    eventCode: 'RCWN',
                    type: 'general',
                    description: `${driverName} won the race!`,
                    vehicleIdx: vIdx,
                    driverName,
                    severity: 'success',
                    sessionTime: header.SessionTime,
                  });
                  break;
              }
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
            // PacketID 10: Car Damage Data
            else if (header.PacketId === 10) {
              const pkt = data as PacketCarDamageData;
              if (pkt.CarDamageData) {
                setAllCarDamage(pkt.CarDamageData);
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
            // PacketID 16: Car Telemetry 2 Data (Active Aero & Boost for 2026)
            else if (header.PacketId === 16) {
              const pkt = data as PacketCarTelemetry2Data;
              if (pkt.CarTelemetry2Data) {
                setAllTelemetry2(pkt.CarTelemetry2Data);
              }
            }
            // PacketID 2: Lap Data
            else if (header.PacketId === 2) {
              const pkt = data as PacketLapData;
              if (pkt.LapData) {
                setAllLaps(pkt.LapData);

                // Synthetic Event Detection for Pit Stops and Retirements
                pkt.LapData.forEach((lap, idx) => {
                  const prev = prevLapsRef.current[idx];
                  if (!prev) return;

                  // Pit entry transition
                  if (prev.PitStatus === 0 && (lap.PitStatus === 1 || lap.PitStatus === 2)) {
                    const p = participantsRef.current[idx];
                    const dName = parseDriverName(p?.Name, `Car #${idx + 1}`, p?.DriverId);
                    addEvent({
                      eventCode: 'TMPT',
                      type: 'pit',
                      description: `${dName} entered the pit lane (Lap ${lap.CurrentLapNum})`,
                      vehicleIdx: idx,
                      driverName: dName,
                      lapNum: lap.CurrentLapNum,
                      severity: 'warning',
                      sessionTime: header.SessionTime,
                    });
                  }

                  // New penalty received
                  if ((lap.Penalties || 0) > (prev.Penalties || 0)) {
                    const added = (lap.Penalties || 0) - (prev.Penalties || 0);
                    const p = participantsRef.current[idx];
                    const dName = parseDriverName(p?.Name, `Car #${idx + 1}`, p?.DriverId);
                    addEvent({
                      eventCode: 'PENA',
                      type: 'penalty',
                      description: `${dName} received +${added}s penalty (Lap ${lap.CurrentLapNum})`,
                      vehicleIdx: idx,
                      driverName: dName,
                      lapNum: lap.CurrentLapNum,
                      severity: 'danger',
                      sessionTime: header.SessionTime,
                    });
                  }
                });

                prevLapsRef.current = pkt.LapData;
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
      } catch {
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

  const maxCars = Math.max(participants.length, allCarStatus.length, allLaps.length, allTelemetry.length, 22);
  const activeIdx = selectedCarIndex >= 0 && selectedCarIndex < maxCars ? selectedCarIndex : playerCarIndex;
  const telemetry = allTelemetry[activeIdx] || null;
  const lap = allLaps[activeIdx] || null;
  const motion = allMotion[activeIdx] || null;
  const carStatus = allCarStatus[activeIdx] || null;
  const carDamage = allCarDamage[activeIdx] || null;
  const telemetry2 = allTelemetry2[activeIdx] || null;

  return {
    session,
    participants,
    allLaps,
    allMotion,
    allCarStatus,
    allCarDamage,
    allTelemetry,
    allTelemetry2,
    telemetry,
    telemetry2,
    lap,
    motion,
    carStatus,
    carDamage,
    trackPath,
    connected,
    history,
    events,
    clearEvents,
    playerCarIndex,
    selectedCarIndex,
    setSelectedCarIndex,
    packetFormat,
  };
}


