import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Menu } from './Menu';

const setup = () => {
  const onExport = vi.fn();
  const onDelete = vi.fn();
  const onRow = vi.fn();
  render(
    // A clickable row around the button, as in the session list
    <div role="presentation" onClick={onRow}>
      <Menu
        label="More actions"
        items={[
          { key: 'export', label: 'Export', onSelect: onExport },
          { key: 'tags', label: 'Tags', onSelect: vi.fn(), disabled: true },
          { key: 'delete', label: 'Delete', onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  );
  return { onExport, onDelete, onRow, button: screen.getByRole('button', { name: 'More actions' }) };
};

describe('Menu', () => {
  it('opens on a click without clicking the row, and runs an item', () => {
    const { button, onExport, onRow } = setup();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'More actions' })).toBeInTheDocument();
    expect(onRow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(onRow).not.toHaveBeenCalled();
  });

  it('moves between enabled items with the arrows and closes on Esc', () => {
    const { button, onDelete } = setup();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus();

    // The disabled item is skipped, and the arrows wrap
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();

    // The up arrow opens on the last item
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('closes on a click outside', () => {
    const { button } = setup();
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
