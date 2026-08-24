import { render, screen, act } from '@testing-library/react';
import { useTelemetry, parseDriverName } from './useTelemetry';
import { useTelemetryStore } from '../store/useTelemetryStore';

// Mock the WebSocket
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
}

beforeAll(() => {
  (globalThis as any).WebSocket = MockWebSocket;
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
    (globalThis as any).WebSocket = function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    };

    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);

    act(() => {
      if (wsInstance?.onopen) wsInstance.onopen();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('CONNECTED');

    // Send a 10Hz Live Snapshot packet (PacketId 255)
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 255, SessionTime: 10.0, PlayerCarIndex: 0, PacketFormat: 2026 },
            CarTelemetry: {
              CarTelemetryData: [{ Speed: 320 }],
            },
            LapData: {
              LapData: [{ CurrentLapNum: 12 }],
            },
          }),
        });
      }
    });

    expect(screen.getByTestId('speed')).toHaveTextContent('320');
    expect(screen.getByTestId('lap')).toHaveTextContent('12');
  });

  it('parses legacy individual telemetry packets correctly', () => {
    let wsInstance: MockWebSocket | undefined;
    (globalThis as any).WebSocket = function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    };

    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);

    act(() => {
      if (wsInstance?.onopen) wsInstance.onopen();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('CONNECTED');

    // Send a mock CarTelemetry packet
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 6, SessionTime: 1.0, PlayerCarIndex: 0 },
            CarTelemetryData: [
              { Speed: 315 },
            ],
          }),
        });
      }
    });

    expect(screen.getByTestId('speed')).toHaveTextContent('315');
  });

  it('retains all participants without truncating when NumActiveCars drops on retirement', () => {
    let wsInstance: MockWebSocket | undefined;
    (globalThis as any).WebSocket = function (url: string) {
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    };

    function ParticipantsTestComponent() {
      const { participants } = useTelemetry('ws://localhost:8080/ws');
      return <div data-testid="count">{participants.length}</div>;
    }

    render(<ParticipantsTestComponent />);

    // Initial snapshot with 4 active cars
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 255, SessionTime: 1.0, SessionUID: 12345, PlayerCarIndex: 0 },
            Participants: {
              NumActiveCars: 4,
              Participants: [
                { DriverId: 9, Name: 'Max Verstappen' },
                { DriverId: 7, Name: 'Lewis Hamilton' },
                { DriverId: 22, Name: 'Charles Leclerc' },
                { DriverId: 10, Name: 'Lando Norris' },
                { DriverId: 0, Name: '' },
                { DriverId: 0, Name: '' },
              ],
            },
          }),
        });
      }
    });

    expect(screen.getByTestId('count')).toHaveTextContent('4');

    // Subsequent snapshot when 1 driver retires (NumActiveCars drops to 3)
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 255, SessionTime: 2.0, SessionUID: 12345, PlayerCarIndex: 0 },
            Participants: {
              NumActiveCars: 3,
              Participants: [
                { DriverId: 9, Name: 'Max Verstappen' },
                { DriverId: 7, Name: 'Lewis Hamilton' },
                { DriverId: 22, Name: 'Charles Leclerc' },
                { DriverId: 10, Name: 'Lando Norris' },
                { DriverId: 0, Name: '' },
                { DriverId: 0, Name: '' },
              ],
            },
          }),
        });
      }
    });

    // Must still retain all 4 drivers
    expect(screen.getByTestId('count')).toHaveTextContent('4');
  });
});

describe('parseDriverName', () => {
  it('parses string driver names without base64 corruption', () => {
    expect(parseDriverName('Carlos Sainz', 'Driver 55')).toBe('Carlos Sainz');
    expect(parseDriverName('Sainz', 'Driver 55')).toBe('Sainz');
  });

  it('parses character array driver names and truncates trailing garbage', () => {
    const charArray = [77, 97, 120, 0, 57, 49, 57, 56]; // "Max\09198"
    expect(parseDriverName(charArray, 'Driver 1')).toBe('Max');
    expect(parseDriverName('GASLY\x00919819000', 'Driver 1')).toBe('GASLY');
  });

  it('resolves AI driver names via DriverId when name is empty', () => {
    expect(parseDriverName('', 'Driver 9', 9)).toBe('Max Verstappen');
    expect(parseDriverName('', 'Driver 22', 22)).toBe('Charles Leclerc');
  });

  it('falls back to defaultName when name is empty and driverId unknown', () => {
    expect(parseDriverName('', 'Driver 99', 999)).toBe('Driver 99');
  });
});
