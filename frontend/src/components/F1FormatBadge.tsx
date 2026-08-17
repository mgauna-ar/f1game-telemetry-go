import React from 'react';

interface F1FormatBadgeProps {
  format?: number | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const F1FormatBadge: React.FC<F1FormatBadgeProps> = ({
  format,
  size = 'sm',
  className = '',
  style,
}) => {
  const is2025 = format === 2025;
  const label = is2025 ? 'F1 2025' : 'F1 2026';
  const badgeClass = is2025 ? 'badge-f1-2025' : 'badge-f1-2026';

  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: { fontSize: '0.65rem', padding: '1px 6px' },
    sm: { fontSize: '0.72rem', padding: '2px 8px' },
    md: { fontSize: '0.8rem', padding: '4px 10px' },
  };

  return (
    <span
      className={`session-badge ${badgeClass} ${className}`}
      style={{
        ...sizeStyles[size],
        letterSpacing: '0.04em',
        fontWeight: 700,
        ...style,
      }}
      title={`F1 Game Telemetry UDP Specification ${is2025 ? '2025 (22 slots)' : '2026 (24 slots)'}`}
    >
      {label}
    </span>
  );
};
