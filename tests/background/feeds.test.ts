import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addReadHistory,
  clearOldArticles,
  fetchSource,
  filterArticles,
  getArticles,
  getRandomArticle,
  markArticleRead,
  recordRoll,
  refreshRandomBatch,
  resolveArticleTitle,
  toggleStarred,
} from '../../src/background/feeds';
import type { Article, Catalog, Settings, Source } from '../../src/models';
import { SettingsSchema, STORAGE_KEYS } from '../../src/models';
import { DAY_MS } from '../../src/utils';
import { installChromeMock } from '../helpers';

let store: Map<string, unknown>;

beforeEach(() => {
  store = installChromeMock().store;
  // No real network in tests: every suite below overrides fetch as needed.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('network disabled in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recordRoll', () => {
  it('starts a streak of 1 and counts the source', async () => {
    const stats = await recordRoll('techcrunch');
    expect(stats).toEqual({ streak: 1, previousSourceId: null });
    expect(store.get(STORAGE_KEYS.ROLL_STATS)).toEqual({ streak: 1, sourceCounts: { techcrunch: 1 } });
    expect(store.get(STORAGE_KEYS.ROLL_HISTORY)).toEqual(['techcrunch']);
  });

  it('extends the streak and count on repeat rolls', async () => {
    await recordRoll('techcrunch');
    const stats = await recordRoll('techcrunch');
    expect(stats).toEqual({ streak: 2, previousSourceId: 'techcrunch' });
    expect(store.get(STORAGE_KEYS.ROLL_STATS)).toEqual({ streak: 2, sourceCounts: { techcrunch: 2 } });
  });

  it('resets the streak on source change but preserves all-time counts', async () => {
    await recordRoll('techcrunch');
    const stats = await recordRoll('espn');
    expect(stats).toEqual({ streak: 1, previousSourceId: 'techcrunch' });
    expect(store.get(STORAGE_KEYS.ROLL_STATS)).toEqual({ streak: 1, sourceCounts: { techcrunch: 1, espn: 1 } });
  });

  it('falls back cleanly on corrupted stored stats', async () => {
    store.set(STORAGE_KEYS.ROLL_STATS, { garbage: true });
    const stats = await recordRoll('techcrunch');
    expect(stats.streak).toBe(1);
    expect(store.get(STORAGE_KEYS.ROLL_STATS)).toEqual({ streak: 1, sourceCounts: { techcrunch: 1 } });
  });

  it('caps roll history at the ten most recent', async () => {
    for (let i = 0; i < 12; i++) await recordRoll(`s${i}`);
    expect(store.get(STORAGE_KEYS.ROLL_HISTORY)).toEqual([
      's11',
      's10',
      's9',
      's8',
      's7',
      's6',
      's5',
      's4',
      's3',
      's2',
    ]);
  });

  it('recovers from corrupted roll history', async () => {
    store.set(STORAGE_KEYS.ROLL_HISTORY, 'junk');
    const stats = await recordRoll('techcrunch');
    expect(stats).toEqual({ streak: 1, previousSourceId: null });
    expect(store.get(STORAGE_KEYS.ROLL_HISTORY)).toEqual(['techcrunch']);
  });

  it('prunes source counts past the cap, dropping the least-rolled', async () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1001; i++) counts[`s${i}`] = i + 1;
    store.set(STORAGE_KEYS.ROLL_STATS, { streak: 1, sourceCounts: counts });
    await recordRoll('s1000');
    const stored = store.get(STORAGE_KEYS.ROLL_STATS) as { sourceCounts: Record<string, number> };
    expect(Object.keys(stored.sourceCounts)).toHaveLength(1000);
    expect(stored.sourceCounts.s1000).toBe(1002);
    expect(stored.sourceCounts.s0).toBeUndefined();
  });
});

describe('settings defaults', () => {
  it('ships explorer mode off', () => {
    expect(SettingsSchema.parse({}).explorerMode).toBe(false);
  });
});

function article(overrides: Partial<Article> & { id: string }): Article {
  return {
    sourceId: 's1',
    title: 'Test article title',
    url: `https://s1.com/${overrides.id}`,
    fetchedAt: Date.now(),
    read: false,
    starred: false,
    ...overrides,
  };
}

