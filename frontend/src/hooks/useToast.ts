import { useToastStore, type Toast } from '../store/useToastStore';

export function useToast() {
  const toasts = useToastStore((s) => s.toasts);
  const showToast = useToastStore((s) => s.showToast);
  const dismissToast = useToastStore((s) => s.dismissToast);
  const clearToasts = useToastStore((s) => s.clearToasts);

  return { toasts, showToast, dismissToast, clearToasts };
}

export { useToastStore, type Toast };
