import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAndValidateCatalog,
  getEnabledSources,
  getSettings,
  importCatalogFromJson,
  markSourcesFetched,
  patchSettings,
  refreshCatalog,
  setActiveCatalog,
  setSettings,
  validateCatalogJson,
} from '../../src/background/catalog';
import type { Catalog } from '../../src/models';
import { SettingsSchema, STORAGE_KEYS } from '../../src/models';
import { installChromeMock } from '../helpers';

let store: Map<string, unknown>;

beforeEach(() => {
  store = installChromeMock().store;
  vi.stubGlobal('fetch', () => Promise.reject(new Error('network disabled in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function catSource(overrides: Record<string, unknown>): Record<string, unknown> {
  return { name: 'S', url: 'https://example.com/feed', type: 'rss', enabled: true, tags: [], ...overrides };
}

function remoteCatalogResponse(sources: Record<string, unknown>[]): Response {
  return new Response(JSON.stringify({ version: 2, updatedAt: '2026-09-13', sources, blockedDomains: [] }), {
    status: 200,
  });
}

describe('validateCatalogJson', () => {
  it('accepts a minimal valid catalog', () => {
    const raw = JSON.stringify({ version: 1, updatedAt: '2026-09-13', sources: [], blockedDomains: [] });
    const result = validateCatalogJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.catalog.version).toBe(1);
  });

  it('rejects malformed JSON', () => {
    expect(validateCatalogJson('{oops')).toEqual({ ok: false, error: 'Invalid JSON file' });
  });

  it('reports schema violations with paths', () => {
    const result = validateCatalogJson('{"sources":[]}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Invalid catalog:/);
  });
});

describe('settings', () => {
  it('returns schema defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(SettingsSchema.parse({}));
  });

  it('merges partial updates over current settings', async () => {
    const updated = await setSettings({ theme: 'dark' });
    expect(updated.theme).toBe('dark');
    expect(updated.openIn).toBe(SettingsSchema.parse({}).openIn);
  });

  it('patches only on real changes', async () => {
    const first = await patchSettings({ theme: 'dark' });
    expect(first.changed).toBe(true);
    expect(first.settings.theme).toBe('dark');
    const second = await patchSettings({ theme: 'dark' });
    expect(second.changed).toBe(false);
  });
});

describe('getEnabledSources', () => {
  it('excludes disabled and snoozed sources, keeps expired snoozes', () => {
    const catalog = {
      version: 1,
      updatedAt: 't',
      blockedDomains: [],
      sources: [
        { id: 'on', name: 'On', url: 'https://on.com/f', type: 'rss', enabled: true },
        { id: 'off', name: 'Off', url: 'https://off.com/f', type: 'rss', enabled: false },
        {
          id: 'zzz',
          name: 'Zzz',
          url: 'https://zzz.com/f',
          type: 'rss',
          enabled: true,
          snoozedUntil: Date.now() + 10_000,
        },
        {
          id: 'wake',
          name: 'Wake',
          url: 'https://wake.com/f',
          type: 'rss',
          enabled: true,
          snoozedUntil: Date.now() - 10_000,
        },
      ],
    } as unknown as Catalog;
    expect(
      getEnabledSources(catalog)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['on', 'wake']);
    expect(getEnabledSources(null)).toEqual([]);
  });
});

describe('fetchAndValidateCatalog', () => {
  it('returns the parsed catalog on success', async () => {
    vi.stubGlobal('fetch', async () => remoteCatalogResponse([catSource({ id: 's1' })]));
    const catalog = await fetchAndValidateCatalog('https://example.com/catalog.json');
    expect(catalog?.sources.map((s) => s.id)).toEqual(['s1']);
  });

  it('returns null on HTTP errors, bad JSON, and schema violations', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    await expect(fetchAndValidateCatalog('https://example.com/c.json')).resolves.toBeNull();
    vi.stubGlobal('fetch', async () => new Response('not json', { status: 200 }));
    await expect(fetchAndValidateCatalog('https://example.com/c.json')).resolves.toBeNull();
    vi.stubGlobal('fetch', async () => new Response('{"sources":[]}', { status: 200 }));
    await expect(fetchAndValidateCatalog('https://example.com/c.json')).resolves.toBeNull();
  });
});

describe('refreshCatalog', () => {
  it('uses the local catalog in local mode without fetching', async () => {
    let fetched = false;
    vi.stubGlobal('fetch', async () => {
      fetched = true;
      throw new Error('must not fetch');
    });
    store.set(STORAGE_KEYS.SETTINGS, SettingsSchema.parse({ catalogMode: 'local' }));
    store.set(STORAGE_KEYS.LOCAL_CATALOG, {
      version: 9,
      updatedAt: 't',
      sources: [],
      blockedDomains: [],
    });
    const { catalog, fetched: didFetch } = await refreshCatalog();
    expect(fetched).toBe(false);
    expect(didFetch).toBe(false);
    expect(catalog?.version).toBe(9);
  });

  it('merges remote updates while preserving toggles and tracking', async () => {
    vi.stubGlobal('fetch', async () => remoteCatalogResponse([catSource({ id: 's1' }), catSource({ id: 's2' })]));
    store.set(STORAGE_KEYS.CATALOG, {
      version: 1,
      updatedAt: 'old',
      sources: [{ ...catSource({ id: 's1' }), enabled: false, errorCount: 3, lastFetched: 111 }],
      blockedDomains: ['kept.com'],
    });
    const { catalog, fetched } = await refreshCatalog();
    expect(fetched).toBe(true);
    const s1 = catalog?.sources.find((s) => s.id === 's1');
    expect(s1?.enabled).toBe(false);
    expect(s1?.errorCount).toBe(3);
    expect(s1?.lastFetched).toBe(111);
    expect(catalog?.sources.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect(catalog?.blockedDomains).toContain('kept.com');
    // New sources arrive with their own enabled state.
    expect(catalog?.sources.find((s) => s.id === 's2')?.enabled).toBe(true);
  });

  it('falls back to stored, then bundled, catalogs when remote fails', async () => {
    store.set(STORAGE_KEYS.CATALOG, {
      version: 1,
      updatedAt: 'old',
      sources: [catSource({ id: 's1' })],
      blockedDomains: [],
    });
    const stored = await refreshCatalog();
    expect(stored.fetched).toBe(false);
    expect(stored.catalog?.sources.map((s) => s.id)).toEqual(['s1']);

    store.clear();
    const bundled = await refreshCatalog();
    expect(bundled.fetched).toBe(false);
    expect(bundled.catalog?.sources.length).toBeGreaterThan(100);
  });
});

describe('importCatalogFromJson', () => {
  it('imports valid catalogs into local mode', async () => {
    const raw = JSON.stringify({
      version: 3,
      updatedAt: 't',
      sources: [catSource({ id: 'mine' })],
      blockedDomains: [],
    });
    const result = await importCatalogFromJson(raw);
    expect(result.ok).toBe(true);
    const settings = await getSettings();
    expect(settings.catalogMode).toBe('local');
    expect(store.get(STORAGE_KEYS.LOCAL_CATALOG)).toMatchObject({ version: 3 });
  });

  it('rejects invalid input without touching storage', async () => {
    const result = await importCatalogFromJson('{oops');
    expect(result.ok).toBe(false);
    expect(store.has(STORAGE_KEYS.LOCAL_CATALOG)).toBe(false);
  });
});

describe('setActiveCatalog', () => {
  const catalog = {
    version: 1,
    updatedAt: 't',
    sources: [],
    blockedDomains: [],
  } as unknown as Catalog;

  it('writes to the local catalog in local mode', async () => {
    store.set(STORAGE_KEYS.SETTINGS, SettingsSchema.parse({ catalogMode: 'local' }));
    await setActiveCatalog(catalog);
    expect(store.get(STORAGE_KEYS.LOCAL_CATALOG)).toEqual(catalog);
    expect(store.has(STORAGE_KEYS.CATALOG)).toBe(false);
  });

  it('writes to the remote catalog otherwise', async () => {
    await setActiveCatalog(catalog);
    expect(store.get(STORAGE_KEYS.CATALOG)).toEqual(catalog);
  });
});

describe('markSourcesFetched', () => {
  it('is a no-op for empty updates', async () => {
    await markSourcesFetched(new Map());
    expect(store.has(STORAGE_KEYS.CATALOG)).toBe(false);
  });

  it('is a no-op without a catalog and ignores unknown ids', async () => {
    await markSourcesFetched(new Map([['ghost', { errorCountDelta: 1 }]]));
    expect(store.has(STORAGE_KEYS.CATALOG)).toBe(false);
    const catalog = {
      version: 1,
      updatedAt: 't',
      sources: [catSource({ id: 's1' })],
      blockedDomains: [],
    };
    store.set(STORAGE_KEYS.CATALOG, catalog);
    await markSourcesFetched(new Map([['ghost', { errorCountDelta: 1 }]]));
    expect(store.get(STORAGE_KEYS.CATALOG)).toEqual(catalog);
  });
});
