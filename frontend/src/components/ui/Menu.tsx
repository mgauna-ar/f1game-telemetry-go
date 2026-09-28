import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { IconButton } from './Button';
import { cx } from './cx';
import styles from './Menu.module.css';

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Shown in the danger colour, such as Delete. */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Names the button, such as "More actions for session #12". */
  label: string;
  items: readonly MenuItem[];
  /** Replaces the default "⋯" icon. */
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const VIEWPORT_MARGIN = 8;
const GAP = 4;

/**
 * A "⋯" button that opens a list of actions. It follows the menu button pattern: Enter, Space or
 * the down arrow open it on the first item (the up arrow on the last), the arrows, Home and End
 * move between items, Esc and Tab close it, and focus goes back to the button. The list is
 * rendered at the document root with fixed coordinates, so a scrolling or clipped table can't cut
 * it off; it closes on scroll and on a click outside.
 */
export const Menu: React.FC<MenuProps> = ({ label, items, icon, size = 'sm', className }) => {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const openAt = (index: number) => {
    setFocusIndex(index);
    setOpen(true);
  };

  // Right-aligned under the button, or above it when there's no room below
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const list = listRef.current;
    if (!button || !list) return;
    const rect = button.getBoundingClientRect();
    const { width, height } = list.getBoundingClientRect();
    const below = rect.bottom + GAP;
    const top = below + height > window.innerHeight - VIEWPORT_MARGIN ? rect.top - GAP - height : below;
    const left = Math.min(Math.max(rect.right - width, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN);
    setPosition({ left, top: Math.max(top, VIEWPORT_MARGIN) });
  }, [open]);

  useEffect(() => {
    if (!open || !position) return;
    listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[focusIndex]?.focus();
  }, [open, position, focusIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  const move = (step: number) => {
    const at = enabled.indexOf(focusIndex);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    if (next !== undefined) setFocusIndex(next);
  };

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (enabled.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAt(enabled[0]);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(enabled[enabled.length - 1]);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setFocusIndex(enabled[0]);
        break;
      case 'End':
        event.preventDefault();
        setFocusIndex(enabled[enabled.length - 1]);
        break;
      case 'Escape':
        // Only the menu closes, not a dialog it sits in
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <>
      <IconButton
        ref={buttonRef}
        size={size}
        variant="ghost"
        label={label}
        className={cx(styles.button, className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          // The button often sits in a clickable row
          event.stopPropagation();
          if (open) close(false);
          else if (enabled.length > 0) openAt(enabled[0]);
        }}
        onKeyDown={onButtonKeyDown}
      >
        {icon ?? <MoreHorizontal size={16} />}
      </IconButton>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={id}
            role="menu"
            aria-label={label}
            className={styles.menu}
            style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
            onKeyDown={onListKeyDown}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, i) => (
              <li key={item.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={i === focusIndex ? 0 : -1}
                  disabled={item.disabled}
                  className={cx('button-reset', styles.item, item.danger && styles.danger)}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  {item.icon && (
                    <span className={styles.icon} aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
};
