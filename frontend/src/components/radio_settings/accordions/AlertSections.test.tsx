import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { RADIO_TRIGGER_PRESETS } from '../../../constants/f1';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';
import { api } from '../../../utils/apiClient';
import { CoachingAccordion } from './CoachingAccordion';
import { PitAccordion } from './PitAccordion';
import { QualyAccordion } from './QualyAccordion';
import { RivalsAccordion } from './RivalsAccordion';
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
    ['Pit Stop', 'Last Lap of the Pit Window', PitAccordion, 'pitAlertsEnabled', 'subPitWindowClose'],
    ['Driver Coaching', 'Sector Time Deltas', CoachingAccordion, 'coachingAlertsEnabled', 'subSectorDelta'],
    ['Teammate', 'Teammate Ahead on Track', TeammateAccordion, 'teammateAlertsEnabled', 'subTeammateAhead'],
    ['Tyres & Degradation', 'Laps Left on the Tyres', TyresAccordion, 'tyreAlertsEnabled', 'subTyreLife'],
    [
      'Rival Battles & DRS Gaps',
      'Gap Report to the Cars Around You',
      RivalsAccordion,
      'rivalAlertsEnabled',
      'subGapReport',
    ],
  ] as const)('%s turns its calls on and off', (title, label, Section, master, alert) => {
    renderSection(<Section {...sectionProps} />);
    const before = useRadioSettingsStore.getState();

    fireEvent.click(screen.getByRole('switch', { name: title }));
    expect(useRadioSettingsStore.getState()[master]).toBe(!before[master]);

    fireEvent.click(screen.getByText(label));
    expect(useRadioSettingsStore.getState()[alert]).toBe(!before[alert]);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);
  });

  it('sets the pit entry reminder and how early box calls come', () => {
    renderSection(<PitAccordion {...sectionProps} />);

    fireEvent.click(screen.getByText('Box Reminder Before the Pit Entry'));
    expect(useRadioSettingsStore.getState().subPitEntryReminder).toBe(false);
    expect(screen.getByText('Box Call Distance Before the Pit Entry')).toBeInTheDocument();
    expect(useRadioSettingsStore.getState().pitCallLeadM).toBe(500);
  });

  it('sets how many laps apart the gap reports come', () => {
    renderSection(<RivalsAccordion {...sectionProps} />);

    expect(screen.getByText('Gap Report Every')).toBeInTheDocument();
    expect(screen.getByText('3 laps')).toBeInTheDocument();
    act(() => useRadioSettingsStore.getState().setGapReportLaps(0));
    expect(useRadioSettingsStore.getState().gapReportLaps).toBe(1);
    expect(screen.getByText('Lap')).toBeInTheDocument();
    act(() => useRadioSettingsStore.getState().setGapReportLaps(25));
    expect(useRadioSettingsStore.getState().gapReportLaps).toBe(10);
  });

  it('sets how early the push-lap car behind is called', () => {
    renderSection(<QualyAccordion {...sectionProps} />);

    expect(screen.getByText('Push-Lap Car Behind Warning')).toBeInTheDocument();
    expect(screen.getByText('6.0s')).toBeInTheDocument();
    act(() => useRadioSettingsStore.getState().setQualyCarBehindSec(1));
    expect(useRadioSettingsStore.getState().qualyCarBehindSec).toBe(3);
    act(() => useRadioSettingsStore.getState().setQualyCarBehindSec(15));
    expect(useRadioSettingsStore.getState().qualyCarBehindSec).toBe(10);
    expect(screen.getByText('10.0s')).toBeInTheDocument();
  });

  it('sets hot and cold tyre calls with one margin', () => {
    renderSection(<TyresAccordion {...sectionProps} />);

    expect(screen.getByText('Hot/Cold Margin Outside the Compound Window')).toBeInTheDocument();
    expect(screen.getByText('±5°C')).toBeInTheDocument();
    expect(screen.queryByText('Overheat Surface Temp')).not.toBeInTheDocument();
  });
});
