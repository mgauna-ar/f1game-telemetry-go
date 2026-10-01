import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparatorPreferencesModal } from './ComparatorPreferencesModal';
import {
  resetComparatorPreferencesStore,
  useComparatorPreferencesStore,
} from '../../store/useComparatorPreferencesStore';

describe('ComparatorPreferencesModal Component', () => {
  beforeEach(() => {
    resetComparatorPreferencesStore();
    localStorage.clear();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ComparatorPreferencesModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByTestId('comparator-preferences-modal')).toBeNull();
  });

  it('renders correctly when open and loads initial storage preferences', () => {
    useComparatorPreferencesStore.setState({ preferences: { rivalMode: 'teammate', rivalDriverName: '' } });

    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        currentSlotBDriverName="Liam Lawson"
      />
    );

    expect(screen.getByTestId('comparator-preferences-modal')).toBeInTheDocument();
    // Your driver is picked per session now, not by a saved name
    expect(screen.queryByTestId('default-driver-name-input')).toBeNull();
    expect(screen.getByTestId('rival-mode-teammate-radio')).toBeChecked();
  });

  it('allows selecting rival modes', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    // Switch to driver mode
    const driverRadio = screen.getByTestId('rival-mode-driver-radio');
    fireEvent.click(driverRadio);
    expect(driverRadio).toBeChecked();

    // Type rival driver name
    const rivalInput = screen.getByTestId('rival-driver-name-input');
    fireEvent.change(rivalInput, { target: { value: 'Piastri' } });

    // Save
    const saveBtn = screen.getByTestId('save-preferences-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      rivalMode: 'driver',
      rivalDriverName: 'Piastri',
    });
    expect(handleClose).toHaveBeenCalled();
    // Saved for every device
    expect(useComparatorPreferencesStore.getState().preferences).toEqual({ rivalMode: 'driver', rivalDriverName: 'Piastri' });
  });

  it('supports the "use current driver" shortcut', () => {
    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        currentSlotBDriverName="Lando Norris"
      />
    );

    // Select driver mode
    const driverRadio = screen.getByTestId('rival-mode-driver-radio');
    fireEvent.click(driverRadio);

    const useDriverBBtn = screen.getByTestId('use-current-driver-b-btn');
    fireEvent.click(useDriverBBtn);

    const rivalInput = screen.getByTestId('rival-driver-name-input');
    expect(rivalInput).toHaveValue('Lando Norris');
  });

  it('leads to the comparator section of the settings page', () => {
    const handleClose = vi.fn();
    render(<ComparatorPreferencesModal isOpen={true} onClose={handleClose} onSave={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'All settings' });
    expect(link).toHaveAttribute('href', '/settings/comparator');
    fireEvent.click(link);
    expect(handleClose).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/settings/comparator');
  });

  it('closes on cancel and close button clicks', () => {
    const handleClose = vi.fn();
    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={handleClose}
        onSave={vi.fn()}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-preferences-btn');
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /^close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });
});
