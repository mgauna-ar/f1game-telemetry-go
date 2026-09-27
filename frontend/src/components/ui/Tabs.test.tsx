import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabPanel, Tabs } from './Tabs';
import { SegmentedControl } from './SegmentedControl';
import { nextRovingIndex } from './roving';

type Tab = 'laps' | 'stints' | 'sectors';

const TabsHarness: React.FC<{ disableStints?: boolean }> = ({ disableStints = false }) => {
  const [tab, setTab] = useState<Tab>('laps');
  return (
    <>
      <Tabs
        idPrefix="test"
        aria-label="Session analysis"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'laps', label: 'Laps' },
          { id: 'stints', label: 'Stints', disabled: disableStints },
          { id: 'sectors', label: 'Sectors' },
        ]}
      />
      <TabPanel idPrefix="test" tab={tab}>
        Content for {tab}
      </TabPanel>
    </>
  );
};

describe('Tabs', () => {
  it('links the selected tab to its panel and gives the list one Tab stop', () => {
    render(<TabsHarness />);
    const laps = screen.getByRole('tab', { name: 'Laps' });
    expect(screen.getByRole('tablist', { name: 'Session analysis' })).toBeInTheDocument();
    expect(laps).toHaveAttribute('aria-selected', 'true');
    expect(laps).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Stints' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Laps' })).toHaveTextContent('Content for laps');
  });

  it('moves and selects with the arrow keys, Home and End', () => {
    render(<TabsHarness />);
    const laps = screen.getByRole('tab', { name: 'Laps' });
    fireEvent.keyDown(laps, { key: 'ArrowRight' });
    const stints = screen.getByRole('tab', { name: 'Stints' });
    expect(stints).toHaveFocus();
    expect(stints).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(stints, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Sectors' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Sectors' }), { key: 'ArrowRight' });
    expect(laps).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Content for laps');
  });

  it('skips disabled tabs', () => {
    render(<TabsHarness disableStints />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Laps' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Sectors' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('SegmentedControl', () => {
  const Harness: React.FC = () => {
    const [mode, setMode] = useState<'dashboard' | 'cockpit'>('dashboard');
    return (
      <SegmentedControl
        aria-label="Live view"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'dashboard', label: 'Race Control' },
          { value: 'cockpit', label: 'Cockpit' },
        ]}
      />
    );
  };

  it('is a radio group that clicks and arrow keys change', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Live view' })).toBeInTheDocument();
    const dashboard = screen.getByRole('radio', { name: 'Race Control' });
    const cockpit = screen.getByRole('radio', { name: 'Cockpit' });
    expect(dashboard).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(cockpit);
    expect(cockpit).toHaveAttribute('aria-checked', 'true');
    expect(dashboard).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(cockpit, { key: 'ArrowLeft' });
    expect(dashboard).toHaveAttribute('aria-checked', 'true');
    expect(dashboard).toHaveFocus();
  });
});

describe('nextRovingIndex', () => {
  it('wraps, jumps to the ends and ignores other keys', () => {
    const none = [false, false, false];
    expect(nextRovingIndex('ArrowDown', 2, none)).toBe(0);
    expect(nextRovingIndex('ArrowUp', 0, none)).toBe(2);
    expect(nextRovingIndex('Home', 1, [true, false, false])).toBe(1);
    expect(nextRovingIndex('End', 0, [false, false, true])).toBe(1);
    expect(nextRovingIndex('Enter', 0, none)).toBeNull();
  });
});
