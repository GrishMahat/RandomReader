import type { Article, Catalog, Settings, Source } from '../models';
import { parseFeed } from '../providers';
import { fetchWithTimeout, getErrorMessage, hostnameOf, normalizeDomain, extractPageTitle } from '../utils';
import { getCatalog, getEnabledSources, getSettings, setActiveCatalog } from './catalog';
import { addReadHistory, getStarredMap, setStarred as setStarredInStore } from './storage';

const ARTICLES_KEY = 'articles';
const TITLE_CACHE_KEY = 'titleCache';
const ROLL_STATS_KEY = 'rollStats';
const ROLL_HISTORY_KEY = 'rollHistory';
const ROLL_HISTORY_LENGTH = 10;
const MAX_ON_DEMAND_ATTEMPTS = 8;
const BATCH_CONCURRENCY = 4;
const TITLE_CACHE_MAX = 5000;
const POOL_CAP_BYTES = 7 * 1024 * 1024;

export async function getArticles(): Promise<Article[]> {
  const result = await chrome.storage.local.get(ARTICLES_KEY) as Record<string, unknown>;
  return (result[ARTICLES_KEY] as Article[]) || [];
}

async function setArticles(articles: Article[]): Promise<void> {
  await chrome.storage.local.set({ [ARTICLES_KEY]: articles });
}

function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

async function getTitleCache(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(TITLE_CACHE_KEY) as Record<string, unknown>;
  return (result[TITLE_CACHE_KEY] as Record<string, string>) || {};
}

async function cacheTitle(id: string, title: string): Promise<void> {
  const cache = await getTitleCache();
  cache[id] = title;
  const ids = Object.keys(cache);
  if (ids.length > TITLE_CACHE_MAX) {
    for (const k of ids.slice(0, ids.length - TITLE_CACHE_MAX)) delete cache[k];
  }
  await chrome.storage.local.set({ [TITLE_CACHE_KEY]: cache });
}

/** Fetch a real <title> for generic sitemap entries and persist it (cache + pool). */
export async function resolveArticleTitle(article: Article): Promise<Article> {
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

    const articles = await getArticles();
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

/** Keep the stored pool under chrome.storage.local quota by dropping the oldest
 *  non-starred articles first, newest kept. */
function enforcePoolCap(articles: Article[]): Article[] {
  const size = (a: Article): number => a.title.length + a.url.length + (a.author?.length ?? 0) + 48;
  const total = articles.reduce((acc, a) => acc + size(a), 0);
  if (total <= POOL_CAP_BYTES) return articles;

  const starred = articles.filter((a) => a.starred);
  const nonStarred = articles
    .filter((a) => !a.starred)
    .sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0));

  const keep = new Set<Article>(starred);
  let acc = starred.reduce((sum, a) => sum + size(a), 0);
  for (const a of nonStarred) {
    if (acc + size(a) > POOL_CAP_BYTES) break;
    keep.add(a);
    acc += size(a);
  }
  return [...keep];
}

export async function fetchSource(source: Source): Promise<Article[]> {
  const urls = [...new Set([source.url, ...(source.feeds ?? [])])];
  try {
    const responses = await Promise.all(urls.map((url) => fetchWithTimeout(url, { timeout: 15000 })));
    const okResponses = responses.filter((r) => r.ok);
    if (okResponses.length === 0) {
      throw new Error(`HTTP ${responses[0]?.status ?? 'failed'}`);
    }
    const xmls = await Promise.all(okResponses.map((r) => r.text()));
    const parsed = xmls.map((xml) => parseFeed(source, xml));
    return deduplicateArticles(parsed.flat());
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, getErrorMessage(error));
    return [];
  }
}

/**
 * Pure filter over an article list, mirroring the user's selection settings.
 * `selectionMode: 'unread_only'` only filters out already-read items when the
 * caller provides read flags; on-demand fetches treat fresh items as unread.
 */
