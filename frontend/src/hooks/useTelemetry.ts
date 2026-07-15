import { useState, useEffect, useRef } from 'react';

// Simplified types based on our Go backend structs
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
  CurrentLapTimeInMS: number;
  LastLapTimeInMS: number;
  Sector1TimeMSPart: number;
  Sector2TimeMSPart: number;
  CurrentLapNum: number;
  CarPosition: number;
  CurrentLapInvalid: number;
}

export interface CarMotionData {
  WorldPositionX: number;
  WorldPositionY: number;
  WorldPositionZ: number;
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

interface PacketLapData {
  Header: PacketHeader;
  LapData: LapData[];
}

interface PacketMotionData {
  Header: PacketHeader;
  CarMotionData: CarMotionData[];
}

export interface TelemetrySample extends CarTelemetryData {
  SessionTime: number;
}

export function useTelemetry(wsUrl: string) {
  const [telemetry, setTelemetry] = useState<CarTelemetryData | null>(null);
  const [lap, setLap] = useState<LapData | null>(null);
  const [motion, setMotion] = useState<CarMotionData | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Rolling buffer for chart data
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  
  // Track layout historical positions
  const [trackPath, setTrackPath] = useState<{x: number, z: number}[]>([]);
  
  const ws = useRef<WebSocket | null>(null);
  const historyRef = useRef<TelemetrySample[]>([]);

  useEffect(() => {
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const header = data.Header as PacketHeader;
        
        // Use PlayerCarIndex from header, fallback to 0
        const playerIdx = header.PlayerCarIndex || 0;

        // PacketID 6 is CarTelemetry
        if (header.PacketId === 6) {
          const pkt = data as PacketCarTelemetryData;
          const current = pkt.CarTelemetryData[playerIdx];
          setTelemetry(current);

          // Update rolling buffer
          const sample: TelemetrySample = {
            ...current,
            SessionTime: header.SessionTime
          };
          
          historyRef.current = [...historyRef.current.slice(-99), sample];
          setHistory(historyRef.current);
        } 
        // PacketID 2 is LapData
        else if (header.PacketId === 2) {
          const pkt = data as PacketLapData;
          setLap(pkt.LapData[playerIdx]);
        }
        // PacketID 0 is MotionData
        else if (header.PacketId === 0) {
          const pkt = data as PacketMotionData;
          const current = pkt.CarMotionData[playerIdx];
          setMotion(current);
          
          // Downsample tracking to avoid massive arrays (e.g., only add if moved significantly)
          setTrackPath(prev => {
            const last = prev[prev.length - 1];
            if (!last || Math.abs(last.x - current.WorldPositionX) > 1.0 || Math.abs(last.z - current.WorldPositionZ) > 1.0) {
              return [...prev, { x: current.WorldPositionX, z: current.WorldPositionZ }];
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to parse telemetry:", err);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [wsUrl]);

  return { telemetry, lap, motion, trackPath, connected, history };
}
