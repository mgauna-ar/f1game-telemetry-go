import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { cx } from '../ui/cx';
import styles from './SectorTime.module.css';

interface SectorTimeProps {
  /** The session's fastest time for this sector (purple). */
  isSessionBest?: boolean;
  /** The driver's own fastest time for this sector (green); ignored when it's also the session best. */
  isPersonalBest?: boolean;
  /** A completed sector slower than the driver's best (yellow); ignored when either best applies. */
  isSlower?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A sector time coloured the F1 way: purple for the session best, green for a personal best and
 * yellow for a slower one.
 * Colour isn't the only cue: session bests carry a corner notch, and both kinds say what they
 * are in a tooltip and to screen readers.
 */
export const SectorTime: React.FC<SectorTimeProps> = ({
  isSessionBest = false,
  isPersonalBest = false,
  isSlower = false,
  children,
  className,
}) => {
  const { t } = useI18n();
  if (!isSessionBest && !isPersonalBest) {
    // Yellow says "no improvement", which the time next to the best ones already tells a screen reader
    return (
      <span className={cx(isSlower && styles.yellow, className)} data-best={isSlower ? 'none' : undefined}>
        {children}
      </span>
    );
  }

  const label = t(
    isSessionBest ? 'history.classification.sessionFastestSector' : 'history.classification.personalBestSector'
  );
  return (
    <span
      className={cx(isSessionBest ? styles.purple : styles.green, className)}
      data-best={isSessionBest ? 'session' : 'personal'}
      title={label}
    >
      {children}
      <span className="sr-only"> ({label})</span>
    </span>
  );
};

/** The purple or green sample for a legend; decorative, so the legend text must say what it means. */
export const SectorSwatch: React.FC<{ kind: 'session' | 'personal' | 'slower' }> = ({ kind }) => (
  <span
    className={cx(
      styles.swatch,
      kind === 'session' ? styles.purple : kind === 'personal' ? styles.green : styles.yellow
    )}
    aria-hidden="true"
  />
);
