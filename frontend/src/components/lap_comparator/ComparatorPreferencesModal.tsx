import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, X, Trophy, Users, User, Check } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { ComparatorPreferences, ComparatorRivalMode } from '../../types/comparatorPreferences';
import {
  loadComparatorPreferences,
  saveComparatorPreferences,
} from '../../utils/comparatorPreferencesUtils';

export interface ComparatorPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: ComparatorPreferences) => void;
  currentSlotADriverName?: string;
  currentSlotBDriverName?: string;
}

export const ComparatorPreferencesModal: React.FC<ComparatorPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSlotADriverName,
  currentSlotBDriverName,
}) => {
  const { t } = useI18n();

  const [defaultDriverName, setDefaultDriverName] = useState('');
  const [rivalMode, setRivalMode] = useState<ComparatorRivalMode>('fastest');
  const [rivalDriverName, setRivalDriverName] = useState('');

  // Synchronize state from storage whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const prefs = loadComparatorPreferences();
      setDefaultDriverName(prefs.defaultDriverName);
      setRivalMode(prefs.rivalMode);
      setRivalDriverName(prefs.rivalDriverName);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: ComparatorPreferences = {
      defaultDriverName: defaultDriverName.trim(),
      rivalMode,
      rivalDriverName: rivalDriverName.trim(),
    };
    saveComparatorPreferences(updated);
    onSave(updated);
    onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="comparator-preferences-modal-overlay">
      <div
        className="modal-container glass-panel comparator-preferences-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }}
        data-testid="comparator-preferences-modal"
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(235, 10, 40, 0.15)',
                border: '1px solid rgba(235, 10, 40, 0.3)',
                color: 'var(--accent-primary)',
              }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                {t('comparator.preferences.modalTitle')}
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {t('comparator.preferences.modalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="close-preferences-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Default Reference Pilot (Slot A / Base) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label
              htmlFor="default-reference-driver-input"
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ff4757',
                  boxShadow: '0 0 8px rgba(255, 71, 87, 0.6)',
                }}
              />
              {t('comparator.preferences.defaultReferenceDriver')}
            </label>

            {currentSlotADriverName && (
              <button
                type="button"
                onClick={() => setDefaultDriverName(currentSlotADriverName)}
                style={{
                  background: 'rgba(255, 71, 87, 0.12)',
                  border: '1px solid rgba(255, 71, 87, 0.3)',
                  color: '#ff6b81',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                data-testid="use-current-driver-a-btn"
              >
                <span>{t('comparator.preferences.useCurrentDriver')}: {currentSlotADriverName}</span>
              </button>
            )}
          </div>

          <input
            id="default-reference-driver-input"
            type="text"
            value={defaultDriverName}
            onChange={(e) => setDefaultDriverName(e.target.value)}
            placeholder={t('comparator.preferences.defaultReferenceDriverPlaceholder')}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            data-testid="default-driver-name-input"
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t('comparator.preferences.defaultReferenceDriverHelp')}
          </p>
        </div>

        {/* Section 2: Default Comparison Target (Slot B / Comp) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#00d2d3',
                boxShadow: '0 0 8px rgba(0, 210, 211, 0.6)',
                marginRight: '6px',
              }}
            />
            {t('comparator.preferences.comparisonTarget')}
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Target 1: Fastest */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                background: rivalMode === 'fastest' ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${rivalMode === 'fastest' ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              data-testid="rival-mode-fastest-label"
            >
              <input
                type="radio"
                name="rivalMode"
                value="fastest"
                checked={rivalMode === 'fastest'}
                onChange={() => setRivalMode('fastest')}
                style={{ accentColor: '#00d2d3' }}
                data-testid="rival-mode-fastest-radio"
              />
              <Trophy size={16} color={rivalMode === 'fastest' ? '#00d2d3' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.88rem', fontWeight: rivalMode === 'fastest' ? 600 : 400 }}>
                {t('comparator.preferences.targetFastest')}
              </span>
            </label>

            {/* Target 2: Teammate */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                background: rivalMode === 'teammate' ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${rivalMode === 'teammate' ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              data-testid="rival-mode-teammate-label"
            >
              <input
                type="radio"
                name="rivalMode"
                value="teammate"
                checked={rivalMode === 'teammate'}
                onChange={() => setRivalMode('teammate')}
                style={{ accentColor: '#00d2d3' }}
                data-testid="rival-mode-teammate-radio"
              />
              <Users size={16} color={rivalMode === 'teammate' ? '#00d2d3' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.88rem', fontWeight: rivalMode === 'teammate' ? 600 : 400 }}>
                {t('comparator.preferences.targetTeammate')}
              </span>
            </label>

            {/* Target 3: Specific Driver */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                background: rivalMode === 'driver' ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${rivalMode === 'driver' ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              data-testid="rival-mode-driver-label"
            >
              <input
                type="radio"
                name="rivalMode"
                value="driver"
                checked={rivalMode === 'driver'}
                onChange={() => setRivalMode('driver')}
                style={{ accentColor: '#00d2d3' }}
                data-testid="rival-mode-driver-radio"
              />
              <User size={16} color={rivalMode === 'driver' ? '#00d2d3' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.88rem', fontWeight: rivalMode === 'driver' ? 600 : 400 }}>
                {t('comparator.preferences.targetDriver')}
              </span>
            </label>

            {/* If driver mode active, show input */}
            {rivalMode === 'driver' && (
              <div style={{ marginTop: '0.35rem', paddingLeft: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('comparator.preferences.targetDriver')}:
                  </span>
                  {currentSlotBDriverName && (
                    <button
                      type="button"
                      onClick={() => setRivalDriverName(currentSlotBDriverName)}
                      style={{
                        background: 'rgba(0, 210, 211, 0.12)',
                        border: '1px solid rgba(0, 210, 211, 0.3)',
                        color: '#00d2d3',
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      data-testid="use-current-driver-b-btn"
                    >
                      {t('comparator.preferences.useCurrentDriver')}: {currentSlotBDriverName}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={rivalDriverName}
                  onChange={(e) => setRivalDriverName(e.target.value)}
                  placeholder={t('comparator.preferences.rivalDriverPlaceholder')}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(0, 210, 211, 0.3)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  data-testid="rival-driver-name-input"
                />
              </div>
            )}
          </div>

          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t('comparator.preferences.fallbackNotice')}
          </p>
        </div>

        {/* Modal Actions Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            data-testid="cancel-preferences-btn"
          >
            {t('comparator.preferences.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(235, 10, 40, 0.35)',
            }}
            data-testid="save-preferences-btn"
          >
            <Check size={16} />
            <span>{t('comparator.preferences.save')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
