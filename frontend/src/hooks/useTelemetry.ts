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

export function useTelemetry(wsUrl: string) {
  const [telemetry, setTelemetry] = useState<CarTelemetryData | null>(null);
  const [lap, setLap] = useState<LapData | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

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
          setTelemetry(pkt.CarTelemetryData[playerIdx]);
        } 
        // PacketID 2 is LapData
        else if (header.PacketId === 2) {
          const pkt = data as PacketLapData;
          setLap(pkt.LapData[playerIdx]);
        }
      } catch (err) {
        console.error("Failed to parse telemetry:", err);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [wsUrl]);

  return { telemetry, lap, connected };
}
