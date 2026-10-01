import { useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import {
  isEngineerSavePending,
  isVoiceSavePending,
  useRadioSettingsStore,
} from '../../store/useRadioSettingsStore';
import { useSettingsSaveStore } from '../../store/useSettingsSaveStore';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { useToastStore } from '../../store/useToastStore';
import { subscribeSettingsChanges } from '../../utils/settingsClient';

/**
 * Keeps the shared race engineer, voice and comparator settings in step with other devices, and shows settings
 * saves that failed. Renders nothing; mounted once by the app shell.
 */
export function SettingsSync(): null {
  const { t } = useI18n();
  const problem = useSettingsSaveStore((s) => s.problem);

  useEffect(() => {
    const offEngineer = subscribeSettingsChanges('engineer', (msg) => {
      const radio = useRadioSettingsStore.getState();
      // Already have this version, or a save of ours is pending: it conflicts and reloads itself.
      if ((msg.version ?? 0) <= radio.engineerVersion || isEngineerSavePending()) return;
      void radio.loadConfigFromBackend();
    });
    const offVoice = subscribeSettingsChanges('voice', () => {
      if (isVoiceSavePending()) return;
      void useRadioSettingsStore.getState().loadVoiceFromBackend();
    });
    // Only a comparator this tab has loaded needs the new copy; reload skips it while a save is pending
    const offComparator = subscribeSettingsChanges('comparator', () => {
      const comparator = useComparatorPreferencesStore.getState();
      if (comparator.loaded) void comparator.reload();
    });
    return () => {
      offEngineer();
      offVoice();
      offComparator();
    };
  }, []);

  useEffect(() => {
    if (!problem) return;
    const section = t(`ai_engineer.settingsSync.sections.${problem.section}`);
    useToastStore.getState().showToast(
      problem.kind === 'conflict'
        ? { type: 'info', message: t('ai_engineer.settingsSync.conflict', { section }) }
        : { type: 'error', message: t('ai_engineer.settingsSync.saveFailed', { section, message: problem.message }) }
    );
    useSettingsSaveStore.getState().clear();
  }, [problem, t]);

  return null;
}
