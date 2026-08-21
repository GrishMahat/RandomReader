import type { ZodType } from 'zod';
import type { StorageKey } from '../models';
import { STORAGE_KEYS } from '../models';

/**
 * The single seam over chrome.storage.local.
 *
 * Every read goes through a Zod schema so corrupted or stale storage data
 * degrades to a fallback instead of flowing into the pool builder as a blind
 * cast. Writes are centralized here so multi-key updates can be issued
 * atomically in one chrome.storage call.
 */

export async function loadStore<T>(key: StorageKey, schema: ZodType<T>, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  const stored = result[key];
  if (stored === undefined) return fallback;
  const parsed = schema.safeParse(stored);
  if (!parsed.success) {
    console.warn(`store: invalid data for "${key}", using fallback:`, parsed.error.message);
    return fallback;
  }
  return parsed.data;
}

export async function saveStore(key: StorageKey, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function saveStoreMany(values: Partial<Record<StorageKey, unknown>>): Promise<void> {
  await chrome.storage.local.set(values);
}

export async function removeStore(keys: StorageKey | StorageKey[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}

/**
 * Read-modify-write through one primitive: `fn` receives freshly loaded,
 * validated data and its result is persisted in the same call chain.
 * All pool/history mutations should go through here so races concentrate
 * in one place instead of spreading across callers.
 */
export async function updateStore<T>(
  key: StorageKey,
  schema: ZodType<T>,
  fallback: T,
  fn: (current: T) => T,
): Promise<T> {
  const current = await loadStore(key, schema, fallback);
  const next = fn(current);
  await saveStore(key, next);
  return next;
}

/** Keys holding user-generated data; settings and catalog state survive a clear. */
const KEEP_KEYS: readonly StorageKey[] = [
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.CATALOG,
  STORAGE_KEYS.CATALOG_VERSION,
  STORAGE_KEYS.LOCAL_CATALOG,
];

/** Clear all user-generated data (pool, history, stars, roll tracking, title cache). */
export async function clearUserData(): Promise<void> {
  const keys = (Object.values(STORAGE_KEYS) as StorageKey[]).filter((k) => !KEEP_KEYS.includes(k));
  await removeStore(keys);
}
