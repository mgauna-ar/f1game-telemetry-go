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
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_SPANISH_VOICES,
  RADIO_ENGLISH_VOICES,
  RADIO_STORAGE_KEYS,
  type RadioLanguage,
} from '../constants/f1';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
}

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({
  isOpen,
  onClose,
  radio,
}) => {
  const { t } = useI18n();

  // Local state for proactive alert toggles
  const [tyreAlerts, setTyreAlerts] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TYRE);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [rivalAlerts, setRivalAlerts] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [trackAlerts, setTrackAlerts] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TRACK);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleTyreAlerts = (checked: boolean) => {
    setTyreAlerts(checked);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_TYRE, String(checked));
    } catch {}
  };

  const handleToggleRivalAlerts = (checked: boolean) => {
    setRivalAlerts(checked);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL, String(checked));
    } catch {}
  };

  const handleToggleTrackAlerts = (checked: boolean) => {
    setTrackAlerts(checked);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_TRACK, String(checked));
    } catch {}
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
                {t('ai_engineer.personas.title')} & Push-to-Talk
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

        {/* 1. Persona Selection (Style / Attitude) */}
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
            <div className="radio-section" style={{ marginTop: '6px' }}>
              <textarea
                value={radio.customPrompt}
                onChange={(e) => radio.setCustomPrompt(e.target.value)}
                placeholder={t('ai_engineer.personas.custom.placeholder')}
                rows={3}
                className="radio-custom-textarea"
              />
            </div>
          )}
        </div>

        {/* 2. Radio Language & Voice Selection */}
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
        </div>

        {/* 3. PTT Controls */}
        <div className="radio-section">
          <label className="radio-section-label">
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

        {/* 4. Audio Effects & Cockpit */}
        <div className="radio-section">
          <label className="radio-section-label">
            <Sliders className="w-3.5 h-3.5" />
            {t('ai_engineer.audio.title')}
          </label>

          <div className="radio-ptt-grid">
            {/* Beeps Toggle */}
            <label className="radio-toggle-row">
              <span>{t('ai_engineer.audio.beeps')}</span>
              <input
                type="checkbox"
                checked={radio.beepsEnabled}
                onChange={(e) => radio.setBeepsEnabled(e.target.checked)}
                className="radio-checkbox"
              />
            </label>

            {/* Cockpit Filter Toggle */}
            <label className="radio-toggle-row">
              <span>{t('ai_engineer.audio.cockpitFilter')}</span>
              <input
                type="checkbox"
                checked={radio.filterEnabled}
                onChange={(e) => radio.setFilterEnabled(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>

          {/* Volume Slider */}
          <div className="radio-slider-box" style={{ marginTop: '8px' }}>
            {radio.volume > 0 ? (
              <Volume2 className="w-4 h-4" style={{ color: '#00f2fe', flexShrink: 0 }} />
            ) : (
              <VolumeX className="w-4 h-4" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span>{t('ai_engineer.audio.volume')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#00f2fe', fontWeight: 700 }}>
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
        </div>

        {/* 5. Proactive Pit Wall Alerts */}
        <div className="radio-section">
          <label className="radio-section-label">
            <BellRing className="w-3.5 h-3.5" />
            {t('ai_engineer.proactiveAlerts.title')}
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="radio-toggle-row">
              <span>{t('ai_engineer.proactiveAlerts.tyreWear')}</span>
              <input
                type="checkbox"
                checked={tyreAlerts}
                onChange={(e) => handleToggleTyreAlerts(e.target.checked)}
                className="radio-checkbox"
              />
            </label>

            <label className="radio-toggle-row">
              <span>{t('ai_engineer.proactiveAlerts.rivalGaps')}</span>
              <input
                type="checkbox"
                checked={rivalAlerts}
                onChange={(e) => handleToggleRivalAlerts(e.target.checked)}
                className="radio-checkbox"
              />
            </label>

            <label className="radio-toggle-row">
              <span>{t('ai_engineer.proactiveAlerts.trackConditions')}</span>
              <input
                type="checkbox"
                checked={trackAlerts}
                onChange={(e) => handleToggleTrackAlerts(e.target.checked)}
                className="radio-checkbox"
              />
            </label>
          </div>
        </div>

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
