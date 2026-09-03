import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparatorPreferencesModal } from './ComparatorPreferencesModal';
import { saveComparatorPreferences } from '../../utils/comparatorPreferencesUtils';

describe('ComparatorPreferencesModal Component', () => {
  beforeEach(() => {
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
    saveComparatorPreferences({
      defaultDriverName: 'Verstappen',
      rivalMode: 'teammate',
      rivalDriverName: '',
    });

    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        currentSlotADriverName="Max Verstappen"
        currentSlotBDriverName="Liam Lawson"
      />
    );

    expect(screen.getByTestId('comparator-preferences-modal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Verstappen')).toBeInTheDocument();
    expect(screen.getByTestId('rival-mode-teammate-radio')).toBeChecked();
  });

  it('allows changing driver name and selecting rival modes', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    // Change reference driver name
    const driverInput = screen.getByTestId('default-driver-name-input');
    fireEvent.change(driverInput, { target: { value: 'Norris' } });
    expect(driverInput).toHaveValue('Norris');

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
      defaultDriverName: 'Norris',
      rivalMode: 'driver',
      rivalDriverName: 'Piastri',
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('supports "use current driver" shortcuts', () => {
    render(
      <ComparatorPreferencesModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        currentSlotADriverName="Max Verstappen"
        currentSlotBDriverName="Lando Norris"
      />
    );

    const useDriverABtn = screen.getByTestId('use-current-driver-a-btn');
    fireEvent.click(useDriverABtn);

    const driverInput = screen.getByTestId('default-driver-name-input');
    expect(driverInput).toHaveValue('Max Verstappen');

    // Select driver mode
    const driverRadio = screen.getByTestId('rival-mode-driver-radio');
    fireEvent.click(driverRadio);

    const useDriverBBtn = screen.getByTestId('use-current-driver-b-btn');
    fireEvent.click(useDriverBBtn);

    const rivalInput = screen.getByTestId('rival-driver-name-input');
    expect(rivalInput).toHaveValue('Lando Norris');
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

    const closeBtn = screen.getByTestId('close-preferences-modal-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
