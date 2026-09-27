import React, { useRef } from 'react';
import { cx } from './cx';
import { nextRovingIndex } from './roving';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Names the tab list for screen readers. */
  'aria-label': string;
  /** Shared with each `TabPanel`, so tab and panel point at each other. Unique on the page. */
  idPrefix: string;
  /** `primary` fills the selected tab red; `accent` tints it cyan. */
  tone?: 'primary' | 'accent';
  size?: 'sm' | 'md';
  /** Give every tab the same width. */
  stretch?: boolean;
  className?: string;
}

const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`;
const tabPanelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`;

/**
 * WAI-ARIA tabs: one Tab stop for the list, arrow keys and Home/End move between tabs and select
 * them. Pair with a `TabPanel` that has the same `idPrefix` and the selected id.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  idPrefix,
  tone = 'primary',
  size = 'md',
  stretch = false,
  className,
}: TabsProps<T>): React.ReactElement {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === value)
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRovingIndex(
      event.key,
      index,
      items.map((item) => Boolean(item.disabled))
    );
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(styles.list, styles[tone], styles[size], stretch && styles.stretch, className)}
    >
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, item.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, item.id)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={styles.tab}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  /** The id of the tab this panel belongs to. */
  tab: string;
  children: React.ReactNode;
  className?: string;
}

/** The content of the selected tab. Focusable, so keyboard users can reach content without controls. */
export const TabPanel: React.FC<TabPanelProps> = ({ idPrefix, tab, children, className }) => (
  <div
    role="tabpanel"
    id={tabPanelId(idPrefix, tab)}
    aria-labelledby={tabId(idPrefix, tab)}
    tabIndex={0}
    className={className}
  >
    {children}
  </div>
);