describe('toggleStarred', () => {
  it('stars and unstars through the map', async () => {
    const a = article({ id: 'a1' });
    expect(await toggleStarred(a)).toBe(true);
    expect(store.get(STORAGE_KEYS.STARRED)).toEqual({
      a1: { id: 'a1', url: a.url, title: a.title, sourceId: 's1' },
    });
    expect(await toggleStarred(a, false)).toBe(false);
    expect(store.get(STORAGE_KEYS.STARRED)).toEqual({});
  });

  it('patches pool entries so flags survive re-fetches', async () => {
    store.set(STORAGE_KEYS.ARTICLES, [article({ id: 'a1' })]);
    expect(await toggleStarred(article({ id: 'a1' }))).toBe(true);
    expect(await getArticles()).toMatchObject([{ id: 'a1', starred: true }]);
  });
});

describe('clearOldArticles', () => {
  it('drops old unstarred articles but keeps starred and fresh ones', async () => {
    store.set(STORAGE_KEYS.ARTICLES, [
      article({ id: 'old', fetchedAt: Date.now() - 100 * DAY_MS }),
      article({ id: 'old-starred', fetchedAt: Date.now() - 100 * DAY_MS, starred: true }),
      article({ id: 'fresh' }),
    ]);
    await clearOldArticles(90);
    const remaining = store.get(STORAGE_KEYS.ARTICLES) as Article[];
    expect(remaining.map((a) => a.id).sort()).toEqual(['fresh', 'old-starred']);
  });
});

describe('markArticleRead', () => {
  it('records history with the catalog source name', async () => {
    store.set(STORAGE_KEYS.CATALOG, {
      version: 1,
      updatedAt: '2026-09-13',
      sources: [{ id: 's1', name: 'Tech Source', url: 'https://s1.com/feed', type: 'rss' }],
      blockedDomains: [],
    });
    await markArticleRead(article({ id: 'a1', title: 'A story I opened' }));
    const history = store.get(STORAGE_KEYS.READ_HISTORY) as Array<{ title: string; sourceName?: string }>;
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('A story I opened');
    expect(history[0].sourceName).toBe('Tech Source');
  });
});

function feedSource(overrides: Partial<Source> & { id: string }): Source {
  return {
    name: 'Feed Source',
    url: 'https://example.com/feed',
    type: 'rss',
    enabled: true,
    tags: [],
    errorCount: 0,
    feeds: [],
    ...overrides,
  };
}

function catalogWith(sources: Source[], blockedDomains: string[] = []): Catalog {
  return { version: 1, updatedAt: '2026-09-13', sources, blockedDomains };
}

function testSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...SettingsSchema.parse({}), ...overrides };
}

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Feed</title>
<item><title>First fetch story</title><link>https://example.com/a1</link><pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Second fetch story</title><link>https://example.com/a2</link><pubDate>Tue, 02 Sep 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

function stubFetchOk(): void {
  vi.stubGlobal('fetch', async () => new Response(FEED_XML, { status: 200 }));
}

