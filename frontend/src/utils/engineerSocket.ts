type EngineerMessageHandler = (data: any) => void;

let activeEngineerWs: WebSocket | null = null;
let engineerReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let engineerSubscribers = 0;
const handlers = new Set<EngineerMessageHandler>();

function getTargetEngineerUrl(customUrl?: string): string {
  if (customUrl) return customUrl;
  if (typeof window === 'undefined') return 'ws://localhost:8080/ws/engineer';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/engineer`;
}

function connectEngineerWs(customUrl?: string) {
  if (engineerSubscribers <= 0) return;
  if (activeEngineerWs && activeEngineerWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  try {
    const socket = new WebSocket(getTargetEngineerUrl(customUrl));
    activeEngineerWs = socket;

    socket.onopen = () => {
      // Successfully connected to /ws/engineer
    };

    socket.onclose = () => {
      activeEngineerWs = null;
      if (engineerSubscribers > 0) {
        if (!engineerReconnectTimer) {
          engineerReconnectTimer = setTimeout(() => {
            engineerReconnectTimer = null;
            connectEngineerWs(customUrl);
          }, 2000);
        }
      }
    };

    socket.onerror = () => {
      // Browser automatically triggers onclose following onerror
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handlers.forEach((handler) => {
          try {
            handler(data);
          } catch (err) {
            console.error('[EngineerWS] Handler execution error:', err);
          }
        });
      } catch (err) {
        console.error('[EngineerWS] Failed to parse message JSON:', err);
      }
    };
  } catch {
    activeEngineerWs = null;
    if (engineerSubscribers > 0) {
      if (!engineerReconnectTimer) {
        engineerReconnectTimer = setTimeout(() => {
          engineerReconnectTimer = null;
          connectEngineerWs(customUrl);
        }, 2000);
      }
    }
  }
}

/**
 * Subscribes a message listener to the singleton /ws/engineer WebSocket connection.
 * Connects automatically when the first subscriber registers and disconnects when all unsubscribe.
 */
export function subscribeEngineerWebSocket(handler: EngineerMessageHandler, customUrl?: string): () => void {
  handlers.add(handler);
  engineerSubscribers++;

  if (!activeEngineerWs || activeEngineerWs.readyState === WebSocket.CLOSED) {
    connectEngineerWs(customUrl);
  }

  return () => {
    handlers.delete(handler);
    engineerSubscribers = Math.max(0, engineerSubscribers - 1);
    if (engineerSubscribers === 0) {
      if (engineerReconnectTimer) {
        clearTimeout(engineerReconnectTimer);
        engineerReconnectTimer = null;
      }
      if (activeEngineerWs) {
        const wsToClose = activeEngineerWs;
        activeEngineerWs = null;
        wsToClose.onclose = null;
        wsToClose.close();
      }
    }
  };
}
