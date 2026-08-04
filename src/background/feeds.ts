import type { Article, Catalog, Settings, Source } from '../models';
import { STORAGE_KEYS } from '../models';
import { parseFeed } from '../providers';
import { extractPageTitle, fetchWithTimeout, getErrorMessage, hostnameOf, normalizeDomain } from '../utils';
import { getCatalog, getEnabledSources, getSettings, setActiveCatalog } from './catalog';
import { addReadHistory, getReadHistory, getStarredMap, setStarred as setStarredInStore } from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Number of sources fetched on install or startup. */
const BATCH_SIZE_STARTUP = 20;
/** Number of sources fetched per background alarm cycle. */
const BATCH_SIZE_ALARM = 10;
/** Max simultaneous feed fetch requests. */
const BATCH_CONCURRENCY = 4;
/** Max live-fetch attempts when the stored pool is empty or fully filtered. */
const MAX_ON_DEMAND_ATTEMPTS = 8;
/** Max entries in the title cache (per-URL title for sitemap entries). */
const TITLE_CACHE_MAX = 5_000;
/** Pool soft cap in bytes; oldest non-starred articles are dropped first. */
const POOL_CAP_BYTES = 7 * 1024 * 1024;
/** How many recent source IDs to remember for diversity weighting. */
const ROLL_HISTORY_LENGTH = 10;

export { BATCH_SIZE_ALARM, BATCH_SIZE_STARTUP };

// ─── Article pool ─────────────────────────────────────────────────────────────

export async function getArticles(): Promise<Article[]> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.ARTICLES)) as Record<string, unknown>;
  return (result[STORAGE_KEYS.ARTICLES] as Article[]) || [];
}

async function setArticles(articles: Article[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ARTICLES]: articles });
}

function deduplicateArticles(articles: Article[]): Article[] {
  const seenId = new Set<string>();
  const seenUrl = new Set<string>();
  return articles.filter((article) => {
    const normUrl = article.url.toLowerCase().replace(/\/+$/, '');
    if (seenId.has(article.id) || seenUrl.has(normUrl)) return false;
    seenId.add(article.id);
    seenUrl.add(normUrl);
    return true;
  });
}

// ─── Title cache ──────────────────────────────────────────────────────────────

let inMemoryTitleCache: Record<string, string> | null = null;

async function getTitleCache(): Promise<Record<string, string>> {
  if (inMemoryTitleCache !== null) return inMemoryTitleCache;
  const result = (await chrome.storage.local.get(STORAGE_KEYS.TITLE_CACHE)) as Record<string, unknown>;
  inMemoryTitleCache = (result[STORAGE_KEYS.TITLE_CACHE] as Record<string, string>) || {};
  return inMemoryTitleCache;
}

async function cacheTitle(id: string, title: string): Promise<void> {
  const cache = await getTitleCache();
  cache[id] = title;
  const ids = Object.keys(cache);
  if (ids.length > TITLE_CACHE_MAX) {
    for (const k of ids.slice(0, ids.length - TITLE_CACHE_MAX)) delete cache[k];
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.TITLE_CACHE]: cache });
}

/** Fetch a real <title> for generic sitemap entries and persist it (cache + pool).
 *  Accepts optional existingArticles array to avoid redundant storage reads. */
export async function resolveArticleTitle(article: Article, existingArticles?: Article[]): Promise<Article> {
  if (article.title !== 'Sitemap Entry') return article;

  const cache = await getTitleCache();
  const cached = cache[article.id];
  if (cached) return { ...article, title: cached };

  try {
    const response = await fetchWithTimeout(article.url, { timeout: 10000 });
    if (!response.ok) return article;
    const html = await response.text();
    const title = extractPageTitle(html);
    if (!title) return article;

    await cacheTitle(article.id, title);

    const articles = existingArticles ?? (await getArticles());
    const idx = articles.findIndex((a) => a.id === article.id);
    if (idx >= 0) {
      articles[idx] = { ...articles[idx], title };
      await setArticles(articles);
    }
    return { ...article, title };
  } catch (error) {
    console.error(`Failed to resolve title for ${article.url}:`, getErrorMessage(error));
    return article;
  }
}

// ─── Pool cap ─────────────────────────────────────────────────────────────────

/**
 * Estimate the serialized byte size of one article.
 * Accounts for JSON property names + typical overhead so the cap is
 * more accurate than just summing string character counts.
 */
function estimateArticleBytes(a: Article): number {
  // Sum of field name lengths (id, sourceId, title, url, author, publishedAt,
  // fetchedAt, read, starred) + values + JSON punctuation/quotes ≈ 120 bytes base.
  return a.id.length + a.sourceId.length + a.title.length + a.url.length + (a.author?.length ?? 0) + 120;
}

