import '@testing-library/jest-dom';

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

  // Polyfill/wrap fetch in Node/JSDOM environment for relative API URLs
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      let url = input;
      if (typeof input === 'string' && input.startsWith('/')) {
        url = `http://localhost:8080${input}`;
      }
      return originalFetch(url, init).catch(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ configured: false }),
          text: async () => '',
        } as Response);
      });
    };
  }
}
