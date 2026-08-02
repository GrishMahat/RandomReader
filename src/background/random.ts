import type { Article, Settings } from '../models';
import { getRandomArticle, markArticleRead } from './feeds';

export async function handleOpenRandom(settings: Settings): Promise<{ success: boolean; article?: Article; error?: string }> {
  const article = await getRandomArticle(settings);
  if (!article) {
    return { success: false, error: 'No articles match your filters. Try refreshing feeds or adjusting filters in Settings.' };
  }

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
    await markArticleRead(article.id);
    return { success: true, article };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to open tab' };
  }
}

export async function handleGetRandom(settings: Settings): Promise<{ success: boolean; article?: Article; error?: string }> {
  const article = await getRandomArticle(settings);
  if (!article) {
    return { success: false, error: 'No articles available' };
  }
  return { success: true, article };
}