/** Keep the stored pool under POOL_CAP_BYTES by dropping the oldest
 *  non-starred articles first, newest kept. */
function enforcePoolCap(articles: Article[]): Article[] {
  const total = articles.reduce((acc, a) => acc + estimateArticleBytes(a), 0);
  if (total <= POOL_CAP_BYTES) return articles;

  const starred = articles.filter((a) => a.starred);
  const nonStarred = articles.filter((a) => !a.starred).sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0));

  const keep = new Set<Article>(starred);
  let acc = starred.reduce((sum, a) => sum + estimateArticleBytes(a), 0);
  for (const a of nonStarred) {
    if (acc + estimateArticleBytes(a) > POOL_CAP_BYTES) break;
    keep.add(a);
    acc += estimateArticleBytes(a);
  }
  return [...keep];
}

// ─── Feed fetching ────────────────────────────────────────────────────────────

export async function fetchSource(source: Source): Promise<Article[]> {
  const urls = [...new Set([source.url, ...(source.feeds ?? [])])];
  try {
    const results = await Promise.allSettled(urls.map((url) => fetchWithTimeout(url, { timeout: 15000 })));
    const okTexts: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status === 'fulfilled' && res.value.ok) {
        okTexts.push(await res.value.text());
      } else {
        const reason = res.status === 'rejected' ? getErrorMessage(res.reason) : `HTTP ${res.value.status}`;
        console.warn(`[${source.name}] Feed ${urls[i]} failed: ${reason}`);
      }
    }

    if (okTexts.length === 0) {
      throw new Error(`All ${urls.length} feed URLs failed`);
    }

    const parsed = okTexts.map((xml) => parseFeed(source, xml));
    return deduplicateArticles(parsed.flat());
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, getErrorMessage(error));
    return [];
  }
}

// ─── Article filtering ────────────────────────────────────────────────────────

/**
 * Pre-normalize blocked domains once rather than on every filterArticles call.
 * This is cheap and avoids redundant URL parsing in the hot path.
 */
function normalizeBlockedDomains(domains: string[]): string[] {
  return [...new Set(domains.map(normalizeDomain).filter(Boolean))];
}

/**
 * Pure filter over an article list, mirroring the user's selection settings.
 * `selectionMode: 'unread_only'` only filters out already-read items when the
 * caller provides read flags; on-demand fetches treat fresh items as unread.
 */
