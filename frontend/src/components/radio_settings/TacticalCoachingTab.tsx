import React, { useState } from 'react';
import {
  BellRing,
  Gauge,
  ShieldAlert,
  Zap,
  Activity,
  Fuel,
  Flame,
  Timer,
  Flag,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RadioPresetSelector } from './RadioPresetSelector';
import { SubsystemAccordion } from './SubsystemAccordion';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

interface TacticalCoachingTabProps {
  radio: UseRadioControllerReturn;
}

export const TacticalCoachingTab: React.FC<TacticalCoachingTabProps> = ({ radio }) => {
  const { t } = useI18n();

  // Settings from Zustand store with fine-grained selectors
  const triggerPreset = useRadioSettingsStore((s) => s.triggerPreset);
  const applyTriggerPreset = useRadioSettingsStore((s) => s.applyTriggerPreset);
  const resetTriggerDefaults = useRadioSettingsStore((s) => s.resetTriggerDefaults);
  const smartDiscretionEnabled = useRadioSettingsStore((s) => s.smartDiscretionEnabled);
  const setSmartDiscretionEnabled = useRadioSettingsStore((s) => s.setSmartDiscretionEnabled);
  const chatterCooldownSeconds = useRadioSettingsStore((s) => s.chatterCooldownSeconds);
  const setChatterCooldownSeconds = useRadioSettingsStore((s) => s.setChatterCooldownSeconds);

  const tyreAlertsEnabled = useRadioSettingsStore((s) => s.tyreAlertsEnabled);
  const setTyreAlertsEnabled = useRadioSettingsStore((s) => s.setTyreAlertsEnabled);
  const subTyreWear = useRadioSettingsStore((s) => s.subTyreWear);
  const setSubTyreWear = useRadioSettingsStore((s) => s.setSubTyreWear);
  const subTyrePuncture = useRadioSettingsStore((s) => s.subTyrePuncture);
  const setSubTyrePuncture = useRadioSettingsStore((s) => s.setSubTyrePuncture);
  const subTyreThermal = useRadioSettingsStore((s) => s.subTyreThermal);
  const setSubTyreThermal = useRadioSettingsStore((s) => s.setSubTyreThermal);
  const subTyreCold = useRadioSettingsStore((s) => s.subTyreCold);
  const setSubTyreCold = useRadioSettingsStore((s) => s.setSubTyreCold);
  const tyreWearWarningPct = useRadioSettingsStore((s) => s.tyreWearWarningPct);
  const setTyreWearWarningPct = useRadioSettingsStore((s) => s.setTyreWearWarningPct);
  const tyreWearCriticalPct = useRadioSettingsStore((s) => s.tyreWearCriticalPct);
  const setTyreWearCriticalPct = useRadioSettingsStore((s) => s.setTyreWearCriticalPct);
  const tyreOverheatC = useRadioSettingsStore((s) => s.tyreOverheatC);
  const setTyreOverheatC = useRadioSettingsStore((s) => s.setTyreOverheatC);
  const tyreColdC = useRadioSettingsStore((s) => s.tyreColdC);
  const setTyreColdC = useRadioSettingsStore((s) => s.setTyreColdC);

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

  const ersAlertsEnabled = useRadioSettingsStore((s) => s.ersAlertsEnabled);
  const setErsAlertsEnabled = useRadioSettingsStore((s) => s.setErsAlertsEnabled);
  const subErsLow = useRadioSettingsStore((s) => s.subErsLow);
  const setSubErsLow = useRadioSettingsStore((s) => s.setSubErsLow);
  const ersLowPct = useRadioSettingsStore((s) => s.ersLowPct);
  const setErsLowPct = useRadioSettingsStore((s) => s.setErsLowPct);

  const brakesAlertsEnabled = useRadioSettingsStore((s) => s.brakesAlertsEnabled);
  const setBrakesAlertsEnabled = useRadioSettingsStore((s) => s.setBrakesAlertsEnabled);
  const subBrakeTemp = useRadioSettingsStore((s) => s.subBrakeTemp);
  const setSubBrakeTemp = useRadioSettingsStore((s) => s.setSubBrakeTemp);
  const subBrakeCold = useRadioSettingsStore((s) => s.subBrakeCold);
  const setSubBrakeCold = useRadioSettingsStore((s) => s.setSubBrakeCold);
  const brakeOverheatC = useRadioSettingsStore((s) => s.brakeOverheatC);
  const setBrakeOverheatC = useRadioSettingsStore((s) => s.setBrakeOverheatC);
  const brakeColdC = useRadioSettingsStore((s) => s.brakeColdC);
  const setBrakeColdC = useRadioSettingsStore((s) => s.setBrakeColdC);

  const fuelAlertsEnabled = useRadioSettingsStore((s) => s.fuelAlertsEnabled);
  const setFuelAlertsEnabled = useRadioSettingsStore((s) => s.setFuelAlertsEnabled);
  const subFuelDelta = useRadioSettingsStore((s) => s.subFuelDelta);
  const setSubFuelDelta = useRadioSettingsStore((s) => s.setSubFuelDelta);
  const fuelDeltaLaps = useRadioSettingsStore((s) => s.fuelDeltaLaps);
  const setFuelDeltaLaps = useRadioSettingsStore((s) => s.setFuelDeltaLaps);

  const rivalAlertsEnabled = useRadioSettingsStore((s) => s.rivalAlertsEnabled);
  const setRivalAlertsEnabled = useRadioSettingsStore((s) => s.setRivalAlertsEnabled);
  const subUndercut = useRadioSettingsStore((s) => s.subUndercut);
  const setSubUndercut = useRadioSettingsStore((s) => s.setSubUndercut);
  const subPitWindow = useRadioSettingsStore((s) => s.subPitWindow);
  const setSubPitWindow = useRadioSettingsStore((s) => s.setSubPitWindow);
  const subRivalDefend = useRadioSettingsStore((s) => s.subRivalDefend);
  const setSubRivalDefend = useRadioSettingsStore((s) => s.setSubRivalDefend);
  const subRivalAttack = useRadioSettingsStore((s) => s.subRivalAttack);
  const setSubRivalAttack = useRadioSettingsStore((s) => s.setSubRivalAttack);
  const undercutGapSec = useRadioSettingsStore((s) => s.undercutGapSec);
  const setUndercutGapSec = useRadioSettingsStore((s) => s.setUndercutGapSec);
  const rivalGapThresholdSec = useRadioSettingsStore((s) => s.rivalGapThresholdSec);
  const setRivalGapThresholdSec = useRadioSettingsStore((s) => s.setRivalGapThresholdSec);
  const rivalAheadGapSec = useRadioSettingsStore((s) => s.rivalAheadGapSec);
  const setRivalAheadGapSec = useRadioSettingsStore((s) => s.setRivalAheadGapSec);

  const qualyAlertsEnabled = useRadioSettingsStore((s) => s.qualyAlertsEnabled);
  const setQualyAlertsEnabled = useRadioSettingsStore((s) => s.setQualyAlertsEnabled);
  const subQualyTraffic = useRadioSettingsStore((s) => s.subQualyTraffic);
  const setSubQualyTraffic = useRadioSettingsStore((s) => s.setSubQualyTraffic);
  const subQualyInvalid = useRadioSettingsStore((s) => s.subQualyInvalid);
  const setSubQualyInvalid = useRadioSettingsStore((s) => s.setSubQualyInvalid);
  const subQualyTime = useRadioSettingsStore((s) => s.subQualyTime);
  const setSubQualyTime = useRadioSettingsStore((s) => s.setSubQualyTime);
  const subQualyElim = useRadioSettingsStore((s) => s.subQualyElim);
  const setSubQualyElim = useRadioSettingsStore((s) => s.setSubQualyElim);
  const qualyCleanAirSec = useRadioSettingsStore((s) => s.qualyCleanAirSec);
  const setQualyCleanAirSec = useRadioSettingsStore((s) => s.setQualyCleanAirSec);

  const flagsPensAlertsEnabled = useRadioSettingsStore((s) => s.flagsPensAlertsEnabled);
  const setFlagsPensAlertsEnabled = useRadioSettingsStore((s) => s.setFlagsPensAlertsEnabled);
  const subSafetyCar = useRadioSettingsStore((s) => s.subSafetyCar);
  const setSubSafetyCar = useRadioSettingsStore((s) => s.setSubSafetyCar);
  const subRedFlag = useRadioSettingsStore((s) => s.subRedFlag);
  const setSubRedFlag = useRadioSettingsStore((s) => s.setSubRedFlag);
  const subRain = useRadioSettingsStore((s) => s.subRain);
  const setSubRain = useRadioSettingsStore((s) => s.setSubRain);
  const subTrackLimits = useRadioSettingsStore((s) => s.subTrackLimits);
  const setSubTrackLimits = useRadioSettingsStore((s) => s.setSubTrackLimits);
  const subPenalties = useRadioSettingsStore((s) => s.subPenalties);
  const setSubPenalties = useRadioSettingsStore((s) => s.setSubPenalties);
  const cornerCutWarnThreshold = useRadioSettingsStore((s) => s.cornerCutWarnThreshold);
  const setCornerCutWarnThreshold = useRadioSettingsStore((s) => s.setCornerCutWarnThreshold);
  const rainHorizonMin = useRadioSettingsStore((s) => s.rainHorizonMin);
  const setRainHorizonMin = useRadioSettingsStore((s) => s.setRainHorizonMin);
  const rainProbPct = useRadioSettingsStore((s) => s.rainProbPct);
  const setRainProbPct = useRadioSettingsStore((s) => s.setRainProbPct);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    tyres: true,
    damage: false,
    ers: false,
    brakes: false,
    fuel: false,
    rivals: false,
    qualy: false,
    flags: false,
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  return (
    <div className="radio-section">
      {/* Preset Selector */}
      <RadioPresetSelector
        currentPreset={triggerPreset}
        onSelectPreset={applyTriggerPreset}
        onResetDefaults={resetTriggerDefaults}
      />

      {/* Smart Discretion & Engineer Chatter Row */}
      <div className="radio-voice-grid" style={{ marginBottom: '6px' }}>
        <label className="radio-toggle-row" style={{ height: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{t('ai_engineer.triggers.smartDiscretion')}</span>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>
              {t('ai_engineer.triggers.smartDiscretionDesc')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={smartDiscretionEnabled}
            onChange={(e) => setSmartDiscretionEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('ai_engineer.triggers.chatterFrequency')}</span>
            <span className="radio-badge-val">{chatterCooldownSeconds}s</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={chatterCooldownSeconds}
            onChange={(e) => setChatterCooldownSeconds(parseInt(e.target.value, 10))}
            className="radio-slider-input"
            style={{ marginTop: '6px' }}
          />
        </div>
      </div>

      {/* Subsystems Accordion Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 2px' }}>
        <label className="radio-section-label" style={{ margin: 0 }}>
          <BellRing className="w-3.5 h-3.5" />
          {t('ai_engineer.proactiveAlerts.title')}
        </label>
      </div>

      <div className="radio-accordion-container">
        {/* 1. TYRES */}
        <SubsystemAccordion
          id="tyres"
          title={t('ai_engineer.proactiveAlerts.tyresTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.tyresDesc')}
          icon={<Gauge className="w-4 h-4" />}
          iconColorClass="text-cyan-400"
          masterEnabled={tyreAlertsEnabled}
          onToggleMaster={setTyreAlertsEnabled}
          isExpanded={!!expandedCategories.tyres}
          onToggleExpand={() => toggleCategory('tyres')}
          onTestAlert={() => radio.testTriggerAlert('tyres')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreWearWarning')}</span>
              <input
                type="checkbox"
                checked={subTyreWear}
                onChange={(e) => setSubTyreWear(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyrePuncture')}</span>
              <input
                type="checkbox"
                checked={subTyrePuncture}
                onChange={(e) => setSubTyrePuncture(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreThermalOverheat')}</span>
              <input
                type="checkbox"
                checked={subTyreThermal}
                onChange={(e) => setSubTyreThermal(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreCold')}</span>
              <input
                type="checkbox"
                checked={subTyreCold}
                onChange={(e) => setSubTyreCold(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreWearWarnThreshold')}</span>
                <span className="radio-badge-val">{tyreWearWarningPct}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                step={5}
                value={tyreWearWarningPct}
                onChange={(e) => setTyreWearWarningPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreWearCritThreshold')}</span>
                <span className="radio-badge-val">{tyreWearCriticalPct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={tyreWearCriticalPct}
                onChange={(e) => setTyreWearCriticalPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreOverheatTemp')}</span>
                <span className="radio-badge-val">{tyreOverheatC}°C</span>
              </div>
              <input
                type="range"
                min={90}
                max={140}
                step={5}
                value={tyreOverheatC}
                onChange={(e) => setTyreOverheatC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreColdTemp')}</span>
                <span className="radio-badge-val">{tyreColdC}°C</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={tyreColdC}
                onChange={(e) => setTyreColdC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 2. DAMAGE */}
        <SubsystemAccordion
          id="damage"
          title={t('ai_engineer.proactiveAlerts.damageTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.damageDesc')}
          icon={<ShieldAlert className="w-4 h-4" />}
          iconColorClass="text-rose-400"
          masterEnabled={damageAlertsEnabled}
          onToggleMaster={setDamageAlertsEnabled}
          isExpanded={!!expandedCategories.damage}
          onToggleExpand={() => toggleCategory('damage')}
          onTestAlert={() => radio.testTriggerAlert('damage')}
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

        {/* 3. ERS */}
        <SubsystemAccordion
          id="ers"
          title={t('ai_engineer.proactiveAlerts.ersTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.ersDesc')}
          icon={<Zap className="w-4 h-4" />}
          iconColorClass="text-amber-400"
          masterEnabled={ersAlertsEnabled}
          onToggleMaster={setErsAlertsEnabled}
          isExpanded={!!expandedCategories.ers}
          onToggleExpand={() => toggleCategory('ers')}
          onTestAlert={() => radio.testTriggerAlert('ers')}
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

        {/* 4. BRAKES */}
        <SubsystemAccordion
          id="brakes"
          title={t('ai_engineer.proactiveAlerts.brakesTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.brakesDesc')}
          icon={<Flame className="w-4 h-4" />}
          iconColorClass="text-orange-400"
          masterEnabled={brakesAlertsEnabled}
          onToggleMaster={setBrakesAlertsEnabled}
          isExpanded={!!expandedCategories.brakes}
          onToggleExpand={() => toggleCategory('brakes')}
          onTestAlert={() => radio.testTriggerAlert('brakes')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.brakeOverheatFade')}</span>
              <input
                type="checkbox"
                checked={subBrakeTemp}
                onChange={(e) => setSubBrakeTemp(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.brakeCold')}</span>
              <input
                type="checkbox"
                checked={subBrakeCold}
                onChange={(e) => setSubBrakeCold(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.brakeOverheatTemp')}</span>
                <span className="radio-badge-val">{brakeOverheatC}°C</span>
              </div>
              <input
                type="range"
                min={600}
                max={1200}
                step={50}
                value={brakeOverheatC}
                onChange={(e) => setBrakeOverheatC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.brakeColdTemp')}</span>
                <span className="radio-badge-val">{brakeColdC}°C</span>
              </div>
              <input
                type="range"
                min={50}
                max={400}
                step={25}
                value={brakeColdC}
                onChange={(e) => setBrakeColdC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 5. FUEL */}
        <SubsystemAccordion
          id="fuel"
          title={t('ai_engineer.proactiveAlerts.fuelTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.fuelDesc')}
          icon={<Fuel className="w-4 h-4" />}
          iconColorClass="text-emerald-400"
          masterEnabled={fuelAlertsEnabled}
          onToggleMaster={setFuelAlertsEnabled}
          isExpanded={!!expandedCategories.fuel}
          onToggleExpand={() => toggleCategory('fuel')}
          onTestAlert={() => radio.testTriggerAlert('fuel')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.fuelDeficitLiftCoast')}</span>
              <input
                type="checkbox"
                checked={subFuelDelta}
                onChange={(e) => setSubFuelDelta(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.fuelDeltaThreshold')}</span>
                <span className="radio-badge-val">{fuelDeltaLaps > 0 ? `+${fuelDeltaLaps}` : fuelDeltaLaps} laps</span>
              </div>
              <input
                type="range"
                min={-3.0}
                max={0.0}
                step={0.1}
                value={fuelDeltaLaps}
                onChange={(e) => setFuelDeltaLaps(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 6. RIVALS */}
        <SubsystemAccordion
          id="rivals"
          title={t('ai_engineer.proactiveAlerts.rivalsTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.rivalsDesc')}
          icon={<Activity className="w-4 h-4" />}
          iconColorClass="text-purple-400"
          masterEnabled={rivalAlertsEnabled}
          onToggleMaster={setRivalAlertsEnabled}
          isExpanded={!!expandedCategories.rivals}
          onToggleExpand={() => toggleCategory('rivals')}
          onTestAlert={() => radio.testTriggerAlert('rivals')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.undercutThreat')}</span>
              <input
                type="checkbox"
                checked={subUndercut}
                onChange={(e) => setSubUndercut(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.pitWindowOpen')}</span>
              <input
                type="checkbox"
                checked={subPitWindow}
                onChange={(e) => setSubPitWindow(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.rivalDefend')}</span>
              <input
                type="checkbox"
                checked={subRivalDefend}
                onChange={(e) => setSubRivalDefend(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.rivalAttack')}</span>
              <input
                type="checkbox"
                checked={subRivalAttack}
                onChange={(e) => setSubRivalAttack(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.undercutGapThreshold')}</span>
                <span className="radio-badge-val">{undercutGapSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={5.0}
                step={0.5}
                value={undercutGapSec}
                onChange={(e) => setUndercutGapSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rivalDefendGap')}</span>
                <span className="radio-badge-val">{rivalGapThresholdSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.1}
                value={rivalGapThresholdSec}
                onChange={(e) => setRivalGapThresholdSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rivalAttackGap')}</span>
                <span className="radio-badge-val">{rivalAheadGapSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.1}
                value={rivalAheadGapSec}
                onChange={(e) => setRivalAheadGapSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 7. QUALIFYING */}
        <SubsystemAccordion
          id="qualy"
          title={t('ai_engineer.proactiveAlerts.qualyTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.qualyDesc')}
          icon={<Timer className="w-4 h-4" />}
          iconColorClass="text-yellow-400"
          masterEnabled={qualyAlertsEnabled}
          onToggleMaster={setQualyAlertsEnabled}
          isExpanded={!!expandedCategories.qualy}
          onToggleExpand={() => toggleCategory('qualy')}
          onTestAlert={() => radio.testTriggerAlert('qualy')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyTraffic')}</span>
              <input
                type="checkbox"
                checked={subQualyTraffic}
                onChange={(e) => setSubQualyTraffic(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyDeletedLap')}</span>
              <input
                type="checkbox"
                checked={subQualyInvalid}
                onChange={(e) => setSubQualyInvalid(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualySessionTime')}</span>
              <input
                type="checkbox"
                checked={subQualyTime}
                onChange={(e) => setSubQualyTime(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyElimDanger')}</span>
              <input
                type="checkbox"
                checked={subQualyElim}
                onChange={(e) => setSubQualyElim(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.qualyCleanAirGap')}</span>
                <span className="radio-badge-val">{qualyCleanAirSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1.5}
                max={7.0}
                step={0.5}
                value={qualyCleanAirSec}
                onChange={(e) => setQualyCleanAirSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 8. FLAGS & RACE CONTROL */}
        <SubsystemAccordion
          id="flags"
          title={t('ai_engineer.proactiveAlerts.flagsTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.flagsDesc')}
          icon={<Flag className="w-4 h-4" />}
          iconColorClass="text-emerald-400"
          masterEnabled={flagsPensAlertsEnabled}
          onToggleMaster={setFlagsPensAlertsEnabled}
          isExpanded={!!expandedCategories.flags}
          onToggleExpand={() => toggleCategory('flags')}
          onTestAlert={() => radio.testTriggerAlert('flags')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.safetyCarAlert')}</span>
              <input
                type="checkbox"
                checked={subSafetyCar}
                onChange={(e) => setSubSafetyCar(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.redFlagAlert')}</span>
              <input
                type="checkbox"
                checked={subRedFlag}
                onChange={(e) => setSubRedFlag(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.dynamicRainAlert')}</span>
              <input
                type="checkbox"
                checked={subRain}
                onChange={(e) => setSubRain(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.trackLimitsWarning')}</span>
              <input
                type="checkbox"
                checked={subTrackLimits}
                onChange={(e) => setSubTrackLimits(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.penaltiesIncurred')}</span>
              <input
                type="checkbox"
                checked={subPenalties}
                onChange={(e) => setSubPenalties(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.cornerCutLimit')}</span>
                <span className="radio-badge-val">{cornerCutWarnThreshold}</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={cornerCutWarnThreshold}
                onChange={(e) => setCornerCutWarnThreshold(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rainHorizon')}</span>
                <span className="radio-badge-val">{rainHorizonMin} min</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={rainHorizonMin}
                onChange={(e) => setRainHorizonMin(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>

            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rainProbability')}</span>
                <span className="radio-badge-val">{rainProbPct}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                step={5}
                value={rainProbPct}
                onChange={(e) => setRainProbPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>
      </div>
    </div>
  );
};
