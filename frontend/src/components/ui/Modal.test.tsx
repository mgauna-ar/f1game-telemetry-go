import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader } from './Modal';
import { useDialogLayer } from './useDialogLayer';

const Harness: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        isOpen={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        describedByBody
      >
        <ModalHeader title="Delete session" />
        <ModalBody>
          <ModalDescription>This cannot be undone.</ModalDescription>
        </ModalBody>
        <ModalFooter>
          <button type="button">Cancel</button>
          <button type="button">Delete</button>
        </ModalFooter>
      </Modal>
    </>
  );
};

const openModal = () => {
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a modal dialog named by its title and described by its body', () => {
    render(<Harness />);
    openModal();
    const dialog = screen.getByRole('dialog', { name: 'Delete session' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('moves focus in, keeps Tab inside and wraps at both ends', () => {
    render(<Harness />);
    openModal();
    const close = screen.getByRole('button', { name: 'Close' });
    const del = screen.getByRole('button', { name: 'Delete' });
    // The first real control gets focus, not the header's close button
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    del.focus();
    fireEvent.keyDown(del, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(del).toHaveFocus();
  });

  it('closes on Esc and gives focus back to the button that opened it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = openModal();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('closes on a backdrop click but not on a click inside the dialog', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openModal();
    fireEvent.click(screen.getByText('This cannot be undone.'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the header close button', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves an Esc that something inside already handled', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} aria-label="Pick">
        <input aria-label="Search" onKeyDown={(event) => event.key === 'Escape' && event.preventDefault()} />
      </Modal>
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

const Layer: React.FC<{ name: string; onClose: () => void; children?: React.ReactNode }> = ({
  name,
  onClose,
  children,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useDialogLayer({ isOpen: true, onClose, containerRef: ref });
  return (
    <div ref={ref} role="dialog" aria-label={name}>
      <button type="button">{name} action</button>
      {children}
    </div>
  );
};

describe('useDialogLayer', () => {
  it('lets only the newest layer answer Esc', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const { rerender } = render(<Layer name="Chat" onClose={closeOuter} />);
    rerender(
      <Layer name="Chat" onClose={closeOuter}>
        <Layer name="Settings" onClose={closeInner} />
      </Layer>
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    rerender(<Layer name="Chat" onClose={closeOuter} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });

  it('does not trap Tab in a non-modal layer', () => {
    render(
      <>
        <Layer name="Chat" onClose={vi.fn()} />
        <button type="button">Page</button>
      </>
    );
    const action = screen.getByRole('button', { name: 'Chat action' });
    expect(action).toHaveFocus();
    const event = fireEvent.keyDown(action, { key: 'Tab' });
    expect(event).toBe(true); // not prevented, so the browser moves on to the page
  });
});
