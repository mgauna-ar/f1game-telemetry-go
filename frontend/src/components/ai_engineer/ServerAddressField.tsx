import React, { useEffect, useId, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { AI_SERVER_PRESETS } from '../../constants/f1';
import { findServerPreset } from '../../utils/aiServers';
import { TextInput } from '../ui/Field';
import styles from './AiSettings.module.css';

export interface ServerAddressFieldProps {
  baseUrl: string;
  onChange: (baseUrl: string) => void;
}

/** The address of an OpenAI-compatible server, with one-click presets for the common ones. */
export const ServerAddressField: React.FC<ServerAddressFieldProps> = ({ baseUrl, onChange }) => {
  const { t } = useI18n();
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(baseUrl);

  useEffect(() => {
    setDraft(baseUrl);
  }, [baseUrl]);

  const commit = (value: string) => {
    const next = value.trim();
    if (next !== baseUrl) onChange(next);
  };

  const activePreset = findServerPreset(draft);

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={inputId}>
          {t('ai_engineer.setup.serverAddress')}
        </label>
      </div>

      <div className={styles.presets}>
        {AI_SERVER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.preset}
            aria-pressed={activePreset?.id === preset.id}
            onClick={() => {
              setDraft(preset.baseUrl);
              commit(preset.baseUrl);
            }}
          >
            {preset.name}
            <span className={styles.presetKind}>
              {preset.local ? t('ai_engineer.setup.local') : t('ai_engineer.setup.cloud')}
            </span>
          </button>
        ))}
      </div>

      <TextInput
        id={inputId}
        mono
        spellCheck={false}
        placeholder="http://localhost:11434/v1"
        aria-describedby={hintId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
        }}
      />
      <div id={hintId} className={styles.hint}>
        {t('ai_engineer.setup.serverHint')}
      </div>
    </div>
  );
};
