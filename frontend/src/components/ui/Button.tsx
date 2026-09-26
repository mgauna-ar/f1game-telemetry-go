import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cx } from './cx';
import { useTooltip } from './useTooltip';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the text; replaced by a spinner while `loading`. */
  icon?: React.ReactNode;
  /** Shows a spinner, sets `aria-busy` and ignores clicks. */
  loading?: boolean;
  /** Stretch to the container's width. */
  block?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

/** The app's button. Defaults to `type="button"` so it never submits a form by accident. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  block = false,
  type = 'button',
  className,
  disabled,
  children,
  ...rest
}) => {
  const iconSize = size === 'sm' ? 13 : 15;
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <RefreshCw size={iconSize} className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
};

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children' | 'block'> {
  /** The button's accessible name, also shown as its tooltip. */
  label: string;
  children: React.ReactNode;
  /** Tooltip text when it should say more than `label`. */
  tooltip?: string;
}

/** A square button with only an icon. `label` names it and shows as a tooltip. */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  tooltip,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ref,
  ...rest
}) => {
  const { triggerProps, tooltip: bubble } = useTooltip({
    content: tooltip ?? label,
    describe: tooltip !== undefined && tooltip !== label,
  });
  const setRef = (node: HTMLButtonElement | null) => {
    triggerProps.ref(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <>
      <Button
        {...rest}
        ref={setRef}
        variant={variant}
        size={size}
        className={cx(styles.icon, className)}
        aria-label={label}
        aria-describedby={triggerProps['aria-describedby']}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          triggerProps.onMouseEnter();
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          triggerProps.onMouseLeave();
        }}
        onFocus={(e) => {
          onFocus?.(e);
          triggerProps.onFocus(e);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          triggerProps.onBlur();
        }}
      >
        {children}
      </Button>
      {bubble}
    </>
  );
};