function filterArticles(articles: Article[], settings: Settings, catalog: Catalog | null): Article[] {
  let result = articles;

  const maxAgeDays = settings.maxAgeDays ?? 0;
  if (maxAgeDays > 0) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    result = result.filter((a) => (a.publishedAt || a.fetchedAt) >= cutoff);
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

  const blockedDomains = catalog?.blockedDomains ?? [];
  if (blockedDomains.length > 0) {
    const normalized = [...new Set(blockedDomains.map(normalizeDomain).filter(Boolean))];
    result = result.filter((a) => {
      const host = hostnameOf(a.url);
      return !normalized.some((d) => host === d || host.endsWith(`.${d}`));
    });
  }

  return result;
}

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

  const selectionMode = settings.selectionMode ?? 'unread_only';
  const starredMap = await getStarredMap();
  const history = await getRollHistory();
  const tried = new Set<string>();

  for (let attempt = 0; attempt < MAX_ON_DEMAND_ATTEMPTS && tried.size < sources.length; attempt++) {
    const remaining = sources.filter((s) => !tried.has(s.id));
    if (remaining.length === 0) break;
    const source = pickWeighted(remaining, (s) => sourceWeight(s.id, history));
    if (!source) break;
    tried.add(source.id);

    const articles = await fetchSource(source);
    if (articles.length === 0) continue;

    const candidates = articles.map((a) =>
      selectionMode === 'starred_only' ? { ...a, starred: Boolean(starredMap[a.id]) } : a,
    );
    const filtered = filterArticles(
      candidates,
      { ...settings, selectionMode: selectionMode === 'starred_only' ? 'starred_only' : 'all' },
      catalog,
    );
    if (filtered.length === 0) continue;

    const picked = filtered[Math.floor(Math.random() * filtered.length)];
    return resolveArticleTitle(picked);
  }

  return null;
}

export interface BatchResult {
  fetched: number;
  added: number;
}

// ─── Source diversity & roll tracking ───────────────────────────────────────

export async function getRollHistory(): Promise<string[]> {
  const result = await chrome.storage.local.get(ROLL_HISTORY_KEY) as Record<string, unknown>;
  return (result[ROLL_HISTORY_KEY] as string[]) || [];
}

export interface RollStats {
  streak: number;
  previousSourceId: string | null;
}

/** Record a rolled source and return the consecutive same-source streak. */
export async function recordRoll(sourceId: string): Promise<RollStats> {
  const result = await chrome.storage.local.get(ROLL_STATS_KEY) as Record<string, unknown>;
  const stats = result[ROLL_STATS_KEY] as { lastSourceId?: string; streak?: number } | undefined;
  const streak = stats?.lastSourceId === sourceId ? (stats.streak ?? 1) + 1 : 1;
  await chrome.storage.local.set({ [ROLL_STATS_KEY]: { lastSourceId: sourceId, streak } });

  const history = await getRollHistory();
  await chrome.storage.local.set({ [ROLL_HISTORY_KEY]: [sourceId, ...history].slice(0, ROLL_HISTORY_LENGTH) });
  return { streak, previousSourceId: stats?.lastSourceId ?? null };
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

/**
 * Refresh a random slice of the catalog instead of every source: fast, no
 * two-minute stalls, and the whole catalog is covered over successive cycles.
 */
export async function refreshRandomBatch(size = 10): Promise<BatchResult> {
  const catalog = await getCatalog();
  if (!catalog) return { fetched: 0, added: 0 };

  const enabled = catalog.sources.filter((s) => s.enabled);
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

  return { fetched, added: 0 };
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
      const filtered = filterArticles(flagged, opts, catalog);
      if (filtered.length > 0) {
        const picked = pickWeighted(filtered, (a) => sourceWeight(a.sourceId, history));
        if (picked) return resolveArticleTitle(picked);
      }
    }
  }

  return fetchRandomArticles(opts);
}

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

export async function clearOldArticles(maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<void> {
  const articles = await getArticles();
  const cutoff = Date.now() - maxAge;
  const filtered = articles.filter((a) => a.fetchedAt > cutoff || a.starred);
  await setArticles(filtered);
}
