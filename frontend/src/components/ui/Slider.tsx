import React from 'react';
import { cx } from './cx';
import styles from './Slider.module.css';

export interface SliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'min' | 'max'
> {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** A range input. Name it with a `<label>`, `aria-label` or `aria-labelledby`, and describe the value with `aria-valuetext` when it has a unit. */
export const Slider: React.FC<SliderProps> = ({ value, min, max, step = 1, onChange, className, ...rest }) => (
  <input
    type="range"
    className={cx(styles.slider, className)}
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(event) => {
      const parsed = Number(event.target.value);
      onChange(Number.isFinite(parsed) ? parsed : 0);
    }}
    {...rest}
  />
);
