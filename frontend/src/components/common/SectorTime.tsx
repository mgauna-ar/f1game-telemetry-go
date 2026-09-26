import React from 'react';
import { useI18n } from '../../context/I18nContext';

interface SectorTimeProps {
  /** The session's fastest time for this sector (purple). */
  isSessionBest?: boolean;
  /** The driver's own fastest time for this sector (green); ignored when it's also the session best. */
  isPersonalBest?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A sector time coloured the F1 way: purple for the session best, green for a personal best.
 * Colour isn't the only cue: session bests carry a corner notch, and both kinds say what they
 * are in a tooltip and to screen readers.
 */
export const SectorTime: React.FC<SectorTimeProps> = ({
  isSessionBest = false,
  isPersonalBest = false,
  children,
  className,
  style,
}) => {
  const { t } = useI18n();
  if (!isSessionBest && !isPersonalBest) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

  const label = t(
    isSessionBest ? 'history.classification.sessionFastestSector' : 'history.classification.personalBestSector'
  );
  const bestClass = isSessionBest ? 'sector-purple' : 'sector-green';
  return (
    <span className={className ? `${bestClass} ${className}` : bestClass} style={style} title={label}>
      {children}
      <span className="sr-only"> ({label})</span>
    </span>
  );
};
