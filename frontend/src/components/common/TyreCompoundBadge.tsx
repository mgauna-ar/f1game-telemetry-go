import React from 'react';

interface TyreCompoundBadgeProps {
  compound?: string;
}

export const TyreCompoundBadge: React.FC<TyreCompoundBadgeProps> = ({ compound }) => {
  if (!compound) return null;
  const str = compound.toUpperCase().trim();

  let label = str.charAt(0);
  let color = '#FFFFFF';
  let bg = 'rgba(255, 255, 255, 0.15)';

  if (str === '16' || str.includes('SOFT') || str === 'S') {
    label = 'S';
    color = '#ff4757';
    bg = 'rgba(255, 71, 87, 0.2)';
  } else if (str === '17' || str.includes('MED') || str === 'M') {
    label = 'M';
    color = '#ffd200';
    bg = 'rgba(255, 210, 0, 0.2)';
  } else if (str === '18' || str.includes('HARD') || str === 'H') {
    label = 'H';
    color = '#FFFFFF';
    bg = 'rgba(255, 255, 255, 0.2)';
  } else if (str === '7' || str.includes('INTER') || str === 'I') {
    label = 'I';
    color = '#2ed573';
    bg = 'rgba(46, 213, 115, 0.2)';
  } else if (str === '8' || str.includes('WET') || str === 'W') {
    label = 'W';
    color = '#1e90ff';
    bg = 'rgba(30, 144, 255, 0.2)';
  }

  return (
    <span
      className="tyre-badge-mini"
      style={{ color, backgroundColor: bg, borderColor: color }}
      title={`Tyre Compound: ${compound}`}
    >
      {label}
    </span>
  );
};
