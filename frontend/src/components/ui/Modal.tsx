import React, { createContext, useContext, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { closeOnBackdropClick } from '../../utils/backdrop';
import { IconButton } from './Button';
import { cx } from './cx';
import { SKIP_AUTOFOCUS_ATTRIBUTE, useDialogLayer } from './useDialogLayer';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg';
/** Tints the header icon; `danger` also turns the title red, for destructive confirmations. */
export type ModalTone = 'neutral' | 'primary' | 'accent' | 'info' | 'warning' | 'danger';

interface ModalContextValue {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

const useModalContext = (component: string): ModalContextValue => {
  const value = useContext(ModalContext);
  if (!value) throw new Error(`${component} must be used inside a Modal`);
  return value;
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  /** `alertdialog` for confirmations that interrupt, such as deleting. */
  role?: 'dialog' | 'alertdialog';
  /** Name the dialog without a `ModalHeader` title. */
  'aria-label'?: string;
  /** Link a `ModalBody` paragraph (with `describes`) as the dialog's description. */
  describedByBody?: boolean;
  /** What to focus on open; defaults to the first control after the header's close button. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Close when the backdrop is clicked. */
  closeOnBackdrop?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * A modal dialog: rendered over the page in a portal, with `aria-modal`, Tab kept inside it, Esc
 * and backdrop clicks closing it, and focus returned to what opened it. Build its content from
 * `ModalHeader` (which names the dialog), `ModalBody` and `ModalFooter`.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  role = 'dialog',
  'aria-label': ariaLabel,
  describedByBody = false,
  initialFocusRef,
  closeOnBackdrop = true,
  className,
  'data-testid': testId,
}) => {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useDialogLayer({ isOpen, onClose, containerRef: dialogRef, trapFocus: true, initialFocusRef });

  if (!isOpen) return null;

  return createPortal(
    <ModalContext.Provider value={{ titleId, descriptionId, onClose }}>
      <div
        className={styles.overlay}
        role="presentation"
        onClick={closeOnBackdrop ? closeOnBackdropClick(onClose) : (event) => event.stopPropagation()}
      >
        <div
          ref={dialogRef}
          role={role}
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-describedby={describedByBody ? descriptionId : undefined}
          tabIndex={-1}
          className={cx(styles.dialog, styles[size], className)}
          data-testid={testId}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body
  );
};

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: ModalTone;
  /** Extra content under the title, such as tags. */
  children?: React.ReactNode;
  /** Hide the close button when the footer is the only way out. */
  hideClose?: boolean;
}

/** The dialog's title row. Its title names the dialog, and its close button calls `onClose`. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  tone = 'neutral',
  children,
  hideClose = false,
}) => {
  const { t } = useI18n();
  const { titleId, onClose } = useModalContext('ModalHeader');
  return (
    <header className={cx(styles.header, styles[tone])}>
      <div className={styles.heading}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          {children}
        </div>
      </div>
      {!hideClose && (
        <IconButton
          label={t('common.close')}
          className={styles.close}
          onClick={onClose}
          {...{ [SKIP_AUTOFOCUS_ATTRIBUTE]: true }}
        >
          <X size={18} />
        </IconButton>
      )}
    </header>
  );
};

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

/** The dialog's scrolling content. */
export const ModalBody: React.FC<ModalBodyProps> = ({ children, className }) => (
  <div className={cx(styles.body, className)}>{children}</div>
);

/** A paragraph that describes the dialog, for `describedByBody`. */
export const ModalDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  const { descriptionId } = useModalContext('ModalDescription');
  return (
    <p id={descriptionId} className={cx(styles.description, className)}>
      {children}
    </p>
  );
};

export interface ModalFooterProps {
  children: React.ReactNode;
  /** `between` puts the first child on the left, as for a "don't remind me" checkbox. */
  align?: 'end' | 'between';
}

/** The dialog's action row. */
export const ModalFooter: React.FC<ModalFooterProps> = ({ children, align = 'end' }) => (
  <footer className={cx(styles.footer, align === 'between' && styles.between)}>{children}</footer>
);
