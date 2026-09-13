import { z } from 'zod';
import type { Article, Catalog, HistoryEntry, Settings, Source, StarredMap } from '../models';
import { ArticleSchema, HistoryEntrySchema, STORAGE_KEYS, StarredMapSchema } from '../models';
import { parseFeed } from '../providers';
import { DAY_MS, extractPageTitle, fetchWithTimeout, getErrorMessage, hostnameOf, normalizeDomain } from '../utils';
import { getCatalog, getEnabledSources, getSettings, markSourcesFetched } from './catalog';
import { deduplicateArticles } from './dedup';
import type { ScoringContext } from './scoring';
import {
  MAX_SOURCE_COUNTS,
  makeScoringContext,
  pickScored,
  pickWeighted,
  presetFor,
  sourceDiversityWeight,
} from './scoring';
import { loadStore, saveStore, saveStoreMany, updateStore } from './store';

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
/** Default assumed pagination depth when a source hasn't been probed yet. */
const DEEP_DEFAULT_DEPTH = 10;
/** Max sources tried per deep roll before falling back to recent behavior. */
const DEEP_MAX_ATTEMPTS = 4;
/** Hard ceiling for learned pagination depth. */
const MAX_LEARNED_DEPTH = 200_000;
/** WordPress feeds show the site's "posts per page" setting; 10 is the default. */
const FEED_POSTS_PER_PAGE = 10;
/** Timeout for resolving a real page title. */
const TITLE_TIMEOUT_MS = 10_000;
/** Timeout for fetching one source's feed(s). */
const FEED_TIMEOUT_MS = 15_000;
/** Max entries kept in reading history. */
const HISTORY_CAP = 200;

export { BATCH_SIZE_ALARM, BATCH_SIZE_STARTUP };

// ─── Schemas for store reads ─────────────────────────────────────────────────

const ArticlesSchema = z.array(ArticleSchema);
const TitleCacheSchema = z.record(z.string(), z.string());
const RollHistorySchema = z.array(z.string());
const RollStatsSchema = z.object({
  streak: z.number(),
  sourceCounts: z.record(z.string(), z.number()).default({}),
});
const HistoryListSchema = z.array(HistoryEntrySchema);

// ─── Article pool ─────────────────────────────────────────────────────────────

export async function getArticles(): Promise<Article[]> {
  return loadStore(STORAGE_KEYS.ARTICLES, ArticlesSchema, []);
}

async function patchArticle(id: string, patch: Partial<Article>): Promise<void> {
  await updateStore(STORAGE_KEYS.ARTICLES, ArticlesSchema, [], (articles) => {
    const idx = articles.findIndex((a) => a.id === id);
    if (idx < 0) return articles;
    const next = [...articles];
    next[idx] = { ...next[idx], ...patch };
    return next;
  });
}

// ─── Title cache ──────────────────────────────────────────────────────────────

let inMemoryTitleCache: Record<string, string> | null = null;

async function getTitleCache(): Promise<Record<string, string>> {
  if (inMemoryTitleCache !== null) return inMemoryTitleCache;
  inMemoryTitleCache = await loadStore(STORAGE_KEYS.TITLE_CACHE, TitleCacheSchema, {});
  return inMemoryTitleCache;
}

async function cacheTitle(id: string, title: string): Promise<void> {
  const cache = await getTitleCache();
  cache[id] = title;
  const ids = Object.keys(cache);
  if (ids.length > TITLE_CACHE_MAX) {
    for (const k of ids.slice(0, ids.length - TITLE_CACHE_MAX)) delete cache[k];
  }
  await saveStore(STORAGE_KEYS.TITLE_CACHE, cache);
}

