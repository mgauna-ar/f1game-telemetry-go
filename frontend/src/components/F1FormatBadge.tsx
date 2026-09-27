import React from 'react';
import { Badge } from './ui/Badge';

interface F1FormatBadgeProps {
  format?: number | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const F1FormatBadge: React.FC<F1FormatBadgeProps> = ({ format, size = 'sm', className }) => {
  const is2025 = format === 2025;
  return (
    <Badge
      tone={is2025 ? 'purple' : 'accent'}
      size={size}
      className={className}
      title={`F1 Game Telemetry UDP Specification ${is2025 ? '2025 (22 slots)' : '2026 (24 slots)'}`}
    >
      {is2025 ? 'F1 2025' : 'F1 2026'}
    </Badge>
  );
};
