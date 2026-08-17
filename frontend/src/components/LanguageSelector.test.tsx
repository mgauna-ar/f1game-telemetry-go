import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nProvider } from '../context/I18nContext';
import { LanguageSelector } from './LanguageSelector';

describe('LanguageSelector Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders language selector button with current locale flag and code', () => {
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>
    );

    const btn = screen.getByTestId('language-selector-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('🇬🇧');
    expect(btn).toHaveTextContent('EN');
  });

  it('opens language dropdown when clicked and shows available locales including Spanish (Argentina 🇦🇷)', () => {
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>
    );

    const btn = screen.getByTestId('language-selector-btn');
    fireEvent.click(btn);

    const menu = screen.getByTestId('language-dropdown-menu');
    expect(menu).toBeInTheDocument();

    const esOption = screen.getByTestId('lang-option-es');
    expect(esOption).toBeInTheDocument();
    expect(esOption).toHaveTextContent('🇦🇷');
    expect(esOption).toHaveTextContent('Español (Latinoamérica)');

    const enOption = screen.getByTestId('lang-option-en');
    expect(enOption).toBeInTheDocument();
    expect(enOption).toHaveTextContent('🇬🇧');
    expect(enOption).toHaveTextContent('English');
  });

  it('changes locale when an option is selected and closes dropdown', () => {
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>
    );

    const btn = screen.getByTestId('language-selector-btn');
    fireEvent.click(btn);

    const esOption = screen.getByTestId('lang-option-es');
    fireEvent.click(esOption);

    // Dropdown should close
    expect(screen.queryByTestId('language-dropdown-menu')).not.toBeInTheDocument();

    // Trigger button should now show Argentina flag and ES
    expect(btn).toHaveTextContent('🇦🇷');
    expect(btn).toHaveTextContent('ES');
    expect(localStorage.getItem('f1_telemetry_language')).toBe('es');
  });
});
