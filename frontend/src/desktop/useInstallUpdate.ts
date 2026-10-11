import { useCallback, useEffect, useState } from 'react';
import { TIME_CONSTANTS } from '../constants/f1';
import { api } from '../utils/apiClient';
import { desktopClient } from '../utils/desktopClient';
import type { SystemVersion } from '../types/system';

/** How often the window asks whether the restarted app answers with the new version. */
export const UPDATE_POLL_INTERVAL_MS = TIME_CONSTANTS.MS_PER_SECOND;
/** How long the restart may take before the window says the app didn't come back. */
export const UPDATE_RESTART_TIMEOUT_MS = TIME_CONSTANTS.MS_PER_MINUTE;

/** Where a one-click update is: downloading and installing, waiting for the restart, or stopped. */
export type InstallUpdateState =
  | { phase: 'idle' }
  | { phase: 'installing' }
  | { phase: 'restarting'; version: string }
  | { phase: 'failed'; error: string }
  | { phase: 'timedOut'; version: string };

const reloadPage = () => window.location.reload();

/**
 * Installs the newest release from the app window. The server downloads it, puts it in place of its
 * executable and restarts (POST /api/desktop/update); the window then waits for the new version to
 * answer and reloads on it. `reload` is replaceable for tests.
 */
export function useInstallUpdate(reload: () => void = reloadPage) {
  const [state, setState] = useState<InstallUpdateState>({ phase: 'idle' });

  const install = useCallback(async () => {
    setState({ phase: 'installing' });
    try {
      const { version } = await desktopClient.installUpdate();
      setState({ phase: 'restarting', version });
    } catch (err) {
      setState({ phase: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const restartingInto = state.phase === 'restarting' ? state.version : null;
  useEffect(() => {
    if (restartingInto === null) return;
    const controller = new AbortController();
    const deadline = Date.now() + UPDATE_RESTART_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { version } = await api.get<SystemVersion>('/api/system/version', controller.signal);
        if (version === restartingInto) {
          reload();
          return;
        }
      } catch {
        // Nothing answers while the app restarts
      }
      if (controller.signal.aborted) return;
      if (Date.now() >= deadline) {
        setState({ phase: 'timedOut', version: restartingInto });
        return;
      }
      timer = setTimeout(poll, UPDATE_POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, UPDATE_POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [restartingInto, reload]);

  return { state, install };
}