describe('filterArticles', () => {
  it('applies the global max age, with 0 disabling the filter', () => {
    const articles = [
      article({ id: 'new', publishedAt: Date.now() - 2 * DAY_MS }),
      article({ id: 'old', publishedAt: Date.now() - 10 * DAY_MS }),
    ];
    expect(filterArticles(articles, testSettings({ maxAgeDays: 7 }), null).map((a) => a.id)).toEqual(['new']);
    expect(filterArticles(articles, testSettings({ maxAgeDays: 0 }), null)).toHaveLength(2);
  });

  it('lets per-source max age override the global setting', () => {
    const articles = [
      article({ id: 'a', sourceId: 's1', publishedAt: Date.now() - 10 * DAY_MS }),
      article({ id: 'b', sourceId: 's2', publishedAt: Date.now() - 10 * DAY_MS }),
    ];
    const catalog = catalogWith([feedSource({ id: 's1', maxAgeDays: 30 }), feedSource({ id: 's2' })]);
    const result = filterArticles(articles, testSettings({ maxAgeDays: 7 }), catalog);
    expect(result.map((a) => a.id)).toEqual(['a']);
  });

  it('disables aging for unlisted sources when the global age is 0', () => {
    const articles = [article({ id: 'a', sourceId: 's2', publishedAt: Date.now() - 300 * DAY_MS })];
    const catalog = catalogWith([feedSource({ id: 's1', maxAgeDays: 30 }), feedSource({ id: 's2' })]);
    expect(filterArticles(articles, testSettings({ maxAgeDays: 0 }), catalog).map((a) => a.id)).toEqual(['a']);
  });

  it('falls back to everything when unread_only has no unread articles', () => {
    const articles = [article({ id: 'a', read: true }), article({ id: 'b', read: true })];
    expect(filterArticles(articles, testSettings({ selectionMode: 'unread_only' }), null)).toHaveLength(2);
    expect(
      filterArticles(
        [article({ id: 'c', read: true }), article({ id: 'd' })],
        testSettings({ selectionMode: 'unread_only' }),
        null,
      ).map((a) => a.id),
    ).toEqual(['d']);
  });

  it('selects only starred articles in starred_only mode', () => {
    const articles = [article({ id: 'a', starred: true }), article({ id: 'b' })];
    expect(filterArticles(articles, testSettings({ selectionMode: 'starred_only' }), null).map((a) => a.id)).toEqual([
      'a',
    ]);
  });

  it('matches keywords case-insensitively by title', () => {
    const articles = [
      article({ id: 'a', title: 'A Rust story about systems' }),
      article({ id: 'b', title: 'A pasta recipe for dinner' }),
    ];
    const settings = testSettings({ keywordsInclude: ['RUST'] });
    expect(filterArticles(articles, settings, null).map((a) => a.id)).toEqual(['a']);
    expect(filterArticles(articles, testSettings({ keywordsExclude: ['pasta'] }), null).map((a) => a.id)).toEqual([
      'a',
    ]);
  });

  it('filters tags in any/all modes and honors excludes', () => {
    const catalog = catalogWith([
      feedSource({ id: 's1', tags: ['technology', 'news'] }),
      feedSource({ id: 's2', tags: ['technology'] }),
      feedSource({ id: 's3', tags: ['sports'] }),
    ]);
    const articles = [
      article({ id: 'a', sourceId: 's1' }),
      article({ id: 'b', sourceId: 's2' }),
      article({ id: 'c', sourceId: 's3' }),
    ];
    const any = filterArticles(articles, testSettings({ includeTags: ['news'] }), catalog);
    expect(any.map((a) => a.id)).toEqual(['a']);
    const all = filterArticles(
      articles,
      testSettings({ includeTags: ['technology', 'news'], tagMatchMode: 'all' }),
      catalog,
    );
    expect(all.map((a) => a.id)).toEqual(['a']);
    const excluded = filterArticles(articles, testSettings({ excludeTags: ['sports'] }), catalog);
    expect(excluded.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('blocks exact and subdomain matches only', () => {
    const catalog = catalogWith([], ['example.com']);
    const articles = [
      article({ id: 'a', url: 'https://example.com/x' }),
      article({ id: 'b', url: 'https://sub.example.com/y' }),
      article({ id: 'c', url: 'https://other.com/z' }),
    ];
    expect(filterArticles(articles, testSettings(), catalog).map((a) => a.id)).toEqual(['c']);
  });
});

describe('fetchSource', () => {
  it('parses fetched feeds into articles', async () => {
    stubFetchOk();
    const articles = await fetchSource(feedSource({ id: 's1' }));
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({ sourceId: 's1', url: 'https://example.com/a1' });
  });

  it('returns [] when every feed URL fails', async () => {
    expect(await fetchSource(feedSource({ id: 's1' }))).toEqual([]);
    vi.stubGlobal('fetch', async () => new Response('err', { status: 500 }));
    expect(await fetchSource(feedSource({ id: 's1' }))).toEqual([]);
  });

  it('merges multiple feed urls and dedupes overlap', async () => {
    stubFetchOk();
    const articles = await fetchSource(feedSource({ id: 's1', feeds: ['https://example.com/second'] }));
    expect(articles).toHaveLength(2);
  });
});

describe('resolveArticleTitle', () => {
  // Unique ids per test: the title cache lives in module state and would
  // otherwise leak resolutions across tests.
  const sitemapEntry = (id: string) => article({ id, title: 'Sitemap Entry', url: `https://s1.com/${id}` });

  it('passes normal articles through untouched', async () => {
    const a = article({ id: 'a' });
    await expect(resolveArticleTitle(a)).resolves.toBe(a);
  });

  it('resolves, patches the pool, and caches the title', async () => {
    store.set(STORAGE_KEYS.ARTICLES, [sitemapEntry('sm:1')]);
    vi.stubGlobal('fetch', async () => new Response('<html><head><title>Real Title</title></head></html>'));
    const resolved = await resolveArticleTitle(sitemapEntry('sm:1'));
    expect(resolved.title).toBe('Real Title');
    const pool = store.get(STORAGE_KEYS.ARTICLES) as Article[];
    expect(pool[0].title).toBe('Real Title');
    // Cache hit: fetch now fails, the title still resolves.
    vi.stubGlobal('fetch', () => Promise.reject(new Error('down')));
    await expect(resolveArticleTitle(sitemapEntry('sm:1'))).resolves.toMatchObject({ title: 'Real Title' });
  });

  it('keeps the placeholder when the page has no usable title', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html><body>no title</body></html>'));
    await expect(resolveArticleTitle(sitemapEntry('sm:2'))).resolves.toMatchObject({ title: 'Sitemap Entry' });
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));
    await expect(resolveArticleTitle(sitemapEntry('sm:3'))).resolves.toMatchObject({ title: 'Sitemap Entry' });
  });

  it('keeps the placeholder when the fetch itself throws', async () => {
    await expect(resolveArticleTitle(sitemapEntry('sm:9'))).resolves.toMatchObject({ title: 'Sitemap Entry' });
  });
});

