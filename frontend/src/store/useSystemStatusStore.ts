import { create } from 'zustand';
import { api } from '../utils/apiClient';
import { LIVE_STALE_AFTER_MS, LIVE_STALE_FORGET_MS, LIVE_STATUS, SYSTEM_STATUS_POLL_MS } from '../constants/f1';
import type { LiveStatus } from '../constants/f1';
import type { ActiveSession, SystemStatus } from '../types/system';

export interface SystemStatusState {
  /** The feed state from the last poll; offline until one answers, and when one fails. */
  liveStatus: LiveStatus;
  /** The session the game is sending while the feed is live or stale, else null. */
  session: ActiveSession | null;
  applyStatus: (status: SystemStatus | null) => void;
}

/**
 * What GET /api/system/status says the feed is doing. A session counts as live while packets are
 * fresher than LIVE_STALE_AFTER_MS, stale for a minute after they stop, then listening again.
 */
export function liveStatusFromSystem(status: SystemStatus | null): LiveStatus {
  if (!status) return LIVE_STATUS.OFFLINE;
  const age = status.packet_age_ms;
  if (age === null || !status.session || age > LIVE_STALE_FORGET_MS) return LIVE_STATUS.LISTENING;
  return age > LIVE_STALE_AFTER_MS ? LIVE_STATUS.STALE : LIVE_STATUS.LIVE;
}

/** The live feed as the server reports it, for pages that don't open /ws. */
export const useSystemStatusStore = create<SystemStatusState>((set, get) => ({
  liveStatus: LIVE_STATUS.OFFLINE,
  session: null,

  applyStatus: (status) => {
    const liveStatus = liveStatusFromSystem(status);
    const session = liveStatus === LIVE_STATUS.LIVE || liveStatus === LIVE_STATUS.STALE ? status!.session : null;
    const prev = get();
    // A poll that changes nothing leaves the state (and its subscribers) alone
    if (prev.liveStatus === liveStatus && prev.session?.session_uid === session?.session_uid) return;
    set({ liveStatus, session });
  },
}));

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

const pollWhenShown = () => {
  if (!document.hidden) void poll();
};

async function poll(): Promise<void> {
  // A hidden tab doesn't need the badge; it polls again as soon as it shows (pollWhenShown)
  if (document.hidden) return;
  const status = await api.get<SystemStatus>('/api/system/status').catch(() => null);
  if (subscribers > 0) useSystemStatusStore.getState().applyStatus(status);
}

/**
 * Polls GET /api/system/status while at least one caller is subscribed. Returns the unsubscribe.
 */
export function subscribeSystemStatus(): () => void {
  subscribers += 1;
  if (subscribers === 1) {
    void poll();
    timer = setInterval(() => void poll(), SYSTEM_STATUS_POLL_MS);
    document.addEventListener('visibilitychange', pollWhenShown);
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    subscribers -= 1;
    if (subscribers === 0) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', pollWhenShown);
    }
  };
}