function filterArticles(
  articles: Article[],
  settings: Settings,
  catalog: Catalog | null,
  normalizedBlockedDomains?: string[],
): Article[] {
  let result = articles;

  // Age filtering: per-source maxAgeDays overrides the global setting. When a
  // source has no override, the global setting applies; 0 disables the filter.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const sourceMaxAge = new Map<string, number>();
  for (const source of catalog?.sources ?? []) {
    if (typeof source.maxAgeDays === 'number') sourceMaxAge.set(source.id, source.maxAgeDays);
  }
  const globalMaxAge = settings.maxAgeDays ?? 0;
  if (globalMaxAge > 0 || sourceMaxAge.size > 0) {
    const now = Date.now();
    result = result.filter((a) => {
      const days = sourceMaxAge.get(a.sourceId) ?? globalMaxAge;
      if (days <= 0) return true;
      return (a.publishedAt || a.fetchedAt) >= now - days * DAY_MS;
    });
  }

  const selectionMode = settings.selectionMode ?? 'unread_only';
  if (selectionMode === 'unread_only') {
    const unread = result.filter((a) => !a.read);
    if (unread.length > 0) result = unread;
  } else if (selectionMode === 'starred_only') {
    result = result.filter((a) => a.starred);
  }

  const keywordsInclude = settings.keywordsInclude ?? [];
  if (keywordsInclude.length > 0) {
    result = result.filter((a) => {
      const text = `${a.title}`.toLowerCase();
      return keywordsInclude.some((kw: string) => text.includes(kw.toLowerCase()));
    });
  }

  const keywordsExclude = settings.keywordsExclude ?? [];
  if (keywordsExclude.length > 0) {
    result = result.filter((a) => {
      const text = `${a.title}`.toLowerCase();
      return !keywordsExclude.some((kw: string) => text.includes(kw.toLowerCase()));
    });
  }

  const includeTags = settings.includeTags ?? [];
  const excludeTags = settings.excludeTags ?? [];
  if (includeTags.length > 0 || excludeTags.length > 0) {
    const tagBySource = new Map<string, string[]>();
    for (const source of catalog?.sources ?? []) {
      tagBySource.set(source.id, source.tags ?? []);
    }
    const matchMode = settings.tagMatchMode ?? 'any';
    result = result.filter((article) => {
      const tags = tagBySource.get(article.sourceId) ?? [];
      if (excludeTags.length > 0 && tags.some((tag) => excludeTags.includes(tag))) {
        return false;
      }
      if (includeTags.length > 0) {
        if (matchMode === 'all') {
          if (!includeTags.every((tag) => tags.includes(tag))) return false;
        } else if (!includeTags.some((tag) => tags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }

  // Use pre-normalized domains if provided (avoids redundant normalization in hot path).
  const blockedDomains = normalizedBlockedDomains ?? normalizeBlockedDomains(catalog?.blockedDomains ?? []);
  if (blockedDomains.length > 0) {
    result = result.filter((a) => {
      const host = hostnameOf(a.url);
      return !blockedDomains.some((d) => host === d || host.endsWith(`.${d}`));
    });
  }

  return result;
}

// ─── Source diversity & roll tracking ─────────────────────────────────────────

export async function getRollHistory(): Promise<string[]> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.ROLL_HISTORY)) as Record<string, unknown>;
  return (result[STORAGE_KEYS.ROLL_HISTORY] as string[]) || [];
}

export interface RollStats {
  streak: number;
  previousSourceId: string | null;
}

/** Record a rolled source and return the consecutive same-source streak.
 *  The previous source is derived from rollHistory[0] — the redundant
 *  `lastSourceId` field in rollStats is never written (old values are ignored). */
export async function recordRoll(sourceId: string): Promise<RollStats> {
  const history = await getRollHistory();
  const previousSourceId = history[0] ?? null;

  const result = (await chrome.storage.local.get(STORAGE_KEYS.ROLL_STATS)) as Record<string, unknown>;
  const stats = result[STORAGE_KEYS.ROLL_STATS] as { streak?: number } | undefined;
  const streak = previousSourceId === sourceId ? (stats?.streak ?? 1) + 1 : 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.ROLL_STATS]: { streak } });
  await chrome.storage.local.set({
    [STORAGE_KEYS.ROLL_HISTORY]: [sourceId, ...history].slice(0, ROLL_HISTORY_LENGTH),
  });
  return { streak, previousSourceId };
}

/**
 * Diversity weighting: sources rolled recently get a lower weight so rolls
 * spread across the catalog "when possible", but repeats still happen — which
 * is what powers the lucky-streak feature.
 */
function sourceWeight(sourceId: string, history: string[]): number {
  const count = history.filter((id) => id === sourceId).length;
  return 1 / (1 + count * 2);
}

function pickWeighted<T>(items: T[], weight: (item: T) => number): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Batch refresh ────────────────────────────────────────────────────────────

export interface BatchResult {
  fetched: number;
  added: number;
  /** Set when the batch could not run or nothing could be fetched. */
  error?: string;
}

/**
 * Refresh a random slice of the catalog instead of every source: fast, no
 * two-minute stalls, and the whole catalog is covered over successive cycles.
 */
export async function refreshRandomBatch(size = BATCH_SIZE_ALARM): Promise<BatchResult> {
  const catalog = await getCatalog();
  if (!catalog) return { fetched: 0, added: 0, error: 'No catalog loaded' };

  const enabled = getEnabledSources(catalog);
  if (enabled.length === 0) return { fetched: 0, added: 0, error: 'No enabled sources' };

  const sorted = [...enabled].sort((a, b) => (a.lastFetched ?? 0) - (b.lastFetched ?? 0));
  const batch = sorted.slice(0, size);

  const existing = await getArticles();
  const newArticles: Article[] = [];
  let fetched = 0;
  const now = Date.now();
  const byId = new Map(catalog.sources.map((s) => [s.id, s]));

  for (let i = 0; i < batch.length; i += BATCH_CONCURRENCY) {
    const chunk = batch.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((source) => fetchSource(source)));
    for (let j = 0; j < chunk.length; j++) {
      const source = chunk[j];
      const articles = results[j];
      const current = byId.get(source.id);
      if (articles.length > 0) {
        fetched++;
        newArticles.push(...articles);
        if (current) byId.set(source.id, { ...current, lastFetched: now, errorCount: 0 });
      } else if (current) {
        byId.set(source.id, { ...current, errorCount: (current.errorCount ?? 0) + 1 });
      }
    }
  }

  await setActiveCatalog({ ...catalog, sources: [...byId.values()] });

  if (newArticles.length > 0) {
    const combined = [...existing, ...newArticles];
    const deduped = deduplicateArticles(combined);
    const capped = enforcePoolCap(deduped);
    const existingIds = new Set(existing.map((a) => a.id));
    const added = capped.filter((a) => !existingIds.has(a.id)).length;
    await setArticles(capped);
    return { fetched, added };
  }

  return { fetched, added: 0, error: fetched > 0 ? 'No new articles were added' : 'All sources failed to fetch' };
}

