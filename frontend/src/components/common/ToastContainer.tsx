import React, { useContext } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../../store/useToastStore';
import { ToastContext } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} />;
      case 'error':
        return <AlertTriangle size={18} />;
      case 'info':
        return <Info size={18} />;
    }
  };

  const getToastBackground = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.95)';
      case 'error':
        return 'rgba(239, 68, 68, 0.95)';
      case 'info':
        return 'rgba(0, 242, 254, 0.95)';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '2rem',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid={`toast-${toast.type}`}
          style={{
            pointerEvents: 'auto',
            background: getToastBackground(toast.type),
            color: toast.type === 'info' ? '#000' : '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in-out',
            maxWidth: '420px',
          }}
        >
          {getToastIcon(toast.type)}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.8,
            }}
            title="Dismiss"
          >
            <X size={14} />
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
