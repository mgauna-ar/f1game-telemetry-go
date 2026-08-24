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

  it('renders release details, filtered assets, and markdown notes when open', () => {
    // Force macOS userAgent
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');

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
    // Only macOS package should be visible
    expect(screen.getByText('f1telemetry_v1.0.0-beta.2_darwin_arm64.zip (14.0 MB)')).toBeInTheDocument();
    expect(screen.getByText('macOS (Apple Silicon M1–M4)')).toBeInTheDocument();
    // Windows package should NOT be rendered
    expect(screen.queryByText('f1telemetry_v1.0.0-beta.2_windows_amd64.zip (15.0 MB)')).not.toBeInTheDocument();
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

  it('renders commit and build date when systemVersion is provided', () => {
    const mockSystemVersion = {
      version: 'v1.0.1',
      commit: 'abc1234',
      build_date: '2026-08-24',
      is_dev: false,
      is_beta: false,
    };

    render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={true}
          onClose={() => {}}
          updateData={null}
          systemVersion={mockSystemVersion}
        />
      </I18nProvider>
    );

    expect(screen.getByText('v1.0.1')).toBeInTheDocument();
    expect(screen.getByText('Commit: abc1234')).toBeInTheDocument();
    expect(screen.getByText('Built on 2026-08-24')).toBeInTheDocument();
  });

  it('renders dev banner title, latest stable version info, and OS-filtered downloads in development mode', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');

    const mockSystemVersion = {
      version: 'dev',
      commit: '48f0b96',
      build_date: '2026-08-24',
      is_dev: true,
      is_beta: false,
    };

    render(
      <I18nProvider>
        <ReleaseNotesModal
          isOpen={true}
          onClose={() => {}}
          updateData={{
            update_available: false,
            current_version: 'dev',
            latest_version: 'v1.0.1',
            assets: [
              {
                name: 'f1telemetry_v1.0.1_darwin_arm64.zip',
                size: 14680064,
                download_url: 'https://example.com/mac.zip',
                platform: 'macos',
              },
              {
                name: 'f1telemetry_v1.0.1_windows_amd64.zip',
                size: 15728640,
                download_url: 'https://example.com/win.zip',
                platform: 'windows',
              },
            ],
          }}
          systemVersion={mockSystemVersion}
        />
      </I18nProvider>
    );

    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('Development Build')).toBeInTheDocument();
    expect(screen.getByText('Commit: 48f0b96')).toBeInTheDocument();
    expect(screen.getByText('Latest Stable Release: v1.0.1')).toBeInTheDocument();
    // Only macOS download should be visible
    expect(screen.getByText('macOS (Apple Silicon M1–M4)')).toBeInTheDocument();
    expect(screen.queryByText('Windows (64-bit x64)')).not.toBeInTheDocument();
  });
});
