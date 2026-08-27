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
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

interface TacticalCoachingTabProps {
  radio: UseRadioControllerReturn;
}

export const TacticalCoachingTab: React.FC<TacticalCoachingTabProps> = ({ radio }) => {
  const { t } = useI18n();

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
        currentPreset={radio.triggerPreset}
        onSelectPreset={radio.applyTriggerPreset}
        onResetDefaults={radio.resetTriggerDefaults}
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
            checked={radio.smartDiscretionEnabled}
            onChange={(e) => radio.setSmartDiscretionEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('ai_engineer.triggers.chatterFrequency')}</span>
            <span className="radio-badge-val">{radio.chatterCooldownSeconds}s</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={radio.chatterCooldownSeconds}
            onChange={(e) => radio.setChatterCooldownSeconds(parseInt(e.target.value, 10))}
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
          masterEnabled={radio.tyreAlertsEnabled}
          onToggleMaster={radio.setTyreAlertsEnabled}
          isExpanded={!!expandedCategories.tyres}
          onToggleExpand={() => toggleCategory('tyres')}
          onTestAlert={() => radio.testTriggerAlert('tyres')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreWearWarning')}</span>
              <input
                type="checkbox"
                checked={radio.subTyreWear}
                onChange={(e) => radio.setSubTyreWear(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyrePuncture')}</span>
              <input
                type="checkbox"
                checked={radio.subTyrePuncture}
                onChange={(e) => radio.setSubTyrePuncture(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreThermalOverheat')}</span>
              <input
                type="checkbox"
                checked={radio.subTyreThermal}
                onChange={(e) => radio.setSubTyreThermal(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.tyreCold')}</span>
              <input
                type="checkbox"
                checked={radio.subTyreCold}
                onChange={(e) => radio.setSubTyreCold(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.triggers.wearWarningPct')}</span>
                <span className="radio-badge-val">{radio.tyreWearWarningPct}%</span>
              </div>
              <input
                type="range"
                min={15}
                max={60}
                step={5}
                value={radio.tyreWearWarningPct}
                onChange={(e) => radio.setTyreWearWarningPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.triggers.wearCriticalPct')}</span>
                <span className="radio-badge-val">{radio.tyreWearCriticalPct}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={90}
                step={5}
                value={radio.tyreWearCriticalPct}
                onChange={(e) => radio.setTyreWearCriticalPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreOverheatThreshold')}</span>
                <span className="radio-badge-val">{radio.tyreOverheatC}°C</span>
              </div>
              <input
                type="range"
                min={95}
                max={135}
                step={1}
                value={radio.tyreOverheatC}
                onChange={(e) => radio.setTyreOverheatC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.tyreColdThreshold')}</span>
                <span className="radio-badge-val">{radio.tyreColdC}°C</span>
              </div>
              <input
                type="range"
                min={65}
                max={95}
                step={1}
                value={radio.tyreColdC}
                onChange={(e) => radio.setTyreColdC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 2. DAMAGE & AERO */}
        <SubsystemAccordion
          id="damage"
          title={t('ai_engineer.proactiveAlerts.damageTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.damageDesc')}
          icon={<ShieldAlert className="w-4 h-4" />}
          iconColorClass="text-rose-400"
          masterEnabled={radio.damageAlertsEnabled}
          onToggleMaster={radio.setDamageAlertsEnabled}
          isExpanded={!!expandedCategories.damage}
          onToggleExpand={() => toggleCategory('damage')}
          onTestAlert={() => radio.testTriggerAlert('damage')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.damageWing')}</span>
              <input
                type="checkbox"
                checked={radio.subDamageWing}
                onChange={(e) => radio.setSubDamageWing(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.damageFloor')}</span>
              <input
                type="checkbox"
                checked={radio.subDamageFloor}
                onChange={(e) => radio.setSubDamageFloor(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.damageEngine')}</span>
              <input
                type="checkbox"
                checked={radio.subDamageEngine}
                onChange={(e) => radio.setSubDamageEngine(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.damageFaults')}</span>
              <input
                type="checkbox"
                checked={radio.subDamageFaults}
                onChange={(e) => radio.setSubDamageFaults(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.wingThreshold')}</span>
                <span className="radio-badge-val">{radio.wingDamageWarnPct}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={45}
                step={5}
                value={radio.wingDamageWarnPct}
                onChange={(e) => radio.setWingDamageWarnPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.floorThreshold')}</span>
                <span className="radio-badge-val">{radio.floorDamageWarnPct}%</span>
              </div>
              <input
                type="range"
                min={15}
                max={50}
                step={5}
                value={radio.floorDamageWarnPct}
                onChange={(e) => radio.setFloorDamageWarnPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>

          <div className="radio-ptt-box" style={{ marginTop: '2px' }}>
            <div className="radio-ptt-box-header">
              <span>{t('ai_engineer.proactiveAlerts.engineWearThreshold')}</span>
              <span className="radio-badge-val">{radio.engineWearWarnPct}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={radio.engineWearWarnPct}
              onChange={(e) => radio.setEngineWearWarnPct(parseInt(e.target.value, 10))}
              className="radio-slider-input"
            />
          </div>
        </SubsystemAccordion>

        {/* 3. ERS & POWER UNIT */}
        <SubsystemAccordion
          id="ers"
          title={t('ai_engineer.proactiveAlerts.ersTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.ersDesc')}
          icon={<Zap className="w-4 h-4" />}
          iconColorClass="text-amber-400"
          masterEnabled={radio.ersAlertsEnabled}
          onToggleMaster={radio.setErsAlertsEnabled}
          isExpanded={!!expandedCategories.ers}
          onToggleExpand={() => toggleCategory('ers')}
          onTestAlert={() => radio.testTriggerAlert('ers')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.ersLow')}</span>
              <input
                type="checkbox"
                checked={radio.subErsLow}
                onChange={(e) => radio.setSubErsLow(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.engineTemp')}</span>
              <input
                type="checkbox"
                checked={radio.subEngineTemp}
                onChange={(e) => radio.setSubEngineTemp(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.ersLowThreshold')}</span>
                <span className="radio-badge-val">{radio.ersLowPct}%</span>
              </div>
              <input
                type="range"
                min={8}
                max={35}
                step={1}
                value={radio.ersLowPct}
                onChange={(e) => radio.setErsLowPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.engineTempThreshold')}</span>
                <span className="radio-badge-val">{radio.engineOverheatC}°C</span>
              </div>
              <input
                type="range"
                min={115}
                max={145}
                step={1}
                value={radio.engineOverheatC}
                onChange={(e) => radio.setEngineOverheatC(parseInt(e.target.value, 10))}
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
          icon={<Activity className="w-4 h-4" />}
          iconColorClass="text-orange-400"
          masterEnabled={radio.brakesAlertsEnabled}
          onToggleMaster={radio.setBrakesAlertsEnabled}
          isExpanded={!!expandedCategories.brakes}
          onToggleExpand={() => toggleCategory('brakes')}
          onTestAlert={() => radio.testTriggerAlert('brakes')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.brakeOverheat')}</span>
              <input
                type="checkbox"
                checked={radio.subBrakeTemp}
                onChange={(e) => radio.setSubBrakeTemp(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.brakeCold')}</span>
              <input
                type="checkbox"
                checked={radio.subBrakeCold}
                onChange={(e) => radio.setSubBrakeCold(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.brakeOverheatThreshold')}</span>
                <span className="radio-badge-val">{radio.brakeOverheatC}°C</span>
              </div>
              <input
                type="range"
                min={700}
                max={1150}
                step={25}
                value={radio.brakeOverheatC}
                onChange={(e) => radio.setBrakeOverheatC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.brakeColdThreshold')}</span>
                <span className="radio-badge-val">{radio.brakeColdC}°C</span>
              </div>
              <input
                type="range"
                min={100}
                max={350}
                step={25}
                value={radio.brakeColdC}
                onChange={(e) => radio.setBrakeColdC(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 5. FUEL & STRATEGY */}
        <SubsystemAccordion
          id="fuel"
          title={t('ai_engineer.proactiveAlerts.fuelTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.fuelDesc')}
          icon={<Fuel className="w-4 h-4" />}
          iconColorClass="text-emerald-400"
          masterEnabled={radio.fuelAlertsEnabled}
          onToggleMaster={radio.setFuelAlertsEnabled}
          isExpanded={!!expandedCategories.fuel}
          onToggleExpand={() => toggleCategory('fuel')}
          onTestAlert={() => radio.testTriggerAlert('fuel')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.fuelDelta')}</span>
              <input
                type="checkbox"
                checked={radio.subFuelDelta}
                onChange={(e) => radio.setSubFuelDelta(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.undercut')}</span>
              <input
                type="checkbox"
                checked={radio.subUndercut}
                onChange={(e) => radio.setSubUndercut(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.pitWindow')}</span>
              <input
                type="checkbox"
                checked={radio.subPitWindow}
                onChange={(e) => radio.setSubPitWindow(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.fuelDeltaThreshold')}</span>
                <span className="radio-badge-val">{radio.fuelDeltaLaps.toFixed(1)} v</span>
              </div>
              <input
                type="range"
                min={-2.5}
                max={-0.2}
                step={0.1}
                value={radio.fuelDeltaLaps}
                onChange={(e) => radio.setFuelDeltaLaps(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.undercutThreshold')}</span>
                <span className="radio-badge-val">{radio.undercutGapSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={4.5}
                step={0.2}
                value={radio.undercutGapSec}
                onChange={(e) => radio.setUndercutGapSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 6. RIVALS & DRS */}
        <SubsystemAccordion
          id="rivals"
          title={t('ai_engineer.proactiveAlerts.rivalsTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.rivalsDesc')}
          icon={<Flame className="w-4 h-4" />}
          iconColorClass="text-purple-400"
          masterEnabled={radio.rivalAlertsEnabled}
          onToggleMaster={radio.setRivalAlertsEnabled}
          isExpanded={!!expandedCategories.rivals}
          onToggleExpand={() => toggleCategory('rivals')}
          onTestAlert={() => radio.testTriggerAlert('rivals')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.rivalDefend')}</span>
              <input
                type="checkbox"
                checked={radio.subRivalDefend}
                onChange={(e) => radio.setSubRivalDefend(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.rivalAttack')}</span>
              <input
                type="checkbox"
                checked={radio.subRivalAttack}
                onChange={(e) => radio.setSubRivalAttack(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rivalDefendThreshold')}</span>
                <span className="radio-badge-val">{radio.rivalGapThresholdSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={radio.rivalGapThresholdSec}
                onChange={(e) => radio.setRivalGapThresholdSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rivalAttackThreshold')}</span>
                <span className="radio-badge-val">{radio.rivalAheadGapSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={radio.rivalAheadGapSec}
                onChange={(e) => radio.setRivalAheadGapSec(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
            </div>
          </div>
        </SubsystemAccordion>

        {/* 7. QUALY & PRACTICE */}
        <SubsystemAccordion
          id="qualy"
          title={t('ai_engineer.proactiveAlerts.qualyTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.qualyDesc')}
          icon={<Timer className="w-4 h-4" />}
          iconColorClass="text-sky-400"
          masterEnabled={radio.qualyAlertsEnabled}
          onToggleMaster={radio.setQualyAlertsEnabled}
          isExpanded={!!expandedCategories.qualy}
          onToggleExpand={() => toggleCategory('qualy')}
          onTestAlert={() => radio.testTriggerAlert('qualy')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyTraffic')}</span>
              <input
                type="checkbox"
                checked={radio.subQualyTraffic}
                onChange={(e) => radio.setSubQualyTraffic(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyInvalid')}</span>
              <input
                type="checkbox"
                checked={radio.subQualyInvalid}
                onChange={(e) => radio.setSubQualyInvalid(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyTime')}</span>
              <input
                type="checkbox"
                checked={radio.subQualyTime}
                onChange={(e) => radio.setSubQualyTime(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.qualyElimination')}</span>
              <input
                type="checkbox"
                checked={radio.subQualyElim}
                onChange={(e) => radio.setSubQualyElim(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-box">
            <div className="radio-ptt-box-header">
              <span>{t('ai_engineer.proactiveAlerts.qualyCleanAirThreshold')}</span>
              <span className="radio-badge-val">{radio.qualyCleanAirSec.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={2.0}
              max={6.0}
              step={0.5}
              value={radio.qualyCleanAirSec}
              onChange={(e) => radio.setQualyCleanAirSec(parseFloat(e.target.value))}
              className="radio-slider-input"
            />
          </div>
        </SubsystemAccordion>

        {/* 8. FLAGS & PENALTIES */}
        <SubsystemAccordion
          id="flags"
          title={t('ai_engineer.proactiveAlerts.flagsTitle')}
          subtitle={t('ai_engineer.proactiveAlerts.flagsDesc')}
          icon={<Flag className="w-4 h-4" />}
          iconColorClass="text-yellow-400"
          masterEnabled={radio.flagsPensAlertsEnabled}
          onToggleMaster={radio.setFlagsPensAlertsEnabled}
          isExpanded={!!expandedCategories.flags}
          onToggleExpand={() => toggleCategory('flags')}
          onTestAlert={() => radio.testTriggerAlert('flags')}
        >
          <div className="radio-sub-toggles-grid">
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.safetyCar')}</span>
              <input
                type="checkbox"
                checked={radio.subSafetyCar}
                onChange={(e) => radio.setSubSafetyCar(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.redFlag')}</span>
              <input
                type="checkbox"
                checked={radio.subRedFlag}
                onChange={(e) => radio.setSubRedFlag(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.rainRadar')}</span>
              <input
                type="checkbox"
                checked={radio.subRain}
                onChange={(e) => radio.setSubRain(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.trackLimits')}</span>
              <input
                type="checkbox"
                checked={radio.subTrackLimits}
                onChange={(e) => radio.setSubTrackLimits(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
            <label className="radio-sub-toggle-item">
              <span>{t('ai_engineer.proactiveAlerts.penalties')}</span>
              <input
                type="checkbox"
                checked={radio.subPenalties}
                onChange={(e) => radio.setSubPenalties(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          <div className="radio-ptt-grid">
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rainHorizonThreshold')}</span>
                <span className="radio-badge-val">{radio.rainHorizonMin} min</span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                step={1}
                value={radio.rainHorizonMin}
                onChange={(e) => radio.setRainHorizonMin(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
            <div className="radio-ptt-box">
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.proactiveAlerts.rainProbThreshold')}</span>
                <span className="radio-badge-val">{radio.rainProbPct}%</span>
              </div>
              <input
                type="range"
                min={25}
                max={75}
                step={5}
                value={radio.rainProbPct}
                onChange={(e) => radio.setRainProbPct(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
            </div>
          </div>

          <div className="radio-ptt-box" style={{ marginTop: '2px' }}>
            <div className="radio-ptt-box-header">
              <span>{t('ai_engineer.proactiveAlerts.cornerCutThreshold')}</span>
              <span className="radio-badge-val">{radio.cornerCutWarnThreshold} avisos</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={radio.cornerCutWarnThreshold}
              onChange={(e) => radio.setCornerCutWarnThreshold(parseInt(e.target.value, 10))}
              className="radio-slider-input"
            />
          </div>
        </SubsystemAccordion>
      </div>
    </div>
  );
};
