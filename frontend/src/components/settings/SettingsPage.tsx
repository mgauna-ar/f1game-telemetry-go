import React, { useEffect, useRef } from 'react';
import { Bot, GitCompare, Mic, Monitor, Radio, Server, Settings, Sparkles } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Link } from '../../router/Link';
import { useRoute } from '../../router/router';
import { SETTINGS_SECTIONS, settingsPath, type SettingsPageSection } from '../../router/routes';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../ui/PageHeader';
import { Panel, PanelHeader } from '../ui/Panel';
import { AiSettingsSection } from './AiSettingsSection';
import { ComparatorSettingsSection } from './ComparatorSettingsSection';
import { DeviceSettingsSection } from './DeviceSettingsSection';
import { RadioSettingsSections } from './RadioSettingsSections';
import styles from './SettingsPage.module.css';

/** Each section's icon, and whether it is saved for every device or only in this browser. */
const SECTION_META: Record<SettingsPageSection, { icon: typeof Settings; shared: boolean }> = {
  voice: { icon: Sparkles, shared: true },
  alerts: { icon: Radio, shared: true },
  ptt: { icon: Mic, shared: true },
  ai: { icon: Bot, shared: true },
  comparator: { icon: GitCompare, shared: true },
  device: { icon: Monitor, shared: false },
};

const SectionContent: React.FC<{ section: SettingsPageSection }> = ({ section }) => {
  switch (section) {
    case 'voice':
    case 'alerts':
    case 'ptt':
      return <RadioSettingsSections section={section} />;
    case 'ai':
      return <AiSettingsSection />;
    case 'comparator':
      return <ComparatorSettingsSection />;
    case 'device':
      return <DeviceSettingsSection />;
  }
};

/**
 * Every setting on one page, a section per URL (`/settings/:section`). The shared sections save
 * to the server as you change them (other open dashboards follow; failed saves and conflicts show
 * as toasts); "This device" stays in this browser. The radio, AI and comparator dialogs remain as
 * shortcuts that lead here.
 */
export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const route = useRoute();
  const section: SettingsPageSection = route.page === 'settings' ? route.section : SETTINGS_SECTIONS[0];
  const meta = SECTION_META[section];
  const title = t(`settings.sections.${section}.title`);
  useDocumentTitle(`${t('settings.title')}: ${title}`);

  useEffect(() => {
    void useComparatorPreferencesStore.getState().ensureLoaded();
  }, []);

  // On tablets and phones the sections are a strip that scrolls sideways: keep the open one in view
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [section]);

  return (
    <div className={styles.page}>
      <PageHeader icon={<Settings />} title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className={styles.layout}>
        <nav ref={navRef} className={styles.nav} aria-label={t('settings.navLabel')}>
          <ul className={styles.navList}>
            {SETTINGS_SECTIONS.map((id) => {
              const { icon: Icon, shared } = SECTION_META[id];
              return (
                <li key={id}>
                  <Link
                    href={settingsPath(id)}
                    replace
                    className={styles.navLink}
                    aria-current={id === section ? 'page' : undefined}
                    data-device={!shared || undefined}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {t(`settings.sections.${id}.short`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Panel className={styles.content} data-section={section}>
          <PanelHeader
            level={2}
            className={styles.sectionHeader}
            icon={<meta.icon size={16} />}
            title={title}
            subtitle={t(`settings.sections.${section}.description`)}
            actions={
              <Badge
                tone={meta.shared ? 'info' : 'neutral'}
                size="xs"
                icon={meta.shared ? <Server size={12} /> : <Monitor size={12} />}
                title={t(meta.shared ? 'settings.scope.sharedHint' : 'settings.scope.deviceHint')}
              >
                {t(meta.shared ? 'settings.scope.shared' : 'settings.scope.device')}
              </Badge>
            }
          />
          <SectionContent section={section} />
        </Panel>
      </div>
    </div>
  );
};
