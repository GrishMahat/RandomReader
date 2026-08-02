import type { Article, Source } from '../models';

const CACHE_KEY = 'cache';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

type CacheStore = Record<string, CacheEntry<unknown>>;

async function getCacheStore(): Promise<CacheStore> {
  const result = await chrome.storage.local.get(CACHE_KEY) as Record<string, unknown>;
  return (result[CACHE_KEY] as CacheStore) || {};
}

export async function getCache<T>(key: string): Promise<T | null> {
  const cache = await getCacheStore();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
    await deleteCache(key);
    return null;
  }
  return entry.data as T;
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  const cache = await getCacheStore();
  cache[key] = { data, timestamp: Date.now() };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function deleteCache(key: string): Promise<void> {
  const cache = await getCacheStore();
  delete cache[key];
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}

export async function getCachedCatalog(): Promise<Source[] | null> {
  return getCache<Source[]>('catalog:sources');
}

export async function setCachedCatalog(sources: Source[]): Promise<void> {
  await setCache('catalog:sources', sources);
}

export async function getCachedArticles(): Promise<Article[] | null> {
  return getCache<Article[]>('articles:all');
}

export async function setCachedArticles(articles: Article[]): Promise<void> {
  await setCache('articles:all', articles);
}