import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { I18nProvider } from '../context/I18nProvider';
import { CountryFlag } from './CountryFlag';
import { TrackFlag } from './TrackFlag';

describe('CountryFlag & TrackFlag Components', () => {
  it('renders SVG flag for a valid country code with localized title', () => {
    render(
      <I18nProvider>
        <CountryFlag countryCode="au" />
      </I18nProvider>
    );

    const flag = screen.getByTestId('track-country-flag');
    expect(flag).toBeInTheDocument();
    expect(flag).toHaveAttribute('data-country', 'au');
    expect(flag).toHaveAttribute('title', 'Australia');
  });

  it('shows tooltip on mouse enter and hides on mouse leave', () => {
    render(
      <I18nProvider>
        <CountryFlag countryCode="gb" />
      </I18nProvider>
    );

    const flag = screen.getByTestId('track-country-flag');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(flag);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('United Kingdom');

    fireEvent.mouseLeave(flag);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders fallback checkered flag for unknown country code', () => {
    render(
      <I18nProvider>
        <CountryFlag countryCode="xx" />
      </I18nProvider>
    );

    const flag = screen.getByTestId('track-country-flag');
    expect(flag).toBeInTheDocument();
    expect(flag).toHaveAttribute('data-country', 'xx');
    expect(flag).toHaveAttribute('title', 'International / Unknown');
  });

  it('renders TrackFlag correctly from numeric track ID', () => {
    render(
      <I18nProvider>
        <TrackFlag track={7} showName={true} />
      </I18nProvider>
    );

    const flag = screen.getByTestId('track-country-flag');
    expect(flag).toHaveAttribute('data-country', 'gb');
    expect(screen.getByText('Silverstone')).toBeInTheDocument();
  });

  it('renders TrackFlag correctly from track name string and aliases', () => {
    render(
      <I18nProvider>
        <TrackFlag track="Albert Park" showName={true} />
      </I18nProvider>
    );

    const flag = screen.getByTestId('track-country-flag');
    expect(flag).toHaveAttribute('data-country', 'au');
    expect(screen.getByText('Melbourne')).toBeInTheDocument();
  });

  it('renders TrackFlag with Italian flag for Monza and Imola', () => {
    const { rerender } = render(
      <I18nProvider>
        <TrackFlag track="Monza" />
      </I18nProvider>
    );

    let flag = screen.getByTestId('track-country-flag');
    expect(flag).toHaveAttribute('data-country', 'it');

    rerender(
      <I18nProvider>
        <TrackFlag track="Imola" />
      </I18nProvider>
    );

    flag = screen.getByTestId('track-country-flag');
    expect(flag).toHaveAttribute('data-country', 'it');
  });
});
