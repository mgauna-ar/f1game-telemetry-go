import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  it('prefixes the app name with the view title and follows changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Session History' },
    });
    expect(document.title).toBe('Session History · F1 Telemetry');

    rerender({ title: 'P4 · L12/29 · Melbourne' });
    expect(document.title).toBe('P4 · L12/29 · Melbourne · F1 Telemetry');
  });

  it('falls back to the default title without one', () => {
    renderHook(() => useDocumentTitle(null));
    expect(document.title).toBe('F1 Telemetry — Real-Time Telemetry & Pit Wall');
  });
});
