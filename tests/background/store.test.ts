import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearUserData,
  loadStore,
  removeStore,
  saveStore,
  saveStoreMany,
  updateStore,
} from '../../src/background/store';
import { STORAGE_KEYS } from '../../src/models';
import { installChromeMock } from '../helpers';

let store: Map<string, unknown>;

beforeEach(() => {
  store = installChromeMock().store;
});

const StringSchema = z.string();

describe('loadStore', () => {
  it('returns the fallback when nothing is stored', async () => {
    expect(await loadStore(STORAGE_KEYS.ARTICLES, StringSchema, 'fallback')).toBe('fallback');
  });

  it('returns stored values that validate', async () => {
    store.set(STORAGE_KEYS.ARTICLES, 'hello');
    expect(await loadStore(STORAGE_KEYS.ARTICLES, StringSchema, 'fallback')).toBe('hello');
  });

  it('falls back on schema violations instead of flowing bad data through', async () => {
    store.set(STORAGE_KEYS.ARTICLES, 42);
    expect(await loadStore(STORAGE_KEYS.ARTICLES, StringSchema, 'fallback')).toBe('fallback');
  });
});

describe('saveStore / saveStoreMany', () => {
  it('persists single and multiple keys', async () => {
    await saveStore(STORAGE_KEYS.ARTICLES, 'a');
    await saveStoreMany({ [STORAGE_KEYS.READ_HISTORY]: 'h', [STORAGE_KEYS.STARRED]: 's' });
    expect(store.get(STORAGE_KEYS.ARTICLES)).toBe('a');
    expect(store.get(STORAGE_KEYS.READ_HISTORY)).toBe('h');
    expect(store.get(STORAGE_KEYS.STARRED)).toBe('s');
  });
});

describe('updateStore', () => {
  it('modifies freshly loaded data and returns the result', async () => {
    store.set(STORAGE_KEYS.ROLL_HISTORY, ['a']);
    const next = await updateStore(STORAGE_KEYS.ROLL_HISTORY, z.array(z.string()), [], (history) => ['b', ...history]);
    expect(next).toEqual(['b', 'a']);
    expect(store.get(STORAGE_KEYS.ROLL_HISTORY)).toEqual(['b', 'a']);
  });

  it('seeds from the fallback when nothing is stored', async () => {
    const next = await updateStore(STORAGE_KEYS.ROLL_HISTORY, z.array(z.string()), [], (history) => ['b', ...history]);
    expect(next).toEqual(['b']);
  });
});

describe('removeStore', () => {
  it('removes one key or many', async () => {
    store.set(STORAGE_KEYS.ARTICLES, 'a');
    store.set(STORAGE_KEYS.STARRED, 's');
    await removeStore(STORAGE_KEYS.ARTICLES);
    expect(store.has(STORAGE_KEYS.ARTICLES)).toBe(false);
    await removeStore([STORAGE_KEYS.STARRED, STORAGE_KEYS.READ_HISTORY]);
    expect(store.has(STORAGE_KEYS.STARRED)).toBe(false);
  });
});

describe('clearUserData', () => {
  it('clears generated data but keeps settings and catalog state', async () => {
    store.set(STORAGE_KEYS.SETTINGS, { theme: 'dark' });
    store.set(STORAGE_KEYS.CATALOG, { version: 1 });
    store.set(STORAGE_KEYS.ARTICLES, ['a']);
    store.set(STORAGE_KEYS.READ_HISTORY, ['h']);
    store.set(STORAGE_KEYS.STARRED, { x: 1 });
    await clearUserData();
    expect(store.get(STORAGE_KEYS.SETTINGS)).toEqual({ theme: 'dark' });
    expect(store.get(STORAGE_KEYS.CATALOG)).toEqual({ version: 1 });
    expect(store.has(STORAGE_KEYS.ARTICLES)).toBe(false);
    expect(store.has(STORAGE_KEYS.READ_HISTORY)).toBe(false);
    expect(store.has(STORAGE_KEYS.STARRED)).toBe(false);
  });
});
