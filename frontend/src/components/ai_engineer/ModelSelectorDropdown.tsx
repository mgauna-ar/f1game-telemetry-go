import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

export interface ModelItem {
  id: string;
  display_name: string;
}

export interface ModelSelectorDropdownProps {
  currentModel: string;
  availableModels: ModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  onModelChange: (model: string) => void;
  onRefreshModels: () => void;
}

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  currentModel,
  availableModels,
  isLoadingModels,
  modelsError,
  onModelChange,
  onRefreshModels,
}) => {
  const { t } = useI18n();

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem' }}>
        <label className="readout-label" style={{ margin: 0 }}>{t('ai_engineer.model')}</label>
        <button
          type="button"
          className="ai-link-btn"
          onClick={onRefreshModels}
          disabled={isLoadingModels}
          title="Query available models from API"
        >
          <RefreshCw size={11} className={isLoadingModels ? 'animate-spin' : ''} /> {t('ai_engineer.refreshModels')}
        </button>
      </div>

      {availableModels.length > 0 ? (
        <select
          className="ui-select"
          value={currentModel}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className="ui-input"
          value={currentModel}
          placeholder="e.g. gemini-flash-lite-latest, gpt-4o-mini"
          onChange={(e) => onModelChange(e.target.value)}
        />
      )}

      {modelsError && <div className="ai-error-text">{modelsError}</div>}
    </>
  );
};
