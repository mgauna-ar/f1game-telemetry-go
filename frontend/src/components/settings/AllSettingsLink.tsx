import React from 'react';
import { Settings } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Link } from '../../router/Link';
import { settingsPath, type SettingsPageSection } from '../../router/routes';
import styles from './AllSettingsLink.module.css';

export interface AllSettingsLinkProps {
  section: SettingsPageSection;
  /** Called before the page opens, e.g. to close the dialog the link sits in. */
  onNavigate?: () => void;
}

/** "All settings": leads from a settings shortcut (a dialog or panel) to its section of the settings page. */
export const AllSettingsLink: React.FC<AllSettingsLinkProps> = ({ section, onNavigate }) => {
  const { t } = useI18n();
  return (
    <Link href={settingsPath(section)} className={styles.link} onClick={() => onNavigate?.()}>
      <Settings size={13} aria-hidden="true" />
      {t('settings.allSettings')}
    </Link>
  );
};
