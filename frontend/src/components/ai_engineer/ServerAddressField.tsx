import React, { useEffect, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { AI_SERVER_PRESETS } from '../../constants/f1';
import { findServerPreset } from '../../utils/aiServers';

export interface ServerAddressFieldProps {
  baseUrl: string;
  onChange: (baseUrl: string) => void;
}

/** The address of an OpenAI-compatible server, with one-click presets for the common ones. */
export const ServerAddressField: React.FC<ServerAddressFieldProps> = ({ baseUrl, onChange }) => {
  const { t } = useI18n();
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
    <div className="ai-field">
      <div className="ai-field-label-row">
        <label className="ai-field-label" htmlFor="ai-server-address">
          {t('ai_engineer.setup.serverAddress')}
        </label>
      </div>

      <div className="ai-preset-row">
        {AI_SERVER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`ai-preset-chip${activePreset?.id === preset.id ? ' is-selected' : ''}`}
            onClick={() => {
              setDraft(preset.baseUrl);
              commit(preset.baseUrl);
            }}
          >
            {preset.name}
            <span className="ai-preset-kind">
              {preset.local ? t('ai_engineer.setup.local') : t('ai_engineer.setup.cloud')}
            </span>
          </button>
        ))}
      </div>

      <input
        id="ai-server-address"
        type="text"
        className="ai-input mono"
        spellCheck={false}
        placeholder="http://localhost:11434/v1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
        }}
      />
      <div className="ai-field-hint">{t('ai_engineer.setup.serverHint')}</div>
    </div>
  );
};
