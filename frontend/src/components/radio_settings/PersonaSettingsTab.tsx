import React from 'react';
import { Sparkles, User } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RADIO_PERSONAS } from '../../constants/f1';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

interface PersonaSettingsTabProps {
  radio: UseRadioControllerReturn;
}

export const PersonaSettingsTab: React.FC<PersonaSettingsTabProps> = ({ radio }) => {
  const { t } = useI18n();

  return (
    <div className="radio-section">
      <label className="radio-section-label">
        <Sparkles className="w-3.5 h-3.5" />
        {t('ai_engineer.personas.title')}
      </label>

      <div className="radio-persona-grid">
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
  );
};
