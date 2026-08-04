import type { Article, Settings } from '../models';
import { getCatalog } from './catalog';
import { getRandomArticle, markArticleRead, recordRoll } from './feeds';

export async function handleOpenRandom(settings: Settings): Promise<{
  success: boolean;
  article?: Article;
  streak?: number;
  odds?: number;
  sourceName?: string;
  error?: string;
}> {
  const article = await getRandomArticle(settings);
  if (!article) {
    return {
      success: false,
      error: 'No articles match your filters. Try refreshing feeds or adjusting filters in Settings.',
    };
  }

  const catalog = await getCatalog();
  const sourceName = catalog?.sources.find((s) => s.id === article.sourceId)?.name;
  const roll = await recordRoll(article.sourceId);
  const enabledCount = Math.max((catalog?.sources ?? []).filter((s) => s.enabled).length, 1);
  const streak = roll.streak;
  const odds = streak > 1 ? Math.round(enabledCount ** (streak - 1)) : 1;

  try {
    if (settings.openIn === 'new_tab') {
      await chrome.tabs.create({ url: article.url, active: true });
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) {
        await chrome.tabs.update(tab.id, { url: article.url });
      } else {
        await chrome.tabs.create({ url: article.url, active: true });
      }
    }
    await markArticleRead(article);
    return { success: true, article, streak, odds, sourceName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to open tab' };
  }
}

export async function handleGetRandom(
  settings: Settings,
): Promise<{ success: boolean; article?: Article; error?: string }> {
  const article = await getRandomArticle(settings);
  if (!article) {
    return { success: false, error: 'No articles available' };
  }
  return { success: true, article };
}
