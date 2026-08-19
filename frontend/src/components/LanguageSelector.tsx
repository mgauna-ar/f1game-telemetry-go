import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { LocaleCode } from '../locales';
import { CountryFlag } from './CountryFlag';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale, availableLocales, currentLocaleInfo } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: LocaleCode) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className="lang-selector-container" ref={dropdownRef}>
      <button
        type="button"
        className={`lang-selector-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Select Language"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="language-selector-btn"
      >
        <Globe size={14} className="lang-icon" />
        <span className="lang-flag">
          <CountryFlag
            countryCode={currentLocaleInfo.countryCode || (currentLocaleInfo.code === 'es' ? 'ar' : 'gb')}
            width={16}
            height={12}
            showTooltip={false}
          />
        </span>
        <span className="lang-code mono">{currentLocaleInfo.code.toUpperCase()}</span>
        <ChevronDown size={13} className={`lang-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="lang-dropdown-menu" role="listbox" aria-label="Available Languages" data-testid="language-dropdown-menu">
          {availableLocales.map((loc) => {
            const isSelected = loc.code === locale;
            return (
              <button
                key={loc.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`lang-menu-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(loc.code)}
                data-testid={`lang-option-${loc.code}`}
              >
                <span className="lang-item-flag">
                  <CountryFlag
                    countryCode={loc.countryCode || (loc.code === 'es' ? 'ar' : 'gb')}
                    width={18}
                    height={13}
                    showTooltip={false}
                  />
                </span>
                <span className="lang-item-label">{loc.label}</span>
                {isSelected && <Check size={14} className="lang-item-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
