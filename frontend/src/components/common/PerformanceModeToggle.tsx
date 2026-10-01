import React from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';
import { IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import styles from './PerformanceModeToggle.module.css';

/**
 * Turns performance mode on or off for the page on screen. The Driver view keeps its own choice,
 * so turning it off on the dashboard leaves the phone on the rig solid.
 */
export const PerformanceModeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useI18n();
  const { on, context, toggle } = usePerformanceMode();
  const state = on ? t('nav.performanceMode.on') : t('nav.performanceMode.off');
  const scope = context === 'driver' ? t('nav.performanceMode.driverScope') : t('nav.performanceMode.generalScope');
  return (
    <IconButton
      size="sm"
      label={t('nav.performanceMode.label')}
      tooltip={`${t('nav.performanceMode.label')}: ${state}. ${t('nav.performanceMode.hint')} ${scope}`}
      aria-pressed={on}
      className={cx(styles.toggle, className)}
      onClick={toggle}
      data-testid="performance-mode-toggle"
    >
      <Gauge size={15} aria-hidden="true" />
    </IconButton>
  );
};
