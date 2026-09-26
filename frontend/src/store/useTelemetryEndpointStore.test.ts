import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTelemetryEndpointStore, DEFAULT_TELEMETRY_ENDPOINT } from './useTelemetryEndpointStore';

const mockFetchJson = (body: unknown) => {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
};

describe('useTelemetryEndpointStore', () => {
  beforeEach(() => {
    useTelemetryEndpointStore.setState({ endpoint: DEFAULT_TELEMETRY_ENDPOINT });
  });

  it('starts with the default game port', () => {
    expect(useTelemetryEndpointStore.getState().endpoint.udp_port).toBe(20777);
    expect(useTelemetryEndpointStore.getState().endpoint.local_ip).toBe('127.0.0.1');
  });

  it('loads the endpoint the server reports', async () => {
    const endpoint = {
      udp_addr: '0.0.0.0:20999',
      udp_port: 20999,
      local_ip: '127.0.0.1',
      lan_ips: ['192.168.1.20', '10.0.0.5'],
    };
    mockFetchJson(endpoint);

    await useTelemetryEndpointStore.getState().loadEndpoint();

    expect(useTelemetryEndpointStore.getState().endpoint).toEqual(endpoint);
  });

  it('keeps the defaults when the response is not an endpoint', async () => {
    mockFetchJson({ status: 'ok' });

    await useTelemetryEndpointStore.getState().loadEndpoint();

    expect(useTelemetryEndpointStore.getState().endpoint).toEqual(DEFAULT_TELEMETRY_ENDPOINT);
  });

  it('keeps the defaults when the request fails', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('offline'));

    await useTelemetryEndpointStore.getState().loadEndpoint();

    expect(useTelemetryEndpointStore.getState().endpoint).toEqual(DEFAULT_TELEMETRY_ENDPOINT);
  });
});