describe('getRandomArticle', () => {
  it('picks from the pool when enabled sources have articles', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' }), feedSource({ id: 's2' })]));
    store.set(STORAGE_KEYS.ARTICLES, [
      article({ id: 'a1', sourceId: 's1', title: 'Pool story one' }),
      article({ id: 'a2', sourceId: 's2', title: 'Pool story two' }),
    ]);
    const picked = await getRandomArticle();
    expect(['a1', 'a2']).toContain(picked?.id);
  });

  it('returns null when the pool is empty and fetches fail', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    await expect(getRandomArticle()).resolves.toBeNull();
  });

  it('fetches on demand when the pool is empty and feeds work', async () => {
    stubFetchOk();
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    const picked = await getRandomArticle();
    expect(picked?.sourceId).toBe('s1');
    expect(['https://example.com/a1', 'https://example.com/a2']).toContain(picked?.url);
  });

  it('ignores pool articles from disabled sources', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', enabled: false })]));
    store.set(STORAGE_KEYS.ARTICLES, [article({ id: 'a1', sourceId: 's1' })]);
    await expect(getRandomArticle()).resolves.toBeNull();
  });

  it('returns null in starred_only mode with nothing starred', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    store.set(STORAGE_KEYS.ARTICLES, [article({ id: 'a1', sourceId: 's1' })]);
    store.set(STORAGE_KEYS.SETTINGS, SettingsSchema.parse({ selectionMode: 'starred_only' }));
    await expect(getRandomArticle()).resolves.toBeNull();
  });

  it('returns null in deep mode with no enabled sources', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', enabled: false })]));
    await expect(getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' })).resolves.toBeNull();
  });
});

describe('refreshRandomBatch', () => {
  it('reports when no catalog is loaded', async () => {
    await expect(refreshRandomBatch()).resolves.toEqual({ fetched: 0, added: 0, error: 'No catalog loaded' });
  });

  it('fetches, stores, and tracks sources; reruns add nothing new', async () => {
    stubFetchOk();
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' }), feedSource({ id: 's2' })]));
    const first = await refreshRandomBatch(10);
    expect(first).toMatchObject({ fetched: 2, added: 2 });
    const pool = store.get(STORAGE_KEYS.ARTICLES) as Article[];
    expect(pool).toHaveLength(2);
    const stored = store.get(STORAGE_KEYS.CATALOG) as Catalog;
    for (const s of stored.sources) {
      expect(s.lastFetched).toEqual(expect.any(Number));
      expect(s.errorCount).toBe(0);
    }
    const second = await refreshRandomBatch(10);
    expect(second).toMatchObject({ fetched: 2, added: 0 });
  });

  it('reports when every source fails', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    await expect(refreshRandomBatch(10)).resolves.toEqual({
      fetched: 0,
      added: 0,
      error: 'All sources failed to fetch',
    });
  });

  it('reports when no sources are enabled', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', enabled: false })]));
    await expect(refreshRandomBatch(10)).resolves.toEqual({
      fetched: 0,
      added: 0,
      error: 'No enabled sources',
    });
  });

  it('enforces the pool cap keeping starred and newest articles', async () => {
    stubFetchOk();
    // ~7KB titles with distinct leading tokens: ~8.6MB total trips the 7MB
    // cap with only ~1.2k articles, and distinct buckets keep dedupe linear.
    // (40k same-bucket articles once turned this test quadratic.)
    const bulk: Article[] = [];
    for (let i = 0; i < 1200; i++) {
      bulk.push(
        article({
          id: `bulk${i}`,
          title: `Word${i} bulk import story ${'x'.repeat(7000)}`,
          fetchedAt: Date.now() - 30 * DAY_MS,
        }),
      );
    }
    bulk.push(article({ id: 'keeper', title: 'y'.repeat(100), fetchedAt: Date.now() - 60 * DAY_MS, starred: true }));
    store.set(STORAGE_KEYS.ARTICLES, bulk);
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    const result = await refreshRandomBatch(10);
    expect(result.fetched).toBe(1);
    const pool = await getArticles();
    expect(pool.length).toBeLessThan(bulk.length + 1);
    expect(pool.map((a) => a.id)).toContain('keeper');
    expect(pool.map((a) => a.url)).toContain('https://example.com/a1');
  }, 10_000);
});

