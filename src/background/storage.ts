import type { Article, HistoryEntry, StarredMap } from '../models';
import { STORAGE_KEYS } from '../models';

const HISTORY_CAP = 200;

export async function getReadHistory(): Promise<HistoryEntry[]> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.READ_HISTORY)) as Record<string, unknown>;
  return (result[STORAGE_KEYS.READ_HISTORY] as HistoryEntry[]) || [];
}

export async function addReadHistory(entry: HistoryEntry): Promise<void> {
  const history = await getReadHistory();
  const next = [entry, ...history.filter((h) => h.id !== entry.id)];
  await chrome.storage.local.set({ [STORAGE_KEYS.READ_HISTORY]: next.slice(0, HISTORY_CAP) });
}

export async function getStarredMap(): Promise<StarredMap> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.STARRED)) as Record<string, unknown>;
  return (result[STORAGE_KEYS.STARRED] as StarredMap) || {};
}

export async function setStarred(article: Article, starred: boolean): Promise<void> {
  const map = await getStarredMap();
  if (starred) {
    map[article.id] = {
      id: article.id,
      url: article.url,
      title: article.title,
      sourceId: article.sourceId,
    };
  } else {
    delete map[article.id];
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.STARRED]: map });
}
