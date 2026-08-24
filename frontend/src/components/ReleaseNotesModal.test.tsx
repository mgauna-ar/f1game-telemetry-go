import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { I18nProvider } from '../context/I18nProvider';
import type { UpdateCheckResponse } from '../types/system';

const mockUpdateData: UpdateCheckResponse = {
  update_available: true,
  current_version: 'v1.0.0-beta.1',
  latest_version: 'v1.0.0-beta.2',
  release_name: 'F1 Telemetry Analyzer v1.0.0-beta.2',
  release_notes: '### Features\n* Added active aero chart\n* Fixed timing calculations',
  html_url: 'https://github.com/mgauna-ar/f1game-telemetry-go/releases/tag/v1.0.0-beta.2',
  published_at: '2026-08-18T20:00:00Z',
  is_prerelease: true,
  assets: [
    {
      name: 'f1telemetry_v1.0.0-beta.2_windows_amd64.zip',
      size: 15728640,
      download_url: 'https://example.com/dl/win.zip',
      platform: 'windows',
    },
    {
      name: 'f1telemetry_v1.0.0-beta.2_darwin_arm64.zip',
      size: 14680064,
      download_url: 'https://example.com/dl/mac.zip',
      platform: 'macos',
    },
  ],
};

describe('ReleaseNotesModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={false}
          onClose={() => {}}
          updateData={mockUpdateData}
        />
      </I18nProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders release details, assets, and markdown notes when open', () => {
    render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={true}
          onClose={() => {}}
          updateData={mockUpdateData}
        />
      </I18nProvider>
    );

    expect(screen.getByText('v1.0.0-beta.2')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Added active aero chart')).toBeInTheDocument();
    expect(screen.getByText('f1telemetry_v1.0.0-beta.2_windows_amd64.zip (15.0 MB)')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={true}
          onClose={onClose}
          updateData={mockUpdateData}
        />
      </I18nProvider>
    );

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDismissVersion when dont remind is checked and dismissed', () => {
    const onDismiss = vi.fn();
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={true}
          onClose={onClose}
          updateData={mockUpdateData}
          onDismissVersion={onDismiss}
        />
      </I18nProvider>
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const dismissBtn = screen.getByText('Close');
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledWith('v1.0.0-beta.2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
