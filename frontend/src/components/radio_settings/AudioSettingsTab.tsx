import React from 'react';
import {
  Languages,
  Sliders,
  Volume2,
  VolumeX,
  Gamepad2,
  Keyboard,
  X,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  RADIO_LANGUAGES,
  RADIO_SPANISH_VOICES,
  RADIO_ENGLISH_VOICES,
  RADIO_PTT_MODES,
  type RadioLanguage,
} from '../../constants/f1';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

interface AudioSettingsTabProps {
  radio: UseRadioControllerReturn;
}

export const AudioSettingsTab: React.FC<AudioSettingsTabProps> = ({ radio }) => {
  const { t } = useI18n();

  // Settings from Zustand store with fine-grained selectors
  const radioLanguage = useRadioSettingsStore((s) => s.radioLanguage);
  const setRadioLanguage = useRadioSettingsStore((s) => s.setRadioLanguage);
  const neuralVoice = useRadioSettingsStore((s) => s.neuralVoice);
  const setNeuralVoice = useRadioSettingsStore((s) => s.setNeuralVoice);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);
  const setBeepsEnabled = useRadioSettingsStore((s) => s.setBeepsEnabled);
  const filterEnabled = useRadioSettingsStore((s) => s.filterEnabled);
  const setFilterEnabled = useRadioSettingsStore((s) => s.setFilterEnabled);
  const staticFxEnabled = useRadioSettingsStore((s) => s.staticFxEnabled);
  const setStaticFxEnabled = useRadioSettingsStore((s) => s.setStaticFxEnabled);
  const volume = useRadioSettingsStore((s) => s.volume);
  const setVolume = useRadioSettingsStore((s) => s.setVolume);
  const speechRate = useRadioSettingsStore((s) => s.speechRate);
  const setSpeechRate = useRadioSettingsStore((s) => s.setSpeechRate);
  const speechPitch = useRadioSettingsStore((s) => s.speechPitch);
  const setSpeechPitch = useRadioSettingsStore((s) => s.setSpeechPitch);

  return (
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
            value={radioLanguage}
            onChange={(e) => setRadioLanguage(e.target.value as RadioLanguage)}
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
            value={neuralVoice}
            onChange={(e) => setNeuralVoice(e.target.value)}
            className="radio-select-input"
          >
            <option value="">{t('ai_engineer.neuralVoice.auto')}</option>
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
            checked={beepsEnabled}
            onChange={(e) => setBeepsEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>

        <label className="radio-toggle-row">
          <span>{t('ai_engineer.audio.cockpitFilter')}</span>
          <input
            type="checkbox"
            checked={filterEnabled}
            onChange={(e) => setFilterEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>

        <label className="radio-toggle-row">
          <span>{t('ai_engineer.audio.staticNoise')}</span>
          <input
            type="checkbox"
            checked={staticFxEnabled}
            onChange={(e) => setStaticFxEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      {/* Volume & Audio Settings */}
      <div className="radio-slider-box" style={{ marginTop: '6px' }}>
        {volume > 0 ? (
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
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="radio-slider-input"
        />
        <span className="radio-badge-val" style={{ minWidth: '35px', textAlign: 'right' }}>
          {Math.round(volume * 100)}%
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
          value={speechRate}
          onChange={(e) => setSpeechRate(parseInt(e.target.value, 10))}
          className="radio-slider-input"
        />
        <span className="radio-badge-val" style={{ minWidth: '45px', textAlign: 'right' }}>
          {speechRate > 0 ? `+${speechRate}%` : `${speechRate}%`}
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
          value={speechPitch}
          onChange={(e) => setSpeechPitch(parseInt(e.target.value, 10))}
          className="radio-slider-input"
        />
        <span className="radio-badge-val" style={{ minWidth: '45px', textAlign: 'right' }}>
          {speechPitch > 0 ? `+${speechPitch}Hz` : `${speechPitch}Hz`}
        </span>
      </div>

      {/* Push-to-Talk Controls */}
      <label className="radio-section-label" style={{ marginTop: '12px' }}>
        <Gamepad2 className="w-3.5 h-3.5" />
        {t('ai_engineer.ptt.title')}
      </label>

      {/* PTT Activation Mode (Hold vs Toggle) */}
      <div className="radio-select-box" style={{ marginTop: '6px', marginBottom: '8px' }}>
        <label className="radio-select-label">
          {t('ai_engineer.ptt.mode')}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => radio.setPTTMode(RADIO_PTT_MODES.HOLD)}
            className={`radio-tab-btn ${radio.pttMode === RADIO_PTT_MODES.HOLD ? 'tab-active' : ''}`}
            style={{ justifyContent: 'center', padding: '7px 8px', fontSize: '0.78rem' }}
          >
            🔘 {t('ai_engineer.ptt.modeHold')}
          </button>
          <button
            type="button"
            onClick={() => radio.setPTTMode(RADIO_PTT_MODES.TOGGLE)}
            className={`radio-tab-btn ${radio.pttMode === RADIO_PTT_MODES.TOGGLE ? 'tab-active' : ''}`}
            style={{ justifyContent: 'center', padding: '7px 8px', fontSize: '0.78rem' }}
          >
            🔀 {t('ai_engineer.ptt.modeToggle')}
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 2px' }}>
          {radio.pttMode === RADIO_PTT_MODES.HOLD
            ? t('ai_engineer.ptt.modeHoldDesc')
            : t('ai_engineer.ptt.modeToggleDesc')}
        </p>
      </div>

      {/* Global OS Background Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: radio.globalActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.08)',
          border: `1px solid ${radio.globalActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.15)'}`,
          marginBottom: '10px',
          fontSize: '0.74rem',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: radio.globalActive ? '#10b981' : '#94a3b8',
            }}
          />
          <strong style={{ color: radio.globalActive ? '#34d399' : '#94a3b8' }}>
            {t('ai_engineer.ptt.globalSupport')}:
          </strong>
          <span style={{ color: 'var(--text-secondary)' }}>
            {radio.globalActive ? t('ai_engineer.ptt.globalActive') : t('ai_engineer.ptt.globalInactive')}
          </span>
        </span>
        {radio.globalMapping && (radio.globalMapping.device_name || radio.globalMapping.key_name) && (
          <span className="live-radio-key-badge" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
            {radio.globalMapping.device_name || 'Device'}: {radio.globalMapping.key_name || (radio.globalMapping.button_index !== undefined ? `B${radio.globalMapping.button_index + 1}` : '')}
          </span>
        )}
      </div>

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
            <span className="live-radio-key-badge">
              {radio.mappedKey === 'None' ? t('ai_engineer.ptt.unassigned') : radio.mappedKey}
            </span>
          </div>
          <select
            value={radio.mappedKey}
            onChange={(e) => radio.setMappedKey(e.target.value)}
            className="radio-select-key"
          >
            <option value="None">🚫 {t('ai_engineer.ptt.noKey')}</option>
            <option value="Space">Space</option>
            <option value="KeyT">T Key</option>
            <option value="KeyR">R Key</option>
            <option value="KeyV">V Key</option>
            <option value="CapsLock">Caps Lock</option>
          </select>
        </div>
      </div>
    </div>
  );
};

