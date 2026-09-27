import type React from 'react';

/**
 * Click handler for a dialog's backdrop: closes on clicks on the backdrop itself, not on the
 * dialog, and keeps the dialog's clicks from reaching the page behind it.
 */
export const closeOnBackdropClick =
  (onClose: () => void) =>
  (event: React.MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
    if (event.target === event.currentTarget) onClose();
  };
