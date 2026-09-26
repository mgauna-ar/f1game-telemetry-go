import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

export type TooltipPlacement = 'top' | 'bottom';

export interface TooltipOptions {
  content: React.ReactNode;
  placement?: TooltipPlacement;
  /**
   * Link the text to the trigger with `aria-describedby`. Leave it on for extra detail; turn it
   * off when the text repeats the trigger's own name, as on an icon button.
   */
  describe?: boolean;
  /** Hover delay in milliseconds. Keyboard focus shows the tooltip at once. */
  delay?: number;
}

export interface TooltipTriggerProps {
  ref: (node: HTMLElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  'aria-describedby'?: string;
}

const VIEWPORT_MARGIN = 8;
const GAP = 6;

const isKeyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
};

/**
 * Hover and focus tooltip: shows after a short hover or at once on keyboard focus, hides on
 * leave, blur, scroll and Esc (without closing the dialog it sits in). The text is also kept in
 * a hidden element so screen readers get it through `aria-describedby` as soon as focus lands.
 */
export function useTooltip({ content, placement = 'top', describe = true, delay = 350 }: TooltipOptions): {
  triggerProps: TooltipTriggerProps;
  tooltip: React.ReactNode;
} {
  const id = useId();
  const descriptionId = `${id}-description`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; placement: TooltipPlacement } | null>(null);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPosition(null);
  }, []);

  const show = useCallback(
    (wait: number) => {
      window.clearTimeout(timer.current);
      if (wait <= 0) setOpen(true);
      else timer.current = window.setTimeout(() => setOpen(true), wait);
    },
    []
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Place the bubble once it has a size: centred on the trigger, flipped when it would leave the
  // viewport, and kept inside it horizontally.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const rect = trigger.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    let side = placement;
    if (side === 'top' && rect.top - height - GAP < VIEWPORT_MARGIN) side = 'bottom';
    else if (side === 'bottom' && rect.bottom + height + GAP > window.innerHeight - VIEWPORT_MARGIN) side = 'top';
    const top = side === 'top' ? rect.top - height - GAP : rect.bottom + GAP;
    const centred = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centred, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN);
    setPosition({ left, top, placement: side });
  }, [open, placement, content]);

  useEffect(() => {
    if (!open) return;
    // Capture phase, so Esc hides the tooltip before a dialog around it sees the key.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        hide();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  const hasContent = content !== null && content !== undefined && content !== '';

  const triggerProps: TooltipTriggerProps = {
    ref: (node) => {
      triggerRef.current = node;
    },
    onMouseEnter: () => hasContent && show(delay),
    onMouseLeave: hide,
    onFocus: (event) => hasContent && isKeyboardFocus(event.currentTarget) && show(0),
    onBlur: hide,
    'aria-describedby': describe && hasContent ? descriptionId : undefined,
  };

  const tooltip = hasContent ? (
    <>
      {describe && (
        <span id={descriptionId} className="sr-only">
          {content}
        </span>
      )}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            className={styles.tooltip}
            data-placement={position?.placement ?? placement}
            aria-hidden="true"
            style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  ) : null;

  return { triggerProps, tooltip };
}
