import { create } from 'zustand';
import { api } from '../utils/apiClient';
import { DEFAULT_UDP_PORT, LOCALHOST_IPV4 } from '../constants/f1';
import type { TelemetryEndpoint } from '../types/system';

export const DEFAULT_TELEMETRY_ENDPOINT: TelemetryEndpoint = {
  udp_addr: `0.0.0.0:${DEFAULT_UDP_PORT}`,
  udp_port: DEFAULT_UDP_PORT,
  local_ip: LOCALHOST_IPV4,
  lan_ips: [],
};

export interface TelemetryEndpointState {
  endpoint: TelemetryEndpoint;
  loadEndpoint: () => Promise<void>;
}

const isTelemetryEndpoint = (value: unknown): value is TelemetryEndpoint => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.udp_addr === 'string' &&
    typeof v.udp_port === 'number' &&
    v.udp_port > 0 &&
    typeof v.local_ip === 'string' &&
    Array.isArray(v.lan_ips) &&
    v.lan_ips.every((ip) => typeof ip === 'string')
  );
};

/** The UDP port and addresses the game has to send telemetry to, as the server reports them. */
export const useTelemetryEndpointStore = create<TelemetryEndpointState>((set) => ({
  endpoint: DEFAULT_TELEMETRY_ENDPOINT,

  loadEndpoint: async () => {
    // Offline, or a server without this endpoint: keep showing the defaults
    const res = await api.get<unknown>('/api/system/network').catch(() => null);
    if (isTelemetryEndpoint(res)) {
      set({ endpoint: res });
    }
  },
}));
