import React from 'react';
import { AppWindow, Gauge, LayoutDashboard, Mic } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { LIVE_VIEW_MODES, type LiveViewMode } from '../constants/f1';
import { useToastStore } from '../store/useToastStore';
import { isNativeWindow, isRaceControlWindow, openRaceControlWindow } from '../utils/nativeWindow';
import { IconButton } from './ui/Button';
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

/**
 * Switches the live page between race control, the voice cockpit and the driver glance view. In
 * the app's own window on Windows it also opens Race Control in a window of its own, for a second
 * monitor.
 */
export const LiveViewModeSwitch: React.FC<LiveViewModeSwitchProps> = ({ value, onChange, compact }) => {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const openRaceControl = () => {
    openRaceControlWindow().catch((err: unknown) => {
      const error = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', message: t('live.raceControlWindowFailed', { error }) });
    });
  };

  return (
    <>
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
      {isNativeWindow() && !isRaceControlWindow() && (
        <IconButton
          variant="secondary"
          size="sm"
          label={t('live.raceControlWindow')}
          onClick={openRaceControl}
          data-testid="live-race-control-window"
        >
          <AppWindow size={compact ? 16 : 14} />
        </IconButton>
      )}
    </>
  );
};
