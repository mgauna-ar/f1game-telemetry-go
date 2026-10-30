import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '../context/I18nProvider';
import { useToastStore } from '../store/useToastStore';
import { api } from '../utils/apiClient';
import { useShowWindow } from './useShowWindow';

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

describe('useShowWindow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the app for the window', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const { result } = renderHook(() => useShowWindow(), { wrapper });

    act(() => result.current('engineer'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/desktop/window', { window: 'engineer', path: undefined })
    );
  });

  it('says when the window did not open', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('the app has no window of its own here'));
    const { result } = renderHook(() => useShowWindow(), { wrapper });

    act(() => result.current('main'));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
        'The window didn’t open: the app has no window of its own here'
      )
    );
  });
});
