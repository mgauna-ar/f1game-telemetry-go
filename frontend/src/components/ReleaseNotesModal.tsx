import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  ExternalLink,
  X,
  CheckCircle,
  Package,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { UpdateCheckResponse, ReleaseAsset } from '../types/system';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateCheckResponse | null;
  onDismissVersion?: (version: string) => void;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
  updateData,
  onDismissVersion,
}) => {
  const { t } = useI18n();
  const [dontRemind, setDontRemind] = useState(false);

  if (!isOpen || !updateData) {
    return null;
  }

  const handleClose = () => {
    if (dontRemind && updateData.latest_version && onDismissVersion) {
      onDismissVersion(updateData.latest_version);
    }
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getPlatformIcon = (platform: ReleaseAsset['platform']) => {
    switch (platform) {
      case 'windows':
      case 'macos':
      case 'linux':
        return <HardDrive size={15} className="asset-platform-icon" />;
      case 'checksums':
        return <ShieldCheck size={15} className="asset-platform-icon text-cyan" />;
      default:
        return <Package size={15} className="asset-platform-icon" />;
    }
  };

  const getPlatformLabel = (platform: ReleaseAsset['platform']) => {
    switch (platform) {
      case 'windows':
        return t('common.updates.windowsPkg');
      case 'macos':
        return t('common.updates.macPkg');
      case 'linux':
        return t('common.updates.linuxPkg');
      case 'checksums':
        return t('common.updates.checksumsPkg');
      default:
        return 'Archive';
    }
  };

  // Simple Markdown renderer for changelog body
  const renderReleaseNotes = (notes: string | undefined) => {
    if (!notes) return <p className="text-muted">No release notes available.</p>;

    const lines = notes.split('\n');
    return (
      <div className="release-notes-content">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="rn-spacer" />;

          // Headings
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="rn-heading-3">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="rn-heading-2">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={idx} className="rn-heading-1">
                {trimmed.replace('# ', '')}
              </h2>
            );
          }

          // Bullet points
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const bulletText = trimmed.substring(2);
            return (
              <div key={idx} className="rn-bullet-item">
                <span className="rn-bullet-dot">•</span>
                <span className="rn-bullet-text">{formatInlineMarkdown(bulletText)}</span>
              </div>
            );
          }

          // Standard paragraph
          return (
            <p key={idx} className="rn-paragraph">
              {formatInlineMarkdown(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    // Format bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const isUpToDate = !updateData.update_available && !updateData.is_prerelease;

  return (
    <div className="release-modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="release-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="release-modal-header">
          <div className="release-modal-title-row">
            <div className="release-modal-icon-badge">
              <Sparkles size={20} className="text-cyan animate-pulse" />
            </div>
            <div>
              <div className="release-modal-title">
                {isUpToDate ? t('common.updates.upToDateTitle') : t('common.updates.title')}
              </div>
              <div className="release-modal-subtitle">
                {t('common.updates.subtitle')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="release-modal-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Version Banner */}
        <div className="release-version-banner">
          <div className="release-version-info">
            <div className="release-tag-title">
              <span className="release-tag-name mono">
                {updateData.latest_version || updateData.current_version}
              </span>
              {updateData.is_prerelease ? (
                <span className="release-badge prerelease">
                  {t('common.updates.prereleaseBadge')}
                </span>
              ) : (
                <span className="release-badge stable">
                  {t('common.updates.stableBadge')}
                </span>
              )}
            </div>
            <div className="release-meta-row mono text-xs text-muted">
              <span>{t('common.updates.currentVersion', { version: updateData.current_version })}</span>
              {updateData.published_at && (
                <>
                  <span className="meta-sep">•</span>
                  <span>
                    {t('common.updates.publishedOn', {
                      date: new Date(updateData.published_at).toLocaleDateString(),
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {updateData.html_url && (
            <a
              href={updateData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="release-github-link-btn"
            >
              <span>{t('common.updates.viewOnGitHub')}</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Modal Body */}
        <div className="release-modal-body">
          {/* Download Packages Section */}
          {updateData.assets && updateData.assets.length > 0 && (
            <div className="release-downloads-section">
              <div className="release-section-title">
                <Download size={14} className="text-cyan" />
                <span>{t('common.updates.downloadTitle')}</span>
              </div>
              <div className="release-assets-grid">
                {updateData.assets.map((asset, index) => (
                  <a
                    key={index}
                    href={asset.download_url}
                    download
                    className="release-asset-card"
                  >
                    <div className="release-asset-icon-box">
                      {getPlatformIcon(asset.platform)}
                    </div>
                    <div className="release-asset-details">
                      <div className="release-asset-label font-medium">
                        {getPlatformLabel(asset.platform)}
                      </div>
                      <div className="release-asset-name mono text-xs text-muted">
                        {asset.name} {asset.size > 0 && `(${formatSize(asset.size)})`}
                      </div>
                    </div>
                    <Download size={14} className="release-asset-dl-icon" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Release Notes Changelog Body */}
          <div className="release-changelog-section">
            <div className="release-section-title">
              <Package size={14} className="text-cyan" />
              <span>{t('common.releaseNotes')}</span>
            </div>
            {renderReleaseNotes(updateData.release_notes)}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="release-modal-footer">
          {updateData.update_available && (
            <label className="release-dont-remind-label">
              <input
                type="checkbox"
                checked={dontRemind}
                onChange={(e) => setDontRemind(e.target.checked)}
                className="release-checkbox"
              />
              <span>{t('common.updates.dontRemind')}</span>
            </label>
          )}
          <button
            type="button"
            className="release-modal-dismiss-btn"
            onClick={handleClose}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
