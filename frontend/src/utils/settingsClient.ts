import type { SettingsChangedMessage, SettingsSection } from '../types/settings';
import { api } from './apiClient';
import { subscribeEngineerMessages } from './engineerSocket';

/** Header naming the tab that saved a settings section; the server copies it into settings_changed. */
export const DASHBOARD_CLIENT_HEADER = 'X-Dashboard-Client';

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** This tab's id. A tab ignores the settings_changed messages its own saves caused. */
export const DASHBOARD_CLIENT_ID = newClientId();

/** Saves one shared settings section (PUT /api/settings/{section}) on behalf of this tab. */
export function putSettings<T = unknown>(section: SettingsSection, body: unknown): Promise<T> {
  return api.put<T>(`/api/settings/${section}`, body, {
    headers: { [DASHBOARD_CLIENT_HEADER]: DASHBOARD_CLIENT_ID },
  });
}

/**
 * Calls `onChange` when another device or tab saves `section`, so this tab can reload it. Returns
 * the unsubscribe function. Opens the shared /ws/engineer connection while subscribed.
 */
export function subscribeSettingsChanges(
  section: SettingsSection,
  onChange: (msg: SettingsChangedMessage) => void
): () => void {
  return subscribeEngineerMessages({
    settings_changed: (msg) => {
      if (msg.section !== section || msg.source === DASHBOARD_CLIENT_ID) return;
      onChange(msg);
    },
  });
}
