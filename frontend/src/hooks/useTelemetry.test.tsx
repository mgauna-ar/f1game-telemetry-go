import { render, screen, act } from '@testing-library/react';
import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { useTelemetry, parseDriverName } from './useTelemetry';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { makeLiveCarTelemetry, makeLiveLap, makeLiveParticipant, makeLiveSnapshot } from '../test/wireFactories';

// Mock the WebSocket
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
}

beforeAll(() => {
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  useTelemetryStore.getState().resetSession();
});

// A simple test component to use the hook
function TestComponent({ wsUrl }: { wsUrl: string }) {
  const { telemetry, lap, connected } = useTelemetry(wsUrl);

  return (
    <div>
      <div data-testid="status">{connected ? 'CONNECTED' : 'DISCONNECTED'}</div>
      <div data-testid="speed">{telemetry?.Speed || 0}</div>
      <div data-testid="lap">{lap?.CurrentLapNum || 0}</div>
    </div>
  );
}

describe('useTelemetry', () => {
  it('connects to websocket and updates state', () => {
    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);
    expect(screen.getByTestId('status')).toHaveTextContent('DISCONNECTED');
  });

  it('parses 10Hz live snapshot packets correctly', () => {
    let wsInstance: MockWebSocket | undefined;
    vi.stubGlobal('WebSocket', function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    });

    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);

    act(() => {
      if (wsInstance?.onopen) wsInstance.onopen();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('CONNECTED');

    // Send a 10Hz Live Snapshot packet (PacketId 255)
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify(
            makeLiveSnapshot(
              {
                CarTelemetry: [makeLiveCarTelemetry({ Speed: 320 })],
                LapData: [makeLiveLap({ CurrentLapNum: 12 })],
                ActiveCarCount: 1,
              },
              { SessionTime: 10.0 }
            )
          ),
        });
      }
    });

    expect(screen.getByTestId('speed')).toHaveTextContent('320');
    expect(screen.getByTestId('lap')).toHaveTextContent('12');
  });

  it('keeps the participants the server sends, one per active car', () => {
    let wsInstance: MockWebSocket | undefined;
    vi.stubGlobal('WebSocket', function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    });

    function ParticipantsTestComponent() {
      const { participants } = useTelemetry('ws://localhost:8080/ws');
      return <div data-testid="count">{participants.map((p) => p.Name).join(',')}</div>;
    }

    render(<ParticipantsTestComponent />);

    // The server cuts the rows to ActiveCarCount (a retired car keeps its slot), so the store takes them as they are.
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify(
            makeLiveSnapshot(
              {
                Participants: ['Max Verstappen', 'Lewis Hamilton', 'Charles Leclerc', 'Lando Norris'].map((Name) =>
                  makeLiveParticipant({ Name })
                ),
                ActiveCarCount: 4,
              },
              { SessionUID: '0x0000000000003039' }
            )
          ),
        });
      }
    });

    expect(screen.getByTestId('count')).toHaveTextContent('Max Verstappen,Lewis Hamilton,Charles Leclerc,Lando Norris');
  });

  it('ingests server-synthesized live events from LiveSnapshot packet', () => {
    let wsInstance: MockWebSocket | undefined;
    vi.stubGlobal('WebSocket', function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    });

    function EventsTestComponent() {
      const { events } = useTelemetry('ws://localhost:8080/ws');
      return (
        <div>
          <div data-testid="event-count">{events.length}</div>
          <div data-testid="latest-driver">{events[0]?.driverName || 'none'}</div>
          <div data-testid="latest-code">{events[0]?.eventCode || 'none'}</div>
        </div>
      );
    }

    render(<EventsTestComponent />);

    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 255, SessionTime: 10.0, SessionUID: '0x0000000000003039', PlayerCarIndex: 0 },
            Events: [
              {
                eventCode: 'SCAR',
                type: 'flag',
                severity: 'warning',
                sessionTime: 10.0,
              },
              {
                eventCode: 'TMPT',
                type: 'pit',
                vehicleIdx: 0,
                driverName: 'Franco Colapinto',
                lapNum: 12,
                severity: 'warning',
                sessionTime: 10.0,
              },
            ],
          }),
        });
      }
    });

    expect(screen.getByTestId('event-count')).toHaveTextContent('2');
    // Events are added prepended, so the second event in the list was added last and is at index 0
    expect(screen.getByTestId('latest-code')).toHaveTextContent('TMPT');
    expect(screen.getByTestId('latest-driver')).toHaveTextContent('Franco Colapinto');
  });
});

describe('parseDriverName', () => {
  it('parses string driver names without base64 corruption', () => {
    expect(parseDriverName('Carlos Sainz', 'Driver 55')).toBe('Carlos Sainz');
    expect(parseDriverName('Sainz', 'Driver 55')).toBe('Sainz');
  });

  it('truncates trailing garbage after a null byte', () => {
    expect(parseDriverName('GASLY\x00919819000', 'Driver 1')).toBe('GASLY');
  });

  it('keeps long names that look like base64 as they are', () => {
    expect(parseDriverName('AlexanderAlbonAlexanderAlbon', 'Driver 23')).toBe('AlexanderAlbonAlexanderAlbon');
  });

  it('resolves AI driver names via DriverId when name is empty', () => {
    expect(parseDriverName('', 'Driver 9', 9)).toBe('Max Verstappen');
    expect(parseDriverName('', 'Driver 22', 22)).toBe('Charles Leclerc');
  });

  it('falls back to defaultName when name is empty and driverId unknown', () => {
    expect(parseDriverName('', 'Driver 99', 999)).toBe('Driver 99');
  });
});
