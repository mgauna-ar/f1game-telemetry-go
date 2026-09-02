import React from 'react';

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
}

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
}) => {
  const displayVal = formatValue ? formatValue(value) : `${prefix}${value}${unit}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const isFloat = (step && step % 1 !== 0) || raw.includes('.');
    const parsed = isFloat ? parseFloat(raw) : parseInt(raw, 10);
    onChange(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <div className="radio-ptt-box">
      <div className="radio-ptt-box-header">
        <span>{label}</span>
        <span className="radio-badge-val">{displayVal}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="radio-slider-input"
      />
      {description && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
          {description}
        </span>
      )}
    </div>
  );
};
