import { render, screen, act } from '@testing-library/react';
import { useTelemetry } from './useTelemetry';

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
  (global as any).WebSocket = MockWebSocket;
});

// A simple test component to use the hook
function TestComponent({ wsUrl }: { wsUrl: string }) {
  const { telemetry, lap, motion, connected } = useTelemetry(wsUrl);

  return (
    <div>
      <div data-testid="status">{connected ? 'CONNECTED' : 'DISCONNECTED'}</div>
      <div data-testid="speed">{telemetry?.Speed || 0}</div>
      <div data-testid="lap">{lap?.CurrentLapNum || 0}</div>
      <div data-testid="motion-x">{motion?.WorldPositionX || 0}</div>
    </div>
  );
}

describe('useTelemetry', () => {
  it('connects to websocket and updates state', () => {
    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);
    expect(screen.getByTestId('status')).toHaveTextContent('DISCONNECTED');
  });

  it('parses telemetry packets correctly', () => {
    let wsInstance: MockWebSocket | undefined;
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        wsInstance = this;
      }
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
              { Speed: 315 }
            ]
          })
        });
      }
    });

    expect(screen.getByTestId('speed')).toHaveTextContent('315');
  });

  it('parses motion packets correctly', () => {
    let wsInstance: MockWebSocket | undefined;
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        wsInstance = this;
      }
    };

    render(<TestComponent wsUrl="ws://localhost:8080/ws" />);

    // Send a mock Motion packet
    act(() => {
      if (wsInstance?.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            Header: { PacketId: 0, SessionTime: 1.0, PlayerCarIndex: 0 },
            CarMotionData: [
              { WorldPositionX: -100.5, WorldPositionY: 10.0, WorldPositionZ: 200.5 }
            ]
          })
        });
      }
    });

    expect(screen.getByTestId('motion-x')).toHaveTextContent('-100.5');
  });
});
