import React, { useState } from 'react';
import { Gauge, Languages, LayoutDashboard, Power, Radio, Ruler } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { LIVE_VIEW_MODES, RACE_CONTROL_LAYOUTS, type LiveViewMode, type RaceControlLayout } from '../../constants/f1';
import { storedLiveModeFor, storeLiveModeFor } from '../../router/routes';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { usePerformanceModeStore } from '../../store/usePerformanceModeStore';
import { useDevicePreferencesStore } from '../../store/useDevicePreferencesStore';
import type { LocaleCode } from '../../locales';
import { RadioEffectsSettings } from '../radio_settings/AudioSettingsTab';
import { SelectField, SettingSection, ToggleRow } from '../radio_settings/SettingControls';
import { SegmentedControl, type SegmentOption } from '../ui/SegmentedControl';
import type { ClockFormat, SpeedUnit, TemperatureUnit } from '../../utils/units';
import shared from '../radio_settings/RadioSettings.module.css';

interface ChoiceProps<T extends string> {
  label: string;
  hint?: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentOption<T>>;
}

/** A labelled choice between a few values. */
function Choice<T extends string>({ label, hint, value, onChange, options }: ChoiceProps<T>) {
  return (
    <div className={shared.box}>
      <span className={shared.fieldLabel}>{label}</span>
      <SegmentedControl<T> aria-label={label} size="xs" value={value} onChange={onChange} options={options} />
      {hint && <p className={shared.hint}>{hint}</p>}
    </div>
  );
}

const LIVE_MODE_KEYS: Record<LiveViewMode, string> = {
  [LIVE_VIEW_MODES.DASHBOARD]: 'live.viewModeDashboard',
  [LIVE_VIEW_MODES.COCKPIT]: 'live.viewModeCockpit',
  [LIVE_VIEW_MODES.DRIVER]: 'live.viewModeDriver',
};

/**
 * What this screen keeps for itself in this browser: radio sound, the language, units, which live view
 * opens, the Race Control layout, the chat's size or dock and performance mode.
 */
