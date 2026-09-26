import { useEffect } from 'react';
import { APP_NAME, DEFAULT_DOCUMENT_TITLE } from '../constants/ui';

/**
 * Sets the browser tab title to "<title> · F1 Telemetry" while the calling view is shown, so a
 * background tab says what it holds. Call it from the view that owns the page, one at a time.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : DEFAULT_DOCUMENT_TITLE;
  }, [title]);
}
