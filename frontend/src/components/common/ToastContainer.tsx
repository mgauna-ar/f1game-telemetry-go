import React, { useContext } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../../store/useToastStore';
import { ToastContext } from '../../context/ToastContext';
import { useI18n } from '../../context/I18nContext';
import styles from './ToastContainer.module.css';

const TOAST_ICONS: Record<Toast['type'], React.ReactNode> = {
  success: <CheckCircle size={18} aria-hidden="true" />,
  error: <AlertTriangle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
};

export const ToastContainer: React.FC = () => {
  const { t } = useI18n();
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <div className={styles.stack} aria-live="polite" data-testid="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={styles.toast}
          data-type={toast.type}
          role={toast.type === 'error' ? 'alert' : undefined}
          data-testid={`toast-${toast.type}`}
        >
          {TOAST_ICONS[toast.type]}
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.onAction();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => dismissToast(toast.id)}
            aria-label={t('common.dismiss')}
            title={t('common.dismiss')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const StandaloneToastContainer: React.FC = () => {
  const isInsideToastProvider = useContext(ToastContext);
  if (isInsideToastProvider) return null;
  return <ToastContainer />;
};
