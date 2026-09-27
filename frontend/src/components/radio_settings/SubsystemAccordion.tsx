import React from 'react';
import { ChevronDown, Volume1 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import styles from './SubsystemAccordion.module.css';

export type SubsystemTone = 'cyan' | 'green' | 'orange' | 'amber' | 'red' | 'purple' | 'yellow';

interface SubsystemAccordionProps {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  /** Colour of the icon, one per subsystem. */
  tone?: SubsystemTone;
  masterEnabled: boolean;
  onToggleMaster: (enabled: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert?: () => void;
  children: React.ReactNode;
}

export const SubsystemAccordion: React.FC<SubsystemAccordionProps> = ({
  id,
  title,
  subtitle,
  icon,
  tone = 'cyan',
  masterEnabled,
  onToggleMaster,
  isExpanded,
  onToggleExpand,
  onTestAlert,
  children,
}) => {
  const { t } = useI18n();
  const bodyId = `radio-accordion-${id}-body`;

  return (
    <div className={styles.card} data-open={isExpanded}>
      {/* The whole header toggles on click; the title button is the keyboard and screen reader control */}
      <div className={styles.header} role="presentation" onClick={onToggleExpand}>
        <button
          type="button"
          className={`button-reset ${styles.titleButton}`}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? bodyId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          <span className={styles.icon} data-tone={tone} aria-hidden="true">
            {icon}
          </span>
          <span className={styles.titles}>
            <span className={styles.title}>{title}</span>
            <span className={styles.subtitle}>{subtitle}</span>
          </span>
        </button>

        <div className={styles.actions}>
          {/* The switch's clicks don't reach the header */}
          <span role="presentation" className={styles.switchWrap} onClick={(e) => e.stopPropagation()}>
            <Switch size="md" tone="success" aria-label={title} checked={masterEnabled} onChange={onToggleMaster} />
          </span>
          <ChevronDown size={16} className={styles.chevron} aria-hidden="true" data-testid="accordion-chevron" />
        </div>
      </div>

      {isExpanded && (
        <div className={styles.body} id={bodyId}>
          {children}
          {onTestAlert && (
            <Button
              size="sm"
              icon={<Volume1 size={14} aria-hidden="true" />}
              onClick={onTestAlert}
              className={styles.testButton}
            >
              {t('ai_engineer.proactiveAlerts.testSubsystem')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
