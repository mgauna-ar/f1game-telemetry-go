import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CopyValueButton } from './CopyValueButton';

describe('CopyValueButton', () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('copies the value and briefly shows it was copied', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<CopyValueButton value="192.168.1.20" />);
    const button = screen.getByRole('button', { name: 'Copy 192.168.1.20' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith('192.168.1.20');
    expect(button).toHaveAttribute('data-copied');

    act(() => {
      vi.runAllTimers();
    });
    expect(button).not.toHaveAttribute('data-copied');
  });

  it('does not claim to have copied when the clipboard is unavailable', async () => {
    render(<CopyValueButton value="127.0.0.1" />);
    const button = screen.getByRole('button', { name: 'Copy 127.0.0.1' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).not.toHaveAttribute('data-copied');
  });
});
