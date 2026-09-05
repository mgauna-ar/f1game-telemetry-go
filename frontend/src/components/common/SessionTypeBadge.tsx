import React from 'react';
import { Timer, Flag, Zap, Wrench, Gauge } from 'lucide-react';
import { getSessionBadgeClass } from '../../utils/formatters';

export interface SessionTypeBadgeProps {
  sessionType?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SessionTypeBadge: React.FC<SessionTypeBadgeProps> = ({
  sessionType,
  size = 'sm',
  showIcon = true,
  className = '',
  style,
}) => {
  const rawType = sessionType || 'Unknown';
  const badgeColorClass = getSessionBadgeClass(rawType);

  const lower = rawType.toLowerCase();

  const getIcon = () => {
    const iconSize = size === 'xs' ? 11 : size === 'md' ? 14 : 12;
    if (lower.includes('qual') || lower.includes('shootout') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) {
      return <Timer size={iconSize} className="session-type-badge-icon" aria-hidden="true" />;
    }
    if (lower.includes('race')) {
      return <Flag size={iconSize} className="session-type-badge-icon" aria-hidden="true" />;
    }
    if (lower.includes('sprint')) {
      return <Zap size={iconSize} className="session-type-badge-icon" aria-hidden="true" />;
    }
    if (lower.includes('practice') || lower.includes('fp')) {
      return <Wrench size={iconSize} className="session-type-badge-icon" aria-hidden="true" />;
    }
    return <Gauge size={iconSize} className="session-type-badge-icon" aria-hidden="true" />;
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: { fontSize: '0.65rem', padding: '2px 7px', gap: '3px' },
    sm: { fontSize: '0.72rem', padding: '3px 9px', gap: '4px' },
    md: { fontSize: '0.8rem', padding: '4px 12px', gap: '5px' },
  };

  return (
    <span
      className={`session-badge ${badgeColorClass} ${className}`}
      style={{
        ...sizeStyles[size],
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
      title={`Session Type: ${rawType}`}
    >
      {showIcon && getIcon()}
      <span>{rawType}</span>
    </span>
  );
};
