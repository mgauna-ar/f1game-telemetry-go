import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { LocaleCode } from '../locales';
import { CountryFlag } from './CountryFlag';
import styles from './LanguageSelector.module.css';

export const LanguageSelector: React.FC = () => {
  const { t, locale, setLocale, availableLocales, currentLocaleInfo } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A click outside or Esc closes the menu; Esc also puts focus back on the button.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture phase, so an open chat or dialog doesn't also close on the same key.
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const handleSelect = (code: LocaleCode) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className={styles.selector} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('nav.selectLanguage')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="language-selector-btn"
      >
        <Globe size={14} className={styles.muted} aria-hidden="true" />
        <span className={styles.flag} aria-hidden="true">
          <CountryFlag
            countryCode={currentLocaleInfo.countryCode || (currentLocaleInfo.code === 'es' ? 'ar' : 'gb')}
            width={16}
            height={12}
            showTooltip={false}
          />
        </span>
        <span className={styles.code}>{currentLocaleInfo.code.toUpperCase()}</span>
        <ChevronDown size={13} className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className={styles.menu}
          role="listbox"
          aria-label={t('nav.availableLanguages')}
          data-testid="language-dropdown-menu"
        >
          {availableLocales.map((loc) => {
            const isSelected = loc.code === locale;
            return (
              <button
                key={loc.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={styles.option}
                onClick={() => handleSelect(loc.code)}
                data-testid={`lang-option-${loc.code}`}
              >
                <span className={styles.flag} aria-hidden="true">
                  <CountryFlag
                    countryCode={loc.countryCode || (loc.code === 'es' ? 'ar' : 'gb')}
                    width={18}
                    height={13}
                    showTooltip={false}
                  />
                </span>
                <span className={styles.label}>{loc.label}</span>
                {isSelected && <Check size={14} className={styles.check} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
