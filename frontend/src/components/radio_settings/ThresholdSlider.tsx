import React, { useId } from 'react';
import { Slider } from '../ui/Slider';
import styles from './RadioSettings.module.css';

export interface ThresholdSliderProps {
  label: string;
  value: number;
  unit?: string;
  prefix?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  description?: string;
  formatValue?: (val: number) => string;
  /** Shown before the label, such as a volume icon. */
  icon?: React.ReactNode;
}

/** A labelled slider card: the setting's name, its current value, the slider and an optional note. */
export const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
  label,
  value,
  unit = '',
  prefix = '',
  min,
  max,
  step = 1,
  onChange,
  description,
  formatValue,
  icon,
}) => {
  const id = useId();
  const descriptionId = useId();
  const displayVal = formatValue ? formatValue(value) : `${prefix}${value}${unit}`;

  return (
    <div className={styles.box}>
      <div className={styles.boxHeader}>
        <label htmlFor={id} className={styles.boxLabel}>
          {icon}
          {label}
        </label>
        <span className={styles.value} aria-hidden="true">
          {displayVal}
        </span>
      </div>
      <Slider
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        aria-valuetext={displayVal}
        aria-describedby={description ? descriptionId : undefined}
      />
      {description && (
        <span id={descriptionId} className={styles.hint}>
          {description}
        </span>
      )}
    </div>
  );
};
