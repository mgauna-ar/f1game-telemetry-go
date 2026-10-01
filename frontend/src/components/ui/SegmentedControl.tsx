import React, { useRef } from 'react';
import { cx } from './cx';
import { nextRovingIndex } from './roving';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Tooltip, for options whose label is short. */
  title?: string;
  'data-testid'?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  'aria-label': string;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Pick one of a few options, such as a view mode or a filter. A radio group: one Tab stop, and
 * the arrow keys move and select. A `value` that matches no option leaves them all unchecked
 * (the comparator's zoom, when it shows a corner rather than a sector).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'sm',
  className,
}: SegmentedControlProps<T>): React.ReactElement {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabStop = Math.max(0, checkedIndex);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRovingIndex(
      event.key,
      index,
      options.map((option) => Boolean(option.disabled))
    );
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx(styles.group, styles[size], className)}>
      {options.map((option, index) => {
        const checked = index === checkedIndex;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            className={styles.option}
            data-testid={option['data-testid']}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
