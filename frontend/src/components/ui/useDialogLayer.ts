import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Marks a control that focus should not land on when the dialog opens, such as its close button. */
export const SKIP_AUTOFOCUS_ATTRIBUTE = 'data-dialog-skip-autofocus';

/** The elements inside `container` that Tab can reach, in document order. */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden], [inert]') && el.tabIndex >= 0
  );

// Open layers, oldest first. Only the newest one answers Esc and traps Tab.
const openLayers: symbol[] = [];

/**
 * Reads a ref when the layer closes. The fallback element is often rendered in the same commit
 * that closes the layer (a launcher button replacing the panel), so the latest value is the one
 * wanted, not the value from when the layer opened.
 */
const readLatest = <T>(ref: RefObject<T | null> | undefined): T | null => ref?.current ?? null;

export interface DialogLayerOptions {
  isOpen: boolean;
  onClose: () => void;
  /** The dialog element: focus moves into it on open and, with `trapFocus`, stays inside it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Keep Tab inside the dialog. True for modal dialogs, false for panels the page stays usable around. */
  trapFocus?: boolean;
  /**
   * What to focus on open; defaults to the first focusable element that isn't marked with
   * `SKIP_AUTOFOCUS_ATTRIBUTE`, then the dialog itself.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Move focus into the dialog on open. Turn off when the component focuses its own field. */
  autoFocus?: boolean;
  /** Where focus goes on close when the element that opened the dialog is gone. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Behaviour shared by modals, drawers and floating panels: Esc closes the newest open layer only,
 * focus moves in on open and returns to where it was on close, and modal layers trap Tab.
 * An Esc that something inside the layer already handled (`preventDefault`) is left alone.
 */
export function useDialogLayer({
  isOpen,
  onClose,
  containerRef,
  trapFocus = false,
  initialFocusRef,
  autoFocus = true,
  returnFocusRef,
}: DialogLayerOptions): void {
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const layer = Symbol('dialog-layer');
    openLayers.push(layer);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;

    if (autoFocus && container && !container.contains(document.activeElement)) {
      const focusable = getFocusableElements(container);
      const target =
        initialFocusRef?.current ??
        focusable.find((el) => !el.hasAttribute(SKIP_AUTOFOCUS_ATTRIBUTE)) ??
        focusable[0] ??
        container;
      target.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openLayers[openLayers.length - 1] !== layer) return;
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && trapFocus && container) {
        const focusable = getFocusableElements(container);
        const active = document.activeElement;
        if (focusable.length === 0) {
          event.preventDefault();
          container.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const outside = !container.contains(active);
        if (event.shiftKey && (outside || active === first || active === container)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (outside || active === last)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openLayers.splice(openLayers.indexOf(layer), 1);
      // Hand focus back only when it was inside the layer or went with it, never when the
      // person has already moved on to something else on the page.
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || (container?.contains(active) ?? false);
      if (!focusWasInside) return;
      const target = opener?.isConnected && opener !== document.body ? opener : readLatest(returnFocusRef);
      target?.focus();
    };
  }, [isOpen, containerRef, trapFocus, initialFocusRef, autoFocus, returnFocusRef]);
}
