import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { I18nProvider } from '../../context/I18nProvider';
import { SessionTypeBadge } from './SessionTypeBadge';

describe('SessionTypeBadge Component', () => {
  it('renders qualifying session with purple badge and timer icon', () => {
    render(<SessionTypeBadge sessionType="Short Qualifying" />);
    const badge = screen.getByText('Short Qualifying');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('[data-tone]');
    expect(container).toHaveAttribute('data-tone', 'purple');
  });

  it('renders race session with red badge', () => {
    render(<SessionTypeBadge sessionType="Race" />);
    const badge = screen.getByText('Race');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('[data-tone]');
    expect(container).toHaveAttribute('data-tone', 'danger');
  });

  it('renders practice session with green badge', () => {
    render(<SessionTypeBadge sessionType="Practice 1" />);
    const badge = screen.getByText('Practice 1');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('[data-tone]');
    expect(container).toHaveAttribute('data-tone', 'success');
  });

  it('renders sprint session with orange badge', () => {
    render(<SessionTypeBadge sessionType="Sprint" />);
    const badge = screen.getByText('Sprint');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('[data-tone]');
    expect(container).toHaveAttribute('data-tone', 'orange');
  });

  it('renders unknown fallback when sessionType is undefined', () => {
    render(<SessionTypeBadge />);
    const badge = screen.getByText('Unknown session');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('[data-tone]');
    expect(container).toHaveAttribute('data-tone', 'neutral');
  });

  it('shows the stored name in the UI language, keeping its colour', () => {
    localStorage.setItem('f1_telemetry_language', 'es');
    try {
      render(
        <I18nProvider>
          <SessionTypeBadge sessionType="Short Qualifying" />
        </I18nProvider>
      );
      const badge = screen.getByText('Clasificación corta');
      expect(badge.closest('[data-tone]')).toHaveAttribute('data-tone', 'purple');
      expect(badge.closest('[data-tone]')).toHaveAttribute('title', 'Tipo de Sesión: Clasificación corta');
    } finally {
      localStorage.removeItem('f1_telemetry_language');
    }
  });
});
