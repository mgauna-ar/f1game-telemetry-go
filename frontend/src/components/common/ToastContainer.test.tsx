import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ToastContainer } from './ToastContainer';
import { useToastStore } from '../../store/useToastStore';

describe('ToastContainer Component', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
  });

  it('keeps an empty live region when there are no toasts, so later toasts are announced', () => {
    render(<ToastContainer />);
    const region = screen.getByTestId('toast-container');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('announces error toasts as alerts', () => {
    useToastStore.getState().showToast({ type: 'error', message: 'Failed to delete' });
    useToastStore.getState().showToast({ type: 'success', message: 'Session imported' });
    render(<ToastContainer />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete');
    expect(screen.getByTestId('toast-success')).not.toHaveAttribute('role');
  });

  it('renders active toasts with dismiss button', () => {
    useToastStore.getState().showToast({ type: 'success', message: 'Session imported' });
    useToastStore.getState().showToast({ type: 'error', message: 'Failed to delete' });

    render(<ToastContainer />);

    expect(screen.getByText('Session imported')).toBeDefined();
    expect(screen.getByText('Failed to delete')).toBeDefined();

    const dismissBtns = screen.getAllByTitle('Dismiss');
    expect(dismissBtns).toHaveLength(2);

    fireEvent.click(dismissBtns[0]);
    expect(screen.queryByText('Session imported')).toBeNull();
    expect(screen.getByText('Failed to delete')).toBeDefined();
  });
});
