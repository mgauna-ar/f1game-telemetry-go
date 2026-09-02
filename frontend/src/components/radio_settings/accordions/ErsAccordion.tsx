import React from 'react';
import { Zap } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface ErsAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const ErsAccordion: React.FC<ErsAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const ersAlertsEnabled = useRadioSettingsStore((s) => s.ersAlertsEnabled);
  const setErsAlertsEnabled = useRadioSettingsStore((s) => s.setErsAlertsEnabled);
  const subErsLow = useRadioSettingsStore((s) => s.subErsLow);
  const setSubErsLow = useRadioSettingsStore((s) => s.setSubErsLow);
  const ersLowPct = useRadioSettingsStore((s) => s.ersLowPct);
  const setErsLowPct = useRadioSettingsStore((s) => s.setErsLowPct);

  return (
    <SubsystemAccordion
      id="ers"
      title={t('ai_engineer.proactiveAlerts.ersTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.ersDesc')}
      icon={<Zap className="w-4 h-4" />}
      iconColorClass="text-amber-400"
      masterEnabled={ersAlertsEnabled}
      onToggleMaster={setErsAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.ersLowReserve')}</span>
          <input
            type="checkbox"
            checked={subErsLow}
            onChange={(e) => setSubErsLow(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.ersLowThreshold')}</span>
            <span className="radio-badge-val">{ersLowPct}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            step={5}
            value={ersLowPct}
            onChange={(e) => setErsLowPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