export const DeviceSettingsSection: React.FC = () => {
  const { t, locale, setLocale, availableLocales } = useI18n();
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const setIsRadioEnabled = useRadioSettingsStore((s) => s.setIsRadioEnabled);
  const performance = usePerformanceModeStore((s) => s.enabled);
  const setPerformance = usePerformanceModeStore((s) => s.setEnabled);
  const chatExpanded = useDevicePreferencesStore((s) => s.chatExpanded);
  const setChatExpanded = useDevicePreferencesStore((s) => s.setChatExpanded);
  const chatDocked = useDevicePreferencesStore((s) => s.chatDocked);
  const setChatDocked = useDevicePreferencesStore((s) => s.setChatDocked);
  const layout = useDevicePreferencesStore((s) => s.raceControlLayout);
  const units = useDevicePreferencesStore((s) => s.units);
  const setUnits = useDevicePreferencesStore((s) => s.setUnits);
  const setLayout = useDevicePreferencesStore((s) => s.setRaceControlLayout);

  // The live page writes these itself as you switch views; this page only needs them on opening
  const [liveMode, setLiveMode] = useState(() => storedLiveModeFor(false));
  const [phoneLiveMode, setPhoneLiveMode] = useState(() => storedLiveModeFor(true));
  const changeLiveMode = (phone: boolean) => (mode: LiveViewMode) => {
    storeLiveModeFor(phone, mode);
    (phone ? setPhoneLiveMode : setLiveMode)(mode);
  };
  const liveModeOptions = Object.values(LIVE_VIEW_MODES).map((mode) => ({
    value: mode,
    label: t(LIVE_MODE_KEYS[mode]),
  }));

  return (
    <>
      <SettingSection icon={<Power size={14} />} title={t('settings.device.radio')}>
        <ToggleRow
          label={t('ai_engineer.radio.masterToggle')}
          description={t('settings.device.radioMasterDesc')}
          checked={isRadioEnabled}
          onChange={setIsRadioEnabled}
        />
      </SettingSection>

      <RadioEffectsSettings />

      <SettingSection icon={<Languages size={14} />} title={t('nav.language')}>
        <SelectField label={t('nav.language')} value={locale} onChange={(value) => setLocale(value as LocaleCode)}>
          {availableLocales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.label}
            </option>
          ))}
        </SelectField>
      </SettingSection>

      <SettingSection icon={<Ruler size={14} />} title={t('settings.device.units')}>
        <div className={shared.grid3}>
          <Choice<SpeedUnit>
            label={t('settings.device.speed')}
            value={units.speed}
            onChange={(speed) => setUnits({ speed })}
            options={[
              { value: 'kmh', label: t('common.units.kmh') },
              { value: 'mph', label: t('common.units.mph') },
            ]}
          />
          <Choice<TemperatureUnit>
            label={t('settings.device.temperature')}
            value={units.temperature}
            onChange={(temperature) => setUnits({ temperature })}
            options={[
              { value: 'c', label: t('common.units.degC') },
              { value: 'f', label: t('common.units.degF') },
            ]}
          />
          <Choice<ClockFormat>
            label={t('settings.device.clock')}
            value={units.clock}
            onChange={(clock) => setUnits({ clock })}
            options={[
              { value: '24h', label: t('settings.device.clock24') },
              { value: '12h', label: t('settings.device.clock12') },
            ]}
          />
        </div>
        <p className={shared.hint}>{t('settings.device.unitsHint')}</p>
      </SettingSection>

      <SettingSection icon={<Radio size={14} />} title={t('settings.device.liveViews')}>
        <div className={shared.grid2}>
          <Choice
            label={t('settings.device.liveView')}
            value={liveMode}
            onChange={changeLiveMode(false)}
            options={liveModeOptions}
          />
          <Choice
            label={t('settings.device.liveViewPhone')}
            value={phoneLiveMode}
            onChange={changeLiveMode(true)}
            options={liveModeOptions}
          />
        </div>
        <p className={shared.hint}>{t('settings.device.liveViewHint')}</p>
      </SettingSection>

      <SettingSection icon={<LayoutDashboard size={14} />} title={t('settings.device.layout')}>
        <div className={shared.grid2}>
          <Choice<RaceControlLayout>
            label={t('live.raceControlView.layout')}
            value={layout}
            onChange={setLayout}
            options={Object.values(RACE_CONTROL_LAYOUTS).map((value) => ({
              value,
              label: t(`live.raceControlView.layouts.${value}`),
              title: t(`live.raceControlView.layoutTitles.${value}`),
            }))}
          />
          <Choice<'compact' | 'expanded' | 'docked'>
            label={t('settings.device.chatSize')}
            value={chatDocked ? 'docked' : chatExpanded ? 'expanded' : 'compact'}
            onChange={(value) => {
              setChatDocked(value === 'docked');
              if (value !== 'docked') setChatExpanded(value === 'expanded');
            }}
            options={[
              { value: 'compact', label: t('settings.device.chatCompact') },
              { value: 'expanded', label: t('settings.device.chatExpanded') },
              { value: 'docked', label: t('settings.device.chatDocked') },
            ]}
          />
        </div>
        <p className={shared.hint}>{t('settings.device.chatDockedHint')}</p>
      </SettingSection>

      <SettingSection icon={<Gauge size={14} />} title={t('nav.performanceMode.label')}>
        <p className={shared.hint}>{t('nav.performanceMode.hint')}</p>
        <div className={shared.stack}>
          <ToggleRow
            label={t('settings.device.performanceGeneral')}
            checked={performance.general}
            onChange={(on) => setPerformance('general', on)}
          />
          <ToggleRow
            label={t('settings.device.performanceDriver')}
            description={t('settings.device.performanceDriverDesc')}
            checked={performance.driver}
            onChange={(on) => setPerformance('driver', on)}
          />
        </div>
      </SettingSection>
    </>
  );
};
