import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Radio,
  Gamepad2,
  Keyboard,
  Sparkles,
  Sliders,
  BellRing,
  Play,
  Languages,
  Power,
  Check,
  User,
  ShieldAlert,
  Flame,
  Activity,
  Gauge,
  Zap,
  Fuel,
  Timer,
  Flag,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Volume1,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_SPANISH_VOICES,
  RADIO_ENGLISH_VOICES,
  RADIO_TRIGGER_PRESETS,
  type RadioLanguage,
} from '../constants/f1';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
}

type SettingsTab = 'persona' | 'audio' | 'tactical';

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({
  isOpen,
  onClose,
  radio,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('persona');
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

  if (!isOpen) return null;

  return (
    <div className="radio-modal-backdrop" onClick={onClose}>
      <div
        className="radio-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="radio-modal-header">
          <div className="radio-modal-header-left">
            <div className="radio-modal-header-icon">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="radio-modal-title">
                {t('ai_engineer.radio.settings')}
              </h2>
              <p className="radio-modal-subtitle">
                {t('ai_engineer.personas.title')} & Pit Wall Strategist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="radio-modal-close-btn"
            title={t('ai_engineer.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Enable/Disable Card */}
        <div className="radio-master-toggle-card">
          <div className="radio-master-toggle-info">
            <div className="radio-master-toggle-title-row">
              <Power className={`w-4 h-4 ${radio.isRadioEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="radio-master-toggle-title">
                {t('ai_engineer.radio.masterToggle')}
              </span>
              <span className={`radio-master-status-badge ${radio.isRadioEnabled ? 'status-active' : 'status-off'}`}>
                {radio.isRadioEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="radio-master-toggle-desc">
              {t('ai_engineer.radio.masterToggleDesc')}
            </p>
          </div>
          <label className="radio-switch">
            <input
              type="checkbox"
              checked={radio.isRadioEnabled}
              onChange={(e) => radio.setIsRadioEnabled(e.target.checked)}
            />
            <span className="radio-switch-slider" />
          </label>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="radio-tabs-nav">
          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'persona' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('persona')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.persona')}
          </button>

          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'audio' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            <Sliders className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.audio')}
          </button>

          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'tactical' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('tactical')}
          >
            <BellRing className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.tactical')}
          </button>
        </div>

        {/* TAB 1: Persona & Driver Call-sign */}
        {activeTab === 'persona' && (
          <div className="radio-section">
            <label className="radio-section-label">
              <Sparkles className="w-3.5 h-3.5" />
              {t('ai_engineer.personas.title')}
            </label>

            <div className="radio-persona-grid">
              {/* Colapinto */}
              <button
                type="button"
                className={`radio-persona-card ${radio.persona === RADIO_PERSONAS.COLAPINTO ? 'card-active' : ''}`}
                onClick={() => radio.setPersona(RADIO_PERSONAS.COLAPINTO)}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    {t('ai_engineer.personas.colapinto.name')}
                  </span>
                  <span>🇦🇷</span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.colapinto.desc')}
                </p>
              </button>

              {/* Bono */}
              <button
                type="button"
                className={`radio-persona-card ${radio.persona === RADIO_PERSONAS.BONO ? 'card-active' : ''}`}
                onClick={() => radio.setPersona(RADIO_PERSONAS.BONO)}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    {t('ai_engineer.personas.bono.name')}
                  </span>
                  <span>🇬🇧</span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.bono.desc')}
                </p>
              </button>

              {/* Custom */}
              <button
                type="button"
                className={`radio-persona-card ${radio.persona === RADIO_PERSONAS.CUSTOM ? 'card-active' : ''}`}
                onClick={() => radio.setPersona(RADIO_PERSONAS.CUSTOM)}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    {t('ai_engineer.personas.custom.name')}
                  </span>
                  <span>🛠️</span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.custom.desc')}
                </p>
              </button>
            </div>

            {/* Custom Prompt Textarea (Conditional) */}
            {radio.persona === RADIO_PERSONAS.CUSTOM && (
              <div className="radio-section" style={{ marginTop: '4px' }}>
                <label className="radio-section-label">
                  {t('ai_engineer.personas.custom.name')}
                </label>
                <textarea
                  value={radio.customPrompt}
                  onChange={(e) => radio.setCustomPrompt(e.target.value)}
                  placeholder={t('ai_engineer.personas.custom.placeholder')}
                  rows={3}
                  className="radio-custom-textarea"
                />
              </div>
            )}

            {/* Driver Call-sign / Nickname */}
            <div className="radio-section" style={{ marginTop: '10px' }}>
              <label className="radio-section-label">
                <User className="w-3.5 h-3.5" />
                {t('ai_engineer.driverCallsign.title')}
              </label>
              <input
                type="text"
                value={radio.driverCallsign}
                onChange={(e) => radio.setDriverCallsign(e.target.value)}
                placeholder={t('ai_engineer.driverCallsign.placeholder')}
                maxLength={32}
                className="radio-input-field"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 2px' }}>
                {t('ai_engineer.driverCallsign.desc')}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Voice, Audio Realism & PTT Controls */}
        {activeTab === 'audio' && (
          <div className="radio-section">
            <label className="radio-section-label">
              <Languages className="w-3.5 h-3.5" />
              {t('ai_engineer.radioLanguage.title')} & {t('ai_engineer.neuralVoice.title')}
            </label>

            <div className="radio-voice-grid">
              <div className="radio-select-box">
                <label className="radio-select-label">
                  {t('ai_engineer.radioLanguage.title')}
                </label>
                <select
                  value={radio.radioLanguage}
                  onChange={(e) => radio.setRadioLanguage(e.target.value as RadioLanguage)}
                  className="radio-select-input"
                >
                  <option value={RADIO_LANGUAGES.AUTO}>{t('ai_engineer.radioLanguage.auto')}</option>
                  <option value={RADIO_LANGUAGES.ES}>{t('ai_engineer.radioLanguage.es')}</option>
                  <option value={RADIO_LANGUAGES.EN}>{t('ai_engineer.radioLanguage.en')}</option>
                </select>
              </div>

              <div className="radio-select-box">
                <label className="radio-select-label">
                  {t('ai_engineer.neuralVoice.title')}
                </label>
                <select
                  value={radio.neuralVoice}
                  onChange={(e) => radio.setNeuralVoice(e.target.value)}
                  className="radio-select-input"
                >
                  <option value="">{t('ai_engineer.neuralVoice.auto')}</option>
                  {radio.effectiveLanguage === 'es'
                    ? RADIO_SPANISH_VOICES.map((v) => <option key={v.id} value={v.id}>{t(`ai_engineer.neuralVoice.${v.translationKey}`)}</option>)
                    : RADIO_ENGLISH_VOICES.map((v) => <option key={v.id} value={v.id}>{t(`ai_engineer.neuralVoice.${v.translationKey}`)}</option>)}
                </select>
              </div>
            </div>

            {/* Audio Effects Toggles */}
            <label className="radio-section-label" style={{ marginTop: '12px' }}>
              <Sliders className="w-3.5 h-3.5" />
              {t('ai_engineer.audio.title')}
            </label>

            <div className="radio-effects-grid">
              <label className="radio-toggle-row">
                <span>{t('ai_engineer.audio.beeps')}</span>
                <input
                  type="checkbox"
                  checked={radio.beepsEnabled}
                  onChange={(e) => radio.setBeepsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              <label className="radio-toggle-row">
                <span>{t('ai_engineer.audio.cockpitFilter')}</span>
                <input
                  type="checkbox"
                  checked={radio.filterEnabled}
                  onChange={(e) => radio.setFilterEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              <label className="radio-toggle-row">
                <span>{t('ai_engineer.audio.staticNoise')}</span>
                <input
                  type="checkbox"
                  checked={radio.staticFxEnabled}
                  onChange={(e) => radio.setStaticFxEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>
            </div>

            {/* Volume & Audio Settings */}
            <div className="radio-slider-box" style={{ marginTop: '6px' }}>
              {radio.volume > 0 ? (
                <Volume2 className="w-4 h-4" style={{ color: '#00f2fe', flexShrink: 0 }} />
              ) : (
                <VolumeX className="w-4 h-4" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '0.74rem', minWidth: '120px' }}>
                {t('ai_engineer.audio.volume')}:
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={radio.volume}
                onChange={(e) => radio.setVolume(parseFloat(e.target.value))}
                className="radio-slider-input"
              />
              <span className="radio-badge-val" style={{ minWidth: '35px', textAlign: 'right' }}>
                {Math.round(radio.volume * 100)}%
              </span>
            </div>

            {/* Speech Rate Slider (-20% to +30%) */}
            <div className="radio-slider-box">
              <span style={{ fontSize: '0.74rem', minWidth: '136px' }}>
                {t('ai_engineer.audio.speechRate')}:
              </span>
              <input
                type="range"
                min="-20"
                max="30"
                step="5"
                value={radio.speechRate}
                onChange={(e) => radio.setSpeechRate(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
              <span className="radio-badge-val" style={{ minWidth: '45px', textAlign: 'right' }}>
                {radio.speechRate > 0 ? `+${radio.speechRate}%` : `${radio.speechRate}%`}
              </span>
            </div>

            {/* Speech Pitch Slider (-20Hz to +20Hz) */}
            <div className="radio-slider-box">
              <span style={{ fontSize: '0.74rem', minWidth: '136px' }}>
                {t('ai_engineer.audio.speechPitch')}:
              </span>
              <input
                type="range"
                min="-20"
                max="20"
                step="2"
                value={radio.speechPitch}
                onChange={(e) => radio.setSpeechPitch(parseInt(e.target.value, 10))}
                className="radio-slider-input"
              />
              <span className="radio-badge-val" style={{ minWidth: '45px', textAlign: 'right' }}>
                {radio.speechPitch > 0 ? `+${radio.speechPitch}Hz` : `${radio.speechPitch}Hz`}
              </span>
            </div>

            {/* Push-to-Talk Controls */}
            <label className="radio-section-label" style={{ marginTop: '12px' }}>
              <Gamepad2 className="w-3.5 h-3.5" />
              {t('ai_engineer.ptt.title')}
            </label>

            <div className="radio-ptt-grid">
              {/* Gamepad Steering Wheel Mapping */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gamepad2 className="w-4 h-4" style={{ color: '#00f2fe' }} />
                    {radio.gamepadConnected ? (
                      <span className="text-emerald-400 font-semibold truncate" title={radio.gamepadName || ''}>
                        {radio.gamepadName || t('ai_engineer.ptt.gamepadConnected')}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {t('ai_engineer.ptt.gamepadNotDetected')}
                      </span>
                    )}
                  </span>
                </div>

                <div className="radio-ptt-row">
                  <button
                    type="button"
                    onClick={radio.isLearning ? radio.cancelLearning : radio.startLearning}
                    className={`radio-btn-map ${radio.isLearning ? 'btn-learning' : ''}`}
                  >
                    {radio.isLearning
                      ? t('ai_engineer.ptt.learning')
                      : radio.mappedGamepadButton
                        ? `${t('ai_engineer.ptt.btnMapped')}: B${radio.mappedGamepadButton.buttonIndex} (Pad ${radio.mappedGamepadButton.gamepadIndex})`
                        : t('ai_engineer.ptt.mapGamepadBtn')}
                  </button>

                  {radio.mappedGamepadButton && (
                    <button
                      type="button"
                      onClick={() => radio.setMappedGamepadButton(null)}
                      className="radio-btn-clear"
                      title={t('ai_engineer.ptt.clearGamepad')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Keyboard Key */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Keyboard className="w-4 h-4" style={{ color: '#00f2fe' }} />
                    {t('ai_engineer.ptt.keyboardKey')}
                  </span>
                  <span className="live-radio-key-badge">{radio.mappedKey}</span>
                </div>
                <select
                  value={radio.mappedKey}
                  onChange={(e) => radio.setMappedKey(e.target.value)}
                  className="radio-select-key"
                >
                  <option value="Space">Space</option>
                  <option value="KeyT">T Key</option>
                  <option value="KeyR">R Key</option>
                  <option value="KeyV">V Key</option>
                  <option value="CapsLock">Caps Lock</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Telemetry Triggers, Presets & Tactical Coaching */}
        {activeTab === 'tactical' && (
          <div className="radio-section">
            {/* Quick Style Presets & Calibration Banner */}
            <div className="radio-preset-banner">
              <div className="radio-preset-header-row">
                <span className="radio-preset-title">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('ai_engineer.triggers.presetsTitle')}
                </span>
                <button
                  type="button"
                  onClick={radio.resetTriggerDefaults}
                  className="radio-btn-reset"
                  title={t('ai_engineer.triggers.resetDefaults')}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('ai_engineer.triggers.resetDefaults')}</span>
                </button>
              </div>

              <div className="radio-preset-grid">
                <button
                  type="button"
                  onClick={() => radio.applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE)}
                  className={`radio-preset-chip ${radio.triggerPreset === RADIO_TRIGGER_PRESETS.IMMERSIVE ? 'chip-active' : ''}`}
                >
                  🏁 {t('ai_engineer.triggers.immersive')}
                </button>
                <button
                  type="button"
                  onClick={() => radio.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING)}
                  className={`radio-preset-chip ${radio.triggerPreset === RADIO_TRIGGER_PRESETS.COACHING ? 'chip-active' : ''}`}
                >
                  ⚡ {t('ai_engineer.triggers.coaching')}
                </button>
                <button
                  type="button"
                  onClick={() => radio.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL)}
                  className={`radio-preset-chip ${radio.triggerPreset === RADIO_TRIGGER_PRESETS.MINIMAL ? 'chip-active' : ''}`}
                >
                  🤫 {t('ai_engineer.triggers.minimalPreset')}
                </button>
                <button
                  type="button"
                  onClick={() => radio.applyTriggerPreset(RADIO_TRIGGER_PRESETS.CUSTOM)}
                  className={`radio-preset-chip ${radio.triggerPreset === RADIO_TRIGGER_PRESETS.CUSTOM ? 'chip-active' : ''}`}
                >
                  🛠️ {t('ai_engineer.triggers.customPreset')}
                </button>
              </div>

              <p className="radio-preset-desc">
                {radio.triggerPreset === RADIO_TRIGGER_PRESETS.IMMERSIVE && t('ai_engineer.triggers.immersiveDesc')}
                {radio.triggerPreset === RADIO_TRIGGER_PRESETS.COACHING && t('ai_engineer.triggers.coachingDesc')}
                {radio.triggerPreset === RADIO_TRIGGER_PRESETS.MINIMAL && t('ai_engineer.triggers.minimalDesc')}
                {radio.triggerPreset === RADIO_TRIGGER_PRESETS.CUSTOM && t('ai_engineer.triggers.customDesc')}
              </p>
            </div>

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
              <div>
                <label className="radio-section-label" style={{ margin: 0 }}>
                  <BellRing className="w-3.5 h-3.5" />
                  {t('ai_engineer.proactiveAlerts.title')}
                </label>
              </div>
            </div>

            <div className="radio-accordion-container">
              {/* TYRES Accordion Item */}
              <div className={`radio-accordion-card ${expandedCategories.tyres ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('tyres')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-cyan-400">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.tyresTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.tyresDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.tyreAlertsEnabled}
                        onChange={(e) => radio.setTyreAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('tyres')}>
                      {expandedCategories.tyres ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.tyres && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('tyres')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. DAMAGE & AERO */}
              <div className={`radio-accordion-card ${expandedCategories.damage ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('damage')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-rose-400">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.damageTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.damageDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.damageAlertsEnabled}
                        onChange={(e) => radio.setDamageAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('damage')}>
                      {expandedCategories.damage ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.damage && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('damage')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 3. ERS & POWER UNIT */}
              <div className={`radio-accordion-card ${expandedCategories.ers ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('ers')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-amber-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.ersTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.ersDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.ersAlertsEnabled}
                        onChange={(e) => radio.setErsAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('ers')}>
                      {expandedCategories.ers ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.ers && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('ers')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. BRAKES */}
              <div className={`radio-accordion-card ${expandedCategories.brakes ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('brakes')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-orange-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.brakesTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.brakesDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.brakesAlertsEnabled}
                        onChange={(e) => radio.setBrakesAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('brakes')}>
                      {expandedCategories.brakes ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.brakes && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('brakes')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. FUEL & STRATEGY */}
              <div className={`radio-accordion-card ${expandedCategories.fuel ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('fuel')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-emerald-400">
                      <Fuel className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.fuelTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.fuelDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.fuelAlertsEnabled}
                        onChange={(e) => radio.setFuelAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('fuel')}>
                      {expandedCategories.fuel ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.fuel && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('fuel')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 6. RIVALS & DRS */}
              <div className={`radio-accordion-card ${expandedCategories.rivals ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('rivals')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-purple-400">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.rivalsTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.rivalsDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.rivalAlertsEnabled}
                        onChange={(e) => radio.setRivalAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('rivals')}>
                      {expandedCategories.rivals ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.rivals && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('rivals')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 7. QUALY & PRACTICE */}
              <div className={`radio-accordion-card ${expandedCategories.qualy ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('qualy')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-sky-400">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.qualyTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.qualyDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.qualyAlertsEnabled}
                        onChange={(e) => radio.setQualyAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('qualy')}>
                      {expandedCategories.qualy ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.qualy && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('qualy')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 8. FLAGS & PENALTIES */}
              <div className={`radio-accordion-card ${expandedCategories.flags ? 'card-open' : ''}`}>
                <div className="radio-accordion-header" onClick={() => toggleCategory('flags')}>
                  <div className="radio-accordion-title-group">
                    <div className="radio-accordion-icon-box text-yellow-400">
                      <Flag className="w-4 h-4" />
                    </div>
                    <div className="radio-accordion-title-col">
                      <span className="radio-accordion-title">{t('ai_engineer.proactiveAlerts.flagsTitle')}</span>
                      <span className="radio-accordion-subtitle">{t('ai_engineer.proactiveAlerts.flagsDesc')}</span>
                    </div>
                  </div>
                  <div className="radio-accordion-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="radio-switch">
                      <input
                        type="checkbox"
                        checked={radio.flagsPensAlertsEnabled}
                        onChange={(e) => radio.setFlagsPensAlertsEnabled(e.target.checked)}
                      />
                      <span className="radio-switch-slider" />
                    </label>
                    <div onClick={() => toggleCategory('flags')}>
                      {expandedCategories.flags ? <ChevronUp className="w-4 h-4 radio-accordion-chevron" /> : <ChevronDown className="w-4 h-4 radio-accordion-chevron" />}
                    </div>
                  </div>
                </div>

                {expandedCategories.flags && (
                  <div className="radio-accordion-body">
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

                    <button
                      type="button"
                      onClick={() => radio.testTriggerAlert('flags')}
                      className="radio-test-mini-btn"
                    >
                      <Volume1 className="w-3.5 h-3.5" />
                      <span>{t('ai_engineer.proactiveAlerts.testSubsystem')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="radio-modal-footer">
          <button
            type="button"
            onClick={radio.testRadioTransmission}
            className="radio-btn-test"
            title={t('ai_engineer.radio.testRadio')}
          >
            <Play className="w-4 h-4" />
            {t('ai_engineer.radio.testRadio')}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="radio-btn-done"
          >
            <Check className="w-4 h-4" />
            <span>{t('ai_engineer.done')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
