import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  SessionHistoryProvider,
  useSessionHistoryData,
  useSessionHistoryActions,
} from './SessionHistoryContext';
import { RaceEngineerProvider } from './RaceEngineerProvider';
import { I18nProvider } from './I18nProvider';

describe('SessionHistoryContext', () => {
  it('throws error when useSessionHistoryData is used outside SessionHistoryProvider', () => {
    expect(() => {
      renderHook(() => useSessionHistoryData());
    }).toThrow('useSessionHistoryData must be used within a SessionHistoryProvider');
  });

  it('throws error when useSessionHistoryActions is used outside SessionHistoryProvider', () => {
    expect(() => {
      renderHook(() => useSessionHistoryActions());
    }).toThrow('useSessionHistoryActions must be used within a SessionHistoryProvider');
  });

  it('provides data and actions when rendered within provider hierarchy', () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>
        <RaceEngineerProvider>
          <SessionHistoryProvider>{children}</SessionHistoryProvider>
        </RaceEngineerProvider>
      </I18nProvider>
    );

    const { result: dataResult } = renderHook(() => useSessionHistoryData(), { wrapper });
    const { result: actionsResult } = renderHook(() => useSessionHistoryActions(), { wrapper });

    expect(dataResult.current.sessions).toEqual([]);
    expect(dataResult.current.searchQuery).toBe('');
    expect(typeof actionsResult.current.setSearchQuery).toBe('function');
    expect(typeof actionsResult.current.fetchSessions).toBe('function');
  });
});
