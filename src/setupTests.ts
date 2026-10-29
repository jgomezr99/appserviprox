// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect';

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
};

const ensureStorage = (name: 'localStorage' | 'sessionStorage') => {
  try {
    const storage = window[name];
    if (storage && typeof storage.clear === 'function') return;
  } catch {
    // jsdom can expose storage accessors without a usable origin.
  }

  const storage = createMemoryStorage();
  Object.defineProperty(window, name, { configurable: true, value: storage });
  Object.defineProperty(globalThis, name, { configurable: true, value: storage });
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');

// Mock matchmedia
window.matchMedia = window.matchMedia || function() {
  return {
      matches: false,
      addListener: function() {},
      removeListener: function() {}
  };
};
