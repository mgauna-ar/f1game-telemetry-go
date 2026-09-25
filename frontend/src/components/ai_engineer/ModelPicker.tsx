import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, Search } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AIModelItem } from '../../context/RaceEngineerContext';

export interface ModelPickerProps {
  currentModel: string;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  /** Why no list can be loaded yet, shown in place of it. */
  unavailableReason?: string | null;
  onModelChange: (model: string) => void;
  onRefreshModels: () => void;
}

/**
 * Picks the chat model: a searchable list of the provider's models once they load, and a plain
 * name field before that. A name that is not listed can still be typed and used.
 */
export const ModelPicker: React.FC<ModelPickerProps> = ({
  currentModel,
  availableModels,
  isLoadingModels,
  modelsError,
  unavailableReason,
  onModelChange,
  onRefreshModels,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [draftModel, setDraftModel] = useState(currentModel);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const hasList = availableModels.length > 0;

  useEffect(() => {
    setDraftModel(currentModel);
  }, [currentModel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableModels;
    return availableModels.filter(
      (m) => m.id.toLowerCase().includes(q) || m.display_name.toLowerCase().includes(q)
    );
  }, [availableModels, query]);

  // Show the selected model when the list loads, without scrolling anything around the list.
  useEffect(() => {
    const list = listRef.current;
    const selected = selectedRef.current;
    if (list && selected) list.scrollTop = Math.max(0, selected.offsetTop - list.clientHeight / 2);
  }, [hasList]);

  const typed = query.trim();
  const typedIsListed = availableModels.some((m) => m.id === typed);

  const choose = (model: string) => {
    const value = model.trim();
    if (!value) return;
    if (value !== currentModel) onModelChange(value);
    setQuery('');
  };

  const commitDraft = () => {
    const value = draftModel.trim();
    if (value && value !== currentModel) onModelChange(value);
    else setDraftModel(currentModel);
  };

  let status: React.ReactNode = null;
  if (isLoadingModels) status = t('ai_engineer.setup.loadingModels');
  else if (hasList) status = t('ai_engineer.setup.modelsAvailable', { count: availableModels.length });

  return (
    <div className="ai-field">
      <div className="ai-field-label-row">
        <label className="ai-field-label" htmlFor="ai-model-input">
          {t('ai_engineer.model')}
        </label>
        <span className="ai-field-meta">
          {status && <span>{status}</span>}
          {!unavailableReason && (
            <button
              type="button"
              className="ai-icon-link"
              onClick={onRefreshModels}
              disabled={isLoadingModels}
              title={t('ai_engineer.refreshModels')}
              aria-label={t('ai_engineer.refreshModels')}
            >
              <RefreshCw size={12} className={isLoadingModels ? 'animate-spin' : ''} />
            </button>
          )}
        </span>
      </div>

      {hasList ? (
        <div className="ai-model-picker">
          <div className="ai-input-shell">
            <Search size={13} className="ai-input-lead-icon" />
            <input
              id="ai-model-input"
              type="text"
              className="ai-input has-lead-icon"
              spellCheck={false}
              placeholder={t('ai_engineer.setup.searchModels')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                choose(filtered.length === 1 ? filtered[0].id : typed);
              }}
            />
          </div>
          <div className="ai-model-list" ref={listRef} role="listbox" aria-label={t('ai_engineer.model')}>
            {typed && !typedIsListed && (
              <button type="button" className="ai-model-option is-custom" onClick={() => choose(typed)}>
                <span className="ai-model-option-name">{t('ai_engineer.setup.useModel', { model: typed })}</span>
              </button>
            )}
            {filtered.map((m) => {
              const selected = m.id === currentModel;
              return (
                <button
                  key={m.id}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`ai-model-option${selected ? ' is-selected' : ''}`}
                  onClick={() => choose(m.id)}
                >
                  <span className="ai-model-option-name">{m.display_name || m.id}</span>
                  {m.display_name && m.display_name !== m.id && (
                    <span className="ai-model-option-id mono">{m.id}</span>
                  )}
                  {selected && <Check size={13} className="ai-model-option-check" />}
                </button>
              );
            })}
          </div>
          {currentModel && !availableModels.some((m) => m.id === currentModel) && (
            <div className="ai-field-hint">{t('ai_engineer.setup.currentModelNotListed', { model: currentModel })}</div>
          )}
        </div>
      ) : (
        <>
          <input
            id="ai-model-input"
            type="text"
            className="ai-input mono"
            spellCheck={false}
            value={draftModel}
            placeholder="gemini-flash-latest, gpt-4o-mini, claude-opus-5…"
            onChange={(e) => setDraftModel(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
            }}
          />
          {!modelsError && (
            <div className="ai-field-hint">{unavailableReason ?? t('ai_engineer.setup.modelTypeHint')}</div>
          )}
        </>
      )}

      {modelsError && <div className="ai-field-hint is-error">{modelsError}</div>}
    </div>
  );
};
