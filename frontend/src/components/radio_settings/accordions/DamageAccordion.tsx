import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface DamageAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const DamageAccordion: React.FC<DamageAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const damageAlertsEnabled = useRadioSettingsStore((s) => s.damageAlertsEnabled);
  const setDamageAlertsEnabled = useRadioSettingsStore((s) => s.setDamageAlertsEnabled);
  const subDamageWing = useRadioSettingsStore((s) => s.subDamageWing);
  const setSubDamageWing = useRadioSettingsStore((s) => s.setSubDamageWing);
  const subDamageFloor = useRadioSettingsStore((s) => s.subDamageFloor);
  const setSubDamageFloor = useRadioSettingsStore((s) => s.setSubDamageFloor);
  const subDamageEngine = useRadioSettingsStore((s) => s.subDamageEngine);
  const setSubDamageEngine = useRadioSettingsStore((s) => s.setSubDamageEngine);
  const subDamageFaults = useRadioSettingsStore((s) => s.subDamageFaults);
  const setSubDamageFaults = useRadioSettingsStore((s) => s.setSubDamageFaults);
  const subEngineTemp = useRadioSettingsStore((s) => s.subEngineTemp);
  const setSubEngineTemp = useRadioSettingsStore((s) => s.setSubEngineTemp);
  const wingDamageWarnPct = useRadioSettingsStore((s) => s.wingDamageWarnPct);
  const setWingDamageWarnPct = useRadioSettingsStore((s) => s.setWingDamageWarnPct);
  const floorDamageWarnPct = useRadioSettingsStore((s) => s.floorDamageWarnPct);
  const setFloorDamageWarnPct = useRadioSettingsStore((s) => s.setFloorDamageWarnPct);
  const engineWearWarnPct = useRadioSettingsStore((s) => s.engineWearWarnPct);
  const setEngineWearWarnPct = useRadioSettingsStore((s) => s.setEngineWearWarnPct);
  const engineOverheatC = useRadioSettingsStore((s) => s.engineOverheatC);
  const setEngineOverheatC = useRadioSettingsStore((s) => s.setEngineOverheatC);

  return (
    <SubsystemAccordion
      id="damage"
      title={t('ai_engineer.proactiveAlerts.damageTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.damageDesc')}
      icon={<ShieldAlert className="w-4 h-4" />}
      iconColorClass="text-rose-400"
      masterEnabled={damageAlertsEnabled}
      onToggleMaster={setDamageAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.wingDamage')}</span>
          <input
            type="checkbox"
            checked={subDamageWing}
            onChange={(e) => setSubDamageWing(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.floorDamage')}</span>
          <input
            type="checkbox"
            checked={subDamageFloor}
            onChange={(e) => setSubDamageFloor(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.engineWear')}</span>
          <input
            type="checkbox"
            checked={subDamageEngine}
            onChange={(e) => setSubDamageEngine(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.mechanicalFaults')}</span>
          <input
            type="checkbox"
            checked={subDamageFaults}
            onChange={(e) => setSubDamageFaults(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.engineOverheat')}</span>
          <input
            type="checkbox"
            checked={subEngineTemp}
            onChange={(e) => setSubEngineTemp(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.wingDamageThreshold')}</span>
            <span className="radio-badge-val">{wingDamageWarnPct}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={wingDamageWarnPct}
            onChange={(e) => setWingDamageWarnPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.floorDamageThreshold')}</span>
            <span className="radio-badge-val">{floorDamageWarnPct}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={floorDamageWarnPct}
            onChange={(e) => setFloorDamageWarnPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.engineWearThreshold')}</span>
            <span className="radio-badge-val">{engineWearWarnPct}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={90}
            step={5}
            value={engineWearWarnPct}
            onChange={(e) => setEngineWearWarnPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.engineOverheatTemp')}</span>
            <span className="radio-badge-val">{engineOverheatC}°C</span>
          </div>
          <input
            type="range"
            min={105}
            max={145}
            step={5}
            value={engineOverheatC}
            onChange={(e) => setEngineOverheatC(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
