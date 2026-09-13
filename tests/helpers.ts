import { vi } from 'vitest';

/**
 * In-memory `chrome.storage.local` for background-module tests. Modules
 * under test only touch storage inside the functions under test, so
 * installing the global once per file is enough. Returns the backing
 * store (assert against it) plus a per-test reset.
 */
export function installChromeMock(): { store: Map<string, unknown>; reset: () => void } {
  const store = new Map<string, unknown>();
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
        set: async (values: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(values)) store.set(k, v);
        },
        remove: async (keys: string | string[]) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
        },
      },
    },
  });
  return { store, reset: () => store.clear() };
}
