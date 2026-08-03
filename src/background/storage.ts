import type { Article, HistoryEntry, StarredMap } from '../models';

const HISTORY_KEY = 'readHistory';
const STARRED_KEY = 'starred';
const HISTORY_CAP = 200;

export async function getReadHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY) as Record<string, unknown>;
  return (result[HISTORY_KEY] as HistoryEntry[]) || [];
}

export async function addReadHistory(entry: HistoryEntry): Promise<void> {
  const history = await getReadHistory();
  const next = [entry, ...history.filter((h) => h.id !== entry.id)];
  await chrome.storage.local.set({ [HISTORY_KEY]: next.slice(0, HISTORY_CAP) });
}

export async function getStarredMap(): Promise<StarredMap> {
  const result = await chrome.storage.local.get(STARRED_KEY) as Record<string, unknown>;
  return (result[STARRED_KEY] as StarredMap) || {};
}

export async function setStarred(article: Article, starred: boolean): Promise<void> {
  const map = await getStarredMap();
  if (starred) {
    map[article.id] = article;
  } else {
    delete map[article.id];
  }
  await chrome.storage.local.set({ [STARRED_KEY]: map });
}
