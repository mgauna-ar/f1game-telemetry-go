import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Badge } from './Badge';
import { Button, IconButton } from './Button';
import { Callout } from './Callout';
import { Chip } from './Chip';
import { DataTable, type DataTableColumn } from './DataTable';
import { EmptyState } from './EmptyState';
import { Modal } from './Modal';
import { PageHeader } from './PageHeader';
import { Panel, PanelHeader } from './Panel';
import { SkeletonCharts, SkeletonChips, SkeletonGroup, SkeletonPage, SkeletonRows } from './Skeleton';
import { Stat } from './Stat';
import { Tooltip } from './Tooltip';

afterEach(() => {
  vi.useRealTimers();
});

const TestIcon: React.FC<{ size: number }> = ({ size }) => <svg width={size} />;

describe('Button', () => {
  it('never submits a form by accident and blocks clicks while loading', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');

    rerender(
      <Button onClick={onClick} loading>
        Save
      </Button>
    );
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // The spinner takes the icon's own size, so the label doesn't shift
    rerender(
      <Button onClick={onClick} loading icon={<svg width={18} />}>
        Save
      </Button>
    );
    expect(button.querySelector('svg')).toHaveAttribute('width', '15');
    rerender(
      <Button onClick={onClick} loading icon={<TestIcon size={18} />}>
        Save
      </Button>
    );
    expect(button.querySelector('svg')).toHaveAttribute('width', '18');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('names an icon button from its label', () => {
    render(
      <IconButton label="Clear feed">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Clear feed' })).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows after a hover delay, describes the trigger and hides on leave', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Theoretical best from the fastest sectors">
        <button type="button">Ultimate lap</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Ultimate lap' });
    expect(trigger).toHaveAccessibleDescription('Theoretical best from the fastest sectors');

    fireEvent.mouseEnter(trigger);
    expect(document.querySelector('[data-placement]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelector('[data-placement]')).toHaveTextContent('Theoretical best from the fastest sectors');

    fireEvent.mouseLeave(trigger);
    expect(document.querySelector('[data-placement]')).toBeNull();
  });

  it('hides on Esc without closing the dialog it sits in', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} aria-label="Settings">
        <Tooltip content="More detail">
          <button type="button">Info</button>
        </Tooltip>
      </Modal>
    );
    const trigger = screen.getByRole('button', { name: 'Info' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelector('[data-placement]')).not.toBeNull();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(document.querySelector('[data-placement]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

interface Row {
  id: number;
  driver: string;
  lap: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'driver', header: 'Driver', rowHeader: true, sortable: true, cell: (row) => row.driver },
  { key: 'lap', header: 'Best lap', numeric: true, sortable: true, cell: (row) => row.lap },
];

describe('DataTable', () => {
  const rows: Row[] = [
    { id: 1, driver: 'Leclerc', lap: '1:27.100' },
    { id: 2, driver: 'Norris', lap: '1:27.350' },
  ];

  it('is a captioned table with row headers and sort state on its column headers', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        caption="Best laps"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={{ key: 'lap', direction: 'asc' }}
        onSortChange={onSortChange}
      />
    );
    expect(screen.getByRole('table', { name: 'Best laps' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Norris' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Best lap/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Driver/ })).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(screen.getByRole('button', { name: /Driver/ }));
    expect(onSortChange).toHaveBeenCalledWith('driver');
  });

  it('shows the empty state in place of rows and runs the row shortcut', () => {
    const onRowClick = vi.fn();
    const { rerender } = render(
      <DataTable caption="Best laps" columns={columns} rows={[]} getRowKey={(row) => row.id} empty="No laps yet" />
    );
    expect(screen.getByText('No laps yet')).toBeInTheDocument();

    rerender(
      <DataTable caption="Best laps" columns={columns} rows={rows} getRowKey={(row) => row.id} onRowClick={onRowClick} />
    );
    fireEvent.click(screen.getByText('1:27.350'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('adds a full-width row under the rows that have more to show', () => {
    render(
      <DataTable
        caption="Best laps"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        renderExpanded={(row) => (row.id === 1 ? `Laps for ${row.driver}` : null)}
      />
    );
    const expanded = screen.getByRole('cell', { name: 'Laps for Leclerc' });
    expect(expanded).toHaveAttribute('colspan', '2');
    // header row, two driver rows and one expanded row
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('puts grouped rows under row-group headers, one tbody per group, and folds a collapsed group', () => {
    const { container } = render(
      <DataTable
        caption="Best laps"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        groups={[
          { key: 'ferrari', header: 'Ferrari', rows: [rows[0]] },
          { key: 'mclaren', header: 'McLaren', rows: [rows[1]], collapsed: true },
        ]}
      />
    );
    expect(container.querySelectorAll('tbody')).toHaveLength(2);
    const ferrari = screen.getByRole('rowheader', { name: 'Ferrari' });
    expect(ferrari).toHaveAttribute('scope', 'rowgroup');
    expect(ferrari).toHaveAttribute('colspan', '2');
    expect(screen.getByRole('rowheader', { name: 'Leclerc' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'McLaren' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Norris' })).not.toBeInTheDocument();
  });
});

describe('PageHeader, Chip and Callout', () => {
  it('starts a page with its h1, subtitle and controls', () => {
    render(<PageHeader title="Progress" subtitle="Your pace at one track" icon={<svg />} aside={<button type="button">Track</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByText('Your pace at one track')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track' })).toBeInTheDocument();
  });

  it('is a toggle when pressed is set and a plain button otherwise', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip pressed={false} count={4} color="#ff8000" onClick={onClick}>
        Interliga
      </Chip>
    );
    const chip = screen.getByRole('button', { name: /^Interliga\s*4$/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip.style.getPropertyValue('--chip-color')).toBe('#ff8000');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Chip>Norris</Chip>);
    expect(screen.getByRole('button', { name: 'Norris' })).not.toHaveAttribute('aria-pressed');
  });

  it('shows a note with its tone and actions', () => {
    render(
      <Callout tone="warning" title="2 sessions without a driver" actions={<button type="button">Pick</button>}>
        Pick who you were to see them here.
      </Callout>
    );
    expect(screen.getByText('2 sessions without a driver').closest('[data-tone]')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByText('Pick who you were to see them here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick' })).toBeInTheDocument();
  });
});

describe('Panel, Stat, Badge, EmptyState and Skeleton', () => {
  it('names a panel region by its header title', () => {
    render(
      <Panel>
        <PanelHeader title="Pit strategy" subtitle="Service windows" actions={<button type="button">Clear</button>} />
      </Panel>
    );
    expect(screen.getByRole('region', { name: 'Pit strategy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Pit strategy' })).toBeInTheDocument();
  });

  it('pairs a stat label with its value', () => {
    render(<Stat label="Total laps" value="52 LAPS" />);
    expect(screen.getByRole('term')).toHaveTextContent('Total laps');
    expect(screen.getByRole('definition')).toHaveTextContent('52 LAPS');
  });

  it('marks a badge with its tone, or takes a custom colour', () => {
    const { rerender } = render(<Badge tone="warning">SC</Badge>);
    expect(screen.getByText('SC')).toHaveAttribute('data-tone', 'warning');
    rerender(<Badge color="#ff8000">McLaren</Badge>);
    expect(screen.getByText('McLaren').style.getPropertyValue('--badge-color')).toBe('#ff8000');
  });

  it('announces errors and loading', () => {
    render(
      <>
        <EmptyState tone="danger" title="Could not load sessions" action={<button type="button">Retry</button>} />
        <SkeletonGroup label="Loading sessions">
          <SkeletonRows rows={2} />
        </SkeletonGroup>
      </>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load sessions');
    expect(screen.getByRole('status')).toHaveTextContent('Loading sessions');
  });

  it('shapes a whole page, charts and chips while they load, hidden from screen readers', () => {
    const { container } = render(
      <>
        <SkeletonPage label="Loading..." />
        <SkeletonGroup label="Loading telemetry">
          <SkeletonCharts count={2} />
          <SkeletonChips count={3} />
        </SkeletonGroup>
      </>
    );
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual(['Loading...', 'Loading telemetry']);
    // Only the labels are read out; every placeholder is aria-hidden
    const shapes = container.querySelectorAll('[role="status"] > :not(.sr-only)');
    expect([...shapes].every((el) => el.closest('[aria-hidden="true"]'))).toBe(true);
  });
});
