import type { Source, Article, Settings } from '../models';
import { parseFeed } from '../providers';
import { fetchWithTimeout, getErrorMessage } from '../utils';
import { getCatalog, getEnabledSources } from './catalog';

const ARTICLES_KEY = 'articles';

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

export async function fetchSource(source: Source): Promise<Article[]> {
  try {
    const response = await fetchWithTimeout(source.url, { timeout: 15000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return parseFeed(source, xml);
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, getErrorMessage(error));
    return [];
  }
}

export async function refreshFeeds(): Promise<number> {
  const catalog = await getCatalog();
  const sources = getEnabledSources(catalog);
  let totalNew = 0;

  const existingArticles = await getArticles();
  const newArticles: Article[] = [];

  for (const source of sources) {
    const articles = await fetchSource(source);
    if (articles.length > 0) {
      newArticles.push(...articles);
      totalNew += articles.length;
    }
  }

  if (newArticles.length > 0) {
    const combined = [...existingArticles, ...newArticles];
    const deduped = deduplicateArticles(combined);
    await setArticles(deduped);
  }

  return totalNew;
}

export async function getRandomArticle(settings?: Settings): Promise<Article | null> {
  let articles = await getArticles();
  if (articles.length === 0) return null;

  const includeTags = settings?.includeTags ?? [];
  const excludeTags = settings?.excludeTags ?? [];
  const selectionMode = settings?.selectionMode ?? 'unread_only';
  const maxAgeDays = settings?.maxAgeDays ?? 0;
  const keywordsInclude = settings?.keywordsInclude ?? [];
  const keywordsExclude = settings?.keywordsExclude ?? [];

  // Filter by Max Age
  if (maxAgeDays > 0) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    articles = articles.filter((a) => (a.publishedAt || a.fetchedAt) >= cutoff);
  }

  // Filter by Starred / Read selection mode
  if (selectionMode === 'starred_only') {
    articles = articles.filter((a) => a.starred);
  } else if (selectionMode === 'unread_only') {
    const unread = articles.filter((a) => !a.read);
    if (unread.length > 0) {
      articles = unread;
    }
  }

  // Filter by Keywords in title / summary
  if (keywordsInclude.length > 0) {
    articles = articles.filter((a) => {
      const text = `${a.title} ${a.summary || ''}`.toLowerCase();
      return keywordsInclude.some((kw: string) => text.includes(kw.toLowerCase()));
    });
  }

  if (keywordsExclude.length > 0) {
    articles = articles.filter((a) => {
      const text = `${a.title} ${a.summary || ''}`.toLowerCase();
      return !keywordsExclude.some((kw: string) => text.includes(kw.toLowerCase()));
    });
  }

  // Filter by Tags
  if (includeTags.length > 0 || excludeTags.length > 0) {
    const catalog = await getCatalog();
    const tagBySource = new Map<string, string[]>();
    for (const source of catalog?.sources ?? []) {
      tagBySource.set(source.id, source.tags ?? []);
    }

    articles = articles.filter((article) => {
      const tags = tagBySource.get(article.sourceId) ?? [];
      if (excludeTags.length > 0 && tags.some((tag) => excludeTags.includes(tag))) {
        return false;
      }
      if (includeTags.length > 0 && !tags.some((tag) => includeTags.includes(tag))) {
        return false;
      }
      return true;
    });
  }

  if (articles.length === 0) return null;
  return articles[Math.floor(Math.random() * articles.length)];
}

export async function markArticleRead(id: string): Promise<void> {
  const articles = await getArticles();
  const idx = articles.findIndex((a) => a.id === id);
  if (idx >= 0) {
    articles[idx] = { ...articles[idx], read: true };
    await setArticles(articles);
  }
}

export async function toggleStarred(id: string): Promise<void> {
  const articles = await getArticles();
  const idx = articles.findIndex((a) => a.id === id);
  if (idx >= 0) {
    articles[idx] = { ...articles[idx], starred: !articles[idx].starred };
    await setArticles(articles);
  }
}

export async function clearOldArticles(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  const articles = await getArticles();
  const cutoff = Date.now() - maxAge;
  const filtered = articles.filter((a) => a.fetchedAt > cutoff || a.starred);
  await setArticles(filtered);
}