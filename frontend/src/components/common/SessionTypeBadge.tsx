import React from 'react';
import { Timer, Flag, Zap, Wrench, Gauge } from 'lucide-react';
import { getSessionTone } from '../../utils/formatters';
import { Badge } from '../ui/Badge';

export interface SessionTypeBadgeProps {
  sessionType?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const SessionTypeBadge: React.FC<SessionTypeBadgeProps> = ({
  sessionType,
  size = 'sm',
  showIcon = true,
  className,
}) => {
  const rawType = sessionType || 'Unknown';
  const tone = getSessionTone(rawType);
  const lower = rawType.toLowerCase();
  const iconSize = size === 'xs' ? 11 : size === 'md' ? 14 : 12;

  let Icon = Gauge;
  if (['qual', 'shootout', 'q1', 'q2', 'q3'].some((part) => lower.includes(part))) Icon = Timer;
  else if (lower.includes('race')) Icon = Flag;
  else if (lower.includes('sprint')) Icon = Zap;
  else if (lower.includes('practice') || lower.includes('fp')) Icon = Wrench;

  return (
    <Badge
      tone={tone}
      size={size}
      uppercase
      className={className}
      icon={showIcon ? <Icon size={iconSize} aria-hidden="true" /> : undefined}
      title={`Session Type: ${rawType}`}
    >
      <span>{rawType}</span>
    </Badge>
  );
};
