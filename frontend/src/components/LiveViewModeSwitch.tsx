import React from 'react';
import { Gauge, LayoutDashboard, Mic } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { LIVE_VIEW_MODES, type LiveViewMode } from '../constants/f1';
import { SegmentedControl } from './ui/SegmentedControl';

interface LiveViewModeSwitchProps {
  value: LiveViewMode;
  onChange: (mode: LiveViewMode) => void;
  /** Icons only (names stay for screen readers and tooltips), for the Driver view's toolbar. */
  compact?: boolean;
}

const MODES = [
  { value: LIVE_VIEW_MODES.DASHBOARD, labelKey: 'live.viewModeDashboard', Icon: LayoutDashboard },
  { value: LIVE_VIEW_MODES.COCKPIT, labelKey: 'live.viewModeCockpit', Icon: Mic },
  { value: LIVE_VIEW_MODES.DRIVER, labelKey: 'live.viewModeDriver', Icon: Gauge },
] as const;

/** Switches the live page between race control, the voice cockpit and the driver glance view. */
export const LiveViewModeSwitch: React.FC<LiveViewModeSwitchProps> = ({ value, onChange, compact }) => {
  const { t } = useI18n();
  return (
    <SegmentedControl
      aria-label={t('live.viewModeLabel')}
      value={value}
      onChange={onChange}
      options={MODES.map(({ value: mode, labelKey, Icon }) => ({
        value: mode,
        label: compact ? <span className="sr-only">{t(labelKey)}</span> : t(labelKey),
        title: compact ? t(labelKey) : undefined,
        icon: <Icon size={compact ? 16 : 14} aria-hidden="true" />,
        'data-testid': `live-view-toggle-${mode}`,
      }))}
    />
  );
};
