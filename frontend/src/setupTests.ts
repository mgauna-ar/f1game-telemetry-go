import '@testing-library/jest-dom';
import { vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock fetch in Node/JSDOM test environment to ensure tests are isolated and never leak HTTP traffic to a running backend
  globalThis.fetch = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', configured: false }),
      text: async () => '',
    } as Response);
  });
}
