import React from 'react';
import { ChevronDown, ChevronUp, Volume1 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface SubsystemAccordionProps {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColorClass?: string;
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
  iconColorClass = 'text-cyan-400',
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
    <div className={`radio-accordion-card ${isExpanded ? 'card-open' : ''}`}>
      {/* The whole header toggles on click; the title button is the keyboard and screen reader control */}
      <div className="radio-accordion-header" role="presentation" onClick={onToggleExpand}>
        <button
          type="button"
          className="button-reset radio-accordion-title-group"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? bodyId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          <span className={`radio-accordion-icon-box ${iconColorClass}`}>
            {icon}
          </span>
          <span className="radio-accordion-title-col">
            <span className="radio-accordion-title">{title}</span>
            <span className="radio-accordion-subtitle">{subtitle}</span>
          </span>
        </button>

        <div className="radio-accordion-actions">
          {/* The switch's clicks don't reach the header */}
          <span role="presentation" style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
            <label className="radio-switch">
              <input
                type="checkbox"
                aria-label={title}
                checked={masterEnabled}
                onChange={(e) => onToggleMaster(e.target.checked)}
              />
              <span className="radio-switch-slider" />
            </label>
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 radio-accordion-chevron" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 radio-accordion-chevron" aria-hidden="true" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="radio-accordion-body" id={bodyId}>
          {children}
          {onTestAlert && (
            <button
              type="button"
              onClick={onTestAlert}
              className="radio-test-mini-btn"
            >
              <Volume1 className="w-3.5 h-3.5" />
              <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
