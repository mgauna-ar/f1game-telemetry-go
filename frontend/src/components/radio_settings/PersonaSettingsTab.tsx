import React, { useId } from 'react';
import { Sparkles, User } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RADIO_PERSONAS } from '../../constants/f1';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { TextArea, TextInput } from '../ui/Field';
import { SettingSection } from './SettingControls';
import shared from './RadioSettings.module.css';
import styles from './PersonaSettingsTab.module.css';

export interface PersonaSettingsTabProps {
  radio?: {
    persona?: string;
    setPersona?: (persona: string) => void;
    customPrompt?: string;
    setCustomPrompt?: (prompt: string) => void;
    driverCallsign?: string;
    setDriverCallsign?: (callsign: string) => void;
  };
}

const PERSONAS = [
  { id: RADIO_PERSONAS.BONO, key: 'bono', flag: '🇬🇧' },
  { id: RADIO_PERSONAS.COLAPINTO, key: 'colapinto', flag: '🇦🇷' },
  { id: RADIO_PERSONAS.CUSTOM, key: 'custom', flag: '🛠️' },
] as const;

export const PersonaSettingsTab: React.FC<PersonaSettingsTabProps> = () => {
  const { t } = useI18n();
  const persona = useRadioSettingsStore((s) => s.persona);
  const setPersona = useRadioSettingsStore((s) => s.setPersona);
  const customPrompt = useRadioSettingsStore((s) => s.customPrompt);
  const setCustomPrompt = useRadioSettingsStore((s) => s.setCustomPrompt);
  const driverCallsign = useRadioSettingsStore((s) => s.driverCallsign);
  const setDriverCallsign = useRadioSettingsStore((s) => s.setDriverCallsign);
  const promptId = useId();
  const callsignId = useId();
  const callsignDescId = useId();

  return (
    <div className={shared.tab}>
      <SettingSection icon={<Sparkles size={14} />} title={t('ai_engineer.personas.title')}>
        <div className={shared.grid3}>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`button-reset ${styles.card}`}
              aria-pressed={persona === p.id}
              onClick={() => setPersona(p.id)}
            >
              <span className={styles.cardHeader}>
                <span className={styles.name}>{t(`ai_engineer.personas.${p.key}.name`)}</span>
                <span aria-hidden="true">{p.flag}</span>
              </span>
              <span className={styles.description}>{t(`ai_engineer.personas.${p.key}.desc`)}</span>
            </button>
          ))}
        </div>

        {/* The custom persona's instructions */}
        {persona === RADIO_PERSONAS.CUSTOM && (
          <div className={shared.stack}>
            <label htmlFor={promptId} className={shared.fieldLabel}>
              {t('ai_engineer.personas.custom.name')}
            </label>
            <TextArea
              id={promptId}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t('ai_engineer.personas.custom.placeholder')}
              rows={3}
            />
          </div>
        )}
      </SettingSection>

      <SettingSection icon={<User size={14} />} title={t('ai_engineer.driverCallsign.title')}>
        <label htmlFor={callsignId} className="sr-only">
          {t('ai_engineer.driverCallsign.title')}
        </label>
        <TextInput
          id={callsignId}
          mono
          value={driverCallsign}
          onChange={(e) => setDriverCallsign(e.target.value)}
          placeholder={t('ai_engineer.driverCallsign.placeholder')}
          maxLength={32}
          aria-describedby={callsignDescId}
        />
        <p id={callsignDescId} className={shared.hint}>
          {t('ai_engineer.driverCallsign.desc')}
        </p>
      </SettingSection>
    </div>
  );
};
