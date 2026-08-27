import React from 'react';

interface ThresholdSliderProps {
  label: string;
  value: number;
  unit?: string;
  prefix?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  description?: string;
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
}) => {
  return (
    <div className="radio-slider-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-primary)' }}>{label}</span>
        <span className="radio-badge-val" style={{ minWidth: '45px', textAlign: 'right' }}>
          {prefix}{value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
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