describe('deep rolls', () => {
  function routeFetch(url: string): Response {
    if (url.includes('wp-json')) return new Response('no', { status: 404 });
    return new Response(FEED_XML, { status: 200 });
  }

  it('falls back through the page-1 path when no index exists', async () => {
    vi.stubGlobal('fetch', async (input: unknown) => routeFetch(String(input)));
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', url: 'https://example.com/feed' })]));
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
  });

  it('fetches a deep page when depth is already known', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.stubGlobal('fetch', async (input: unknown) => {
      const url = String(input);
      if (url.includes('paged=')) return new Response(FEED_XML, { status: 200 });
      return new Response('no', { status: 404 });
    });
    store.set(STORAGE_KEYS.SOURCE_DEPTH, { s1: 5 });
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', url: 'https://example.com/feed' })]));
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
  });

  it('uses the catalog archive template when no index exists', async () => {
    vi.stubGlobal('fetch', async () => new Response(FEED_XML, { status: 200 }));
    store.set(STORAGE_KEYS.SOURCE_DEPTH, { s1: 0 });
    store.set(
      STORAGE_KEYS.CATALOG,
      catalogWith([
        feedSource({
          id: 's1',
          url: 'https://example.com/feed',
          archive: { template: 'https://example.com/archive?p={n}', maxPages: 50 },
        }),
      ]),
    );
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
  });

  it('shrinks learned depth after a paged miss and falls back to the feed', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.stubGlobal('fetch', async (input: unknown) => {
      const url = String(input);
      if (url.includes('paged=') || url.includes('page=')) return new Response('gone', { status: 404 });
      return new Response(FEED_XML, { status: 200 });
    });
    store.set(STORAGE_KEYS.SOURCE_DEPTH, { s1: 5 });
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', url: 'https://example.com/feed' })]));
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
    expect(store.get(STORAGE_KEYS.SOURCE_DEPTH)).toEqual({ s1: 4 });
  });

  it('gives up on deep rolls when every source fails', async () => {
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1' })]));
    await expect(getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' })).resolves.toBeNull();
  });

  it('learns depth from the WordPress index when available', async () => {
    vi.stubGlobal('fetch', async (input: unknown) => {
      const url = String(input);
      if (url.includes('wp-json')) {
        return new Response('[]', { status: 200, headers: { 'x-wp-totalpages': '25' } });
      }
      return new Response(FEED_XML, { status: 200 });
    });
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', url: 'https://example.com/feed' })]));
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
    // ceil(25 posts / 10 per page) = 3 feed pages, remembered for later rolls.
    expect(store.get(STORAGE_KEYS.SOURCE_DEPTH)).toEqual({ s1: 3 });
  });

  it('treats a garbage page count as no index', async () => {
    vi.stubGlobal('fetch', async (input: unknown) => {
      const url = String(input);
      if (url.includes('wp-json')) {
        return new Response('[]', { status: 200, headers: { 'x-wp-totalpages': 'banana' } });
      }
      return new Response(FEED_XML, { status: 200 });
    });
    store.set(STORAGE_KEYS.CATALOG, catalogWith([feedSource({ id: 's1', url: 'https://example.com/feed' })]));
    const picked = await getRandomArticle({ ...SettingsSchema.parse({}), discoveryMode: 'deep' });
    expect(picked?.sourceId).toBe('s1');
    expect(store.get(STORAGE_KEYS.SOURCE_DEPTH)).toEqual({ s1: 0 });
  });
});

describe('addReadHistory', () => {
  it('caps history at 200 entries, newest first', async () => {
    for (let i = 0; i < 201; i++) {
      await addReadHistory({ id: `h${i}`, title: 't', url: `https://x.com/${i}`, sourceId: 's', openedAt: i });
    }
    const history = store.get(STORAGE_KEYS.READ_HISTORY) as Array<{ id: string }>;
    expect(history).toHaveLength(200);
    expect(history[0].id).toBe('h200');
  });
});
