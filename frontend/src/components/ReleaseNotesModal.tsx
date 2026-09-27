import React, { useState } from 'react';
import { Sparkles, Download, ExternalLink, Package, HardDrive, ShieldCheck } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { detectUserOS } from '../utils/system';
import type { UpdateCheckResponse, ReleaseAsset, SystemVersion } from '../types/system';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Markdown } from './ui/Markdown';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';
import styles from './ReleaseNotesModal.module.css';

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
        return <HardDrive size={15} />;
      case 'checksums':
        return <ShieldCheck size={15} />;
      default:
        return <Package size={15} />;
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

      <div className={styles.banner}>
        <div>
          <div className={styles.tagRow}>
            <span className={styles.tag}>
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
          <ul className={styles.meta}>
            {!isDev && <li>{t('common.updates.currentVersion', { version: effectiveData.current_version })}</li>}
            {systemVersion?.commit && systemVersion.commit !== 'none' && (
              <li>{t('common.updates.commit', { commit: systemVersion.commit })}</li>
            )}
            {systemVersion?.build_date && systemVersion.build_date !== 'unknown' && (
              <li>{t('common.updates.buildDate', { date: systemVersion.build_date })}</li>
            )}
            {isDev && effectiveData.latest_version && (
              <li>{t('common.updates.latestStableRelease', { version: effectiveData.latest_version })}</li>
            )}
            {!isDev && effectiveData.published_at && (
              <li>
                {t('common.updates.publishedOn', {
                  date: new Date(effectiveData.published_at).toLocaleDateString(),
                })}
              </li>
            )}
          </ul>
        </div>

        {(effectiveData.html_url || isDev) && (
          <a
            href={effectiveData.html_url || 'https://github.com/mgauna-ar/f1game-telemetry-go/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            <span>{t('common.updates.viewOnGitHub')}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>

      <ModalBody className={styles.body}>
        {/* Downloads for the user's own system */}
        {effectiveData.assets &&
          effectiveData.assets.length > 0 &&
          (() => {
            const userOS = detectUserOS();
            const filteredAssets = effectiveData.assets.filter((asset) => {
              if (userOS === 'other') return true;
              return asset.platform === userOS;
            });

            if (filteredAssets.length === 0) return null;

            return (
              <section>
                <h3 className={styles.sectionTitle}>
                  <Download size={14} aria-hidden="true" />
                  <span>
                    {isDev && effectiveData.latest_version
                      ? `${t('common.updates.downloadTitle')} (${effectiveData.latest_version})`
                      : t('common.updates.downloadTitle')}
                  </span>
                </h3>
                <ul className={styles.assets}>
                  {filteredAssets.map((asset) => (
                    <li key={asset.name}>
                      <a href={asset.download_url} download className={styles.asset}>
                        <span className={styles.assetIcon} data-kind={asset.platform} aria-hidden="true">
                          {getPlatformIcon(asset.platform)}
                        </span>
                        <span className={styles.assetText}>
                          <span className={styles.assetLabel}>{getAssetArchitectureLabel(asset)}</span>
                          <span className={styles.assetName}>
                            {asset.name} {asset.size > 0 && `(${formatSize(asset.size)})`}
                          </span>
                        </span>
                        <Download size={14} className={styles.download} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

        {effectiveData.release_notes && (
          <section>
            <h3 className={styles.sectionTitle}>
              <Package size={14} aria-hidden="true" />
              <span>{t('common.releaseNotes')}</span>
            </h3>
            <Markdown content={effectiveData.release_notes} className={styles.notes} />
          </section>
        )}
      </ModalBody>

      <ModalFooter align={effectiveData.update_available ? 'between' : 'end'}>
        {effectiveData.update_available && (
          <label className={styles.dontRemind}>
            <input type="checkbox" checked={dontRemind} onChange={(e) => setDontRemind(e.target.checked)} />
            <span>{t('common.updates.dontRemind')}</span>
          </label>
        )}
        <Button onClick={handleClose}>{t('common.close')}</Button>
      </ModalFooter>
    </Modal>
  );
};
