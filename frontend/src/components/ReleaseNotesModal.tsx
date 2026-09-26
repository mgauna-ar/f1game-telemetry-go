import React, { useState } from 'react';
import { Sparkles, Download, ExternalLink, Package, HardDrive, ShieldCheck } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { detectUserOS } from '../utils/system';
import type { UpdateCheckResponse, ReleaseAsset, SystemVersion } from '../types/system';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Markdown } from './ui/Markdown';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateCheckResponse | null;
  systemVersion?: SystemVersion | null;
  onDismissVersion?: (version: string) => void;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
  updateData,
  systemVersion,
  onDismissVersion,
}) => {
  const { t } = useI18n();
  const [dontRemind, setDontRemind] = useState(false);

  if (!updateData && !systemVersion) {
    return null;
  }

  const effectiveData: UpdateCheckResponse = updateData || {
    update_available: false,
    current_version: systemVersion?.version || 'dev',
    latest_version: '',
    release_name: '',
    release_notes: '',
    html_url: '',
    published_at: '',
    is_prerelease: false,
    assets: [],
  };

  const handleClose = () => {
    if (dontRemind && effectiveData.latest_version && onDismissVersion) {
      onDismissVersion(effectiveData.latest_version);
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

  const getAssetArchitectureLabel = (asset: ReleaseAsset) => {
    const lower = asset.name.toLowerCase();
    if (asset.platform === 'checksums' || lower.includes('checksum')) {
      return t('common.updates.checksumsPkg');
    }
    if (asset.platform === 'macos') {
      if (lower.includes('arm64')) return t('common.updates.macArmPkg');
      if (lower.includes('amd64') || lower.includes('x86_64')) return t('common.updates.macIntelPkg');
      return t('common.updates.macPkg');
    }
    if (asset.platform === 'windows') {
      if (lower.includes('arm64')) return t('common.updates.winArmPkg');
      if (lower.includes('amd64') || lower.includes('x64')) return t('common.updates.winX64Pkg');
      return t('common.updates.windowsPkg');
    }
    if (asset.platform === 'linux') {
      if (lower.includes('arm64')) return t('common.updates.linuxArmPkg');
      if (lower.includes('amd64') || lower.includes('x64')) return t('common.updates.linuxX64Pkg');
      return t('common.updates.linuxPkg');
    }
    return asset.name;
  };

  const isDev = systemVersion?.is_dev || effectiveData.current_version === 'dev';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader
        tone="accent"
        icon={<Sparkles size={20} />}
        title={
          isDev
            ? t('common.updates.devTitle')
            : effectiveData.update_available
            ? t('common.updates.title')
            : t('common.updates.upToDateTitle')
        }
        subtitle={
          isDev
            ? t('common.updates.devSubtitle')
            : effectiveData.update_available
            ? t('common.updates.subtitle')
            : t('common.updates.upToDateDesc', { version: effectiveData.current_version })
        }
      />

      {/* Version Banner */}
      <div className="release-version-banner">
        <div className="release-version-info">
          <div className="release-tag-title">
            <span className="release-tag-name mono">
              {isDev ? 'dev' : effectiveData.latest_version || effectiveData.current_version}
            </span>
            {isDev ? (
              <Badge tone="warning" square uppercase>
                {t('common.updates.devBadge')}
              </Badge>
            ) : effectiveData.is_prerelease ? (
              <Badge tone="warning" square uppercase>
                {t('common.updates.prereleaseBadge')}
              </Badge>
            ) : (
              <Badge tone="success" square uppercase>
                {t('common.updates.stableBadge')}
              </Badge>
            )}
          </div>
          <div className="release-meta-row mono text-xs text-muted">
            {!isDev && <span>{t('common.updates.currentVersion', { version: effectiveData.current_version })}</span>}
            {systemVersion?.commit && systemVersion.commit !== 'none' && (
              <>
                {!isDev && <span className="meta-sep">•</span>}
                <span>{t('common.updates.commit', { commit: systemVersion.commit })}</span>
              </>
            )}
            {systemVersion?.build_date && systemVersion.build_date !== 'unknown' && (
              <>
                <span className="meta-sep">•</span>
                <span>{t('common.updates.buildDate', { date: systemVersion.build_date })}</span>
              </>
            )}
            {isDev && effectiveData.latest_version && (
              <>
                <span className="meta-sep">•</span>
                <span>{t('common.updates.latestStableRelease', { version: effectiveData.latest_version })}</span>
              </>
            )}
            {!isDev && effectiveData.published_at && (
              <>
                <span className="meta-sep">•</span>
                <span>
                  {t('common.updates.publishedOn', {
                    date: new Date(effectiveData.published_at).toLocaleDateString(),
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        {(effectiveData.html_url || isDev) && (
          <a
            href={effectiveData.html_url || 'https://github.com/mgauna-ar/f1game-telemetry-go/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className="release-github-link-btn"
          >
            <span>{t('common.updates.viewOnGitHub')}</span>
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <ModalBody className="release-modal-body">
        {/* Download Packages Section (Filtered strictly to user's OS) */}
        {effectiveData.assets && effectiveData.assets.length > 0 && (() => {
          const userOS = detectUserOS();
          const filteredAssets = effectiveData.assets.filter((asset) => {
            if (userOS === 'other') return true;
            return asset.platform === userOS;
          });

          if (filteredAssets.length === 0) return null;

          return (
            <div className="release-downloads-section">
              <div className="release-section-title">
                <Download size={14} className="text-cyan" />
                <span>
                  {isDev && effectiveData.latest_version
                    ? `${t('common.updates.downloadTitle')} (${effectiveData.latest_version})`
                    : t('common.updates.downloadTitle')}
                </span>
              </div>
              <div className="release-assets-grid">
                {filteredAssets.map((asset, index) => (
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
                        {getAssetArchitectureLabel(asset)}
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
          );
        })()}

        {/* Release Notes Changelog Body (when available) */}
        {effectiveData.release_notes && (
          <div className="release-changelog-section">
            <div className="release-section-title">
              <Package size={14} className="text-cyan" />
              <span>{t('common.releaseNotes')}</span>
            </div>
            <Markdown content={effectiveData.release_notes} className="release-notes-content" />
          </div>
        )}
      </ModalBody>

      <ModalFooter align={effectiveData.update_available ? 'between' : 'end'}>
        {effectiveData.update_available && (
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
        <Button onClick={handleClose}>{t('common.close')}</Button>
      </ModalFooter>
    </Modal>
  );
};
