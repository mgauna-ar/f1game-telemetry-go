import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { RADIO_TRIGGER_PRESETS } from '../../../constants/f1';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';
import { api } from '../../../utils/apiClient';
import { CoachingAccordion } from './CoachingAccordion';
import { PitAccordion } from './PitAccordion';
import { TeammateAccordion } from './TeammateAccordion';
import { TyresAccordion } from './TyresAccordion';

const sectionProps = { isExpanded: true, onToggleExpand: () => {}, onTestAlert: () => {} };
const renderSection = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);

describe('alert sections', () => {
  beforeEach(() => {
    vi.spyOn(api, 'put').mockResolvedValue({});
    useRadioSettingsStore.getState().resetStoreToDefaults();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useRadioSettingsStore.getState().resetStoreToDefaults();
  });

  it.each([
    ['Pit Stop', 'Pit Window Closing', PitAccordion, 'pitAlertsEnabled', 'subPitWindowClose'],
    ['Driver Coaching', 'Sector Time Deltas', CoachingAccordion, 'coachingAlertsEnabled', 'subSectorDelta'],
    ['Teammate', 'Teammate Ahead on Track', TeammateAccordion, 'teammateAlertsEnabled', 'subTeammateAhead'],
  ] as const)('%s turns its calls on and off', (title, label, Section, master, alert) => {
    renderSection(<Section {...sectionProps} />);
    const before = useRadioSettingsStore.getState();

    fireEvent.click(screen.getByRole('switch', { name: title }));
    expect(useRadioSettingsStore.getState()[master]).toBe(!before[master]);

    fireEvent.click(screen.getByText(label));
    expect(useRadioSettingsStore.getState()[alert]).toBe(!before[alert]);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);
  });

  it('sets hot and cold tyre calls with one margin', () => {
    renderSection(<TyresAccordion {...sectionProps} />);

    expect(screen.getByText('Hot/Cold Margin Outside the Compound Window')).toBeInTheDocument();
    expect(screen.getByText('±5°C')).toBeInTheDocument();
    expect(screen.queryByText('Overheat Surface Temp')).not.toBeInTheDocument();
  });
});