/** Fetch a real <title> for generic sitemap entries and persist it (cache + pool). */
export async function resolveArticleTitle(article: Article): Promise<Article> {
  if (article.title !== 'Sitemap Entry') return article;

  const cache = await getTitleCache();
  const cached = cache[article.id];
  if (cached) return { ...article, title: cached };

  try {
    const response = await fetchWithTimeout(article.url, { timeout: TITLE_TIMEOUT_MS });
    if (!response.ok) return article;
    const html = await response.text();
    const title = extractPageTitle(html);
    if (!title) return article;

    await cacheTitle(article.id, title);

    // Patch only this article through the store's read-modify-write primitive
    // so we never write back a stale snapshot of the whole pool.
    await patchArticle(article.id, { title });
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
    const results = await Promise.allSettled(urls.map((url) => fetchWithTimeout(url, { timeout: FEED_TIMEOUT_MS })));
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
 * Exported for unit tests; callers pass pre-normalized blocked domains.
 * `selectionMode: 'unread_only'` only filters out already-read items when the
 * caller provides read flags; on-demand fetches treat fresh items as unread.
 */
export function filterArticles(
  articles: Article[],
  settings: Settings,
  catalog: Catalog | null,
  normalizedBlockedDomains?: string[],
): Article[] {
  let result = articles;

  // Age filtering: per-source maxAgeDays overrides the global setting. When a
  // source has no override, the global setting applies; 0 disables the filter.
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

// ─── Roll tracking ─────────────────────────────────────────────────────────────

export async function getRollHistory(): Promise<string[]> {
  return loadStore(STORAGE_KEYS.ROLL_HISTORY, RollHistorySchema, []);
}

export interface RollStats {
  streak: number;
  previousSourceId: string | null;
}

/** All-time roll counts per source (the serendipity long window). Old
 *  installs without the field fall back to empty via the schema default. */
async function getRollStats(): Promise<{ streak: number; sourceCounts: Record<string, number> }> {
  return loadStore(STORAGE_KEYS.ROLL_STATS, RollStatsSchema, { streak: 1, sourceCounts: {} });
}

/** Drop the least-rolled sources when the map somehow outgrows the catalog
 *  by an order of magnitude; ~140 ids in practice, so this never triggers. */
function pruneSourceCounts(counts: Record<string, number>): Record<string, number> {
  const entries = Object.entries(counts);
  if (entries.length <= MAX_SOURCE_COUNTS) return counts;
  entries.sort((a, b) => a[1] - b[1]);
  return Object.fromEntries(entries.slice(entries.length - MAX_SOURCE_COUNTS));
}

/** Record a rolled source and return the consecutive same-source streak.
 *  The previous source is derived from rollHistory[0]. The legacy
 *  `lastSourceId` field is never written or read.
 *
 *  Stats and history are written in ONE chrome.storage call so a crash
 *  between them can never leave streak and history inconsistent. */
export async function recordRoll(sourceId: string): Promise<RollStats> {
  const [history, stats] = await Promise.all([getRollHistory(), getRollStats()]);
  const previousSourceId = history[0] ?? null;
  const streak = previousSourceId === sourceId ? (stats.streak || 1) + 1 : 1;
  const sourceCounts = pruneSourceCounts({
    ...stats.sourceCounts,
    [sourceId]: (stats.sourceCounts[sourceId] ?? 0) + 1,
  });
  await saveStoreMany({
    [STORAGE_KEYS.ROLL_STATS]: { streak, sourceCounts },
    [STORAGE_KEYS.ROLL_HISTORY]: [sourceId, ...history].slice(0, ROLL_HISTORY_LENGTH),
  });
  return { streak, previousSourceId };
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

  let fetched = 0;
  const newArticles: Article[] = [];
  const now = Date.now();
  const sourceUpdates = new Map<string, { lastFetched?: number; errorCountDelta?: number; errorCount?: number }>();

  for (let i = 0; i < batch.length; i += BATCH_CONCURRENCY) {
    const chunk = batch.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((source) => fetchSource(source)));
    for (let j = 0; j < chunk.length; j++) {
      const source = chunk[j];
      const articles = results[j];
      if (articles.length > 0) {
        fetched++;
        newArticles.push(...articles);
        sourceUpdates.set(source.id, { lastFetched: now, errorCount: 0 });
      } else {
        sourceUpdates.set(source.id, { errorCountDelta: 1 });
      }
    }
  }

  // Go through the catalog module's dedicated seam instead of reaching into
  // its storage keys directly.
  await markSourcesFetched(sourceUpdates);

  if (newArticles.length > 0) {
    // Read the pool FRESH after fetching (the fetch loop takes seconds and
    // users can starve/read articles meanwhile); existing entries win the
    // dedupe so their read/starred flags are never clobbered by re-fetches.
    const fresh = await getArticles();
    const combined = deduplicateArticles([...fresh, ...newArticles]);
    const capped = enforcePoolCap(combined);
    const freshIds = new Set(fresh.map((a) => a.id));
    const added = capped.filter((a) => !freshIds.has(a.id)).length;
    await saveStore(STORAGE_KEYS.ARTICLES, capped);
    return { fetched, added };
  }

  return { fetched, added: 0, error: fetched > 0 ? 'No new articles were added' : 'All sources failed to fetch' };
}

// ─── Deep rolls ───────────────────────────────────────────────────────────────

const SourceDepthSchema = z.record(z.string(), z.number());

/**
 * Learned pagination depth per source. Deep rolls pick a random page in
 * [1, depth]; a miss (empty page) shrinks the remembered depth so later
 * rolls stop wasting attempts past the site's real maximum. A stored 0 is
 * a sentinel meaning "no WordPress index available; don't re-probe".
 */
async function getSourceDepths(): Promise<Record<string, number>> {
  return loadStore(STORAGE_KEYS.SOURCE_DEPTH, SourceDepthSchema, {});
}

async function rememberSourceDepth(sourceId: string, depth: number): Promise<void> {
  await updateStore(STORAGE_KEYS.SOURCE_DEPTH, SourceDepthSchema, {}, (depths) => ({
    ...depths,
    [sourceId]: Math.max(2, Math.min(depth, MAX_LEARNED_DEPTH)),
  }));
}

async function rememberNoIndex(sourceId: string): Promise<void> {
  await updateStore(STORAGE_KEYS.SOURCE_DEPTH, SourceDepthSchema, {}, (depths) => ({
    ...depths,
    [sourceId]: 0,
  }));
}

/**
 * Ask the site's WordPress REST API for its exact post count. With
 * `per_page=1` the X-WP-TotalPages header equals total posts, which converts
 * to feed pages via the default posts-per-page. Returns null for non-WP
 * sites, disabled REST routes, or blocked requests.
 */
async function probeWpTotalPages(source: Source): Promise<number | null> {
  let origin: string | null = null;
  try {
    origin = new URL(source.url).origin;
  } catch {
    return null;
  }
  try {
    const res = await fetchWithTimeout(`${origin}/wp-json/wp/v2/posts?per_page=1&_fields=id`, {
      timeout: FEED_TIMEOUT_MS,
    });
    if (!res.ok) return null;
    const total = Number(res.headers.get('x-wp-totalpages'));
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.ceil(total / FEED_POSTS_PER_PAGE);
  } catch {
    return null;
  }
}

/** WordPress-style pagination variants; ~34% of the catalog responds to one of these. */
function pagedVariants(url: string, page: number): string[] {
  const sep = url.includes('?') ? '&' : '?';
  return [`${url}${sep}paged=${page}`, `${url}${sep}page=${page}`];
}

/** Fetch page N of a paginated feed; null when both variants come back empty. */
async function fetchPagedArticles(source: Source, page: number): Promise<Article[] | null> {
  for (const url of pagedVariants(source.url, page)) {
    try {
      const res = await fetchWithTimeout(url, { timeout: FEED_TIMEOUT_MS });
      if (!res.ok) continue;
      const parsed = parseFeed(source, await res.text());
      if (parsed.length > 0) return deduplicateArticles(parsed);
    } catch {
      // try the next variant
    }
  }
  return null;
}

/**
 * Fetch articles from anywhere in a source's history rather than just its
 * latest feed page. Strategy, best-first:
 *  1. live index: WordPress REST X-WP-TotalPages, probed once and cached
 *  2. declared `archive` template from the catalog
 *  3. random page in [1, knownDepth] via ?paged=/?page= probing
 *  4. plain feed fetch (recent items), so deep never returns nothing
 */
async function fetchDeepArticles(source: Source): Promise<Article[]> {
  const depths = await getSourceDepths();
  let depth = depths[source.id];

  // Nothing learned yet: ask the site for its exact index once, then cache.
  if (depth === undefined) {
    const discovered = await probeWpTotalPages(source);
    if (discovered !== null) {
      depth = discovered;
      await rememberSourceDepth(source.id, discovered);
    } else {
      await rememberNoIndex(source.id);
    }
  }

  // Static depth from the catalog: only for sources NOT flagged for live
  // discovery (non-WP sites where no index exists).
  if ((!depth || depth <= 0) && source.archive && !source.archive.wpTotalPages && source.archive.maxPages) {
    const page = 1 + Math.floor(Math.random() * source.archive.maxPages);
    const url = source.archive.template.replace('{n}', String(page));
    try {
      const res = await fetchWithTimeout(url, { timeout: FEED_TIMEOUT_MS });
      if (res.ok) {
        const parsed = deduplicateArticles(parseFeed(source, await res.text()));
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // fall through to the heuristic below
    }
  }

  const effective = depth && depth > 0 ? depth : DEEP_DEFAULT_DEPTH;
  const page = 1 + Math.floor(Math.random() * effective);

  if (page > 1) {
    const paged = await fetchPagedArticles(source, page);
    if (paged && paged.length > 0) return paged;
    // Page beyond the site's real max: shrink what we believe so future
    // deep rolls land inside the archive instead of past it.
    await rememberSourceDepth(source.id, Math.max(2, page - 1));
  }

  return fetchSource(source);
}

/**
 * Live deep roll: pick a weighted-random enabled source, pull from somewhere
 * inside its history, filter, and return one article. Tries a handful of
 * sources before giving up (caller then falls back to the pool path).
 */
export async function fetchDeepRandomArticle(settings: Settings): Promise<Article | null> {
  const catalog = await getCatalog();
  const sources = getEnabledSources(catalog);
  if (sources.length === 0) return null;

  const starredMap = await getStarredMap();
  const readHistory = await getReadHistory();
  const readIds = new Set(readHistory.map((h) => h.id));
  const history = await getRollHistory();
  const tried = new Set<string>();
  const blockedDomains = normalizeBlockedDomains(catalog?.blockedDomains ?? []);

  for (let attempt = 0; attempt < DEEP_MAX_ATTEMPTS && tried.size < sources.length; attempt++) {
    const remaining = sources.filter((s) => !tried.has(s.id));
    if (remaining.length === 0) break;
    const source = pickWeighted(remaining, (s) => sourceDiversityWeight(s.id, history));
    if (!source) break;
    tried.add(source.id);

    const articles = await fetchDeepArticles(source);
    if (articles.length === 0) continue;

    const candidates = articles.map((a) => ({
      ...a,
      read: readIds.has(a.id),
      starred: Boolean(starredMap[a.id]),
    }));
    const filtered = filterArticles(candidates, settings, catalog, blockedDomains);
    const found = await pickScoredArticle(filtered, catalog, history, settings.explorerMode);
    if (!found) continue;
    return found;
  }

  return null;
}

// ─── Random selection ─────────────────────────────────────────────────────────

/**
 * Shared article-selection tail for all three pick paths (pooled, on-demand,
 * deep): assemble the scoring context from stores, run the mixture-model
 * pick, resolve sitemap titles. Returns null for an empty filtered list.
 */
async function pickScoredArticle(
  filtered: Article[],
  catalog: Catalog | null,
  rollHistory: string[],
  explorerMode: boolean,
): Promise<Article | null> {
  if (filtered.length === 0) return null;
  const [readHistory, starredMap, stats] = await Promise.all([getReadHistory(), getStarredMap(), getRollStats()]);
  const tagBySource: Record<string, string[]> = {};
  for (const source of catalog?.sources ?? []) tagBySource[source.id] = source.tags ?? [];
  const ctx: ScoringContext = makeScoringContext({
    tagBySource,
    recentSourceIds: rollHistory,
    sourceCounts: stats.sourceCounts,
    reads: readHistory,
    stars: Object.values(starredMap),
  });
  const pick = pickScored(filtered, ctx, Math.random, presetFor(explorerMode));
  if (!pick) return null;
  return resolveArticleTitle(pick.article);
}

/**
 * Live, on-demand random article: pick a weighted-random enabled source, fetch
 * just its feed, and return a matching article. Retries up to a handful of
 * random sources when a feed fails or yields nothing that passes the filters,
 * so a stale or empty pool never blocks a fresh result.
 *
 * Uses the same diversity weighting as pooled rolls so live picks don't
 * hammer recently-seen sources.
 */
export async function fetchRandomArticles(settings: Settings): Promise<Article | null> {
  const catalog = await getCatalog();
  const sources = getEnabledSources(catalog);
  if (sources.length === 0) return null;

  const starredMap = await getStarredMap();
  const readHistory = await getReadHistory();
  const readIds = new Set(readHistory.map((h) => h.id));
  const history = await getRollHistory();
  const tried = new Set<string>();

  // Pre-normalize blocked domains once for all filter calls in this loop.
  const blockedDomains = normalizeBlockedDomains(catalog?.blockedDomains ?? []);

  for (let attempt = 0; attempt < MAX_ON_DEMAND_ATTEMPTS && tried.size < sources.length; attempt++) {
    const remaining = sources.filter((s) => !tried.has(s.id));
    if (remaining.length === 0) break;
    const source = pickWeighted(remaining, (s) => sourceDiversityWeight(s.id, history));
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
    const found = await pickScoredArticle(filtered, catalog, history, settings.explorerMode);
    if (!found) continue;
    return found;
  }

  return null;
}

export async function getRandomArticle(settings?: Settings): Promise<Article | null> {
  const opts = settings ?? (await getSettings());

  // Deep mode: reach into a random source's history instead of the stored pool.
  if ((opts.discoveryMode ?? 'recent') === 'deep') {
    const deep = await fetchDeepRandomArticle(opts);
    if (deep) return deep;
    // Deep failed everywhere; fall through to the pool so the user still gets an article.
  }

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
      const found = await pickScoredArticle(filtered, catalog, history, opts.explorerMode);
      if (found) return found;
    }
  }

  return fetchRandomArticles(opts);
}

// ─── Read & starred state ─────────────────────────────────────────────────────

export async function getReadHistory(): Promise<HistoryEntry[]> {
  return loadStore(STORAGE_KEYS.READ_HISTORY, HistoryListSchema, []);
}

export async function addReadHistory(entry: HistoryEntry): Promise<void> {
  await updateStore(STORAGE_KEYS.READ_HISTORY, HistoryListSchema, [], (history) =>
    [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, HISTORY_CAP),
  );
}

export async function getStarredMap(): Promise<StarredMap> {
  return loadStore(STORAGE_KEYS.STARRED, StarredMapSchema, {});
}

async function setStarredInStore(article: Article, starred: boolean): Promise<void> {
  await updateStore(STORAGE_KEYS.STARRED, StarredMapSchema, {}, (map) => {
    if (!starred) {
      const next = { ...map };
      delete next[article.id];
      return next;
    }
    return {
      ...map,
      [article.id]: {
        id: article.id,
        url: article.url,
        title: article.title,
        sourceId: article.sourceId,
      },
    };
  });
}

export async function markArticleRead(article: Article): Promise<void> {
  await patchArticle(article.id, { read: true });

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
    await patchArticle(article.id, { starred: next });
  }
  await setStarredInStore(article, next);
  return next;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function clearOldArticles(maxAgeDays = 90): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * DAY_MS;
  await updateStore(STORAGE_KEYS.ARTICLES, ArticlesSchema, [], (articles) =>
    articles.filter((a) => a.fetchedAt > cutoff || a.starred),
  );
}
