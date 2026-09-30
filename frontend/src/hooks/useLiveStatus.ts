import { useEffect, useState } from 'react';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { subscribeSystemStatus, useSystemStatusStore } from '../store/useSystemStatusStore';
import { getLastTelemetryMessageAt } from '../utils/telemetrySocket';
import { LIVE_STATUS, LIVE_STALE_AFTER_MS, LIVE_STATUS_POLL_MS } from '../constants/f1';
import type { LiveStatus } from '../constants/f1';

const isFeedStale = (): boolean => Date.now() - getLastTelemetryMessageAt() > LIVE_STALE_AFTER_MS;

/**
 * What the live telemetry feed is doing: offline, listening for a session, live, or stale.
 * The Live tab reads its own /ws feed; every other page polls GET /api/system/status.
 */
export function useLiveStatus(): LiveStatus {
  const connected = useSessionStatusStore((s) => s.connected);
  const hasSession = useSessionStatusStore((s) => s.session !== null);
  const polledStatus = useSystemStatusStore((s) => s.liveStatus);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (connected) return;
    return subscribeSystemStatus();
  }, [connected]);

  useEffect(() => {
    if (!connected || !hasSession) return;
    // Setting the same value again doesn't re-render, so this only re-renders on a change
    const check = () => setStale(isFeedStale());
    check();
    const id = setInterval(check, LIVE_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [connected, hasSession]);

  if (!connected) return polledStatus;
  if (!hasSession) return LIVE_STATUS.LISTENING;
  return stale ? LIVE_STATUS.STALE : LIVE_STATUS.LIVE;
}
