import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { getPttHint, type PttControls } from '../../utils/pttHint';
import { Badge } from '../ui/Badge';
import { cx } from '../ui/cx';
import styles from './PttHint.module.css';

export interface PttHintProps {
  controls: PttControls;
  /** Opens the radio settings where a push-to-talk control can be set up. */
  onSetUp?: () => void;
  className?: string;
}

/** How to talk to the pit wall: the key or button in a chip, or a "Set up" link when none is mapped. */
export const PttHint: React.FC<PttHintProps> = ({ controls, onSetUp, className }) => {
  const { t } = useI18n();
  const hint = getPttHint(controls, t);

  return (
    <span className={cx(styles.hint, className)}>
      {hint.badge && (
        <Badge tone="accent" size="xs" square uppercase>
          {hint.badge}
        </Badge>
      )}
      <span className={styles.text}>{hint.text}</span>
      {!hint.badge && onSetUp && (
        <button type="button" className={`button-reset ${styles.setUp}`} onClick={onSetUp}>
          {t('ai_engineer.radio.pttSetUp')} →
        </button>
      )}
    </span>
  );
};
