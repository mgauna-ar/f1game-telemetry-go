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

  return (
    <div className={`radio-accordion-card ${isExpanded ? 'card-open' : ''}`}>
      <div className="radio-accordion-header" onClick={onToggleExpand}>
        <div className="radio-accordion-title-group">
          <div className={`radio-accordion-icon-box ${iconColorClass}`}>
            {icon}
          </div>
          <div className="radio-accordion-title-col">
            <span className="radio-accordion-title">{title}</span>
            <span className="radio-accordion-subtitle">{subtitle}</span>
          </div>
        </div>

        <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
          <label className="radio-switch">
            <input
              type="checkbox"
              checked={masterEnabled}
              onChange={(e) => onToggleMaster(e.target.checked)}
            />
            <span className="radio-switch-slider" />
          </label>
          <div onClick={onToggleExpand}>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 radio-accordion-chevron" />
            ) : (
              <ChevronDown className="w-4 h-4 radio-accordion-chevron" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="radio-accordion-body">
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
