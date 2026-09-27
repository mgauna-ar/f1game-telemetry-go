import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, Search } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AIModelItem } from '../../context/RaceEngineerContext';
import { IconButton } from '../ui/Button';
import { TextInput } from '../ui/Field';
import styles from './AiSettings.module.css';

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
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    setDraftModel(currentModel);
  }, [currentModel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableModels;
    return availableModels.filter((m) => m.id.toLowerCase().includes(q) || m.display_name.toLowerCase().includes(q));
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

  const hint = hasList
    ? currentModel && !availableModels.some((m) => m.id === currentModel)
      ? t('ai_engineer.setup.currentModelNotListed', { model: currentModel })
      : null
    : modelsError
      ? null
      : (unavailableReason ?? t('ai_engineer.setup.modelTypeHint'));

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={inputId}>
          {t('ai_engineer.model')}
        </label>
        <span className={styles.meta}>
          {status && <span role="status">{status}</span>}
          {!unavailableReason && (
            <IconButton
              size="sm"
              label={t('ai_engineer.refreshModels')}
              onClick={onRefreshModels}
              disabled={isLoadingModels}
            >
              <RefreshCw size={12} className={isLoadingModels ? 'animate-spin' : undefined} />
            </IconButton>
          )}
        </span>
      </div>

      {hasList ? (
        <div className={styles.modelPicker}>
          <div className={styles.inputShell}>
            <Search size={13} className={styles.leadIcon} aria-hidden="true" />
            <TextInput
              id={inputId}
              className={styles.withLeading}
              spellCheck={false}
              placeholder={t('ai_engineer.setup.searchModels')}
              aria-describedby={hint ? hintId : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                choose(filtered.length === 1 ? filtered[0].id : typed);
              }}
            />
          </div>
          <div className={styles.modelList} ref={listRef} role="listbox" aria-label={t('ai_engineer.model')}>
            {typed && !typedIsListed && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={styles.model}
                data-custom
                onClick={() => choose(typed)}
              >
                <span className={styles.modelName}>{t('ai_engineer.setup.useModel', { model: typed })}</span>
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
                  className={styles.model}
                  onClick={() => choose(m.id)}
                >
                  <span className={styles.modelName}>{m.display_name || m.id}</span>
                  {m.display_name && m.display_name !== m.id && <span className={styles.modelId}>{m.id}</span>}
                  {selected && <Check size={13} className={styles.modelCheck} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <TextInput
          id={inputId}
          mono
          spellCheck={false}
          value={draftModel}
          placeholder="gemini-flash-latest, gpt-4o-mini, claude-opus-5…"
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => setDraftModel(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
          }}
        />
      )}

      {hint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}
      {modelsError && (
        <div className={styles.hint} role="alert">
          {modelsError}
        </div>
      )}
    </div>
  );
};
