import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export interface ToastStore {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  showToast: ({ type, message, duration = 4000 }) => {
    const id = `toast-${Date.now()}-${++toastCounter}`;
    const newToast: Toast = { id, type, message, duration };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },
  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));