// ─── Random selection ─────────────────────────────────────────────────────────

/**
 * Live, on-demand random article: pick a random enabled source, fetch just its
 * feed, and return a random matching article. Retries up to a handful of random
 * sources when a feed fails or yields nothing that passes the filters, so a
 * stale or empty pool never blocks a fresh result.
 */
export async function fetchRandomArticles(settings: Settings): Promise<Article | null> {
  const catalog = await getCatalog();
  const sources = getEnabledSources(catalog);
  if (sources.length === 0) return null;

  const starredMap = await getStarredMap();
  const readHistory = await getReadHistory();
  const readIds = new Set(readHistory.map((h: { id: string }) => h.id));
  const history = await getRollHistory();
  const tried = new Set<string>();

  // Pre-normalize blocked domains once for all filter calls in this loop.
  const blockedDomains = normalizeBlockedDomains(catalog?.blockedDomains ?? []);

  for (let attempt = 0; attempt < MAX_ON_DEMAND_ATTEMPTS && tried.size < sources.length; attempt++) {
    const remaining = sources.filter((s) => !tried.has(s.id));
    if (remaining.length === 0) break;
    const source = pickWeighted(remaining, (s) => sourceWeight(s.id, history));
    if (!source) break;
    tried.add(source.id);

    const articles = await fetchSource(source);
    if (articles.length === 0) continue;

    const candidates = articles.map((a) => ({
      ...a,
      read: readIds.has(a.id),
      starred: Boolean(starredMap[a.id]),
    }));
    const filtered = filterArticles(candidates, settings, catalog, blockedDomains);
    if (filtered.length === 0) continue;

    const picked = filtered[Math.floor(Math.random() * filtered.length)];
    return resolveArticleTitle(picked);
  }

  return null;
}

export async function getRandomArticle(settings?: Settings): Promise<Article | null> {
  const opts = settings ?? (await getSettings());
  const articles = await getArticles();

  if (articles.length > 0) {
    const catalog = await getCatalog();
    const enabledIds = new Set(getEnabledSources(catalog).map((s) => s.id));
    const fromEnabled = articles.filter((a) => enabledIds.has(a.sourceId));
    if (fromEnabled.length > 0) {
      const starredMap = await getStarredMap();
      const history = await getRollHistory();
      const flagged = fromEnabled.map((a) => (starredMap[a.id] ? { ...a, starred: true } : a));
      // Pre-normalize blocked domains once.
      const blockedDomains = normalizeBlockedDomains(catalog?.blockedDomains ?? []);
      const filtered = filterArticles(flagged, opts, catalog, blockedDomains);
      if (filtered.length > 0) {
        const picked = pickWeighted(filtered, (a) => sourceWeight(a.sourceId, history));
        // Pass the already-loaded pool so resolveArticleTitle can patch titles in
        // place without a second chrome.storage read.
        if (picked) return resolveArticleTitle(picked, articles);
      }
    }
  }

  return fetchRandomArticles(opts);
}

// ─── Read & starred state ─────────────────────────────────────────────────────

export async function markArticleRead(article: Article): Promise<void> {
  const articles = await getArticles();
  const idx = articles.findIndex((a) => a.id === article.id);
  if (idx >= 0) {
    articles[idx] = { ...articles[idx], read: true };
    await setArticles(articles);
  }

  const catalog = await getCatalog();
  const source = catalog?.sources.find((s) => s.id === article.sourceId);
  await addReadHistory({
    id: article.id,
    title: article.title,
    url: article.url,
    sourceId: article.sourceId,
    sourceName: source?.name,
    author: article.author,
    openedAt: Date.now(),
  });
}

export async function toggleStarred(article: Article, starred?: boolean): Promise<boolean> {
  const articles = await getArticles();
  const idx = articles.findIndex((a) => a.id === article.id);
  const next = starred ?? (idx >= 0 ? !articles[idx].starred : true);
  if (idx >= 0) {
    articles[idx] = { ...articles[idx], starred: next };
    await setArticles(articles);
  }
  await setStarredInStore(article, next);
  return next;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function clearOldArticles(maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<void> {
  const articles = await getArticles();
  const cutoff = Date.now() - maxAge;
  const filtered = articles.filter((a) => a.fetchedAt > cutoff || a.starred);
  await setArticles(filtered);
}
