import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';
import styles from './Field.module.css';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Monospace text, for call signs, keys and addresses. */
  mono?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

/** A single-line text input. Name it with a `<label htmlFor>` or `aria-label`. */
export const TextInput: React.FC<TextInputProps> = ({ mono = false, type = 'text', className, ...rest }) => (
  <input type={type} className={cx(styles.control, mono && styles.mono, className)} {...rest} />
);

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** A multi-line text input that grows vertically. */
export const TextArea: React.FC<TextAreaProps> = ({ className, ...rest }) => (
  <textarea className={cx(styles.control, styles.textarea, className)} {...rest} />
);

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** A native select with the app's box and a chevron. */
export const Select: React.FC<SelectProps> = ({ className, children, ...rest }) => (
  <span className={cx(styles.selectWrap, className)}>
    <select className={cx(styles.control, styles.select)} {...rest}>
      {children}
    </select>
    <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
  </span>
);
