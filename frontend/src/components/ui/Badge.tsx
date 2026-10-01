import React from 'react';
import { cx } from './cx';
import styles from './Badge.module.css';

/** `you` marks the player (cyan, `--f1-you`); `info` is blue; `accent` is cyan for highlights that aren't you. */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'you' | 'purple' | 'orange';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Any CSS colour, such as a team colour; overrides `tone`. */
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  uppercase?: boolean;
  /** Small radius instead of a pill. */
  square?: boolean;
  icon?: React.ReactNode;
}

/** A short status or category label: tinted background, matching border and text. */
export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  color,
  size = 'sm',
  uppercase = false,
  square = false,
  icon,
  className,
  style,
  children,
  ...rest
}) => (
  <span
    className={cx(
      styles.badge,
      styles[tone],
      size !== 'sm' && styles[size],
      uppercase && styles.uppercase,
      square && styles.square,
      className
    )}
    style={color ? ({ ...style, '--badge-color': color } as React.CSSProperties) : style}
    data-tone={color ? undefined : tone}
    {...rest}
  >
    {icon}
    {children}
  </span>
);
