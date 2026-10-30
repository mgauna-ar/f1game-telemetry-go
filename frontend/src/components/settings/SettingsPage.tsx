import React, { useEffect, useRef } from 'react';
import { AppWindow, Bot, Computer, GitCompare, Mic, Monitor, Radio, Server, Settings, Sparkles } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Link } from '../../router/Link';
import { useRoute } from '../../router/router';
import { SETTINGS_SECTIONS, settingsPath, type SettingsPageSection } from '../../router/routes';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { useDesktopStore } from '../../store/useDesktopStore';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../ui/PageHeader';
import { Panel, PanelHeader } from '../ui/Panel';
import { AiSettingsSection } from './AiSettingsSection';
import { AppSection } from './AppSection';
import { ComparatorSettingsSection } from './ComparatorSettingsSection';
import { DeviceSettingsSection } from './DeviceSettingsSection';
import { RadioSettingsSections } from './RadioSettingsSections';
import styles from './SettingsPage.module.css';

/** Where a section's settings apply: every device, this browser, or the app on the PC that runs it. */
type SectionScope = 'shared' | 'device' | 'pc';

/** Each section's icon and where its settings apply. */
const SECTION_META: Record<SettingsPageSection, { icon: typeof Settings; scope: SectionScope }> = {
  voice: { icon: Sparkles, scope: 'shared' },
  alerts: { icon: Radio, scope: 'shared' },
  ptt: { icon: Mic, scope: 'shared' },
  ai: { icon: Bot, scope: 'shared' },
  comparator: { icon: GitCompare, scope: 'shared' },
  device: { icon: Monitor, scope: 'device' },
  app: { icon: AppWindow, scope: 'pc' },
};

const SCOPE_BADGE: Record<SectionScope, { tone: 'info' | 'neutral'; icon: typeof Settings }> = {
  shared: { tone: 'info', icon: Server },
  device: { tone: 'neutral', icon: Monitor },
  pc: { tone: 'neutral', icon: Computer },
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
    case 'app':
      return <AppSection />;
  }
};

/**
 * Every setting on one page, a section per URL (`/settings/:section`). The shared sections save
 * to the server as you change them (other open dashboards follow; failed saves and conflicts show
 * as toasts); "This device" stays in this browser. "App" is listed only on the PC that runs the
 * app, which alone may change it. The radio, AI and comparator dialogs remain as shortcuts that
 * lead here.
 */
export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const route = useRoute();
  const section: SettingsPageSection = route.page === 'settings' ? route.section : SETTINGS_SECTIONS[0];
  const meta = SECTION_META[section];
  const badge = SCOPE_BADGE[meta.scope];
  const title = t(`settings.sections.${section}.title`);
  useDocumentTitle(`${t('settings.title')}: ${title}`);
  // A phone or tablet doesn't list App; a link to it still opens it, and it says why it's empty
  const onThePC = useDesktopStore((s) => s.state !== null);
  const sections = SETTINGS_SECTIONS.filter((id) => id !== 'app' || onThePC || section === 'app');

  useEffect(() => {
    void useComparatorPreferencesStore.getState().ensureLoaded();
    void useDesktopStore.getState().load();
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
            {sections.map((id) => {
              const { icon: Icon, scope } = SECTION_META[id];
              return (
                <li key={id}>
                  <Link
                    href={settingsPath(id)}
                    replace
                    className={styles.navLink}
                    aria-current={id === section ? 'page' : undefined}
                    data-device={scope === 'device' || undefined}
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
                tone={badge.tone}
                size="xs"
                icon={<badge.icon size={12} />}
                title={t(`settings.scope.${meta.scope}Hint`)}
              >
                {t(`settings.scope.${meta.scope}`)}
              </Badge>
            }
          />
          <SectionContent section={section} />
        </Panel>
      </div>
    </div>
  );
};
