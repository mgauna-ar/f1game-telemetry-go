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
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_SPANISH_VOICES,
  RADIO_ENGLISH_VOICES,
  RADIO_ALERT_CONSTANTS,
  type RadioLanguage,
} from '../constants/f1';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
}

type SettingsTab = 'persona' | 'audio' | 'triggers' | 'tactical';

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({
  isOpen,
  onClose,
  radio,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('persona');

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
            className={`radio-tab-btn ${activeTab === 'triggers' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('triggers')}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.triggers')}
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
                onClick={() => radio.setPersona(RADIO_PERSONAS.COLAPINTO)}
                className={`radio-persona-card ${
                  radio.persona === RADIO_PERSONAS.COLAPINTO ? 'card-active' : ''
                }`}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    🇦🇷 {t('ai_engineer.personas.colapinto.name')}
                  </span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.colapinto.desc')}
                </p>
              </button>

              {/* Bono */}
              <button
                type="button"
                onClick={() => radio.setPersona(RADIO_PERSONAS.BONO)}
                className={`radio-persona-card ${
                  radio.persona === RADIO_PERSONAS.BONO ? 'card-active' : ''
                }`}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    🇬🇧 {t('ai_engineer.personas.bono.name')}
                  </span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.bono.desc')}
                </p>
              </button>

              {/* Custom */}
              <button
                type="button"
                onClick={() => radio.setPersona(RADIO_PERSONAS.CUSTOM)}
                className={`radio-persona-card ${
                  radio.persona === RADIO_PERSONAS.CUSTOM ? 'card-active' : ''
                }`}
              >
                <div className="radio-persona-header">
                  <span className="radio-persona-name">
                    ⚙️ {t('ai_engineer.personas.custom.name')}
                  </span>
                </div>
                <p className="radio-persona-desc">
                  {t('ai_engineer.personas.custom.desc')}
                </p>
              </button>
            </div>

            {/* Custom Persona Prompt Textarea */}
            {radio.persona === RADIO_PERSONAS.CUSTOM && (
              <div className="radio-section" style={{ marginTop: '4px' }}>
                <textarea
                  value={radio.customPrompt}
                  onChange={(e) => radio.setCustomPrompt(e.target.value)}
                  placeholder={t('ai_engineer.personas.custom.placeholder')}
                  rows={3}
                  className="radio-custom-textarea"
                />
              </div>
            )}

            {/* Driver Call-sign */}
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
                className="radio-input-field"
                maxLength={30}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {t('ai_engineer.driverCallsign.desc')}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Voice, Audio Realism & PTT */}
        {activeTab === 'audio' && (
          <div className="radio-section">
            <label className="radio-section-label">
              <Languages className="w-3.5 h-3.5" />
              {t('ai_engineer.radioLanguage.title')} & {t('ai_engineer.neuralVoice.title')}
            </label>

            <div className="radio-ptt-grid">
              {/* Radio Language Selector */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Languages className="w-4 h-4" style={{ color: '#00f2fe' }} />
                    {t('ai_engineer.radioLanguage.title')}
                  </span>
                  <span className="live-radio-key-badge">
                    {radio.effectiveLanguage === 'es' ? '🇦🇷 ES' : '🇬🇧 EN'}
                  </span>
                </div>

                <select
                  value={radio.radioLanguage}
                  onChange={(e) => radio.setRadioLanguage(e.target.value as RadioLanguage)}
                  className="radio-select-key"
                >
                  <option value={RADIO_LANGUAGES.AUTO}>{t('ai_engineer.radioLanguage.auto')}</option>
                  <option value={RADIO_LANGUAGES.ES}>{t('ai_engineer.radioLanguage.es')}</option>
                  <option value={RADIO_LANGUAGES.EN}>{t('ai_engineer.radioLanguage.en')}</option>
                </select>
              </div>

              {/* Neural Voice Selector */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Volume2 className="w-4 h-4" style={{ color: '#00f2fe' }} />
                    {t('ai_engineer.neuralVoice.title')}
                  </span>
                </div>

                <select
                  value={radio.neuralVoice}
                  onChange={(e) => radio.setNeuralVoice(e.target.value)}
                  className="radio-select-key"
                >
                  <option value="">
                    {t('ai_engineer.neuralVoice.auto')} ({radio.effectiveLanguage === 'es' ? '🇦🇷 Tomás' : '🇬🇧 Ryan'})
                  </option>
                  {radio.effectiveLanguage === 'es'
                    ? RADIO_SPANISH_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {t(`ai_engineer.neuralVoice.${v.translationKey}`)}
                        </option>
                      ))
                    : RADIO_ENGLISH_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {t(`ai_engineer.neuralVoice.${v.translationKey}`)}
                        </option>
                      ))}
                </select>
              </div>
            </div>

            {/* Speech Rate & Pitch Sliders */}
            <div className="radio-ptt-grid" style={{ marginTop: '6px' }}>
              {/* Speech Rate */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span>{t('ai_engineer.audio.speechRate')}</span>
                  <span className="radio-badge-val">
                    {radio.speechRate > 0 ? `+${radio.speechRate}%` : `${radio.speechRate}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-20}
                  max={30}
                  step={5}
                  value={radio.speechRate}
                  onChange={(e) => radio.setSpeechRate(parseInt(e.target.value, 10))}
                  className="radio-slider-input"
                />
              </div>

              {/* Vocal Pitch */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span>{t('ai_engineer.audio.speechPitch')}</span>
                  <span className="radio-badge-val">
                    {radio.speechPitch > 0 ? `+${radio.speechPitch}Hz` : `${radio.speechPitch}Hz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-20}
                  max={20}
                  step={2}
                  value={radio.speechPitch}
                  onChange={(e) => radio.setSpeechPitch(parseInt(e.target.value, 10))}
                  className="radio-slider-input"
                />
              </div>
            </div>

            {/* Radio Sound Effects */}
            <div className="radio-ptt-grid" style={{ marginTop: '6px' }}>
              <label className="radio-toggle-row">
                <span>{t('ai_engineer.audio.staticNoise')}</span>
                <input
                  type="checkbox"
                  checked={radio.staticFxEnabled}
                  onChange={(e) => radio.setStaticFxEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              <label className="radio-toggle-row">
                <span>{t('ai_engineer.audio.beeps')}</span>
                <input
                  type="checkbox"
                  checked={radio.beepsEnabled}
                  onChange={(e) => radio.setBeepsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>
            </div>

            <label className="radio-toggle-row" style={{ marginTop: '6px' }}>
              <span>{t('ai_engineer.audio.cockpitFilter')}</span>
              <input
                type="checkbox"
                checked={radio.filterEnabled}
                onChange={(e) => radio.setFilterEnabled(e.target.checked)}
                className="radio-checkbox"
              />
            </label>

            {/* Volume Slider */}
            <div className="radio-slider-box" style={{ marginTop: '6px' }}>
              {radio.volume > 0 ? (
                <Volume2 className="w-4 h-4" style={{ color: '#00f2fe', flexShrink: 0 }} />
              ) : (
                <VolumeX className="w-4 h-4" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>{t('ai_engineer.audio.volume')}</span>
                  <span className="radio-badge-val">
                    {Math.round(radio.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={radio.volume}
                  onChange={(e) => radio.setVolume(parseFloat(e.target.value))}
                  className="radio-slider-input"
                />
              </div>
            </div>

            {/* PTT Controls */}
            <label className="radio-section-label" style={{ marginTop: '12px' }}>
              <Gamepad2 className="w-3.5 h-3.5" />
              {t('ai_engineer.ptt.title')}
            </label>

            <div className="radio-ptt-grid">
              {/* Gamepad / Wheel Mapping */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gamepad2 className="w-4 h-4" style={{ color: '#00f2fe' }} />
                    {radio.gamepadConnected ? t('ai_engineer.ptt.gamepadConnected') : t('ai_engineer.ptt.noGamepad')}
                  </span>
                </div>

                <div className="radio-ptt-row">
                  {radio.isLearning ? (
                    <button
                      type="button"
                      onClick={radio.cancelLearning}
                      className="radio-btn-map btn-learning"
                    >
                      {t('ai_engineer.ptt.learning')} ({t('ai_engineer.ptt.cancelLearning')})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={radio.startLearning}
                      className="radio-btn-map"
                    >
                      {radio.mappedGamepadButton
                        ? t('ai_engineer.ptt.mappedButton', {
                            btn: String(radio.mappedGamepadButton.buttonIndex),
                            gp: String(radio.mappedGamepadButton.gamepadIndex),
                          })
                        : t('ai_engineer.ptt.mapWheelButton')}
                    </button>
                  )}

                  {radio.mappedGamepadButton && (
                    <button
                      type="button"
                      onClick={() => radio.setMappedGamepadButton(null)}
                      className="radio-btn-clear"
                      title={t('ai_engineer.ptt.clearMapping')}
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
                  <span className="live-radio-key-badge">
                    {radio.mappedKey}
                  </span>
                </div>

                <select
                  value={radio.mappedKey}
                  onChange={(e) => radio.setMappedKey(e.target.value)}
                  className="radio-select-key"
                >
                  <option value="Space">Space (Barra Espaciadora)</option>
                  <option value="KeyT">T Key</option>
                  <option value="KeyR">R Key</option>
                  <option value="KeyV">V Key</option>
                  <option value="CapsLock">Caps Lock</option>
                  <option value="F12">F12</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Proactive Triggers & Discretion */}
        {activeTab === 'triggers' && (
          <div className="radio-section">
            <label className="radio-section-label">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t('ai_engineer.triggers.title')}
            </label>

            {/* Smart Driving Discretion Toggle */}
            <label className="radio-toggle-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 700 }}>{t('ai_engineer.triggers.smartDiscretion')}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
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

            {/* Engineer Chatter Cooldown Presets */}
            <div className="radio-ptt-box" style={{ marginTop: '8px' }}>
              <div className="radio-ptt-box-header">
                <span>{t('ai_engineer.triggers.chatterFrequency')}</span>
                <span className="radio-badge-val">{radio.chatterCooldownSeconds}s</span>
              </div>

              <div className="radio-preset-grid">
                <button
                  type="button"
                  onClick={() => radio.setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.TALKATIVE)}
                  className={`radio-preset-chip ${radio.chatterCooldownSeconds === 20 ? 'chip-active' : ''}`}
                >
                  {t('ai_engineer.triggers.talkative')} (20s)
                </button>
                <button
                  type="button"
                  onClick={() => radio.setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL)}
                  className={`radio-preset-chip ${radio.chatterCooldownSeconds === 45 ? 'chip-active' : ''}`}
                >
                  {t('ai_engineer.triggers.normal')} (45s)
                </button>
                <button
                  type="button"
                  onClick={() => radio.setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.MINIMAL)}
                  className={`radio-preset-chip ${radio.chatterCooldownSeconds === 90 ? 'chip-active' : ''}`}
                >
                  {t('ai_engineer.triggers.minimal')} (90s)
                </button>
              </div>

              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={radio.chatterCooldownSeconds}
                onChange={(e) => radio.setChatterCooldownSeconds(parseInt(e.target.value, 10))}
                className="radio-slider-input"
                style={{ marginTop: '4px' }}
              />
            </div>

            {/* Granular Thresholds */}
            <div className="radio-ptt-grid" style={{ marginTop: '6px' }}>
              {/* Tyre Wear Warning % */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span>{t('ai_engineer.triggers.wearWarningPct')}</span>
                  <span className="radio-badge-val">{radio.tyreWearWarningPct}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={60}
                  step={5}
                  value={radio.tyreWearWarningPct}
                  onChange={(e) => radio.setTyreWearWarningPct(parseInt(e.target.value, 10))}
                  className="radio-slider-input"
                />
              </div>

              {/* Tyre Wear Critical % */}
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

            <div className="radio-ptt-grid" style={{ marginTop: '6px' }}>
              {/* Rival Gap Buffer (seconds) */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span>{t('ai_engineer.triggers.rivalGapThreshold')}</span>
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

              {/* Rain Horizon (minutes) */}
              <div className="radio-ptt-box">
                <div className="radio-ptt-box-header">
                  <span>{t('ai_engineer.triggers.rainHorizon')}</span>
                  <span className="radio-badge-val">{radio.rainHorizonMin} min</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={1}
                  value={radio.rainHorizonMin}
                  onChange={(e) => radio.setRainHorizonMin(parseInt(e.target.value, 10))}
                  className="radio-slider-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Tactical Coaching Categories */}
        {activeTab === 'tactical' && (
          <div className="radio-section">
            <label className="radio-section-label">
              <BellRing className="w-3.5 h-3.5" />
              {t('ai_engineer.proactiveAlerts.title')}
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Tyre Wear */}
              <label className="radio-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <span>{t('ai_engineer.proactiveAlerts.tyreWear')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={radio.tyreAlertsEnabled}
                  onChange={(e) => radio.setTyreAlertsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              {/* Tyre Thermal Window & Overheating */}
              <label className="radio-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame className="w-4 h-4 text-amber-400" />
                  <div>
                    <span>{t('ai_engineer.proactiveAlerts.tyreThermal')}</span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {t('ai_engineer.proactiveAlerts.tyreThermalDesc')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={radio.thermalAlertsEnabled}
                  onChange={(e) => radio.setThermalAlertsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              {/* Rival Battles & DRS */}
              <label className="radio-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>{t('ai_engineer.proactiveAlerts.rivalGaps')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={radio.rivalAlertsEnabled}
                  onChange={(e) => radio.setRivalAlertsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              {/* Pit Stop Window & Undercut */}
              <label className="radio-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <div>
                    <span>{t('ai_engineer.proactiveAlerts.pitWindow')}</span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {t('ai_engineer.proactiveAlerts.pitWindowDesc')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={radio.pitWindowAlertsEnabled}
                  onChange={(e) => radio.setPitWindowAlertsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>

              {/* Track Conditions & SC */}
              <label className="radio-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio className="w-4 h-4 text-rose-400" />
                  <span>{t('ai_engineer.proactiveAlerts.trackConditions')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={radio.trackAlertsEnabled}
                  onChange={(e) => radio.setTrackAlertsEnabled(e.target.checked)}
                  className="radio-checkbox"
                />
              </label>
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
