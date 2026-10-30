import { useCallback } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToastStore } from '../store/useToastStore';
import type { DesktopWindowName } from '../types/desktop';
import { desktopClient } from '../utils/desktopClient';

/**
 * Brings one of the app's own windows up (Windows): the engineer's, or the main one with the
 * dashboard. Says so when it can't.
 */
export function useShowWindow(): (window: DesktopWindowName) => void {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  return useCallback(
    (window: DesktopWindowName) => {
      desktopClient.showWindow(window).catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err);
        showToast({ type: 'error', message: t('live.engineerWindow.showFailed', { error }) });
      });
    },
    [showToast, t]
  );
}
