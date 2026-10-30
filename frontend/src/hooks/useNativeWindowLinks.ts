import { useEffect, useRef } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToastStore } from '../store/useToastStore';
import { isNativeWindow, openLinksOutside } from '../utils/nativeWindow';

/**
 * In the app's own window, a link to another site opens in the default browser, and says so when
 * it can't (see `openLinksOutside`). In a browser, links work as they always do.
 */
export function useNativeWindowLinks(): void {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (!isNativeWindow()) return undefined;
    return openLinksOutside((err) => {
      const error = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', message: tRef.current('common.openLinkFailed', { error }) });
    });
  }, [showToast]);
}
